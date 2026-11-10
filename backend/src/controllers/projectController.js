import Project from "../models/Project.js";
import Milestone from "../models/Milestone.js";
import User from "../models/User.js";

export const createProject = async (req, res) => {
  try {
    const { title, description, budget, currency, deadline } = req.body;

    if (!title || !description || !budget || !deadline) {
      return res.status(400).json({ success: false, error: "Title, description, budget and deadline are required" });
    }

    if (budget <= 0) {
      return res.status(400).json({ success: false, error: "Budget must be greater than 0" });
    }

    const project = await Project.create({
      title,
      description,
      budget,
      currency: currency || "USD",
      deadline: new Date(deadline),
      clientId: req.user._id,
      status: "DRAFT",
    });

    res.status(201).json({
      success: true,
      data: { project },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to create project" });
  }
};

export const getMyProjects = async (req, res) => {
  try {
    const filter =
      req.user.role === "client"
        ? { clientId: req.user._id }
        : { freelancerId: req.user._id };

    const projects = await Project.find(filter)
      .populate("clientId", "name email")
      .populate("freelancerId", "name email")
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      data: { projects },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch projects" });
  }
};

export const getProjectById = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId)
      .populate("clientId", "name email")
      .populate("freelancerId", "name email");

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    const isOwner =
      project.clientId._id.toString() === req.user._id.toString() ||
      (project.freelancerId &&
        project.freelancerId._id.toString() === req.user._id.toString());

    if (!isOwner) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    res.json({
      success: true,
      data: { project },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch project" });
  }
};

export const updateProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can update this project" });
    }

    if (project.status !== "DRAFT") {
      return res.status(400).json({ success: false, error: "Can only update projects in DRAFT status" });
    }

    const { title, description, budget, currency, deadline } = req.body;
    if (title) project.title = title;
    if (description) project.description = description;
    if (budget) project.budget = budget;
    if (currency) project.currency = currency;
    if (deadline) project.deadline = new Date(deadline);

    await project.save();

    res.json({
      success: true,
      data: { project },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to update project" });
  }
};

export const cancelProject = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can cancel this project" });
    }

    if (project.status === "COMPLETED" || project.status === "CANCELLED") {
      return res.status(400).json({ success: false, error: "Project is already " + project.status.toLowerCase() });
    }

    project.status = "CANCELLED";
    await project.save();

    res.json({
      success: true,
      data: { project },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to cancel project" });
  }
};

export const assignFreelancer = async (req, res) => {
  try {
    const { freelancerId } = req.body;

    if (!freelancerId) {
      return res.status(400).json({ success: false, error: "Freelancer ID is required" });
    }

    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can assign a freelancer" });
    }

    if (project.status !== "DRAFT") {
      return res.status(400).json({ success: false, error: "Can only assign freelancer to DRAFT projects" });
    }

    const freelancer = await User.findById(freelancerId);
    if (!freelancer || freelancer.role !== "freelancer") {
      return res.status(400).json({ success: false, error: "Invalid freelancer" });
    }

    project.freelancerId = freelancerId;
    project.status = "AGREEMENT_PENDING";
    await project.save();

    res.json({
      success: true,
      data: { project },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to assign freelancer" });
  }
};

export const acceptAgreement = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.status !== "AGREEMENT_PENDING") {
      return res.status(400).json({ success: false, error: "Project is not pending agreement" });
    }

    const userId = req.user._id.toString();
    const isClient = project.clientId.toString() === userId;
    const isFreelancer =
      project.freelancerId && project.freelancerId.toString() === userId;

    if (!isClient && !isFreelancer) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    if (isClient) project.agreement.clientAccepted = true;
    if (isFreelancer) project.agreement.freelancerAccepted = true;

    if (project.agreement.clientAccepted && project.agreement.freelancerAccepted) {
      project.status = "ACTIVE";
      project.agreement.acceptedAt = new Date();
    }

    await project.save();

    res.json({
      success: true,
      data: { project },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to accept agreement" });
  }
};

export const rejectAgreement = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);

    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.status !== "AGREEMENT_PENDING") {
      return res.status(400).json({ success: false, error: "Project is not pending agreement" });
    }

    const userId = req.user._id.toString();
    const isClient = project.clientId.toString() === userId;
    const isFreelancer =
      project.freelancerId && project.freelancerId.toString() === userId;

    if (!isClient && !isFreelancer) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    project.status = "DRAFT";
    project.freelancerId = null;
    project.agreement.clientAccepted = false;
    project.agreement.freelancerAccepted = false;
    project.agreement.acceptedAt = null;
    await project.save();

    res.json({
      success: true,
      data: { project },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to reject agreement" });
  }
};

export const getFreelancers = async (req, res) => {
  try {
    const freelancers = await User.find({ role: "freelancer" }).select(
      "name email profile"
    );

    res.json({
      success: true,
      data: { freelancers },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch freelancers" });
  }
};
