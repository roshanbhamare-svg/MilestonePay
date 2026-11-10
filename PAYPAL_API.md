# MilestonePay – PayPal API Reference

**Base URL**: `http://localhost:5001` (development)

All endpoints return JSON. Successful responses have `{ "success": true, "data": {...} }`. Errors return `{ "success": false, "error": "..." }`.

---

## Endpoints

### 1. Create Order

**`POST /api/paypal/create-order`**

Creates a PayPal authorization order. Uses a fixed $10.00 USD amount for the integration test.

**Request Body**: None

**Response (201)**:
```json
{
  "success": true,
  "data": {
    "orderId": "5O190127TN364715T",
    "status": "CREATED",
    "links": [
      {
        "href": "https://api-m.sandbox.paypal.com/v2/checkout/orders/5O190127TN364715T",
        "rel": "self",
        "method": "GET"
      },
      {
        "href": "https://www.sandbox.paypal.com/checkoutnow?token=5O190127TN364715T",
        "rel": "approve",
        "method": "GET"
      }
    ],
    "_note": "SANDBOX MODE – Fixed $10.00 integration test amount"
  }
}
```

**Error (401)**:
```json
{
  "success": false,
  "error": "Failed to create PayPal order",
  "details": { "error": "invalid_client", "error_description": "Client Authentication failed" }
}
```

---

### 2. Authorize Order

**`POST /api/paypal/authorize/:orderId`**

Authorizes a buyer-approved order. Call this after the PayPal SDK's `onApprove` callback fires.

**URL Parameter**: `orderId` – The order ID from create-order

**Request Body**: None

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "orderId": "5O190127TN364715T",
    "authorizationId": "2DC87612EK520411B",
    "authorizationStatus": "CREATED",
    "amount": {
      "currencyCode": "USD",
      "value": "10.00"
    }
  }
}
```

**Error (422 – already authorized)**:
```json
{
  "success": false,
  "error": "Failed to authorize PayPal order",
  "details": { "name": "UNPROCESSABLE_ENTITY", "details": [...] }
}
```

---

### 3. Capture Milestone Payment (Dev/Sandbox Only)

**`POST /api/paypal/capture/:authorizationId`**

> ⚠️ **SANDBOX/DEV ONLY** – Disabled in production (`PAYPAL_ENV=production`).
> Member B must implement the production endpoint with authentication, MongoDB milestone lookup, and amount validation.

**URL Parameter**: `authorizationId` – The authorization ID from authorize-order

**Request Body**:
```json
{
  "amount": "3.00",
  "finalCapture": false,
  "idempotencyKey": "optional-stable-key-for-retries"
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `amount` | string | ✅ | Positive dollar amount (e.g., `"3.00"`) |
| `finalCapture` | boolean | ✅ | `true` for the last milestone capture |
| `idempotencyKey` | string | ❌ | Stable key for safe retries |

**Test Cases**:
- First milestone: `{ "amount": "3.00", "finalCapture": false }`
- Final milestone: `{ "amount": "7.00", "finalCapture": true }`

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "captureId": "3C679366HH908993T",
    "status": "COMPLETED",
    "amount": {
      "currencyCode": "USD",
      "value": "3.00"
    },
    "finalCapture": false,
    "_devNote": "SANDBOX TEST ONLY – Replace with Member B milestone capture in production"
  }
}
```

**Capture Status Values**:
| Status | Meaning |
|--------|---------|
| `COMPLETED` | Payment transferred to seller |
| `PENDING` | Under review (fraud check, bank hold) |
| `DENIED` | PayPal denied the capture |

**Error (403 – production mode)**:
```json
{
  "success": false,
  "error": "Direct capture endpoint is disabled in production."
}
```

---

### 4. Void Authorization

**`POST /api/paypal/void/:authorizationId`**

Voids an authorization that has not been fully captured. Handles already-captured and expired authorizations gracefully.

**URL Parameter**: `authorizationId`

**Request Body**: None

**Response (200 – voided)**:
```json
{
  "success": true,
  "data": {
    "authorizationId": "2DC87612EK520411B",
    "status": "VOIDED"
  }
}
```

**Response (200 – already captured, cannot void)**:
```json
{
  "success": true,
  "data": {
    "authorizationId": "2DC87612EK520411B",
    "status": "CANNOT_VOID",
    "reason": "Authorization has already been captured."
  }
}
```

**Response (200 – not found)**:
```json
{
  "success": true,
  "data": {
    "authorizationId": "...",
    "status": "NOT_FOUND",
    "reason": "Authorization ID not found"
  }
}
```

---

### 5. Get Order Details

**`GET /api/paypal/order/:orderId`**

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "orderId": "5O190127TN364715T",
    "status": "APPROVED",
    "intent": "AUTHORIZE",
    "amount": {
      "currencyCode": "USD",
      "value": "10.00"
    },
    "payments": {
      "authorizations": [...]
    },
    "createTime": "2026-11-09T...",
    "updateTime": "2026-11-09T..."
  }
}
```

---

### 6. Get Authorization Details

**`GET /api/paypal/authorization/:authorizationId`**

**Response (200)**:
```json
{
  "success": true,
  "data": {
    "authorizationId": "2DC87612EK520411B",
    "status": "CREATED",
    "amount": {
      "currencyCode": "USD",
      "value": "10.00"
    },
    "expirationTime": "2026-12-08T...",
    "createTime": "2026-11-09T...",
    "updateTime": "2026-11-09T...",
    "orderId": "5O190127TN364715T"
  }
}
```

---

### 7. Webhook Receiver

**`POST /api/paypal/webhook`**

Receives and verifies PayPal webhook events. Returns `200` immediately after verification; event handling is async.

**Headers Required** (sent automatically by PayPal):
```
PAYPAL-TRANSMISSION-ID: ...
PAYPAL-TRANSMISSION-TIME: ...
PAYPAL-CERT-URL: https://api.paypal.com/v1/notifications/certs/...
PAYPAL-TRANSMISSION-SIG: ...
PAYPAL-AUTH-ALGO: SHA256withRSA
```

**Response (200 – verified)**:
```json
{ "received": true }
```

**Response (401 – invalid signature)**:
```json
{ "error": "Webhook signature verification failed" }
```

**Supported Event Types**:
| Event | Trigger |
|-------|---------|
| `CHECKOUT.ORDER.APPROVED` | Buyer approves checkout |
| `PAYMENT.AUTHORIZATION.CREATED` | Authorization created |
| `PAYMENT.AUTHORIZATION.VOIDED` | Authorization voided |
| `PAYMENT.CAPTURE.COMPLETED` | Capture succeeded |
| `PAYMENT.CAPTURE.PENDING` | Capture under review |
| `PAYMENT.CAPTURE.DENIED` | Capture denied |

---

## Authorization Flow

```
1. POST /api/paypal/create-order
   → Returns { orderId }

2. React SDK opens PayPal checkout with orderId
   → Buyer logs in and approves

3. POST /api/paypal/authorize/:orderId
   → Returns { authorizationId }
   → Funds are RESERVED (not captured)

4. POST /api/paypal/capture/:authorizationId (per milestone)
   Body: { amount: "3.00", finalCapture: false }
   → Returns { captureId, status: "COMPLETED" }

5. POST /api/paypal/capture/:authorizationId (final milestone)
   Body: { amount: "7.00", finalCapture: true }
   → Authorization closed

6. (If project cancelled) POST /api/paypal/void/:authorizationId
   → Authorization voided, funds released
```

---

## Error Codes

| HTTP Status | Meaning |
|-------------|---------|
| 400 | Validation error (missing/invalid parameters) |
| 401 | PayPal credential error or invalid webhook signature |
| 403 | Operation not allowed in current environment |
| 404 | Resource not found |
| 422 | PayPal unprocessable entity (e.g., already authorized) |
| 500 | Internal server or PayPal SDK error |
