import { z } from "zod";

export const RequirementAnalysisSchema = z.object({
  objectives: z
    .array(z.string())
    .min(1)
    .describe("Primary business and technical objectives extracted from the project description."),
  extractedBudget: z
    .number()
    .nullable()
    .describe("Numeric budget mentioned in the description, or null if not stated in text."),
  extractedCurrency: z
    .string()
    .nullable()
    .describe("Currency code mentioned in the description (e.g. USD, EUR), or null."),
  extractedDeadline: z
    .string()
    .nullable()
    .describe("Deadline or timeframe extracted from the description, or null."),
  coreFeatures: z
    .array(z.string())
    .min(1)
    .describe("Concrete functional features and technical components required."),
  technicalDependencies: z
    .array(z.string())
    .describe("Key technical dependencies and integration order constraints (e.g. Auth before Dashboard)."),
  missingOrAmbiguousRequirements: z
    .array(z.string())
    .describe("Ambiguous, underspecified, or missing requirements the client should clarify."),
  riskFlags: z
    .array(z.string())
    .describe("Delivery, security, or scope risks identified during analysis."),
});

export const TaskBreakdownItemSchema = z.object({
  id: z.string().describe("Short task identifier such as T1, T2."),
  title: z.string().describe("Concise actionable engineering or design task title."),
  description: z.string().describe("What needs to be built or verified for this task."),
  phase: z
    .enum(["foundation", "backend", "frontend", "integration", "testing", "deployment"])
    .describe("Delivery phase for ordering tasks chronologically."),
  complexityWeight: z
    .number()
    .min(1)
    .max(10)
    .describe("Relative effort weight from 1 (small) to 10 (large)."),
  dependencies: z
    .array(z.string())
    .describe("IDs of prerequisite tasks."),
  deliverables: z
    .array(z.string())
    .min(1)
    .describe("Concrete outputs produced by this task."),
});

export const TaskBreakdownSchema = z.object({
  tasks: z
    .array(TaskBreakdownItemSchema)
    .min(2)
    .max(16)
    .describe("Granular tasks covering the full project scope."),
});

export const PlannedDeliverableSchema = z.object({
  title: z.string().describe("Deliverable name."),
  description: z.string().describe("Specific artifact or implementation details expected."),
});

export const PlannedCriterionSchema = z.object({
  criteria: z.string().describe("Testable, unambiguous acceptance criterion."),
});

export const PlannedMilestoneSchema = z.object({
  title: z.string().describe("Clear milestone title."),
  description: z.string().describe("Detailed scope of work covered in this milestone."),
  weightPercentage: z
    .number()
    .min(1)
    .max(100)
    .describe("Relative share of total project effort (positive number). Backend computes exact currency amounts."),
  estimatedDaysRatio: z
    .number()
    .min(0.05)
    .max(1)
    .describe("Cumulative completion point between 0.05 and 1.0 of the project timeline."),
  deliverables: z
    .array(PlannedDeliverableSchema)
    .min(1)
    .describe("Concrete deliverables expected from the freelancer."),
  acceptanceCriteria: z
    .array(PlannedCriterionSchema)
    .min(1)
    .describe("Measurable criteria used to evaluate submission quality."),
});

export const MilestonePlanSchema = z.object({
  milestones: z
    .array(PlannedMilestoneSchema)
    .min(2)
    .max(6)
    .describe("Chronologically ordered milestones covering the entire project."),
});

export const CriteriaEvaluationItemSchema = z.object({
  criteria: z
    .string()
    .describe("Exact acceptance criterion text being evaluated."),
  met: z
    .boolean()
    .describe("True only if verified by observable evidence; false if missing or unverifiable."),
  comments: z
    .string()
    .describe("Factual explanation citing concrete files, commits, screenshots, or notes observed, or explaining what is missing/unverifiable."),
});

export const DeliverableEvaluationSchema = z.object({
  criteriaResults: z
    .array(CriteriaEvaluationItemSchema)
    .min(1)
    .describe("One evaluation item per milestone acceptance criterion."),
  improvementSuggestions: z
    .array(z.string())
    .describe("Actionable recommendations for improving or completing the deliverable."),
  recommendations: z
    .string()
    .describe("Advisory summary for the client (e.g. recommend approval or request modifications). Never approve or release payment automatically."),
});

export const AssistantIntentSchema = z.object({
  intent: z
    .enum([
      "progress_summary",
      "delay_risk",
      "payment_escrow",
      "evaluation_disagreement",
      "requirements_qa",
      "general",
    ])
    .describe("Primary intent of the user's question about the project."),
  focusAreas: z
    .array(z.string())
    .describe("Key topics or milestone titles relevant to answering the question."),
});

export const ProjectAssistantSchema = z.object({
  answer: z
    .string()
    .describe("Clear, factual answer grounded strictly in project, milestone, submission, evaluation, and PayPal data."),
  highlights: z
    .array(z.string())
    .max(6)
    .describe("Short bullet-worthy status badges or metric highlights."),
  suggestedNextSteps: z
    .array(z.string())
    .max(5)
    .describe("Actionable next steps appropriate for the project state."),
});
