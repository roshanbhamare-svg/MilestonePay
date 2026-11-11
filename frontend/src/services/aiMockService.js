/**
 * TEMPORARY MOCK AI SERVICE (Member C)
 *
 * Member D will replace usage of this file in `src/services/aiService.js`
 * with real LangGraph.js backend calls:
 *   - POST /api/ai/projects/:projectId/generate-milestones
 *   - POST /api/ai/milestones/:milestoneId/evaluate
 *   - GET  /api/ai/milestones/:milestoneId/evaluation
 *
 * All outputs strictly match Member B's MongoDB schemas (`Milestone` and `AIEvaluation`)
 * so UI components do not need redesign when real AI responses are connected.
 */

const mockEvaluationCache = new Map();

function roundCurrency(value) {
  return Math.round((Number(value) + Number.EPSILON) * 100) / 100;
}

function allocateBudget(totalBudget, weights) {
  const budget = roundCurrency(totalBudget);
  const weightSum = weights.reduce((acc, w) => acc + w, 0);
  const amounts = weights.map((w) => roundCurrency((budget * w) / weightSum));
  const allocated = amounts.slice(0, -1).reduce((acc, a) => acc + a, 0);
  amounts[amounts.length - 1] = roundCurrency(budget - allocated);
  return amounts;
}

function buildDeadlineSchedule(projectDeadline, count) {
  const now = Date.now();
  const target = projectDeadline ? new Date(projectDeadline).getTime() : now + 30 * 86400000;
  const effectiveEnd = target > now + 86400000 ? target : now + 30 * 86400000;
  const span = effectiveEnd - now;

  return Array.from({ length: count }, (_, idx) => {
    const ratio = (idx + 1) / count;
    const date = new Date(now + span * ratio);
    return date.toISOString();
  });
}

function detectProjectThemes(title = '', description = '') {
  const text = `${title} ${description}`.toLowerCase();
  return {
    hasAuth: /auth|login|jwt|oauth|user|role/.test(text),
    hasPayment: /pay|paypal|stripe|checkout|billing|invoice/.test(text),
    hasAI: /ai|llm|langgraph|agent|ml|chat|recommend/.test(text),
    hasDashboard: /dashboard|analytics|chart|admin|portal|report/.test(text),
  };
}

export async function mockGenerateMilestones({
  title = 'Software Project',
  description = '',
  budget = 100,
  deadline,
}) {
  await new Promise((resolve) => setTimeout(resolve, 650));

  const themes = detectProjectThemes(title, description);
  const numericBudget = Math.max(Number(budget) || 100, 1);

  const templates = [
    {
      title: 'Architecture, UI Foundation & Setup',
      description: `Establish repository structure, responsive layout, core routing, and reusable component system for "${title}".`,
      weight: 0.2,
      deliverables: [
        { title: 'Project Repository & Setup', description: 'Clean folder structure, environment config, and build scripts' },
        { title: 'Core UI Components & Layout', description: 'Responsive navigation, theme tokens, and base screens' },
      ],
      acceptanceCriteria: [
        { criteria: 'Application compiles cleanly with zero runtime or build errors', completed: false },
        { criteria: 'Responsive layout verified across desktop and mobile viewports', completed: false },
        { criteria: 'Environment configuration documented in .env.example', completed: false },
      ],
    },
    {
      title: themes.hasAuth
        ? 'Authentication, Roles & Database Integration'
        : 'Core Data Models & Backend APIs',
      description: themes.hasAuth
        ? 'Implement user registration, login, JWT authentication, role-based access control, and persistent MongoDB models.'
        : 'Design database schemas, REST API endpoints, validation middleware, and error handling.',
      weight: 0.25,
      deliverables: [
        { title: 'Database Schemas & Controllers', description: 'Validated models and API route handlers' },
        {
          title: themes.hasAuth ? 'Auth & Protected Routes' : 'API Integration Layer',
          description: themes.hasAuth
            ? 'JWT issuance, password hashing, and role guards'
            : 'Service layer connected to backend endpoints',
        },
      ],
      acceptanceCriteria: [
        { criteria: 'All CRUD endpoints return consistent JSON responses and HTTP status codes', completed: false },
        {
          criteria: themes.hasAuth
            ? 'Passwords hashed securely and protected routes reject unauthorized requests'
            : 'Input validation rejects malformed payloads with clear error messages',
          completed: false,
        },
      ],
    },
    {
      title: themes.hasPayment
        ? 'Payment Workflow & Core Feature Implementation'
        : themes.hasAI
          ? 'AI Workflow & Core Feature Modules'
          : 'Primary Application Features & Integrations',
      description: themes.hasPayment
        ? 'Integrate payment authorization, milestone capture records, transaction history, and core business workflows.'
        : 'Deliver primary user workflows, state transitions, notifications, and integration tests.',
      weight: 0.3,
      deliverables: [
        { title: 'Core Feature Modules', description: 'End-to-end interactive workflows connected to backend' },
        { title: 'Status & Error Handling', description: 'Loading, empty, and error feedback states' },
      ],
      acceptanceCriteria: [
        { criteria: 'Primary user workflows operate end-to-end against live backend data', completed: false },
        { criteria: 'Invalid state transitions and edge cases handled gracefully', completed: false },
      ],
    },
    {
      title: themes.hasDashboard
        ? 'Analytics Dashboard, Testing & Deployment Readiness'
        : 'QA Verification, Documentation & Handover',
      description:
        'Finalize analytics summaries, cross-browser verification, handover documentation, and production build checks.',
      weight: 0.25,
      deliverables: [
        { title: 'Verified Production Build', description: 'Linted and tested frontend + backend verification' },
        { title: 'Handover Documentation', description: 'Setup instructions, API notes, and test checklist' },
      ],
      acceptanceCriteria: [
        { criteria: 'All project requirements verified against original scope', completed: false },
        { criteria: 'Linting and production build complete without errors', completed: false },
      ],
    },
  ];

  const amounts = allocateBudget(
    numericBudget,
    templates.map((t) => t.weight)
  );
  const deadlines = buildDeadlineSchedule(deadline, templates.length);

  return templates.map((tpl, index) => ({
    title: tpl.title,
    description: tpl.description,
    paymentAmount: amounts[index],
    deadline: deadlines[index],
    deliverables: tpl.deliverables,
    acceptanceCriteria: tpl.acceptanceCriteria,
    order: index + 1,
  }));
}

export async function mockEvaluateSubmission({ milestone, submission }) {
  await new Promise((resolve) => setTimeout(resolve, 750));

  const hasGithub = Boolean(submission?.githubUrl?.trim());
  const fileCount = submission?.files?.length || 0;
  const notesLength = submission?.notes?.trim()?.length || 0;
  const hasNotes = notesLength >= 20;

  const rawCriteria =
    milestone?.acceptanceCriteria?.length > 0
      ? milestone.acceptanceCriteria.map((item) => item.criteria)
      : ['Deliverables match milestone specification', 'Verification notes and documentation included'];

  const criteriaResults = rawCriteria.map((criteriaText, idx) => {
    let met = true;
    let comments = 'Verified against submitted repository link and delivery notes.';

    if (!hasGithub && idx === 0) {
      met = false;
      comments = 'Missing GitHub repository URL for source verification.';
    } else if (fileCount === 0 && idx === rawCriteria.length - 1 && rawCriteria.length > 1) {
      met = false;
      comments = 'No supporting screenshots or architecture/test documents attached.';
    } else if (!hasNotes && idx === rawCriteria.length - 1) {
      met = false;
      comments = 'Submission notes are too brief to verify test coverage and edge cases.';
    }

    return {
      criteria: criteriaText,
      met,
      comments,
    };
  });

  const completedRequirements = criteriaResults
    .filter((c) => c.met)
    .map((c) => c.criteria);

  const missingRequirements = criteriaResults
    .filter((c) => !c.met)
    .map((c) => `${c.criteria} — ${c.comments}`);

  const totalCount = criteriaResults.length;
  const metCount = completedRequirements.length;
  const overallScore = totalCount > 0 ? Math.round((metCount / totalCount) * 100) : 0;

  const improvementSuggestions = [];
  if (!hasGithub) {
    improvementSuggestions.push('Attach a valid GitHub repository URL pointing to the relevant branch or commit.');
  }
  if (fileCount === 0) {
    improvementSuggestions.push('Upload at least one screenshot or verification document demonstrating the working deliverable.');
  }
  if (!hasNotes) {
    improvementSuggestions.push('Expand submission notes with setup steps, endpoints tested, and any known limitations.');
  }
  if (improvementSuggestions.length === 0) {
    improvementSuggestions.push('Consider adding automated unit or integration test screenshots for future milestone audits.');
  }

  const recommendations =
    missingRequirements.length === 0
      ? `All ${totalCount} acceptance criteria appear satisfied based on submitted deliverables (v${submission?.version || 1}). Recommended action: Client review and milestone approval.`
      : `${missingRequirements.length} of ${totalCount} criteria need attention before final sign-off. Recommended action: Request modifications so the freelancer can provide the missing evidence.`;

  const evaluation = {
    _id: `mock-eval-${milestone?._id || 'temp'}-${Date.now()}`,
    milestoneId: milestone?._id,
    submissionId: submission?._id,
    criteriaResults,
    completedRequirements,
    missingRequirements,
    improvementSuggestions,
    recommendations,
    overallScore,
    status: 'COMPLETED',
    createdAt: new Date().toISOString(),
    _isMock: true,
  };

  if (milestone?._id) {
    mockEvaluationCache.set(milestone._id, evaluation);
  }

  return evaluation;
}

export function getCachedMockEvaluation(milestoneId) {
  return mockEvaluationCache.get(milestoneId) || null;
}

export async function mockAskProjectAssistant({ project, milestones = [], payment = null, question = '' }) {
  await new Promise((resolve) => setTimeout(resolve, 450));

  const q = question.toLowerCase();
  const currency = project?.currency || 'USD';
  const totalMilestones = milestones.length;
  const paidCount = milestones.filter((m) => m.status === 'PAID').length;
  const approvedCount = milestones.filter((m) => m.status === 'APPROVED').length;
  const reviewCount = milestones.filter((m) =>
    ['SUBMITTED', 'RESUBMITTED', 'UNDER_REVIEW'].includes(m.status)
  ).length;
  const changesCount = milestones.filter((m) => m.status === 'CHANGES_REQUESTED').length;

  const now = Date.now();
  const overdueMilestones = milestones.filter(
    (m) => m.deadline && m.status !== 'PAID' && new Date(m.deadline).getTime() < now
  );

  const authorized = payment?.totalAuthorized ?? 0;
  const captured = payment?.totalCaptured ?? 0;
  const remainingEscrow = Math.max(0, authorized - captured);

  const highlights = [
    `Project status: ${project?.status || 'UNKNOWN'} (${paidCount}/${totalMilestones} milestones paid)`,
    `PayPal status: ${payment?.status || 'NOT_AUTHORIZED'} (${captured.toFixed(2)} / ${authorized.toFixed(2)} ${currency} captured)`,
  ];

  if (overdueMilestones.length > 0) {
    highlights.push(
      `Overdue milestones (${overdueMilestones.length}): ${overdueMilestones.map((m) => `#${m.order} ${m.title}`).join(', ')}`
    );
  }

  let answer;
  const suggestedNextSteps = [];

  if (/delay|overdue|late|deadline/.test(q)) {
    answer =
      overdueMilestones.length > 0
        ? `${overdueMilestones.length} milestone(s) have passed their deadline without reaching PAID status: ${overdueMilestones.map((m) => `#${m.order} "${m.title}" (${m.status})`).join('; ')}.`
        : 'All unpaid milestones are currently within their scheduled deadlines.';
    suggestedNextSteps.push(
      overdueMilestones.length > 0
        ? 'Review overdue milestones and confirm updated delivery expectations with the freelancer.'
        : 'Continue monitoring upcoming milestone deadlines.'
    );
  } else if (/pay|paypal|capture|escrow|budget|money/.test(q)) {
    answer = payment
      ? `PayPal authorization (${payment.authorizationId || 'pending'}) currently holds ${remainingEscrow.toFixed(2)} ${currency} remaining out of ${authorized.toFixed(2)} ${currency} authorized, with ${captured.toFixed(2)} ${currency} captured across ${payment.captures?.length || 0} transaction(s).`
      : `No PayPal authorization exists yet for "${project?.title}". Project budget is ${project?.budget || 0} ${currency}.`;
    if (approvedCount > 0) {
      suggestedNextSteps.push(`Capture payment for ${approvedCount} approved milestone(s) in the PayPal Payments tab.`);
    }
    if (!payment && project?.status === 'ACTIVE') {
      suggestedNextSteps.push('Authorize project funds via PayPal Sandbox before capturing milestones.');
    }
  } else if (/review|change|disagree|missing|criteria/.test(q)) {
    answer = `There are currently ${reviewCount} milestone(s) awaiting client review and ${changesCount} milestone(s) marked CHANGES_REQUESTED. All final approval decisions remain with the client based on the agreed acceptance criteria.`;
    if (reviewCount > 0) {
      suggestedNextSteps.push('Open "Submissions & AI Report" on submitted milestones to evaluate criteria and decide.');
    }
    if (changesCount > 0) {
      suggestedNextSteps.push('Freelancer should submit an updated version addressing the requested changes.');
    }
  } else {
    answer = `"${project?.title}" is currently ${project?.status}. ${paidCount} of ${totalMilestones} milestones are paid, ${approvedCount} approved awaiting capture, ${reviewCount} in submission/review, and ${changesCount} awaiting revisions.`;
    if (project?.status === 'AGREEMENT_PENDING') {
      suggestedNextSteps.push('Both client and freelancer must accept the project agreement to activate work.');
    } else if (approvedCount > 0) {
      suggestedNextSteps.push('Release PayPal funds for approved milestones.');
    } else if (reviewCount > 0) {
      suggestedNextSteps.push('Run AI evaluation and complete client review on submitted milestones.');
    } else {
      suggestedNextSteps.push('Track active milestone deliverables on the Milestones tab.');
    }
  }

  return {
    answer,
    highlights,
    suggestedNextSteps,
    answeredAt: new Date().toISOString(),
    _isMock: true,
  };
}


