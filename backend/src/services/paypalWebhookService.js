/**
 * PayPal Webhook Service
 *
 * Handles incoming PayPal webhook events:
 *   1. Verifies webhook signature using PayPal's official API.
 *   2. Routes events to appropriate handlers.
 *   3. Provides a clean interface for Member B to connect events to MongoDB.
 *
 * Supported Events:
 *   CHECKOUT.ORDER.APPROVED
 *   PAYMENT.AUTHORIZATION.CREATED
 *   PAYMENT.AUTHORIZATION.VOIDED
 *   PAYMENT.CAPTURE.COMPLETED
 *   PAYMENT.CAPTURE.PENDING
 *   PAYMENT.CAPTURE.DENIED
 *
 * Webhook Verification:
 *   Uses PayPal's /v1/notifications/verify-webhook-signature API.
 *   See: https://developer.paypal.com/api/rest/webhooks/rest/
 *
 * ─── HOW TO CONFIGURE WEBHOOKS ─────────────────────────────────────────────
 *
 * 1. Go to: https://developer.paypal.com/dashboard/
 * 2. Select your application: MilestonePay
 * 3. Navigate to: Webhooks → Add Webhook
 * 4. For LOCAL TESTING:
 *    a. Install ngrok: https://ngrok.com/
 *    b. Run: ngrok http 5001
 *    c. Copy the HTTPS forwarding URL (e.g. https://abc123.ngrok-free.app)
 *    d. Set webhook URL: https://abc123.ngrok-free.app/api/paypal/webhook
 * 5. For PRODUCTION: use your Render backend URL
 * 6. Subscribe to these events:
 *    - CHECKOUT.ORDER.APPROVED
 *    - PAYMENT.AUTHORIZATION.CREATED
 *    - PAYMENT.AUTHORIZATION.VOIDED
 *    - PAYMENT.CAPTURE.COMPLETED
 *    - PAYMENT.CAPTURE.PENDING
 *    - PAYMENT.CAPTURE.DENIED
 * 7. Copy the Webhook ID and add it to backend/.env as PAYPAL_WEBHOOK_ID
 *
 * ─────────────────────────────────────────────────────────────────────────────
 */

import https from 'https';
import Payment from '../models/Payment.js';
import Milestone from '../models/Milestone.js';
import Project from '../models/Project.js';

// ─────────────────────────────────────────────────────────────────────────────
// Webhook Signature Verification
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Verifies a PayPal webhook signature using PayPal's official verify-webhook-signature API.
 *
 * PayPal requires these headers to verify:
 *   PAYPAL-TRANSMISSION-ID
 *   PAYPAL-TRANSMISSION-TIME
 *   PAYPAL-CERT-URL
 *   PAYPAL-TRANSMISSION-SIG
 *   PAYPAL-AUTH-ALGO
 *
 * @param {object} headers – Raw request headers (lowercase keys)
 * @param {string} rawBody – Raw request body string (must NOT be parsed JSON)
 * @returns {Promise<boolean>} true if signature is valid
 */
export async function verifyWebhookSignature(headers, rawBody) {
  // Extract required PayPal headers (Express lowercases all header names)
  const transmissionId = headers['paypal-transmission-id'];
  const transmissionTime = headers['paypal-transmission-time'];
  const certUrl = headers['paypal-cert-url'];
  const transmissionSig = headers['paypal-transmission-sig'];
  const authAlgo = headers['paypal-auth-algo'];

  if (!transmissionId || !transmissionTime || !certUrl || !transmissionSig || !authAlgo) {
    console.warn('[Webhook] Missing required PayPal signature headers');
    return false;
  }

  const webhookId = process.env.PAYPAL_WEBHOOK_ID;

  if (!webhookId) {
    throw new Error('[Webhook] PAYPAL_WEBHOOK_ID is not configured in environment variables');
  }

  // Build the verification payload per PayPal docs
  const verificationPayload = {
    transmission_id: transmissionId,
    transmission_time: transmissionTime,
    cert_url: certUrl,
    auth_algo: authAlgo,
    transmission_sig: transmissionSig,
    webhook_id: webhookId,
    webhook_event: JSON.parse(rawBody),
  };

  try {
    // Get a PayPal access token for the verification API call
    const accessToken = await getPayPalAccessToken();

    const verificationResult = await callVerifySignatureAPI(accessToken, verificationPayload);

    const isValid = verificationResult.verification_status === 'SUCCESS';

    if (isValid) {
      console.log('[Webhook] Signature verified successfully');
    } else {
      console.warn(
        '[Webhook] Signature verification FAILED | status=',
        verificationResult.verification_status
      );
    }

    return isValid;
  } catch (err) {
    console.error('[Webhook] Signature verification error:', err.message);
    throw err;
  }
}

/**
 * Obtain a PayPal OAuth 2.0 access token for server-side API calls.
 * Used specifically for the webhook verification API (not covered by the SDK's auto-auth).
 *
 * @returns {Promise<string>} Access token
 */
async function getPayPalAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  const env = process.env.PAYPAL_ENV || 'sandbox';

  if (!clientId || !clientSecret) {
    throw new Error('[Webhook] PayPal credentials are missing');
  }

  const baseUrl =
    env === 'production'
      ? 'api-m.paypal.com'
      : 'api-m.sandbox.paypal.com';

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

  return new Promise((resolve, reject) => {
    const postData = 'grant_type=client_credentials';

    const options = {
      hostname: baseUrl,
      port: 443,
      path: '/v1/oauth2/token',
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.access_token) {
            resolve(parsed.access_token);
          } else {
            reject(new Error(`Failed to obtain access token: ${data}`));
          }
        } catch (e) {
          reject(new Error(`Failed to parse token response: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

/**
 * Call PayPal's verify-webhook-signature endpoint.
 *
 * @param {string} accessToken
 * @param {object} payload
 * @returns {Promise<object>} { verification_status: "SUCCESS" | "FAILURE" }
 */
async function callVerifySignatureAPI(accessToken, payload) {
  const env = process.env.PAYPAL_ENV || 'sandbox';
  const baseUrl =
    env === 'production'
      ? 'api-m.paypal.com'
      : 'api-m.sandbox.paypal.com';

  const postData = JSON.stringify(payload);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: baseUrl,
      port: 443,
      path: '/v1/notifications/verify-webhook-signature',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(new Error(`Failed to parse verification response: ${e.message}`));
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.write(postData);
    req.end();
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Event Handlers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Route a verified PayPal webhook event to its handler.
 *
 * @param {object} event – The parsed PayPal webhook event object
 */
export async function handleWebhookEvent(event) {
  const eventType = event.event_type;
  const eventId = event.id;
  const resourceType = event.resource_type;

  console.log(`[Webhook] Processing event | id=${eventId} | type=${eventType} | resource=${resourceType}`);

  switch (eventType) {
    case 'CHECKOUT.ORDER.APPROVED':
      await onOrderApproved(event);
      break;

    case 'PAYMENT.AUTHORIZATION.CREATED':
      await onAuthorizationCreated(event);
      break;

    case 'PAYMENT.AUTHORIZATION.VOIDED':
      await onAuthorizationVoided(event);
      break;

    case 'PAYMENT.CAPTURE.COMPLETED':
      await onCaptureCompleted(event);
      break;

    case 'PAYMENT.CAPTURE.PENDING':
      await onCapturePending(event);
      break;

    case 'PAYMENT.CAPTURE.DENIED':
      await onCaptureDenied(event);
      break;

    default:
      console.log(`[Webhook] Unhandled event type: ${eventType} | id=${eventId}`);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Individual Event Handlers
// (Member B: Connect these to MongoDB payment/project models)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * CHECKOUT.ORDER.APPROVED
 * Buyer has approved the checkout – authorization will follow.
 *
 * Member B: Look up project by order ID, update order status to APPROVED.
 */
async function onOrderApproved(event) {
  const resource = event.resource;
  const orderId = resource?.id;
  const status = resource?.status;

  console.log(`[Webhook] Order approved | orderId=${orderId} | status=${status}`);

  if (orderId) {
    await Payment.findOneAndUpdate(
      { paypalOrderId: orderId },
      { status: 'AUTHORIZED' }
    );
  }
}

/**
 * PAYMENT.AUTHORIZATION.CREATED
 * Payment has been authorized – funds are reserved but not captured.
 *
 * Member B: Store authorizationId on the project record. Update project status to AUTHORIZED.
 */
async function onAuthorizationCreated(event) {
  const resource = event.resource;
  const authorizationId = resource?.id;
  const amount = resource?.amount;
  const status = resource?.status;

  console.log(
    `[Webhook] Authorization created | authorizationId=${authorizationId} | amount=${JSON.stringify(amount)} | status=${status}`
  );

  const orderId = resource?.supplementary_data?.related_ids?.order_id;
  if (orderId && authorizationId) {
    await Payment.findOneAndUpdate(
      { paypalOrderId: orderId },
      { authorizationId, status: 'AUTHORIZED' }
    );
  }
}

/**
 * PAYMENT.AUTHORIZATION.VOIDED
 * Authorization has been voided – funds released back to buyer.
 *
 * Member B: Update project/payment status to VOIDED. Cancel pending milestones.
 */
async function onAuthorizationVoided(event) {
  const resource = event.resource;
  const authorizationId = resource?.id;

  console.log(`[Webhook] Authorization voided | authorizationId=${authorizationId}`);

  if (authorizationId) {
    await Payment.findOneAndUpdate(
      { authorizationId },
      { status: 'VOIDED' }
    );
  }
}

/**
 * PAYMENT.CAPTURE.COMPLETED
 * Milestone payment capture succeeded – funds transferred to seller.
 *
 * Member B: Find the milestone by captureId or related authorizationId.
 * Mark milestone as PAID. Store captureId. Update project financials.
 * IMPORTANT: Only mark as paid after this webhook confirms completion.
 */
async function onCaptureCompleted(event) {
  const resource = event.resource;
  const captureId = resource?.id;
  const amount = resource?.amount;
  const finalCapture = resource?.final_capture;

  console.log(
    `[Webhook] Capture completed | captureId=${captureId} | amount=${JSON.stringify(amount)} | finalCapture=${finalCapture}`
  );

  if (captureId) {
    const payment = await Payment.findOne({ "captures.captureId": captureId });
    if (payment) {
      const cap = payment.captures.find((c) => c.captureId === captureId);
      if (cap) {
        cap.status = "COMPLETED";
        payment.totalCaptured = payment.captures
          .filter((c) => c.status === "COMPLETED")
          .reduce((sum, c) => sum + c.amount, 0);

        if (finalCapture) {
          payment.status = "COMPLETED";
        } else {
          payment.status = "PARTIALLY_CAPTURED";
        }
        await payment.save();

        await Milestone.findByIdAndUpdate(cap.milestoneId, { status: "PAID" });

        const allMilestones = await Milestone.find({ projectId: payment.projectId });
        const allPaid = allMilestones.every((m) => m.status === "PAID");
        if (allPaid) {
          await Project.findByIdAndUpdate(payment.projectId, { status: "COMPLETED" });
        }
      }
    }
  }
}

/**
 * PAYMENT.CAPTURE.PENDING
 * Capture is pending review (possible fraud check, bank hold, etc.).
 *
 * Member B: Mark milestone payment as PENDING. Alert the client. Do not mark as paid yet.
 */
async function onCapturePending(event) {
  const resource = event.resource;
  const captureId = resource?.id;
  const statusDetails = resource?.status_details;

  console.warn(
    `[Webhook] Capture pending | captureId=${captureId} | reason=${JSON.stringify(statusDetails)}`
  );

  if (captureId) {
    await Payment.findOneAndUpdate(
      { "captures.captureId": captureId },
      { $set: { "captures.$.status": "PENDING" } }
    );
  }
}

/**
 * PAYMENT.CAPTURE.DENIED
 * Capture was denied by PayPal.
 *
 * Member B: Mark milestone payment as FAILED. Notify client and freelancer.
 * Consider voiding the authorization or retrying.
 */
async function onCaptureDenied(event) {
  const resource = event.resource;
  const captureId = resource?.id;
  const statusDetails = resource?.status_details;

  console.error(
    `[Webhook] Capture denied | captureId=${captureId} | reason=${JSON.stringify(statusDetails)}`
  );

  if (captureId) {
    await Payment.findOneAndUpdate(
      { "captures.captureId": captureId },
      { $set: { "captures.$.status": "DENIED" }, status: "FAILED" }
    );
  }
}
