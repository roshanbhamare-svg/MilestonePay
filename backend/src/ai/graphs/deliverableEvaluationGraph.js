import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import Milestone from "../../models/Milestone.js";
import Project from "../../models/Project.js";
import Submission from "../../models/Submission.js";
import { getVisionModel, invokeStructured } from "../llmClient.js";
import { DeliverableEvaluationSchema } from "../schemas.js";
import {
  formatSubmissionEvidenceDigest,
  inspectGitHubRepository,
  inspectSubmissionFiles,
} from "../tools/submissionInspector.js";

const EvaluationGraphState = Annotation.Root({
  milestoneId: Annotation({ reducer: (_, next) => next, default: () => "" }),
  submissionId: Annotation({ reducer: (_, next) => next, default: () => null }),

  project: Annotation({ reducer: (_, next) => next, default: () => null }),
  milestone: Annotation({ reducer: (_, next) => next, default: () => null }),
  submission: Annotation({ reducer: (_, next) => next, default: () => null }),
  submissionHistory: Annotation({ reducer: (_, next) => next, default: () => [] }),

  repoInspection: Annotation({ reducer: (_, next) => next, default: () => null }),
  fileInspections: Annotation({ reducer: (_, next) => next, default: () => [] }),
  evidenceDigest: Annotation({ reducer: (_, next) => next, default: () => "" }),

  rawEvaluation: Annotation({ reducer: (_, next) => next, default: () => null }),
  verificationIssues: Annotation({ reducer: (_, next) => next, default: () => [] }),
  verificationPassed: Annotation({ reducer: (_, next) => next, default: () => false }),
  attemptCount: Annotation({ reducer: (_, next) => next, default: () => 0 }),
  evaluationReport: Annotation({ reducer: (_, next) => next, default: () => null }),
});

async function defaultLoadEvaluationContext(milestoneId, submissionId) {
  const milestone = await Milestone.findById(milestoneId).lean();
  if (!milestone) {
    const err = new Error("Milestone not found");
    err.statusCode = 404;
    throw err;
  }

  const project = await Project.findById(milestone.projectId).lean();
  if (!project) {
    const err = new Error("Project not found");
    err.statusCode = 404;
    throw err;
  }

  const history = await Submission.find({ milestoneId: milestone._id })
    .sort({ version: -1 })
    .lean();

  const submission = submissionId
    ? history.find((s) => s._id.toString() === submissionId.toString())
    : history[0];

  if (!submission) {
    const err = new Error("No submission found to evaluate");
    err.statusCode = 400;
    throw err;
  }

  return { project, milestone, submission, submissionHistory: history };
}

function normalizeCriteriaText(text) {
  return String(text || "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

function alignCriteriaResults(expectedCriteria, llmCriteriaResults = []) {
  const usedIndices = new Set();
  const aligned = expectedCriteria.map((expected) => {
    const normExpected = normalizeCriteriaText(expected);
    let matchIdx = llmCriteriaResults.findIndex(
      (item, idx) => !usedIndices.has(idx) && normalizeCriteriaText(item.criteria) === normExpected
    );

    if (matchIdx === -1) {
      matchIdx = llmCriteriaResults.findIndex(
        (item, idx) =>
          !usedIndices.has(idx) &&
          (normalizeCriteriaText(item.criteria).includes(normExpected.slice(0, 24)) ||
            normExpected.includes(normalizeCriteriaText(item.criteria).slice(0, 24)))
      );
    }

    if (matchIdx !== -1) {
      usedIndices.add(matchIdx);
      const matched = llmCriteriaResults[matchIdx];
      return {
        criteria: expected,
        met: Boolean(matched.met),
        comments: String(matched.comments || "").trim() || "Evaluated against submitted evidence.",
      };
    }

    return null;
  });

  return aligned;
}

export function buildDeliverableEvaluationGraph(deps = {}) {
  const loadContext = deps.loadContext || defaultLoadEvaluationContext;
  const callStructured = deps.invokeStructured || invokeStructured;
  const inspectRepo = deps.inspectGitHubRepository || inspectGitHubRepository;
  const inspectFiles = deps.inspectSubmissionFiles || inspectSubmissionFiles;
  const llm = deps.llm || null;
  const fetchImpl = deps.fetchImpl || fetch;

  const requirementRetrievalNode = async (state) => {
    const ctx = await loadContext(state.milestoneId, state.submissionId);
    return {
      project: ctx.project,
      milestone: ctx.milestone,
      submission: ctx.submission,
      submissionHistory: ctx.submissionHistory || [],
    };
  };

  const submissionAnalysisNode = async (state) => {
    let visionModel = deps.visionModel || null;
    if (!visionModel && !deps.llm && (state.submission?.files || []).some((f) => f?.fileType === "image" || String(f?.url || "").startsWith("data:image/"))) {
      try {
        visionModel = getVisionModel();
      } catch {
        visionModel = null;
      }
    }

    const [repoInspection, fileInspections] = await Promise.all([
      inspectRepo(state.submission?.githubUrl, {
        milestone: state.milestone,
        fetchImpl,
      }),
      inspectFiles(state.submission?.files || [], {
        milestone: state.milestone,
        visionModel,
        fetchImpl,
      }),
    ]);

    const evidenceDigest = formatSubmissionEvidenceDigest({
      submission: state.submission,
      repoInspection,
      fileInspections,
    });

    return {
      repoInspection,
      fileInspections,
      evidenceDigest,
    };
  };

  const evaluationNode = async (state) => {
    const expectedCriteria =
      state.milestone?.acceptanceCriteria?.length > 0
        ? state.milestone.acceptanceCriteria.map((c) => c.criteria)
        : [
            "Submitted deliverables satisfy the milestone description",
            "Supporting repository code, documents, or screenshots verify implementation",
          ];

    const previousVersionsSummary =
      state.submissionHistory?.length > 1
        ? state.submissionHistory
            .slice(1, 4)
            .map((s) => `v${s.version} (${s.status}): ${s.notes || "No notes"}`)
            .join("\n")
        : "None (initial submission)";

    const retryNote =
      state.verificationIssues?.length > 0
        ? `\n\nPREVIOUS VERIFICATION ISSUES TO FIX:\n- ${state.verificationIssues.join("\n- ")}`
        : "";

    const deliverablesText =
      state.milestone?.deliverables?.length > 0
        ? state.milestone.deliverables
            .map((d, i) => `${i + 1}. ${d.title}${d.description ? `: ${d.description}` : ""}`)
            .join("\n")
        : "No explicit deliverable items listed.";

    const rawEvaluation = await callStructured(
      DeliverableEvaluationSchema,
      [
        new SystemMessage(
          [
            "You are an objective QA and technical deliverable reviewer for MilestonePay.",
            "Compare the freelancer's submitted evidence strictly against the milestone deliverables and acceptance criteria.",
            "Rules:",
            "1. Return EXACTLY one criteriaResults entry for EVERY acceptance criterion listed, preserving its exact text.",
            "2. Mark met=true ONLY when concrete observed evidence supports it (inspected repo files, commit history, decoded documents, screenshot analysis, or detailed verifiable notes).",
            "3. If a GitHub repository URL was inaccessible or missing and no other file proves code implementation, mark code-dependent criteria as met=false and explain the access issue clearly.",
            "4. Never approve a milestone or release payment yourself — provide an advisory recommendation for the human client.",
          ].join("\n")
        ),
        new HumanMessage(
          [
            `Project: ${state.project?.title}`,
            `Project Description: ${state.project?.description}`,
            `Milestone #${state.milestone?.order || 1}: ${state.milestone?.title}`,
            `Milestone Description: ${state.milestone?.description}`,
            `Expected Deliverables:\n${deliverablesText}`,
            `Acceptance Criteria (evaluate EVERY item in order):\n${expectedCriteria
              .map((c, i) => `${i + 1}. ${c}`)
              .join("\n")}`,
            `Previous Submission Versions:\n${previousVersionsSummary}`,
            `Observed Submission Evidence:\n${state.evidenceDigest}`,
          ].join("\n\n") + retryNote
        ),
      ],
      { name: "deliverable_evaluation", temperature: 0.15, llm }
    );

    return { rawEvaluation };
  };

  const verificationNode = async (state) => {
    const expectedCriteria =
      state.milestone?.acceptanceCriteria?.length > 0
        ? state.milestone.acceptanceCriteria.map((c) => c.criteria)
        : [
            "Submitted deliverables satisfy the milestone description",
            "Supporting repository code, documents, or screenshots verify implementation",
          ];

    const aligned = alignCriteriaResults(
      expectedCriteria,
      state.rawEvaluation?.criteriaResults || []
    );

    const issues = [];
    const missingSlots = aligned.filter((item) => item === null).length;
    if (missingSlots > 0) {
      issues.push(
        `Missing evaluation for ${missingSlots} acceptance criterion(s). Include all ${expectedCriteria.length} criteria verbatim.`
      );
    }

    if (!state.rawEvaluation?.recommendations?.trim()) {
      issues.push("Recommendations field must be non-empty.");
    }

    const nextAttempt = (state.attemptCount || 0) + 1;
    return {
      verificationIssues: issues,
      verificationPassed: issues.length === 0,
      attemptCount: nextAttempt,
    };
  };

  const routeAfterVerification = (state) => {
    if (!state.verificationPassed && state.attemptCount < 2) {
      return "evaluation";
    }
    return "reportGeneration";
  };

  const reportGenerationNode = async (state) => {
    const expectedCriteria =
      state.milestone?.acceptanceCriteria?.length > 0
        ? state.milestone.acceptanceCriteria.map((c) => c.criteria)
        : [
            "Submitted deliverables satisfy the milestone description",
            "Supporting repository code, documents, or screenshots verify implementation",
          ];

    const aligned = alignCriteriaResults(
      expectedCriteria,
      state.rawEvaluation?.criteriaResults || []
    );

    const criteriaResults = aligned.map((item, idx) => {
      if (item) return item;
      return {
        criteria: expectedCriteria[idx],
        met: false,
        comments: "Criterion was not sufficiently verified by the submitted artifacts.",
      };
    });

    // Deterministic score & requirement lists from verified criteriaResults
    const completedRequirements = criteriaResults
      .filter((c) => c.met)
      .map((c) => c.criteria);

    const missingRequirements = criteriaResults
      .filter((c) => !c.met)
      .map((c) => `${c.criteria} — ${c.comments}`);

    const total = criteriaResults.length;
    const overallScore = total > 0 ? Math.round((completedRequirements.length / total) * 100) : 0;

    const improvementSuggestions = Array.isArray(state.rawEvaluation?.improvementSuggestions)
      ? state.rawEvaluation.improvementSuggestions.filter((s) => String(s || "").trim())
      : [];

    if (state.repoInspection?.provided && !state.repoInspection?.accessible) {
      improvementSuggestions.unshift(
        `Ensure the GitHub repository (${state.repoInspection.url}) is public or configure GITHUB_TOKEN in backend/.env so private repository code can be inspected.`
      );
    }

    const recommendations =
      state.rawEvaluation?.recommendations?.trim() ||
      (missingRequirements.length === 0
        ? "All acceptance criteria appear verified based on the inspected submission. Recommended action: Client review and explicit milestone approval."
        : `${missingRequirements.length} of ${total} acceptance criteria remain incomplete or unverified. Recommended action: Request modifications before approving milestone payment.`);

    return {
      evaluationReport: {
        milestoneId: state.milestone._id,
        submissionId: state.submission._id,
        criteriaResults,
        completedRequirements,
        missingRequirements,
        improvementSuggestions,
        recommendations,
        overallScore,
        status: "COMPLETED",
        analysisMetadata: {
          githubUrl: state.submission?.githubUrl || "",
          githubAccessible: Boolean(state.repoInspection?.accessible),
          githubError: state.repoInspection?.accessError || null,
          repoFilesInspected: (state.repoInspection?.keyFiles || []).map((f) => f.path),
          attachmentsInspected: (state.fileInspections || []).map((f) => ({
            filename: f.filename,
            fileType: f.fileType,
            inspected: f.inspected,
          })),
        },
      },
    };
  };

  const graph = new StateGraph(EvaluationGraphState)
    .addNode("requirementRetrieval", requirementRetrievalNode)
    .addNode("submissionAnalysis", submissionAnalysisNode)
    .addNode("evaluation", evaluationNode)
    .addNode("verification", verificationNode)
    .addNode("reportGeneration", reportGenerationNode)
    .addEdge(START, "requirementRetrieval")
    .addEdge("requirementRetrieval", "submissionAnalysis")
    .addEdge("submissionAnalysis", "evaluation")
    .addEdge("evaluation", "verification")
    .addConditionalEdges("verification", routeAfterVerification, {
      evaluation: "evaluation",
      reportGeneration: "reportGeneration",
    })
    .addEdge("reportGeneration", END);

  return graph.compile();
}

export async function evaluateDeliverableSubmission(
  { milestoneId, submissionId = null },
  deps = {}
) {
  if (!milestoneId) {
    throw new Error("milestoneId is required for deliverable evaluation.");
  }

  const app = buildDeliverableEvaluationGraph(deps);
  const finalState = await app.invoke({
    milestoneId: String(milestoneId),
    submissionId: submissionId ? String(submissionId) : null,
  });

  return {
    evaluation: finalState.evaluationReport,
    verification: {
      passed: finalState.verificationPassed,
      attempts: finalState.attemptCount,
    },
  };
}
