import { StateGraph, Annotation, START, END } from "@langchain/langgraph";
import { HumanMessage, SystemMessage } from "@langchain/core/messages";
import { invokeStructured } from "../llmClient.js";
import {
  RequirementAnalysisSchema,
  TaskBreakdownSchema,
  MilestonePlanSchema,
} from "../schemas.js";
import {
  formatMilestonesForPersistence,
  reconcileMilestoneBudgets,
  reconcileMilestoneDeadlines,
  roundCurrency,
  validateMilestonePlan,
} from "../utils/budgetAndSchedule.js";

const MilestoneGeneratorState = Annotation.Root({
  title: Annotation({ reducer: (_, next) => next, default: () => "" }),
  description: Annotation({ reducer: (_, next) => next, default: () => "" }),
  budget: Annotation({ reducer: (_, next) => next, default: () => 0 }),
  currency: Annotation({ reducer: (_, next) => next, default: () => "USD" }),
  deadline: Annotation({ reducer: (_, next) => next, default: () => "" }),

  requirementAnalysis: Annotation({ reducer: (_, next) => next, default: () => null }),
  tasks: Annotation({ reducer: (_, next) => next, default: () => [] }),
  draftMilestones: Annotation({ reducer: (_, next) => next, default: () => [] }),
  allocatedMilestones: Annotation({ reducer: (_, next) => next, default: () => [] }),
  validationErrors: Annotation({ reducer: (_, next) => next, default: () => [] }),
  validationPassed: Annotation({ reducer: (_, next) => next, default: () => false }),
  attemptCount: Annotation({ reducer: (_, next) => next, default: () => 0 }),
  milestones: Annotation({ reducer: (_, next) => next, default: () => [] }),
});

export function buildMilestoneGeneratorGraph(deps = {}) {
  const callStructured = deps.invokeStructured || invokeStructured;
  const llm = deps.llm || null;

  const requirementAnalysisNode = async (state) => {
    const analysis = await callStructured(
      RequirementAnalysisSchema,
      [
        new SystemMessage(
          "You are a senior software solutions architect for MilestonePay. Analyze natural-language project briefs into structured requirements, technical dependencies, and missing/ambiguous details."
        ),
        new HumanMessage(
          [
            `Project Title: ${state.title}`,
            `Project Description:\n${state.description}`,
            `Declared Budget: ${state.budget} ${state.currency}`,
            `Declared Deadline: ${state.deadline || "Not specified (assume 30 days)"}`,
          ].join("\n\n")
        ),
      ],
      { name: "requirement_analysis", temperature: 0.15, llm }
    );

    return { requirementAnalysis: analysis };
  };

  const taskBreakdownNode = async (state) => {
    const result = await callStructured(
      TaskBreakdownSchema,
      [
        new SystemMessage(
          "You are a technical project planner. Break down the analyzed project requirements into concrete, ordered engineering tasks with complexity weights (1-10) and dependencies."
        ),
        new HumanMessage(
          [
            `Project Title: ${state.title}`,
            `Description: ${state.description}`,
            `Analyzed Requirements:\n${JSON.stringify(state.requirementAnalysis, null, 2)}`,
          ].join("\n\n")
        ),
      ],
      { name: "task_breakdown", temperature: 0.2, llm }
    );

    return { tasks: result.tasks };
  };

  const milestonePlanningNode = async (state) => {
    const repairContext =
      state.validationErrors?.length > 0
        ? `\n\nPREVIOUS VALIDATION ERRORS TO FIX:\n- ${state.validationErrors.join("\n- ")}`
        : "";

    const desiredCount = state.budget < 15 ? "2 to 3" : "3 to 5";

    const plan = await callStructured(
      MilestonePlanSchema,
      [
        new SystemMessage(
          `You are a milestone contract designer. Group the project tasks into ${desiredCount} sequential payment milestones. Each milestone MUST have concrete deliverables and verifiable, testable acceptance criteria. Assign positive weightPercentage values reflecting relative effort (the backend calculates exact currency amounts deterministically).`
        ),
        new HumanMessage(
          [
            `Project Title: ${state.title}`,
            `Total Budget: ${state.budget} ${state.currency}`,
            `Target Deadline: ${state.deadline || "30 days from today"}`,
            `Tasks:\n${JSON.stringify(state.tasks, null, 2)}`,
            `Dependencies & Risks:\n${JSON.stringify(
              {
                dependencies: state.requirementAnalysis?.technicalDependencies || [],
                ambiguities: state.requirementAnalysis?.missingOrAmbiguousRequirements || [],
              },
              null,
              2
            )}`,
          ].join("\n\n") + repairContext
        ),
      ],
      { name: "milestone_planning", temperature: 0.2, llm }
    );

    return { draftMilestones: plan.milestones };
  };

  const budgetAllocationNode = async (state) => {
    const withBudget = reconcileMilestoneBudgets(state.draftMilestones, state.budget);
    const withSchedule = reconcileMilestoneDeadlines(withBudget, state.deadline);
    return { allocatedMilestones: withSchedule };
  };

  const validationNode = async (state) => {
    const { isValid, errors } = validateMilestonePlan(state.allocatedMilestones, state.budget);
    return {
      validationPassed: isValid,
      validationErrors: errors,
      attemptCount: (state.attemptCount || 0) + 1,
    };
  };

  const routeAfterValidation = (state) => {
    if (!state.validationPassed && state.attemptCount < 2) {
      return "planMilestones";
    }
    return "finalizeOutput";
  };

  const outputNode = async (state) => {
    let candidates = state.allocatedMilestones || [];

    // Deterministic safeguard ensuring deliverables/criteria & exact budget match even after max retries
    const sanitized = candidates.map((m, idx) => ({
      ...m,
      title: m.title?.trim() || `Milestone ${idx + 1}`,
      description: m.description?.trim() || state.description.slice(0, 300),
      deliverables:
        Array.isArray(m.deliverables) && m.deliverables.length > 0
          ? m.deliverables.filter((d) => d?.title?.trim())
          : [{ title: `${m.title || `Milestone ${idx + 1}`} Deliverable`, description: "Verified source code and documentation" }],
      acceptanceCriteria:
        Array.isArray(m.acceptanceCriteria) && m.acceptanceCriteria.length > 0
          ? m.acceptanceCriteria.filter((c) => c?.criteria?.trim())
          : [{ criteria: "All milestone deliverables verified and tested", completed: false }],
    }));

    const reallocated = reconcileMilestoneBudgets(sanitized, state.budget);
    const rescheduled = reconcileMilestoneDeadlines(reallocated, state.deadline);
    const formatted = formatMilestonesForPersistence(rescheduled);
    const finalCheck = validateMilestonePlan(formatted, state.budget);

    return {
      milestones: formatted,
      validationPassed: finalCheck.isValid,
      validationErrors: finalCheck.errors,
    };
  };

  const graph = new StateGraph(MilestoneGeneratorState)
    .addNode("analyzeRequirements", requirementAnalysisNode)
    .addNode("breakDownTasks", taskBreakdownNode)
    .addNode("planMilestones", milestonePlanningNode)
    .addNode("allocateBudgets", budgetAllocationNode)
    .addNode("validatePlan", validationNode)
    .addNode("finalizeOutput", outputNode)
    .addEdge(START, "analyzeRequirements")
    .addEdge("analyzeRequirements", "breakDownTasks")
    .addEdge("breakDownTasks", "planMilestones")
    .addEdge("planMilestones", "allocateBudgets")
    .addEdge("allocateBudgets", "validatePlan")
    .addConditionalEdges("validatePlan", routeAfterValidation, {
      planMilestones: "planMilestones",
      finalizeOutput: "finalizeOutput",
    })
    .addEdge("finalizeOutput", END);

  return graph.compile();
}

export async function generateMilestonePlan(
  { title, description, budget, currency = "USD", deadline },
  deps = {}
) {
  const numericBudget = roundCurrency(budget);
  if (!title?.trim() || !description?.trim() || !Number.isFinite(numericBudget) || numericBudget <= 0) {
    throw new Error("Title, description, and positive budget are required to generate milestones.");
  }

  const app = buildMilestoneGeneratorGraph(deps);
  const finalState = await app.invoke({
    title: title.trim(),
    description: description.trim(),
    budget: numericBudget,
    currency: (currency || "USD").toUpperCase(),
    deadline: deadline ? new Date(deadline).toISOString() : "",
  });

  return {
    milestones: finalState.milestones,
    requirementAnalysis: finalState.requirementAnalysis,
    tasks: finalState.tasks,
    validation: {
      passed: finalState.validationPassed,
      errors: finalState.validationErrors,
      attempts: finalState.attemptCount,
    },
  };
}
