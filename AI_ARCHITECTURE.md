# MilestonePay – LangGraph.js AI Architecture (Member D)

This document describes the **LangGraph.js** multi-step AI agent architecture implemented in the Node.js + Express backend (`backend/src/ai/`), its integration with MongoDB and React, and its operational & safety safeguards.

---

## 1. Tech Stack & Configuration

AI orchestration runs natively inside the Express backend using LangGraph.js (`type: "module"` ESM):

- **Graph Orchestration:** `@langchain/langgraph` (`^1.7.3`) & `@langchain/core` (`^1.3.7`)
- **LLM Provider:** Groq via `@langchain/groq` (`^1.3.1`)
- **Structured Output Validation:** `zod` (`^4.6.7`) + automatic JSON-mode fallback in `invokeStructured`

### Environment Variables (`backend/.env`)

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
GITHUB_TOKEN=
```

- If `GROQ_API_KEY` is unset, `getReasoningModel()` raises `AIConfigError` (HTTP `503`), cleanly surfaced to the UI without crashing the server.
- `GITHUB_TOKEN` is optional. When configured, the deliverable evaluator uses it as a `Bearer` token against `https://api.github.com` to inspect private freelancer repositories.

### Frontend Configuration (`frontend/.env`)

```env
VITE_USE_MOCK_AI=false
```

`frontend/src/services/aiMockService.js` has been removed, and `frontend/src/services/aiService.js` communicates directly with `/api/ai/*` using a `90000ms` request timeout.

---

## 2. Module Layout

```text
backend/src/ai/
├── llmClient.js                         # Groq chat & vision models, AIConfigError/AIExecutionError, structured output helper
├── schemas.js                           # Zod v4 schemas for all structured LLM steps
├── graphs/
│   ├── milestoneGeneratorGraph.js       # 6-node requirement analyzer & milestone planner with retry loop
│   ├── deliverableEvaluationGraph.js    # 5-node deliverable evaluator with verification loop & deterministic scoring
│   └── projectAssistantGraph.js         # Context-grounded intent router & assistant graph
├── tools/
│   └── submissionInspector.js           # GitHub REST API inspector, SSRF guard, doc decoder, Groq Vision image inspector
└── utils/
    └── budgetAndSchedule.js             # Deterministic cent-exact currency reconciliation & monotonic deadline scheduler
```

---

## 3. LangGraph Workflows

### Workflow 1: AI Project Requirement Analyzer & Milestone Generator

**File:** `backend/src/ai/graphs/milestoneGeneratorGraph.js`  
**Endpoints:** `POST /api/ai/generate-milestones`, `POST /api/ai/projects/:projectId/generate-milestones`

```text
START
  │
  ▼
analyzeRequirements   ──► Extracts objectives, core features, dependencies, ambiguities, risk flags
  │
  ▼
breakDownTasks        ──► Converts requirements into ordered engineering tasks with complexity weights
  │
  ▼
planMilestones        ◄──┐ Groups tasks into sequential milestones with deliverables & acceptance criteria
  │                      │
  ▼                      │ (retry when !validationPassed && attemptCount < 2,
allocateBudgets          │  passing validationErrors back into planning context)
  │                      │
  ▼                      │
validatePlan ────────────┘
  │
  ▼ (passed or max attempts reached)
finalizeOutput        ──► Deterministic safeguard sanitizing deliverables, cent-exact budget & deadlines
  │
  ▼
END
```

- **State channels (`MilestoneGeneratorState`):** `title`, `description`, `budget`, `currency`, `deadline`, `requirementAnalysis`, `tasks`, `draftMilestones`, `allocatedMilestones`, `validationErrors`, `validationPassed`, `attemptCount`, `milestones`.
- **Deterministic Guarantees (`budgetAndSchedule.js`):**
  - `reconcileMilestoneBudgets()` allocates integer cents using the largest-remainder strategy so `sum(paymentAmount) === budget` down to exact cents.
  - `reconcileMilestoneDeadlines()` enforces strictly non-decreasing deadlines capped by the project deadline.
  - Persistence via `POST /api/ai/projects/:projectId/generate-milestones` (`persist !== false`) is permitted only for `DRAFT` or `AGREEMENT_PENDING` projects whose existing milestones are all still `PENDING`.

---

### Workflow 2: AI Deliverable Evaluation Agent

**File:** `backend/src/ai/graphs/deliverableEvaluationGraph.js`  
**Endpoints:** `POST /api/ai/milestones/:milestoneId/evaluate`, `GET /api/ai/milestones/:milestoneId/evaluation`

```text
START
  │
  ▼
requirementRetrieval  ──► Loads Project, Milestone (deliverables & criteria), Submission & version history
  │
  ▼
submissionAnalysis    ──► Inspects GitHub repo (REST API + README + key code files), decodes text docs,
  │                       and analyzes image screenshots using GROQ_VISION_MODEL
  ▼
evaluation           ◄──┐ Compares observed evidence against every acceptance criterion verbatim
  │                     │
  ▼                     │ (retry when !verificationPassed && attemptCount < 2,
verification ───────────┘  flagging missing criteria or empty recommendations)
  │
  ▼
reportGeneration      ──► Aligns criteria, deterministically computes overallScore, builds improvementSuggestions
  │                       & analysisMetadata
  ▼
END
```

- **Real Inspection (`submissionInspector.js`):**
  - Parses GitHub URLs and queries repository metadata, recent commits, tree listing, `README`, `package.json`, and milestone-relevant source files via GitHub REST API.
  - **Honest Failure Handling:** If a repository is private (`401`/`403`/`404` without valid access) or unreachable, `analysisMetadata.githubAccessible` is `false` with `githubError` recorded, and the model is instructed never to fabricate inspection results.
  - **SSRF Protection:** `isSafeExternalUrl()` blocks non-HTTP(S) protocols, `localhost`, `.local`, private RFC1918 IPv4 ranges, link-local metadata IPs (`169.254.0.0/16`), and IPv6 loopback/ULA addresses before fetching external attachments.
  - **Multimodal Vision:** Inline `data:image/...` or safe image attachments are analyzed with `meta-llama/llama-4-scout-17b-16e-instruct`.
- **Deterministic Scoring:** `overallScore` is computed mathematically as `Math.round((completedRequirements.length / totalCriteria) * 100)` rather than trusting arbitrary LLM arithmetic.
- **Notifications:** Saving an `AIEvaluation` creates an `EVALUATION_COMPLETE` notification for the project client.

---

### Workflow 3: AI Project Assistant

**File:** `backend/src/ai/graphs/projectAssistantGraph.js`  
**Endpoint:** `POST /api/ai/projects/:projectId/assistant`

```text
START
  │
  ▼
contextRetrieval              ──► Loads MongoDB Project, Milestones, Submissions, AIEvaluations, and Payment escrow metrics
  │
  ▼
intentClassification          ──► Classifies intent: progress_summary | milestone_requirements | delay_risk |
  │                               payment_escrow | evaluation_disagreement | general
  ├──(evaluation_disagreement)──► disputeFocus
  ├──(delay_risk / payment_escrow)──► riskAndEscrowFocus
  └──(other intents)────────────► progressAndRequirementsFocus
  │
  ▼
assistantResponse             ──► Generates grounded answer, highlights[], and suggestedNextSteps[]
  │
  ▼
END
```

---

## 4. Human-in-the-Loop & Security Boundaries

1. **No Autonomous Approvals or Payments:** AI agents NEVER transition milestones to `APPROVED` or `PAID`, and NEVER invoke PayPal capture or void APIs. Clients must explicitly review reports and trigger approval and capture actions.
2. **Project Participant Authorization:** `/api/ai/milestones/:milestoneId/*` and `/api/ai/projects/:projectId/assistant` verify JWT authentication and confirm the caller is the project's `clientId` or `freelancerId`; milestone generation is restricted to the `client` owner.
3. **PayPal Budget & Currency Alignment:** `paypalService.createOrder()` and `paypalService.captureAuthorization()` accept project-level `budget` and `currency` from `paymentController.js` while retaining `$10.00 USD` defaults for Member A's standalone `/api/paypal` sandbox test route.

---

## 5. Automated Verification Scope

- **Backend Tests (`MilestonePay/backend` -> `npm test`):** `tests/ai.test.js` covers 12 unit/workflow tests across 7 suites (Zod v4 + `ChatGroq.withStructuredOutput` binding, deterministic budget & deadline reconciliation, GitHub/SSRF/vision inspector, all 3 LangGraph workflows using fake LLM and `fetch` doubles, and `aiController` input/key validation).
- **Frontend Tests, Lint & Build (`MilestonePay/frontend` -> `npm test`, `npm run lint`, `npm run build`):** `tests/frontend.test.js` covers 5 tests across 2 suites verifying formatters and real `/api/ai/*` `aiService` routing with mock AI disabled, alongside ESLint and Vite production compilation.
- **Live Runtime Prerequisite:** Executing live Groq inference and end-to-end MongoDB/PayPal flows requires valid `GROQ_API_KEY` and `JWT_SECRET` values in `MilestonePay/backend/.env`.
