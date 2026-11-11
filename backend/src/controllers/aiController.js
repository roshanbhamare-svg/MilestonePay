import mongoose from "mongoose";
import Project from "../models/Project.js";
import Milestone from "../models/Milestone.js";
import Submission from "../models/Submission.js";
import AIEvaluation from "../models/AIEvaluation.js";
import { createNotification } from "./notificationController.js";
import { generateMilestonePlan } from "../ai/graphs/milestoneGeneratorGraph.js";
import { evaluateDeliverableSubmission } from "../ai/graphs/deliverableEvaluationGraph.js";
import { askProjectAssistant } from "../ai/graphs/projectAssistantGraph.js";
import { AIConfigError, AIExecutionError } from "../ai/llmClient.js";

function isProjectParticipant(project, userId) {
  const uid = userId.toString();
  return (
    project.clientId.toString() === uid ||
    (project.freelancerId && project.freelancerId.toString() === uid)
  );
}

function handleAIError(res, err, fallbackMessage) {
  if (err instanceof AIConfigError || err instanceof AIExecutionError || err.statusCode) {
    return res.status(err.statusCode || 500).json({
      success: false,
      error: err.message || fallbackMessage,
    });
  }
  console.error("[AI Controller]", fallbackMessage, err?.message || err);
  return res.status(500).json({
    success: false,
    error: fallbackMessage,
  });
}

// Helper functions used by LangGraph workflows and integrations
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
    improvementSuggestions: evaluationData.improvementSuggestions || [],
    recommendations: evaluationData.recommendations || "",
    overallScore: evaluationData.overallScore || 0,
    analysisMetadata: evaluationData.analysisMetadata || undefined,
    status: "COMPLETED",
  });
  return evaluation;
};

/**
 * Unpersisted milestone preview generator for project creation (/projects/new).
 * POST /api/ai/generate-milestones
 */
export const previewMilestonesHandler = async (req, res) => {
  try {
    const { title, description, budget, currency, deadline } = req.body || {};
    const parsedBudget = Number(budget);

    if (!title?.trim() || !description?.trim() || !Number.isFinite(parsedBudget) || parsedBudget <= 0) {
      return res.status(400).json({
        success: false,
        error: "Title, description, and a positive numeric budget are required",
      });
    }

    const result = await generateMilestonePlan({
      title: title.trim(),
      description: description.trim(),
      budget: parsedBudget,
      currency: currency || "USD",
      deadline,
    });

    res.json({
      success: true,
      data: {
        milestones: result.milestones,
        requirementAnalysis: result.requirementAnalysis,
        tasks: result.tasks,
        validation: result.validation,
        persisted: false,
      },
    });
  } catch (err) {
    return handleAIError(res, err, "Failed to generate AI milestones preview");
  }
};

/**
 * Generate milestones for an existing project via LangGraph.js and optionally persist in MongoDB.
 * POST /api/ai/projects/:projectId/generate-milestones
 */
export const generateMilestonesHandler = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID" });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (project.clientId.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        error: "Only the project client can generate milestones",
      });
    }

    const persist = req.body?.persist !== false;
    if (persist) {
      if (!["DRAFT", "AGREEMENT_PENDING"].includes(project.status)) {
        return res.status(400).json({
          success: false,
          error: `Cannot replace milestones when project status is ${project.status}`,
        });
      }

      const existing = await Milestone.find({ projectId: project._id });
      const hasStartedWork = existing.some((m) => m.status !== "PENDING");
      if (hasStartedWork) {
        return res.status(400).json({
          success: false,
          error: "Cannot overwrite milestones after work has already started",
        });
      }
    }

    const title = req.body?.title?.trim() || project.title;
    const description = req.body?.description?.trim() || project.description;
    const budget = req.body?.budget !== undefined ? Number(req.body.budget) : project.budget;
    const currency = req.body?.currency || project.currency || "USD";
    const deadline = req.body?.deadline || project.deadline;

    if (!Number.isFinite(budget) || budget <= 0) {
      return res.status(400).json({ success: false, error: "Project budget must be positive" });
    }

    const result = await generateMilestonePlan({
      title,
      description,
      budget,
      currency,
      deadline,
    });

    let finalMilestones = result.milestones;

    if (persist) {
      await Milestone.deleteMany({ projectId: project._id });
      finalMilestones = await Milestone.insertMany(
        result.milestones.map((m, idx) => ({
          projectId: project._id,
          title: m.title,
          description: m.description,
          paymentAmount: m.paymentAmount,
          deadline: new Date(m.deadline),
          deliverables: m.deliverables,
          acceptanceCriteria: m.acceptanceCriteria,
          order: idx + 1,
        }))
      );
    }

    res.json({
      success: true,
      data: {
        projectId: project._id,
        milestones: finalMilestones,
        requirementAnalysis: result.requirementAnalysis,
        tasks: result.tasks,
        validation: result.validation,
        persisted: persist,
      },
    });
  } catch (err) {
    return handleAIError(res, err, "Failed to generate milestones");
  }
};

/**
 * Evaluate the latest (or specified) submission for a milestone using LangGraph.js.
 * POST /api/ai/milestones/:milestoneId/evaluate
 */
export const evaluateSubmissionHandler = async (req, res) => {
  try {
    const { milestoneId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(milestoneId)) {
      return res.status(400).json({ success: false, error: "Invalid milestone ID" });
    }

    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (!isProjectParticipant(project, req.user._id)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const requestedSubmissionId = req.body?.submissionId || null;
    if (requestedSubmissionId && !mongoose.Types.ObjectId.isValid(requestedSubmissionId)) {
      return res.status(400).json({ success: false, error: "Invalid submission ID" });
    }

    const submission = requestedSubmissionId
      ? await Submission.findOne({ _id: requestedSubmissionId, milestoneId: milestone._id })
      : await Submission.findOne({ milestoneId: milestone._id }).sort({ version: -1 });

    if (!submission) {
      return res.status(400).json({ success: false, error: "No submission found to evaluate" });
    }

    const { evaluation: reportData, verification } = await evaluateDeliverableSubmission({
      milestoneId: milestone._id,
      submissionId: submission._id,
    });

    const savedEvaluation = await saveAIEvaluation(milestone._id, submission._id, reportData);

    await createNotification({
      userId: project.clientId,
      type: "EVALUATION_COMPLETE",
      title: `AI Evaluation Ready: ${milestone.title}`,
      message: `Submission v${submission.version} scored ${savedEvaluation.overallScore}% across ${savedEvaluation.criteriaResults.length} criteria. Review report before approving.`,
      projectId: project._id,
    });

    res.json({
      success: true,
      data: {
        evaluation: savedEvaluation,
        verification,
      },
    });
  } catch (err) {
    return handleAIError(res, err, "Failed to run AI deliverable evaluation");
  }
};

/**
 * Fetch the latest persisted AI evaluation report for a milestone.
 * GET /api/ai/milestones/:milestoneId/evaluation
 */
export const getEvaluation = async (req, res) => {
  try {
    const { milestoneId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(milestoneId)) {
      return res.status(400).json({ success: false, error: "Invalid milestone ID" });
    }

    const milestone = await Milestone.findById(milestoneId);
    if (!milestone) {
      return res.status(404).json({ success: false, error: "Milestone not found" });
    }

    const project = await Project.findById(milestone.projectId);
    if (!project || !isProjectParticipant(project, req.user._id)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const evaluation = await AIEvaluation.findOne({
      milestoneId: milestone._id,
    }).sort({ createdAt: -1 });

    if (!evaluation) {
      return res.status(404).json({ success: false, error: "No evaluation found" });
    }

    res.json({
      success: true,
      data: { evaluation },
    });
  } catch (err) {
    return handleAIError(res, err, "Failed to fetch evaluation");
  }
};

/**
 * Ask the LangGraph AI Project Assistant about scope, progress, delays, disputes, or escrow.
 * POST /api/ai/projects/:projectId/assistant
 */
export const projectAssistantHandler = async (req, res) => {
  try {
    const { projectId } = req.params;
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ success: false, error: "Invalid project ID" });
    }

    const question = req.body?.question?.trim();
    if (!question) {
      return res.status(400).json({ success: false, error: "A question is required" });
    }
    if (question.length > 1000) {
      return res.status(400).json({
        success: false,
        error: "Question must be 1000 characters or fewer",
      });
    }

    const project = await Project.findById(projectId);
    if (!project) {
      return res.status(404).json({ success: false, error: "Project not found" });
    }

    if (!isProjectParticipant(project, req.user._id)) {
      return res.status(403).json({ success: false, error: "Access denied" });
    }

    const reply = await askProjectAssistant({
      projectId: project._id,
      question,
      userRole: req.user.role,
    });

    res.json({
      success: true,
      data: reply,
    });
  } catch (err) {
    return handleAIError(res, err, "Project assistant failed to answer");
  }
};
