import Project from "../models/Project.js";
import Milestone from "../models/Milestone.js";
import Submission from "../models/Submission.js";
import AIEvaluation from "../models/AIEvaluation.js";

// Helper functions for Member D's LangGraph agents
export const getProjectForAI = async (projectId) => {
  const project = await Project.findById(projectId);
  if (!project) throw new Error("Project not found");
  return {
    projectId: project._id,
    title: project.title,
    description: project.description,
    budget: project.budget,
    currency: project.currency,
    deadline: project.deadline,
  };
};

export const getMilestoneCriteriaForAI = async (milestoneId) => {
  const milestone = await Milestone.findById(milestoneId);
  if (!milestone) throw new Error("Milestone not found");
  return {
    milestoneId: milestone._id,
    projectId: milestone.projectId,
    title: milestone.title,
    description: milestone.description,
    deliverables: milestone.deliverables,
    acceptanceCriteria: milestone.acceptanceCriteria,
  };
};

export const getSubmissionForAI = async (submissionId) => {
  const submission = await Submission.findById(submissionId);
  if (!submission) throw new Error("Submission not found");
  return {
    submissionId: submission._id,
    milestoneId: submission.milestoneId,
    githubUrl: submission.githubUrl,
    files: submission.files,
    notes: submission.notes,
    version: submission.version,
  };
};

export const saveAIEvaluation = async (milestoneId, submissionId, evaluationData) => {
  const evaluation = await AIEvaluation.create({
    milestoneId,
    submissionId,
    criteriaResults: evaluationData.criteriaResults || [],
    completedRequirements: evaluationData.completedRequirements || [],
    missingRequirements: evaluationData.missingRequirements || [],
    recommendations: evaluationData.recommendations || "",
    overallScore: evaluationData.overallScore || 0,
    status: "COMPLETED",
  });
  return evaluation;
};

// Controllers for Member D stubs
export const generateMilestonesHandler = async (req, res) => {
  try {
    const project = await Project.findById(req.params.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    // STUB for Member D
    // Member D will connect LangGraph workflow here.
    // Expected output: array of milestone objects with title, description, paymentAmount, deadline, deliverables, acceptanceCriteria
    res.json({
      success: true,
      data: {
        message: "AI Milestone Generator endpoint ready for LangGraph integration",
        projectId: project._id,
        projectDetails: {
          title: project.title,
          description: project.description,
          budget: project.budget,
          deadline: project.deadline,
        },
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to generate milestones" });
  }
};

export const evaluateSubmissionHandler = async (req, res) => {
  try {
    const milestone = await Milestone.findById(req.params.milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const submission = await Submission.findOne({ milestoneId: milestone._id })
      .sort({ version: -1 });

    if (!submission) {
      return res.status(400).json({ success: false, error: "No submission found to evaluate" });
    }

    // STUB for Member D
    // Member D will connect LangGraph deliverable evaluation agent here.
    res.json({
      success: true,
      data: {
        message: "AI Evaluation endpoint ready for LangGraph integration",
        milestoneId: milestone._id,
        submissionId: submission._id,
        acceptanceCriteria: milestone.acceptanceCriteria,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to run evaluation" });
  }
};

export const getEvaluation = async (req, res) => {
  try {
    const evaluation = await AIEvaluation.findOne({
      milestoneId: req.params.milestoneId,
    }).sort({ createdAt: -1 });

    if (!evaluation) {
      return res.status(404).json({ success: false, error: "No evaluation found" });
    }

    res.json({
      success: true,
      data: { evaluation },
    });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to fetch evaluation" });
  }
};
