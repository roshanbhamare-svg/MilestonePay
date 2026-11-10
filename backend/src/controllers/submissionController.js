import Submission from "../models/Submission.js";
import Milestone from "../models/Milestone.js";
import Project from "../models/Project.js";

export const submitWork = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    if (!project.freelancerId || project.freelancerId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the assigned freelancer can submit work" });
    }

    const validStatuses = ["IN_PROGRESS", "CHANGES_REQUESTED"];
    if (!validStatuses.includes(milestone.status)) {
      return res.status(400).json({
        success: false,
        error: `Cannot submit work for milestone in ${milestone.status} status`,
      });
    }

    const { githubUrl, files, notes } = req.body;

    if (!githubUrl && (!files || files.length === 0) && !notes) {
      return res.status(400).json({ success: false, error: "At least one deliverable is required" });
    }

    const previousSubmissions = await Submission.find({ milestoneId: milestone._id });
    const version = previousSubmissions.length + 1;

    const submission = await Submission.create({
      milestoneId: milestone._id,
      submittedBy: req.user._id,
      githubUrl: githubUrl || "",
      files: files || [],
      notes: notes || "",
      version,
    });

    if (milestone.status === "CHANGES_REQUESTED") {
      milestone.status = "RESUBMITTED";
    } else {
      milestone.status = "SUBMITTED";
    }
    await milestone.save();

    res.status(201).json({
      success: true,
      data: { submission },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to submit work" });
  }
};

export const getSubmissions = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    const userId = req.user._id.toString();
    const isOwner =
      project.clientId.toString() === userId ||
      (project.freelancerId && project.freelancerId.toString() === userId);

    if (!isOwner) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const submissions = await Submission.find({ milestoneId: milestone._id })
      .populate("submittedBy", "name email")
      .sort({ version: -1 });

    res.json({
      success: true,
      data: { submissions },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch submissions" });
  }
};

export const getSubmissionById = async (req, res) => {
  try {
    const submission = await Submission.findById(req.params.submissionId)
      .populate("submittedBy", "name email");

    if (!submission) {
      return res.status(404).json({ success: false, error: "Submission not found" });
    }

    const milestone = await Milestone.findById(submission.milestoneId);
    const project = await Project.findById(milestone.projectId);
    const userId = req.user._id.toString();

    const isOwner =
      project.clientId.toString() === userId ||
      (project.freelancerId && project.freelancerId.toString() === userId);

    if (!isOwner) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    res.json({
      success: true,
      data: { submission },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch submission" });
  }
};
