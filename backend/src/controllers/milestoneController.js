import Milestone from "../models/Milestone.js";
import Project from "../models/Project.js";

export const createMilestone = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can add milestones" });
    }

    if (project.status !== "DRAFT" && project.status !== "AGREEMENT_PENDING") {
      return res.status(400).json({ success: false, error: "Cannot add milestones to an active or completed project" });
    }

    const { title, description, paymentAmount, deadline, deliverables, acceptanceCriteria } = req.body;

    if (!title || !description || paymentAmount === undefined || !deadline) {
      return res.status(400).json({ success: false, error: "Title, description, payment amount and deadline are required" });
    }

    const existingMilestones = await Milestone.find({ projectId: project._id });
    const currentTotal = existingMilestones.reduce((sum, m) => sum + m.paymentAmount, 0);

    if (currentTotal + paymentAmount > project.budget) {
      return res.status(400).json({
        success: false,
        error: `Total milestone amount (${currentTotal + paymentAmount}) exceeds project budget (${project.budget})`,
      });
    }

    const milestone = await Milestone.create({
      projectId: project._id,
      title,
      description,
      paymentAmount,
      deadline: new Date(deadline),
      deliverables: deliverables || [],
      acceptanceCriteria: acceptanceCriteria || [],
      order: existingMilestones.length + 1,
    });

    res.status(201).json({
      success: true,
      data: { milestone },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to create milestone" });
  }
};

export const createBulkMilestones = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can add milestones" });
    }

    const { milestones } = req.body;
    if (!milestones || !Array.isArray(milestones) || milestones.length === 0) {
      return res.status(400).json({ success: false, error: "Milestones array is required" });
    }

    const total = milestones.reduce((sum, m) => sum + (m.paymentAmount || 0), 0);
    if (Math.abs(total - project.budget) > 0.01) {
      return res.status(400).json({
        success: false,
        error: `Milestone total (${total}) must equal project budget (${project.budget})`,
      });
    }

    await Milestone.deleteMany({ projectId: project._id });

    const created = await Milestone.insertMany(
      milestones.map((m, i) => ({
        projectId: project._id,
        title: m.title,
        description: m.description || "",
        paymentAmount: m.paymentAmount,
        deadline: new Date(m.deadline),
        deliverables: m.deliverables || [],
        acceptanceCriteria: m.acceptanceCriteria || [],
        order: i + 1,
      }))
    );

    res.status(201).json({
      success: true,
      data: { milestones: created },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to create milestones" });
  }
};

export const getProjectMilestones = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const userId = req.user._id.toString();
    const isOwner =
      project.clientId.toString() === userId ||
      (project.freelancerId && project.freelancerId.toString() === userId);

    if (!isOwner) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const milestones = await Milestone.find({ projectId: project._id }).sort({ order: 1 });

    res.json({
      success: true,
      data: { milestones },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch milestones" });
  }
};

export const updateMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can update milestones" });
    }

    if (milestone.status !== "PENDING") {
      return res.status(400).json({ success: false, error: "Can only update milestones in PENDING status" });
    }

    const { title, description, paymentAmount, deadline, deliverables, acceptanceCriteria } = req.body;

    if (paymentAmount !== undefined && paymentAmount !== milestone.paymentAmount) {
      const otherMilestones = await Milestone.find({
        projectId: milestone.projectId,
        _id: { $ne: milestone._id },
      });
      const othersTotal = otherMilestones.reduce((sum, m) => sum + m.paymentAmount, 0);

      if (othersTotal + paymentAmount > project.budget) {
        return res.status(400).json({
          success: false,
          error: `Total would exceed budget (${project.budget})`,
        });
      }
      milestone.paymentAmount = paymentAmount;
    }

    if (title) milestone.title = title;
    if (description) milestone.description = description;
    if (deadline) milestone.deadline = new Date(deadline);
    if (deliverables) milestone.deliverables = deliverables;
    if (acceptanceCriteria) milestone.acceptanceCriteria = acceptanceCriteria;

    await milestone.save();

    res.json({
      success: true,
      data: { milestone },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to update milestone" });
  }
};

export const updateMilestoneStatus = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    const userId = req.user._id.toString();
    const isClient = project.clientId.toString() === userId;
    const isFreelancer =
      project.freelancerId && project.freelancerId.toString() === userId;

    if (!isClient && !isFreelancer) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const { status } = req.body;

    const allowedTransitions = {
      PENDING: ["IN_PROGRESS"],
      IN_PROGRESS: ["SUBMITTED"],
      SUBMITTED: ["UNDER_REVIEW"],
      UNDER_REVIEW: ["APPROVED", "CHANGES_REQUESTED"],
      CHANGES_REQUESTED: ["RESUBMITTED"],
      RESUBMITTED: ["UNDER_REVIEW"],
      APPROVED: ["PAID"],
    };

    const allowed = allowedTransitions[milestone.status];
    if (!allowed || !allowed.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot transition from ${milestone.status} to ${status}`,
      });
    }

    // freelancers can move to IN_PROGRESS, SUBMITTED, RESUBMITTED
    const freelancerStatuses = ["IN_PROGRESS", "SUBMITTED", "RESUBMITTED"];
    // clients can move to UNDER_REVIEW, APPROVED, CHANGES_REQUESTED
    const clientStatuses = ["UNDER_REVIEW", "APPROVED", "CHANGES_REQUESTED", "PAID"];

    if (isFreelancer && !freelancerStatuses.includes(status)) {
      return res.status(403).json({ success: false, error: "Freelancers cannot set this status" });
    }

    if (isClient && !clientStatuses.includes(status)) {
      return res.status(403).json({ success: false, error: "Clients cannot set this status" });
    }

    milestone.status = status;
    await milestone.save();

    // check if all milestones are paid -> mark project completed
    if (status === "PAID") {
      const allMilestones = await Milestone.find({ projectId: project._id });
      const allPaid = allMilestones.every((m) => m.status === "PAID");
      if (allPaid) {
        project.status = "COMPLETED";
        await project.save();
      }
    }

    res.json({
      success: true,
      data: { milestone },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to update status" });
  }
};

