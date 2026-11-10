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
| AI (planned) | LangGraph.js (Member D) |

---

## Repository Structure

```
MilestonePay/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.js                     # MongoDB connection
│   │   │   └── paypalClient.js           # PayPal SDK client (lazy init)
│   │   ├── controllers/
│   │   │   └── paypalController.js       # Express route handlers
│   │   ├── routes/
│   │   │   └── paypalRoutes.js           # PayPal API routes
│   │   ├── services/
│   │   │   ├── paypalService.js          # PayPal business logic
│   │   │   └── paypalWebhookService.js   # Webhook verification & handlers
│   │   └── server.js                     # Express app entry point
│   ├── .env                              # Private (gitignored)
│   ├── .env.example                      # Template
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── PayPalCheckout.jsx        # PayPal integration test UI
│   │   ├── App.jsx                       # Router and routes
│   │   ├── main.jsx                      # React entry point
│   │   └── index.css
│   ├── .env                              # Private (gitignored)
│   ├── .env.example                      # Template
│   └── package.json
│
├── README.md
├── PAYPAL_SETUP.md                       # PayPal configuration guide
├── PAYPAL_API.md                         # API endpoint documentation
├── PAYPAL_FLOW.md                        # Complete payment flow documentation
├── BACKEND_API.md                        # Member B complete API & schemas documentation
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
PAYPAL_CLIENT_ID=your_sandbox_client_id
PAYPAL_CLIENT_SECRET=your_sandbox_client_secret
PAYPAL_ENV=sandbox
PAYPAL_WEBHOOK_ID=your_webhook_id
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5001
VITE_PAYPAL_CLIENT_ID=your_sandbox_client_id
```

> ⚠️ **Never commit `.env` files. The `.gitignore` excludes them.**

---

## Running the Application

| Command | Location | Description |
|---------|----------|-------------|
| `npm run dev` | `backend/` | Start Express backend (port 5001) |
| `npm run dev` | `frontend/` | Start Vite frontend (port 5173) |

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

See [PAYPAL_API.md](./PAYPAL_API.md) for PayPal endpoints and [BACKEND_API.md](./BACKEND_API.md) for complete application & business APIs.

---

## Team

| Member | Responsibility |
|--------|---------------|
| **A** | Project setup, PayPal integration, webhooks ✅ |
| **B** | MongoDB schemas, authentication, business APIs ✅ |
| **C** | Complete frontend UI and dashboards |
| **D** | LangGraph.js AI agents for milestone generation and evaluation |

---

## Security

- PayPal Client Secret is **backend-only** (never in frontend)
- Webhook signatures are **verified with PayPal's official API**
- Payment amounts come from **MongoDB only** (never from request body)
- The sandbox capture endpoint is **disabled in production**
- All APIs have **rate limiting** (100 req/15min)
- **Helmet** security headers on all responses
