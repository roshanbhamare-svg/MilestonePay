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
│   └── aiService.js           # LangGraph.js AI backend integration client (/api/ai/*)
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

## 4. LangGraph.js AI Integration (`frontend/src/services/aiService.js`)

All temporary mock AI services (`aiMockService.js`) have been removed (`USE_MOCK_AI = false`, `VITE_USE_MOCK_AI=false`). UI components (`AIMilestoneGenerator.jsx`, `AIEvaluationPanel.jsx`, `AIProjectAssistant.jsx`) call real Express + LangGraph.js endpoints via [frontend/src/services/aiService.js](frontend/src/services/aiService.js) with a `90000ms` timeout for multi-step graph execution.

### Connected AI Endpoints

#### A. Milestone Generator (`POST /api/ai/generate-milestones` & `POST /api/ai/projects/:projectId/generate-milestones`)

- During project creation (`/projects/new`) without a `projectId`, `aiService.generateMilestones` calls `POST /api/ai/generate-milestones` (stateless preview, `persisted: false`).
- Inside `AIMilestoneGenerator.jsx` on an existing project, `aiService.generateMilestones` sends `persist: false` to `POST /api/ai/projects/:projectId/generate-milestones` so the client can review, edit, and confirm milestones (or adjust ambiguity flags in `requirementAnalysis.missingOrAmbiguousRequirements`) before saving via `milestoneApi.create`. Sum of `paymentAmount` matches `budget` down to exact cents.

#### B. Deliverable Evaluation (`POST /api/ai/milestones/:milestoneId/evaluate` & `GET /api/ai/milestones/:milestoneId/evaluation`)

Returns `data.evaluation` matching the `AIEvaluation` Mongoose schema (`overallScore`, `criteriaResults`, `completedRequirements`, `missingRequirements`, `improvementSuggestions`, `recommendations`, `analysisMetadata`) plus verification metadata.

#### C. AI Project Assistant (`POST /api/ai/projects/:projectId/assistant`)

Sends `{ question }` and receives `{ answer, highlights, suggestedNextSteps, intent, answeredAt }` grounded in live MongoDB project, milestone, submission, evaluation, and PayPal escrow data.

### Member D Completion Status

1. Implemented the LangGraph.js workflows (`milestoneGeneratorGraph.js`, `deliverableEvaluationGraph.js`, `projectAssistantGraph.js`) on the backend `/api/ai/*` endpoints.
2. Configured `VITE_USE_MOCK_AI=false` in `frontend/.env` and `USE_MOCK_AI = false` in `frontend/src/services/aiService.js`.
3. Removed `frontend/src/services/aiMockService.js` and updated `frontend/tests/frontend.test.js` to verify real API routing.
4. Existing UI components (`AIMilestoneGenerator.jsx`, `AIEvaluationPanel.jsx`, `AIProjectAssistant.jsx`) connect directly to the LangGraph backend.

---

## 5. Payment Parameterization Update (Member D)

- Updated `backend/src/services/paypalService.js` and `backend/src/controllers/paymentController.js` so `createOrder(amount, currency, description)` and `captureAuthorization(..., currency)` parameterize `project.budget` and `project.currency` (while keeping `$10.00 USD` defaults for Member A's standalone `/api/paypal` sandbox test route).
- Fixed `isFinal` milestone capture closure logic in `paymentController.js` so approving multiple milestones at once does not close the PayPal authorization prematurely when unpaid milestones remain.

