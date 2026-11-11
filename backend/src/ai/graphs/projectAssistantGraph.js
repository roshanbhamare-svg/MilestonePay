import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import Project from "../../models/Project.js";
import Milestone from "../../models/Milestone.js";
import Submission from "../../models/Submission.js";
import AIEvaluation from "../../models/AIEvaluation.js";
import Payment from "../../models/Payment.js";
import { invokeStructured } from "../llmClient.js";
import { AssistantIntentSchema, ProjectAssistantSchema } from "../schemas.js";

const AssistantGraphState = Annotation.Root({
  projectId: Annotation({ reducer: (_, next) => next, default: () => "" }),
  question: Annotation({ reducer: (_, next) => next, default: () => "" }),
  userRole: Annotation({ reducer: (_, next) => next, default: () => "client" }),

  contextSnapshot: Annotation({ reducer: (_, next) => next, default: () => null }),
  intent: Annotation({ reducer: (_, next) => next, default: () => "general" }),
  focusAreas: Annotation({ reducer: (_, next) => next, default: () => [] }),
  focusedBrief: Annotation({ reducer: (_, next) => next, default: () => "" }),
  response: Annotation({ reducer: (_, next) => next, default: () => null }),
});

async function defaultLoadAssistantContext(projectId) {
  const project = await Project.findById(projectId)
    .populate("clientId", "name email")
    .populate("freelancerId", "name email")
    .lean();

  if (!project) {
    const err = new Error("Project not found");
    err.statusCode = 404;
    throw err;
  }

  const milestones = await Milestone.find({ projectId: project._id })
    .sort({ order: 1 })
    .lean();

  const milestoneIds = milestones.map((m) => m._id);

  const [submissions, evaluations, payment] = await Promise.all([
    milestoneIds.length > 0
      ? Submission.find({ milestoneId: { $in: milestoneIds } })
          .sort({ version: -1 })
          .lean()
      : [],
    milestoneIds.length > 0
      ? AIEvaluation.find({ milestoneId: { $in: milestoneIds } })
          .sort({ createdAt: -1 })
          .lean()
      : [],
    Payment.findOne({ projectId: project._id }).lean(),
  ]);

  return { project, milestones, submissions, evaluations, payment };
}

function buildDeterministicMetrics({ project, milestones, submissions, evaluations, payment }) {
  const now = Date.now();
  const overdueMilestones = milestones.filter(
    (m) => m.deadline && m.status !== "PAID" && new Date(m.deadline).getTime() < now
  );

  const paidCount = milestones.filter((m) => m.status === "PAID").length;
  const approvedCount = milestones.filter((m) => m.status === "APPROVED").length;
  const underReviewCount = milestones.filter((m) =>
    ["SUBMITTED", "RESUBMITTED", "UNDER_REVIEW"].includes(m.status)
  ).length;
  const changesRequestedCount = milestones.filter(
    (m) => m.status === "CHANGES_REQUESTED"
  ).length;

  const authorized = payment?.totalAuthorized ?? 0;
  const captured = payment?.totalCaptured ?? 0;
  const remainingEscrow = Math.max(0, Math.round((authorized - captured) * 100) / 100);

  const latestEvalByMilestone = new Map();
  for (const ev of evaluations) {
    const key = ev.milestoneId.toString();
    if (!latestEvalByMilestone.has(key)) {
      latestEvalByMilestone.set(key, ev);
    }
  }

  const submissionsByMilestone = new Map();
  for (const sub of submissions) {
    const key = sub.milestoneId.toString();
    if (!submissionsByMilestone.has(key)) {
      submissionsByMilestone.set(key, []);
    }
    submissionsByMilestone.get(key).push(sub);
  }

  return {
    nowIso: new Date(now).toISOString(),
    totalMilestones: milestones.length,
    paidCount,
    approvedCount,
    underReviewCount,
    changesRequestedCount,
    overdueMilestones: overdueMilestones.map((m) => ({
      order: m.order,
      title: m.title,
      status: m.status,
      deadline: m.deadline,
    })),
    paymentMetrics: {
      status: payment?.status || "NOT_AUTHORIZED",
      currency: payment?.currency || project.currency || "USD",
      authorized,
      captured,
      remainingEscrow,
      captureCount: payment?.captures?.length || 0,
      authorizationId: payment?.authorizationId || null,
    },
    milestoneDetails: milestones.map((m) => {
      const mId = m._id.toString();
      const mSubs = submissionsByMilestone.get(mId) || [];
      const mEval = latestEvalByMilestone.get(mId) || null;
      return {
        order: m.order,
        title: m.title,
        description: m.description,
        paymentAmount: m.paymentAmount,
        status: m.status,
        deadline: m.deadline,
        deliverables: m.deliverables || [],
        acceptanceCriteria: m.acceptanceCriteria || [],
        submissions: mSubs.map((s) => ({
          version: s.version,
          status: s.status,
          githubUrl: s.githubUrl,
          notes: s.notes,
          filesCount: s.files?.length || 0,
          submittedAt: s.submittedAt || s.createdAt,
        })),
        latestEvaluation: mEval
          ? {
              overallScore: mEval.overallScore,
              completedRequirements: mEval.completedRequirements,
              missingRequirements: mEval.missingRequirements,
              recommendations: mEval.recommendations,
              improvementSuggestions: mEval.improvementSuggestions || [],
            }
          : null,
      };
    }),
  };
}

export function buildProjectAssistantGraph(deps = {}) {
  const loadContext = deps.loadContext || defaultLoadAssistantContext;
  const callStructured = deps.invokeStructured || invokeStructured;
  const llm = deps.llm || null;

  const contextRetrievalNode = async (state) => {
    const raw = await loadContext(state.projectId);
    const metrics = buildDeterministicMetrics(raw);
    return {
      contextSnapshot: {
        project: {
          title: raw.project.title,
          description: raw.project.description,
          budget: raw.project.budget,
          currency: raw.project.currency,
          deadline: raw.project.deadline,
          status: raw.project.status,
          agreement: raw.project.agreement,
          clientName: raw.project.clientId?.name || "Client",
          freelancerName: raw.project.freelancerId?.name || "Unassigned",
        },
        metrics,
      },
    };
  };

  const intentClassificationNode = async (state) => {
    const classification = await callStructured(
      AssistantIntentSchema,
      [
        new SystemMessage(
          "Classify the user's question about a MilestonePay freelance project into the most relevant intent category."
        ),
        new HumanMessage(
          `User Role: ${state.userRole}\nQuestion: ${state.question}\nMilestones: ${(
            state.contextSnapshot?.metrics?.milestoneDetails || []
          )
            .map((m) => `#${m.order} ${m.title} (${m.status})`)
            .join(", ")}`
        ),
      ],
      { name: "assistant_intent", temperature: 0, maxTokens: 512, llm }
    );

    return {
      intent: classification.intent,
      focusAreas: classification.focusAreas || [],
    };
  };

  const routeByIntent = (state) => {
    if (state.intent === "evaluation_disagreement") return "disputeFocus";
    if (state.intent === "delay_risk" || state.intent === "payment_escrow") return "riskAndEscrowFocus";
    return "progressAndRequirementsFocus";
  };

  const disputeFocusNode = async (state) => {
    const snap = state.contextSnapshot;
    const focusLines = snap.metrics.milestoneDetails.map((m) => ({
      milestone: `#${m.order} ${m.title}`,
      status: m.status,
      acceptanceCriteria: m.acceptanceCriteria,
      submissionHistory: m.submissions,
      latestEvaluation: m.latestEvaluation,
    }));

    return {
      focusedBrief: JSON.stringify(
        {
          focus: "Agreement, Submission History, Evaluation Reports & Disagreement Analysis",
          agreement: snap.project.agreement,
          milestones: focusLines,
        },
        null,
        2
      ),
    };
  };

  const riskAndEscrowFocusNode = async (state) => {
    const snap = state.contextSnapshot;
    return {
      focusedBrief: JSON.stringify(
        {
          focus: "Schedule Delays & PayPal Authorization/Capture Status",
          nowIso: snap.metrics.nowIso,
          projectDeadline: snap.project.deadline,
          overdueMilestones: snap.metrics.overdueMilestones,
          paymentMetrics: snap.metrics.paymentMetrics,
          milestoneSchedules: snap.metrics.milestoneDetails.map((m) => ({
            milestone: `#${m.order} ${m.title}`,
            status: m.status,
            deadline: m.deadline,
            paymentAmount: m.paymentAmount,
          })),
        },
        null,
        2
      ),
    };
  };

  const progressAndRequirementsFocusNode = async (state) => {
    const snap = state.contextSnapshot;
    return {
      focusedBrief: JSON.stringify(
        {
          focus: "Project Requirements, Scope & Overall Status Report",
          project: snap.project,
          summaryCounts: {
            totalMilestones: snap.metrics.totalMilestones,
            paidCount: snap.metrics.paidCount,
            approvedCount: snap.metrics.approvedCount,
            underReviewCount: snap.metrics.underReviewCount,
            changesRequestedCount: snap.metrics.changesRequestedCount,
            overdueCount: snap.metrics.overdueMilestones.length,
          },
          paymentMetrics: snap.metrics.paymentMetrics,
          milestones: snap.metrics.milestoneDetails,
        },
        null,
        2
      ),
    };
  };

  const assistantResponseNode = async (state) => {
    const result = await callStructured(
      ProjectAssistantSchema,
      [
        new SystemMessage(
          [
            "You are the MilestonePay AI Project Assistant.",
            "Answer the user's question strictly using the provided MongoDB project snapshot, agreement state, submission history, AI evaluation reports, and PayPal escrow metrics.",
            "Do not invent milestones, captures, or evaluation scores that are not in the data.",
            "Remember: AI only advises; the client retains final approval and payment capture authority.",
          ].join("\n")
        ),
        new HumanMessage(
          [
            `Asking User Role: ${state.userRole}`,
            `Detected Intent: ${state.intent}`,
            `Question: ${state.question}`,
            `Project Overview:\n${JSON.stringify(state.contextSnapshot?.project, null, 2)}`,
            `Focused Project Data:\n${state.focusedBrief}`,
          ].join("\n\n")
        ),
      ],
      { name: "project_assistant_response", temperature: 0.2, llm }
    );

    return {
      response: {
        answer: result.answer,
        highlights: result.highlights || [],
        suggestedNextSteps: result.suggestedNextSteps || [],
        intent: state.intent,
        answeredAt: new Date().toISOString(),
      },
    };
  };

  const graph = new StateGraph(AssistantGraphState)
    .addNode("contextRetrieval", contextRetrievalNode)
    .addNode("intentClassification", intentClassificationNode)
    .addNode("disputeFocus", disputeFocusNode)
    .addNode("riskAndEscrowFocus", riskAndEscrowFocusNode)
    .addNode("progressAndRequirementsFocus", progressAndRequirementsFocusNode)
    .addNode("assistantResponse", assistantResponseNode)
    .addEdge(START, "contextRetrieval")
    .addEdge("contextRetrieval", "intentClassification")
    .addConditionalEdges("intentClassification", routeByIntent, {
      disputeFocus: "disputeFocus",
      riskAndEscrowFocus: "riskAndEscrowFocus",
      progressAndRequirementsFocus: "progressAndRequirementsFocus",
    })
    .addEdge("disputeFocus", "assistantResponse")
    .addEdge("riskAndEscrowFocus", "assistantResponse")
    .addEdge("progressAndRequirementsFocus", "assistantResponse")
    .addEdge("assistantResponse", END);

  return graph.compile();
}

export async function askProjectAssistant(
  { projectId, question, userRole = "client" },
  deps = {}
) {
  if (!projectId) throw new Error("projectId is required.");
  if (!question?.trim()) throw new Error("question is required.");

  const app = buildProjectAssistantGraph(deps);
  const finalState = await app.invoke({
    projectId: String(projectId),
    question: question.trim(),
    userRole,
  });

  return finalState.response;
}
