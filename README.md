# MilestonePay

**AI-Powered Milestone-Based Payment Platform**

A hackathon project that connects freelancers and clients through milestone-based PayPal payments, with AI-powered project planning and submission evaluation.

---

## Overview

MilestonePay solves the trust gap between freelancers and clients:

- **Clients** authorize the full project payment upfront via PayPal, without it being immediately charged
- **Freelancers** submit work per milestone and receive payment only after client approval
- **AI** breaks projects into milestones and evaluates submissions against predefined criteria
- **PayPal** holds funds via authorization and releases them per milestone via capture

---

## Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, Vite 8, React Router v7 |
| UI | Lucide React, Inline styles |
| PayPal (Frontend) | @paypal/react-paypal-js v10 (SDK v6 API) |
| HTTP Client | Axios |
| Backend | Node.js, Express 5, ES Modules |
| Database | MongoDB Atlas, Mongoose |
| PayPal (Backend) | @paypal/paypal-server-sdk v2.5.0 |
| Security | Helmet, express-rate-limit, CORS |
| Logging | Morgan |
| AI | LangGraph.js (`@langchain/langgraph`), Groq (`@langchain/groq`), Zod |

---

## Repository Structure

```
MilestonePay/
├── backend/
│   ├── src/
│   │   ├── ai/
│   │   │   ├── graphs/                   # LangGraph workflows (generator, evaluator, assistant)
│   │   │   ├── tools/                    # GitHub REST API, SSRF guard & vision inspector
│   │   │   ├── utils/                    # Deterministic budget & deadline reconciliation
│   │   │   ├── llmClient.js              # Groq ChatGroq & structured-output helper
│   │   │   └── schemas.js                # Zod structured output schemas
│   │   ├── config/
│   │   │   ├── db.js                     # MongoDB connection
│   │   │   └── paypalClient.js           # PayPal SDK client (lazy init)
│   │   ├── controllers/                  # Express route handlers (auth, projects, AI, PayPal...)
│   │   ├── models/                       # Mongoose schemas (User, Project, Milestone, AIEvaluation...)
│   │   ├── routes/                       # Express routers (/api/auth, /api/ai, /api/paypal...)
│   │   ├── services/
│   │   │   ├── paypalService.js          # PayPal business logic
│   │   │   └── paypalWebhookService.js   # Webhook verification & handlers
│   │   └── server.js                     # Express app entry point
│   ├── tests/
│   │   └── ai.test.js                    # Backend LangGraph, GitHub inspector & controller tests
│   ├── .env                              # Private (gitignored)
│   ├── .env.example                      # Template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── api/                          # Axios client and REST API modules
│   │   ├── components/                   # Dashboard, milestone, submission, payment & AI components
│   │   ├── pages/                        # Role dashboards, project views & checkout pages
│   │   ├── services/
│   │   │   └── aiService.js              # Real LangGraph AI API client
│   │   ├── App.jsx                       # Router and routes
│   │   ├── main.jsx                      # React entry point
│   │   └── index.css
│   ├── tests/
│   │   └── frontend.test.js              # Frontend utility and aiService tests
│   ├── .env                              # Private (gitignored)
│   ├── .env.example                      # Template
│   └── package.json
│
├── README.md
├── PAYPAL_SETUP.md                       # PayPal configuration guide
├── PAYPAL_API.md                         # API endpoint documentation
├── PAYPAL_FLOW.md                        # Complete payment flow documentation
├── BACKEND_API.md                        # Member B & D complete API & schemas documentation
├── FRONTEND_API.md                       # Member C frontend architecture & AI integration guide
├── AI_ARCHITECTURE.md                    # Member D LangGraph.js agents & setup guide
└── MilestonePay_MemberB_API.postman_collection.json
```

---

## Installation

### Prerequisites

- Node.js 18+
- MongoDB Atlas account
- PayPal Developer account with Sandbox app

### Backend Setup

```bash
cd backend
npm install
cp .env.example .env
# Fill in .env with your credentials
npm run dev
```

### Frontend Setup

```bash
cd frontend
npm install
cp .env.example .env
# Fill in VITE_PAYPAL_CLIENT_ID
npm run dev
```

---

## Environment Configuration

### Backend (`backend/.env`)

```env
PORT=5001
CLIENT_URL=http://localhost:5173
MONGODB_URI=mongodb+srv://...
JWT_SECRET=your_jwt_secret_key_here
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_ENV=sandbox
PAYPAL_WEBHOOK_ID=your_webhook_id

# LangGraph.js AI Configuration (Groq)
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.3-70b-versatile
GROQ_VISION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct

# Optional GitHub token for inspecting private freelancer repositories
GITHUB_TOKEN=
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5001
VITE_PAYPAL_CLIENT_ID=your_sandbox_client_id
VITE_USE_MOCK_AI=false
```

> ⚠️ **Never commit `.env` files. The `.gitignore` excludes them.**

---

## Running the Application

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | `backend/` | Start Express backend (port 5001) |
| `npm test` | `backend/` | Run backend unit & LangGraph workflow tests |
| `npm run dev` | `frontend/` | Start Vite frontend (port 5173) |
| `npm test` | `frontend/` | Run frontend utility & AI client tests |

---

## PayPal Sandbox Testing

1. Start both backend and frontend
2. Navigate to `http://localhost:5173/checkout`
3. Click the **PayPal** button
4. Log in with your Sandbox **Personal (buyer)** account
5. Authorize the $10.00 test payment
6. The backend authorizes the order and displays the **Authorization ID**

### Test Milestone Captures (via API)

After authorization, test captures with Postman or curl:

```bash
# Capture milestone 1 ($3)
curl -X POST http://localhost:5001/api/paypal/capture/AUTH_ID_HERE \
  -H "Content-Type: application/json" \
  -d '{"amount": "3.00", "finalCapture": false}'

# Capture final milestone ($7)
curl -X POST http://localhost:5001/api/paypal/capture/AUTH_ID_HERE \
  -H "Content-Type: application/json" \
  -d '{"amount": "7.00", "finalCapture": true}'
```

---

## API Endpoints

| Method | Path | Description |
|--------|------|-------------|
| `GET` | `/api/health` | Health check with MongoDB status |
| `POST` | `/api/paypal/create-order` | Create authorization order |
| `POST` | `/api/paypal/authorize/:orderId` | Authorize approved order |
| `POST` | `/api/paypal/capture/:authorizationId` | Capture milestone (sandbox only) |
| `POST` | `/api/paypal/void/:authorizationId` | Void authorization |
| `GET` | `/api/paypal/order/:orderId` | Get order details |
| `GET` | `/api/paypal/authorization/:authorizationId` | Get authorization details |
| `POST` | `/api/paypal/webhook` | PayPal webhook receiver |
| `POST` | `/api/ai/generate-milestones` | Preview LangGraph AI milestone breakdown from project brief |
| `POST` | `/api/ai/projects/:projectId/generate-milestones` | Generate & persist AI milestones for an editable project |
| `POST` | `/api/ai/milestones/:milestoneId/evaluate` | Evaluate submitted code, docs & screenshots via LangGraph |
| `GET` | `/api/ai/milestones/:milestoneId/evaluation` | Fetch saved AI evaluation report |
| `POST` | `/api/ai/projects/:projectId/assistant` | Query context-aware AI project & escrow assistant |

See [PAYPAL_API.md](./PAYPAL_API.md) for PayPal endpoints, [BACKEND_API.md](./BACKEND_API.md) for complete application & business APIs, [FRONTEND_API.md](./FRONTEND_API.md) for frontend integration, and [AI_ARCHITECTURE.md](./AI_ARCHITECTURE.md) for LangGraph.js workflows and setup.

---

## Team

| Member | Responsibility |
|--------|---------------|
| **A** | Project setup, PayPal integration, webhooks ✅ |
| **B** | MongoDB schemas, authentication, business APIs ✅ |
| **C** | Complete frontend UI and dashboards ✅ |
| **D** | LangGraph.js AI agents for milestone generation, deliverable evaluation & project assistance ✅ |

---

## Security

- PayPal Client Secret is **backend-only** (never in frontend)
- Webhook signatures are **verified with PayPal's official API**
- Payment amounts come from **MongoDB only** (never from request body)
- The sandbox capture endpoint is **disabled in production**
- All APIs have **rate limiting** (100 req/15min)
- **Helmet** security headers on all responses
