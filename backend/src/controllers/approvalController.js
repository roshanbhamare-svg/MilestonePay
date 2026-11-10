import Milestone from "../models/Milestone.js";
import Submission from "../models/Submission.js";
import Project from "../models/Project.js";

export const approveMilestone = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can approve milestones" });
    }

    if (milestone.status !== "UNDER_REVIEW") {
      return res.status(400).json({
        success: false,
        error: `Cannot approve milestone in ${milestone.status} status`,
      });
    }

    milestone.status = "APPROVED";
    await milestone.save();

    const latestSubmission = await Submission.findOne({ milestoneId: milestone._id })
      .sort({ version: -1 });
    if (latestSubmission) {
      latestSubmission.status = "APPROVED";
      await latestSubmission.save();
    }

    res.json({
      success: true,
      data: { milestone },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to approve milestone" });
  }
};

export const requestChanges = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can request changes" });
    }

    if (milestone.status !== "UNDER_REVIEW") {
      return res.status(400).json({
        success: false,
        error: `Cannot request changes for milestone in ${milestone.status} status`,
      });
    }

    const { reason } = req.body;
    if (!reason) {
      return res.status(400).json({ success: false, error: "Reason is required" });
    }

    milestone.status = "CHANGES_REQUESTED";
    await milestone.save();

    const latestSubmission = await Submission.findOne({ milestoneId: milestone._id })
      .sort({ version: -1 });
    if (latestSubmission) {
      latestSubmission.status = "CHANGES_REQUESTED";
      await latestSubmission.save();
    }

    res.json({
      success: true,
      data: { milestone, reason },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to request changes" });
  }
};

export const startReview = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, error: "Only the client can start reviews" });
    }

    if (milestone.status !== "SUBMITTED" && milestone.status !== "RESUBMITTED") {
      return res.status(400).json({
        success: false,
        error: `Cannot review milestone in ${milestone.status} status`,
      });
    }

    milestone.status = "UNDER_REVIEW";
    await milestone.save();

    const latestSubmission = await Submission.findOne({ milestoneId: milestone._id })
      .sort({ version: -1 });
    if (latestSubmission) {
      latestSubmission.status = "UNDER_REVIEW";
      await latestSubmission.save();
    }

    res.json({
      success: true,
      data: { milestone },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to start review" });
  }
};

