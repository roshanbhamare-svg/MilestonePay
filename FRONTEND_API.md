# MilestonePay – Frontend Architecture & Member D Handover Guide

This document summarizes the **Member C** frontend implementation, backend API integration, and exact mock-to-LangGraph AI replacement contract for **Member D**.

---

## 1. Frontend Architecture Overview

```
frontend/src/
├── api/
│   ├── axiosClient.js         # Shared Axios instance with Bearer JWT interceptor & 401 handler
│   ├── authApi.js             # /api/auth/*
│   ├── projectApi.js          # /api/projects/* and /api/users/freelancers
│   ├── milestoneApi.js        # /api/milestones/*
│   ├── submissionApi.js       # /api/submissions/*
│   ├── approvalApi.js         # /api/approvals/*
│   ├── paymentApi.js          # /api/payments/* and /api/health
│   └── notificationApi.js     # /api/notifications/*
├── services/
│   ├── aiService.js           # Single AI integration facade (controls mock vs LangGraph API)
│   └── aiMockService.js       # Temporary mock AI milestone generator & deliverable evaluator
├── context/
│   ├── AuthContext.jsx        # Session persistence, login, register, logout, profile sync
│   └── ToastContext.jsx       # Global user feedback toasts
├── components/
│   ├── common/                # Button, Card, StatCard, StatusBadge, Modal, Table, Alert, EmptyState
│   ├── layout/                # DashboardLayout, Navbar (with notification popover), Sidebar
│   ├── routing/               # ProtectedRoute (auth + role-based route protection)
│   ├── milestones/            # MilestoneCard, MilestoneFormModal, AIMilestoneGenerator
│   ├── submissions/           # SubmissionModal, SubmissionHistory
│   ├── ai/                    # AIEvaluationPanel, AIProjectAssistant
│   ├── payments/              # ProjectPaymentPanel (PayPal SDK v6 authorization + capture ledger)
│   └── PayPalCheckout.jsx     # Member A standalone PayPal sandbox test component
└── pages/
    ├── HomePage.jsx
    ├── LoginPage.jsx
    ├── RegisterPage.jsx
    ├── DashboardPage.jsx      # Delegates to ClientDashboard or FreelancerDashboard
    ├── ProjectsPage.jsx
    ├── CreateProjectPage.jsx  # Client-only project creation + AI milestone planner
    ├── ProjectDetailPage.jsx  # Workspace: agreements, milestones, submissions, AI review, PayPal
    ├── PaymentsPage.jsx
    ├── NotificationsPage.jsx
    ├── ProfilePage.jsx
    └── NotFoundPage.jsx
```

---

## 2. Routes & Access Matrix

| Route | Access | Description |
|---|---|---|
| `/` | Public | Landing page (auto-redirects authenticated users to `/dashboard`) |
| `/login`, `/register` | Public | Authentication & role selection (`client` / `freelancer`) |
| `/checkout`, `/payment/success`, `/payment/cancel` | Public | Member A PayPal sandbox test & redirect pages |
| `/dashboard` | Protected | Role-specific `ClientDashboard` or `FreelancerDashboard` |
| `/projects` | Protected | Filterable list of user's projects |
| `/projects/new` | Client Only | Create project, preview/edit AI milestones, optionally assign freelancer |
| `/projects/:projectId` | Protected | Full project workspace (agreements, milestones, submissions, AI, payments) |
| `/payments` | Protected | Aggregated authorizations and milestone capture history |
| `/notifications` | Protected | Unread/all notifications feed |
| `/profile` | Protected | Update name, bio, skills, and avatar URL |

---

## 3. Connected Real Backend APIs (Member B + Member A)

All non-AI features are connected directly to Express + MongoDB endpoints:

- **Auth**: `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/profile`, `PUT /api/auth/profile`
- **Users**: `GET /api/users/freelancers`
- **Projects**: `GET /api/projects`, `POST /api/projects`, `GET /api/projects/:projectId`, `PUT /api/projects/:projectId`, `POST /api/projects/:projectId/cancel`, `POST /api/projects/:projectId/assign`, `POST /api/projects/:projectId/accept`, `POST /api/projects/:projectId/reject`
- **Milestones**: `GET /api/milestones/project/:projectId`, `POST /api/milestones/project/:projectId`, `POST /api/milestones/project/:projectId/bulk`, `PUT /api/milestones/:milestoneId`, `PATCH /api/milestones/:milestoneId/status`
- **Submissions**: `POST /api/submissions/milestone/:milestoneId`, `GET /api/submissions/milestone/:milestoneId`
- **Approvals**: `POST /api/approvals/:milestoneId/review`, `POST /api/approvals/:milestoneId/approve`, `POST /api/approvals/:milestoneId/request-changes`
- **Payments (PayPal SDK v6 + Backend)**: `POST /api/payments/projects/:projectId/authorize`, `POST /api/payments/complete-authorization`, `POST /api/payments/milestones/:milestoneId/capture`, `GET /api/payments/projects/:projectId`, `POST /api/payments/projects/:projectId/void`
- **Notifications**: `GET /api/notifications`, `PATCH /api/notifications/:notificationId/read`, `PATCH /api/notifications/mark-all-read`

---

## 4. Temporary Mock AI Layer (For Member D Replacement)

No mock AI data is hardcoded in UI components. All temporary mock AI responses live strictly in:

- [frontend/src/services/aiMockService.js](frontend/src/services/aiMockService.js)
- Controlled by `USE_MOCK_AI` in [frontend/src/services/aiService.js](frontend/src/services/aiService.js) (`VITE_USE_MOCK_AI !== 'false'`).

### Expected AI Contracts

#### A. Milestone Generator (`POST /api/ai/projects/:projectId/generate-milestones`)

**Request from Frontend (`aiService.generateMilestones`):**
```json
{
  "title": "AI-Powered SaaS Dashboard",
  "description": "Full stack app with auth and PayPal billing.",
  "budget": 300,
  "currency": "USD",
  "deadline": "2026-12-31T00:00:00.000Z"
}
```

**Expected Backend Response (`data.milestones`):**
```json
{
  "success": true,
  "data": {
    "milestones": [
      {
        "title": "Architecture, UI Foundation & Setup",
        "description": "...",
        "paymentAmount": 60,
        "deadline": "2026-11-20T00:00:00.000Z",
        "deliverables": [{ "title": "...", "description": "..." }],
        "acceptanceCriteria": [{ "criteria": "...", "completed": false }],
        "order": 1
      }
    ]
  }
}
```
> **Note for Member D:** If generating milestones *before* a project ID exists (on `/projects/new`), either expose an unpersisted preview route or create the project first and call `POST /api/ai/projects/:projectId/generate-milestones`. Sum of `paymentAmount` must equal `budget`.

#### B. Deliverable Evaluation (`POST /api/ai/milestones/:milestoneId/evaluate` & `GET /api/ai/milestones/:milestoneId/evaluation`)

**Expected Backend Response (`data.evaluation` matching `AIEvaluation` schema):**
```json
{
  "success": true,
  "data": {
    "evaluation": {
      "_id": "...",
      "milestoneId": "...",
      "submissionId": "...",
      "overallScore": 85,
      "status": "COMPLETED",
      "criteriaResults": [
        { "criteria": "JWT auth working", "met": true, "comments": "Verified in middleware/auth.js" }
      ],
      "completedRequirements": ["JWT auth working"],
      "missingRequirements": ["Missing integration tests"],
      "improvementSuggestions": ["Add unit tests for token expiry"],
      "recommendations": "Request minor test additions or proceed with approval."
    }
  }
}
```

#### C. AI Project Assistant (`POST /api/ai/projects/:projectId/assistant`)

**Request from Frontend (`aiService.askProjectAssistant`):**
```json
{
  "question": "Which milestones are overdue or at risk?"
}
```

**Expected Backend Response (`data`):**
```json
{
  "success": true,
  "data": {
    "answer": "1 milestone has passed its deadline...",
    "highlights": ["Project status: ACTIVE (1/3 milestones paid)"],
    "suggestedNextSteps": ["Review overdue milestones with the freelancer."]
  }
}
```

### How Member D Switches from Mock to Real LangGraph

1. Implement the LangGraph.js workflows on the backend endpoints listed above.
2. Set `VITE_USE_MOCK_AI=false` in `frontend/.env` (and update `USE_MOCK_AI` default in `frontend/src/services/aiService.js`).
3. Delete `frontend/src/services/aiMockService.js` and remove its import from `frontend/src/services/aiService.js`.
4. Existing UI components (`AIMilestoneGenerator.jsx`, `AIEvaluationPanel.jsx`, `AIProjectAssistant.jsx`) will work immediately without redesign.

---

## 5. Integration Notes Observed During Member C Development

- `backend/src/controllers/paymentController.js` currently calls Member A's `createOrder()` without passing `project.budget` / `project.currency` (so PayPal Sandbox orders default to `$10.00 USD`). Testing end-to-end PayPal sandbox authorization + partial capture works directly with a `$10.00 USD` project, or Member B/D can parameterize `createOrder(amount, currency)` for larger project budgets.

