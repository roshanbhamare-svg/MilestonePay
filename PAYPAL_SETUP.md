# MilestonePay – PayPal Setup Guide

## 1. PayPal Developer Account

1. Go to [https://developer.paypal.com/](https://developer.paypal.com/)
2. Log in with or create your PayPal account.
3. Navigate to **Dashboard → Apps & Credentials**.

---

## 2. Create a Sandbox REST API Application

1. Under **Sandbox** tab, click **Create App**.
2. Fill in:
   - **App Name**: `MilestonePay`
   - **App Type**: `Platform`
3. Click **Create App**.
4. You'll receive:
   - **Sandbox Client ID**
   - **Sandbox Client Secret**
5. Enable these features:
   - **Accept Payments**
   - **Authorization** (critical – enables AUTHORIZE intent)

---

## 3. Configure Environment Variables

### Backend (`backend/.env`)

```env
PORT=5001
CLIENT_URL=http://localhost:5173

MONGODB_URI=mongodb+srv://<user>:<password>@<cluster>.mongodb.net/<dbname>?retryWrites=true&w=majority

PAYPAL_CLIENT_ID=<Your Sandbox Client ID>
PAYPAL_CLIENT_SECRET=<Your Sandbox Client Secret>
PAYPAL_ENV=sandbox
PAYPAL_WEBHOOK_ID=<Your Webhook ID – obtain after creating webhook>
```

### Frontend (`frontend/.env`)

```env
VITE_API_URL=http://localhost:5001
VITE_PAYPAL_CLIENT_ID=<Your Sandbox Client ID>
```

> **Security**: The Client Secret must only be in `backend/.env`. It is never exposed to the frontend.

---

## 4. Sandbox Testing Accounts

Go to **Dashboard → Sandbox → Accounts**:

| Account Type | Role | Used For |
|---|---|---|
| Business (Sandbox) | Seller / Merchant | Receives payments |
| Personal (US, Sandbox) | Buyer | Makes payments |

> Use a **US Personal** account as the buyer. Currency mismatches caused issues in earlier tests – the US account avoids these.

**To get Sandbox account credentials:**
1. Click the account in the list → **View/Edit Account**
2. Use the **Email** and **Password** to log in at checkout

---

## 5. Run the Application

### Backend

```bash
cd backend
npm run dev
```

Runs on: `http://localhost:5001`

### Frontend

```bash
cd frontend
npm run dev
```

Runs on: `http://localhost:5173`

---

## 6. Verify Setup

```bash
curl http://localhost:5001/api/health
```

Expected response:
```json
{
  "status": "ok",
  "message": "MilestonePay backend running",
  "mongodb": "connected",
  "environment": "sandbox",
  "timestamp": "2026-11-09T..."
}
```

---

## 7. Configure Webhooks

### For Local Development (ngrok)

1. Install ngrok: [https://ngrok.com/download](https://ngrok.com/download)
2. Start ngrok:
   ```bash
   ngrok http 5001
   ```
3. Copy the HTTPS URL (e.g., `https://abc123.ngrok-free.app`)

### Register Webhook in PayPal Dashboard

1. Go to **Dashboard → Apps & Credentials → MilestonePay → Webhooks**
2. Click **Add Webhook**
3. Set URL:
   - **Local**: `https://abc123.ngrok-free.app/api/paypal/webhook`
   - **Production**: `https://your-render-backend.onrender.com/api/paypal/webhook`
4. Select these event types:
   - `CHECKOUT.ORDER.APPROVED`
   - `PAYMENT.AUTHORIZATION.CREATED`
   - `PAYMENT.AUTHORIZATION.VOIDED`
   - `PAYMENT.CAPTURE.COMPLETED`
   - `PAYMENT.CAPTURE.PENDING`
   - `PAYMENT.CAPTURE.DENIED`
5. Click **Save**
6. Copy the **Webhook ID**
7. Add to `backend/.env`:
   ```env
   PAYPAL_WEBHOOK_ID=<your-webhook-id>
   ```

### Testing Webhooks

Use the **Simulate Webhook** tool in PayPal Dashboard to send test events.

---

## 8. Payment Flow Summary

```
Client creates project
         ↓
React PayPal button clicked
         ↓
Backend creates AUTHORIZE order ($10 test)
         ↓
Buyer logs in with Sandbox Personal account
         ↓
Buyer approves authorization
         ↓
Backend authorizes order → receives Authorization ID
         ↓
Funds are RESERVED (not charged yet)
         ↓
[ Later: Milestone approved → Backend captures partial amount ]
         ↓
[ Final milestone → Backend captures with finalCapture=true ]
```
