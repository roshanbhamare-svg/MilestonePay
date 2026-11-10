# MilestonePay – Backend API & Database Documentation

This document describes the backend architecture, database schemas, authentication, and complete API reference implemented for **Member B**. It serves as the integration contract for **Member C (Frontend)** and **Member D (LangGraph AI)**.

---

## 1. Quick Start & Demo Credentials

### Run Backend
```bash
cd backend
npm install
npm run seed     # Seeds demo users, projects, and milestones into MongoDB
npm run dev      # Starts Express server on http://localhost:5001
```

### Seed Accounts
| Role | Email | Password |
|---|---|---|
| **Client** | `client@milestonepay.com` | `password123` |
| **Freelancer** | `freelancer@milestonepay.com` | `password123` |

---

## 2. Authentication & Authorization

All protected routes require a JSON Web Token (JWT) passed in the `Authorization` header:

```http
Authorization: Bearer <jwt_token>
```

- Tokens expire in **7 days**.
- Roles: `client` or `freelancer`.
- Client-only endpoints return `403 Access denied` if called by a freelancer.
- Freelancer-only endpoints return `403 Access denied` if called by a client.

---

## 3. Database Entity Relationships

```
User (client | freelancer)
  ├── Project (clientId, freelancerId)
  │     ├── Milestone (projectId, order, paymentAmount)
  │     │     ├── Submission (milestoneId, submittedBy, files, githubUrl)
  │     │     └── AIEvaluation (milestoneId, submissionId, criteriaResults)
  │     └── Payment (projectId, clientId, authorizationId, captures[])
  └── Notification (userId, type, message, read)
```

---

## 4. State Management Lifecycles

### Project Lifecycle
```
DRAFT ──(assign freelancer)──> AGREEMENT_PENDING ──(both accept)──> ACTIVE ──(all paid)──> COMPLETED
  │                                   │
  └────────(cancel)───────────────────┴──(reject)──> DRAFT / CANCELLED
```

### Milestone Lifecycle
```
PENDING ──> IN_PROGRESS ──> SUBMITTED ──> UNDER_REVIEW ──> APPROVED ──> PAID
                                │             │
                                └──(changes)──┴──> CHANGES_REQUESTED ──(resubmit)──> RESUBMITTED ──> UNDER_REVIEW
```

### Payment Lifecycle
```
PENDING ──(PayPal checkout approved)──> AUTHORIZED ──(milestone approved capture)──> PARTIALLY_CAPTURED ──(all captured)──> COMPLETED
```

---

## 5. API Reference

### Auth Endpoints (`/api/auth`)

#### `POST /api/auth/register`
Create a new user account.
```json
// Request
{
  "name": "Jane Doe",
  "email": "jane@example.com",
  "password": "password123",
  "role": "client" // "client" | "freelancer"
}

// Response (201)
{
  "success": true,
  "data": {
    "user": {
      "_id": "67b01...",
      "name": "Jane Doe",
      "email": "jane@example.com",
      "role": "client",
      "profile": { "bio": "", "skills": [], "avatar": "" }
    },
    "token": "eyJhbGciOi..."
  }
}
```

#### `POST /api/auth/login`
Authenticate existing user.
```json
// Request
{
  "email": "jane@example.com",
  "password": "password123"
}

// Response (200)
{
  "success": true,
  "data": {
    "user": { "_id": "...", "name": "Jane Doe", "email": "jane@example.com", "role": "client" },
    "token": "eyJhbGciOi..."
  }
}
```

#### `GET /api/auth/profile` *(Protected)*
Fetch profile of logged-in user.

#### `PUT /api/auth/profile` *(Protected)*
Update name, bio, skills, or avatar.

---

### Project Endpoints (`/api/projects`)

#### `POST /api/projects` *(Client only)*
Create a new project.
```json
// Request
{
  "title": "E-Commerce App",
  "description": "Full stack store with cart and payments.",
  "budget": 300,
  "currency": "USD",
  "deadline": "2026-12-31T00:00:00.000Z"
}
```

#### `GET /api/projects` *(Protected)*
Returns all projects for the authenticated user (client or freelancer).

#### `GET /api/projects/:projectId` *(Protected)*
Fetch project details including client and freelancer details.

#### `PUT /api/projects/:projectId` *(Client only)*
Update project details (only when status is `DRAFT`).

#### `POST /api/projects/:projectId/assign` *(Client only)*
Assign a freelancer to the project. Moves status to `AGREEMENT_PENDING`.
```json
{ "freelancerId": "67b0..." }
```

#### `POST /api/projects/:projectId/accept` *(Protected)*
Accept project agreement (both client and freelancer must accept to move project to `ACTIVE`).

#### `POST /api/projects/:projectId/reject` *(Protected)*
Reject agreement. Resets status to `DRAFT` and unassigns freelancer.

#### `POST /api/projects/:projectId/cancel` *(Client only)*
Cancel project.

---

### Milestone Endpoints (`/api/milestones`)

#### `POST /api/milestones/project/:projectId` *(Client only)*
Create an individual milestone. Enforces total milestone payment cannot exceed project budget.
```json
{
  "title": "Frontend Setup",
  "description": "Setup Vite React and Tailwind",
  "paymentAmount": 100,
  "deadline": "2026-12-01T00:00:00.000Z",
  "deliverables": [{ "title": "Repo link", "description": "GitHub repository" }],
  "acceptanceCriteria": [{ "criteria": "Working build", "completed": false }]
}
```

#### `POST /api/milestones/project/:projectId/bulk` *(Client only)*
Bulk create/replace milestones (e.g. from AI generator). Validates sum of milestone amounts equals project budget.

#### `GET /api/milestones/project/:projectId` *(Protected)*
List all milestones for a project in order.

#### `PATCH /api/milestones/:milestoneId/status` *(Protected)*
Update status with strict role and transition validation.

---

### Submission Endpoints (`/api/submissions`)

#### `POST /api/submissions/milestone/:milestoneId` *(Freelancer only)*
Submit work for a milestone.
```json
{
  "githubUrl": "https://github.com/user/project",
  "files": [
    { "filename": "screenshot.png", "url": "https://example.com/shot.png", "fileType": "image" }
  ],
  "notes": "Completed initial auth and UI views."
}
```

#### `GET /api/submissions/milestone/:milestoneId` *(Protected)*
Fetch submission history for a milestone.

---

### Approval Workflow Endpoints (`/api/approvals`)

#### `POST /api/approvals/:milestoneId/review` *(Client only)*
Start reviewing submitted milestone (moves status to `UNDER_REVIEW`).

#### `POST /api/approvals/:milestoneId/approve` *(Client only)*
Approve milestone deliverables (moves status to `APPROVED`).

#### `POST /api/approvals/:milestoneId/request-changes` *(Client only)*
Request modifications on milestone (moves status to `CHANGES_REQUESTED`).
```json
{ "reason": "Missing responsive mobile layout for sidebar." }
```

---

### Payment Business Logic Endpoints (`/api/payments`)

#### `POST /api/payments/projects/:projectId/authorize` *(Client only)*
Create a PayPal authorization order for the project budget.

#### `POST /api/payments/complete-authorization` *(Client only)*
Record buyer approval and store the PayPal Authorization ID in MongoDB.
```json
{ "orderId": "5O190127TN364715T" }
```

#### `POST /api/payments/milestones/:milestoneId/capture` *(Client only)*
Captures approved milestone funds from the PayPal authorization. Updates Payment and Milestone records in MongoDB to `PAID`.

#### `GET /api/payments/projects/:projectId` *(Protected)*
Fetch payment and capture history for a project.

#### `POST /api/payments/projects/:projectId/void` *(Client only)*
Void unused authorized funds.

---

### AI Integration Endpoints (`/api/ai`) *(Contract for Member D)*

#### `POST /api/ai/projects/:projectId/generate-milestones` *(Protected)*
Input endpoint for LangGraph milestone generator agent.

#### `POST /api/ai/milestones/:milestoneId/evaluate` *(Protected)*
Input endpoint for LangGraph submission evaluation agent.

#### `GET /api/ai/milestones/:milestoneId/evaluation` *(Protected)*
Fetch AI evaluation report for a milestone.

---

### Notification Endpoints (`/api/notifications`)

#### `GET /api/notifications` *(Protected)*
Get user's notifications and unread count.

#### `PATCH /api/notifications/:notificationId/read` *(Protected)*
Mark a notification as read.

#### `PATCH /api/notifications/mark-all-read` *(Protected)*
Mark all user notifications as read.
