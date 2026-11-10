# MilestonePay – Payment Flow Documentation

## Complete Process Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                     CLIENT CREATES PROJECT                       │
│  Describes project → AI generates milestones with amounts        │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      STEP 1: CREATE ORDER                        │
│                                                                  │
│  React → POST /api/paypal/create-order                          │
│       ← { orderId, status: "CREATED" }                          │
│                                                                  │
│  PayPal creates an AUTHORIZE-intent order                        │
│  Fixed $10 for integration test; real amount = project budget    │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     STEP 2: BUYER APPROVAL                       │
│                                                                  │
│  React PayPal SDK opens sandbox checkout popup                   │
│  Buyer logs in with Sandbox Personal account                     │
│  Buyer reviews the authorization amount                          │
│  Buyer clicks "Authorize"                                        │
│       ← SDK calls onApprove({ orderId })                         │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                     STEP 3: AUTHORIZATION                        │
│                                                                  │
│  React → POST /api/paypal/authorize/:orderId                    │
│       ← { authorizationId, authorizationStatus: "CREATED" }     │
│                                                                  │
│  PayPal reserves the full project budget                         │
│  Funds are HELD (not transferred yet)                            │
│  authorizationId stored in project record (by Member B)          │
│                                                                  │
│  AUTHORIZATION EXPIRATION:                                       │
│    • 29 days maximum authorization period                        │
│    • First capture must occur within 3 days (honored period)     │
│    • After 3 days, capture still possible but not guaranteed     │
│    • After 29 days, authorization expires – new order needed     │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼ (For each milestone)
┌─────────────────────────────────────────────────────────────────┐
│               STEP 4: MILESTONE WORK & SUBMISSION                │
│                                                                  │
│  Freelancer completes milestone work                             │
│  Freelancer submits deliverables through MilestonePay            │
│  AI evaluates submission against acceptance criteria             │
│  AI generates evaluation report                                  │
└───────────────────────────────┬─────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│               STEP 5: CLIENT REVIEW & APPROVAL                   │
│                                                                  │
│  Client reviews freelancer's submission                          │
│  Client reviews AI evaluation report                             │
│  Client either:                                                  │
│    ✅ Approves → triggers payment capture                        │
│    ❌ Requests modifications → back to Step 4                    │
│                                                                  │
│  Explicit client approval is recorded in DB (Member B)           │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (After approval)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                   STEP 6: CAPTURE PAYMENT                        │
│                                                                  │
│  Backend → POST /api/paypal/capture/:authorizationId            │
│    Body: { amount: milestoneAmount, finalCapture: false/true }   │
│       ← { captureId, status: "COMPLETED" }                       │
│                                                                  │
│  PRODUCTION RULES (Member B must enforce):                       │
│    • Amount comes from MongoDB milestone record                  │
│    • NEVER from frontend request body                            │
│    • Verify authenticated user = project client                  │
│    • Verify explicit DB approval exists                          │
│    • Verify remaining authorization ≥ capture amount             │
│    • Mark milestone as PAID only after PayPal confirms           │
│    • For the last milestone: finalCapture = true                 │
│                                                                  │
│  PARTIAL CAPTURE EXAMPLE ($10 project, 2 milestones):           │
│    Milestone 1: amount="3.00", finalCapture=false                │
│    Milestone 2: amount="7.00", finalCapture=true                 │
└───────────────────────────────┬─────────────────────────────────┘
                                │ (Repeat for each milestone)
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│                      PROJECT COMPLETE                            │
│                                                                  │
│  All milestones completed and paid                               │
│  Authorization fully captured (finalCapture=true)               │
│  Project status → COMPLETED                                      │
└─────────────────────────────────────────────────────────────────┘
```

---

## Authorization Expiration and Limitations

| Constraint | Detail |
|------------|--------|
| **Max authorization period** | 29 days |
| **Honored capture period** | 3 days from authorization |
| **After 3 days** | Capture possible but not guaranteed |
| **After 29 days** | Authorization expired; new order required |
| **Multiple captures** | Allowed; each partial reduces remaining amount |
| **Final capture** | Must set `finalCapture=true` on last milestone |
| **Void** | Only possible if not fully captured |

> **Important**: For long projects, the team must implement authorization re-authorization before the 29-day expiry. This is out of scope for the current integration but Member B should plan for it.

---

## PayPal Authorization vs. Escrow

> **MilestonePay does NOT provide legal escrow services.**

PayPal authorization reserves funds from the buyer's account and holds them against the merchant's available balance. Key differences from escrow:

- PayPal can release holds for disputes, chargebacks, or compliance reasons
- Captured funds go to the seller (Partner Business Sandbox account)
- Multi-seller payouts require PayPal Partner approval and seller onboarding
- For the hackathon demo: single seller receives all milestone payments

---

## Responsibility Matrix

| Component | Owner | Status |
|-----------|-------|--------|
| PayPal SDK initialization | Member A | ✅ Done |
| Order creation API | Member A | ✅ Done |
| Authorization API | Member A | ✅ Done |
| Webhook receiver + verification | Member A | ✅ Done |
| React PayPal checkout button | Member A | ✅ Done |
| MongoDB schemas (User, Project, Milestone) | Member B | 🔲 Pending |
| Authentication middleware | Member B | 🔲 Pending |
| Production capture endpoint (with DB) | Member B | 🔲 Pending |
| Payment records in MongoDB | Member B | 🔲 Pending |
| Webhook → MongoDB event handler | Member B | 🔲 Pending |
| Client dashboard UI | Member C | 🔲 Pending |
| Freelancer dashboard UI | Member C | 🔲 Pending |
| Payment history UI | Member C | 🔲 Pending |
| AI milestone generator | Member D | 🔲 Pending |
| AI submission evaluator | Member D | 🔲 Pending |

---

## Webhook Event Flow

```
PayPal Event → POST /api/paypal/webhook
                    │
                    ├─ Verify signature (PAYPAL-TRANSMISSION-SIG)
                    │   └─ Reject if invalid (401)
                    │
                    ├─ Return 200 immediately
                    │
                    └─ Handle event async:
                         CHECKOUT.ORDER.APPROVED       → Update order status
                         PAYMENT.AUTHORIZATION.CREATED → Store authorizationId
                         PAYMENT.AUTHORIZATION.VOIDED  → Cancel pending milestones
                         PAYMENT.CAPTURE.COMPLETED     → Mark milestone PAID
                         PAYMENT.CAPTURE.PENDING       → Mark milestone PENDING_REVIEW
                         PAYMENT.CAPTURE.DENIED        → Mark milestone FAILED
```

---

## Security Notes

| Rule | Implementation |
|------|---------------|
| Client Secret never in frontend | ✅ Backend-only |
| Payment amounts from DB only | ✅ Enforced in production path |
| Webhook signature verification | ✅ Uses PayPal verify-webhook-signature API |
| Capture endpoint disabled in production | ✅ Returns 403 if `PAYPAL_ENV=production` |
| Rate limiting on API | ✅ 100 req/15min per IP |
| Helmet security headers | ✅ Enabled |
| Mark paid only after PayPal confirms | ✅ Webhook-driven |
