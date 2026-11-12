/**
 * PayPal Service
 *
 * Reusable business-logic layer for PayPal payment operations.
 * Independent of Express controllers – can be used by Member B's business logic.
 *
 * Uses AUTHORIZE intent: order is authorized at checkout and captured per milestone.
 *
 * Operations:
 *   createOrder()               – Create a new PayPal authorization order
 *   getOrderDetails()           – Retrieve order details by Order ID
 *   authorizeOrder()            – Authorize a buyer-approved order
 *   getAuthorizationDetails()   – Retrieve authorization details by Authorization ID
 *   captureAuthorization()      – Capture a previously authorized amount (partial or final)
 *   voidAuthorization()         – Void an unused authorization
 */

import { getOrdersController, getPaymentsController } from '../config/paypalClient.js';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fixed integration-test amount (USD).
 * IMPORTANT: In production, fetch the actual project budget from MongoDB.
 * Never accept arbitrary amounts from the React frontend.
 */
const INTEGRATION_TEST_AMOUNT = '10.00';
const INTEGRATION_TEST_CURRENCY = 'USD';

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generate a stable idempotency key for a named operation.
 * Keys are deterministic per operation name and are suitable for retries.
 * For milestone captures use captureAuthorization() which accepts an explicit key.
 */
function generateIdempotencyKey(prefix = 'op') {
  const timestamp = Date.now();
  const random = crypto.randomBytes(8).toString('hex');
  return `${prefix}-${timestamp}-${random}`;
}

/**
 * Safely extract an Authorization ID from an authorizeOrder response.
 * Handles both single and multiple purchase units.
 */
function extractAuthorizationId(orderResponse) {
  const purchaseUnits = orderResponse?.purchaseUnits;
  if (!purchaseUnits || purchaseUnits.length === 0) {
    throw new Error('No purchase units found in authorization response');
  }

  const payments = purchaseUnits[0]?.payments;
  if (!payments) {
    throw new Error('No payments object found in purchase unit');
  }

  const authorizations = payments.authorizations;
  if (!authorizations || authorizations.length === 0) {
    throw new Error('No authorizations found in payment response');
  }

  const authId = authorizations[0]?.id;
  if (!authId) {
    throw new Error('Authorization ID is missing from PayPal response');
  }

  return authId;
}

/**
 * Validate a positive monetary amount string (e.g. "3.00").
 */
function validateAmount(amount) {
  const parsed = parseFloat(amount);
  if (isNaN(parsed) || parsed <= 0) {
    throw new Error(`Invalid amount: "${amount}". Must be a positive number.`);
  }
  return parsed.toFixed(2);
}

/**
 * Wrap PayPal SDK calls and produce consistent error objects.
 */
async function callPayPalSDK(operation, label) {
  try {
    const response = await operation();
    return response;
  } catch (err) {
    // PayPal SDK throws ApiError with statusCode + body
    const statusCode = err.statusCode ?? err.response?.status ?? 500;
    const errorBody = err.result ?? err.body ?? err.message ?? String(err);

    console.error(`[PayPal Service] ${label} failed:`, {
      statusCode,
      error: typeof errorBody === 'object' ? JSON.stringify(errorBody) : errorBody,
    });

    const serviceError = new Error(`PayPal ${label} failed`);
    serviceError.statusCode = statusCode;
    serviceError.paypalError = errorBody;
    throw serviceError;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Service Methods
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Create a new PayPal order with AUTHORIZE intent.
 *
 * Defaults to $10.00 USD for standalone sandbox integration testing.
 * Project payments supply the validated project budget and currency from MongoDB.
 *
 * @param {number|string} [amount]
 * @param {string} [currency]
 * @param {string} [description]
 * @returns {{ orderId, status, links }}
 */
export async function createOrder(
  amount = INTEGRATION_TEST_AMOUNT,
  currency = INTEGRATION_TEST_CURRENCY,
  description = 'MilestonePay – Integration Test Authorization'
) {
  const idempotencyKey = generateIdempotencyKey('create-order');
  const validatedAmount = validateAmount(amount);
  const currencyCode = String(currency || INTEGRATION_TEST_CURRENCY).trim().toUpperCase();

  console.log(
    `[PayPal Service] Creating order | amount=${validatedAmount} ${currencyCode} | idempotencyKey=${idempotencyKey}`
  );

  const response = await callPayPalSDK(
    () =>
      getOrdersController().createOrder({
        body: {
          intent: 'AUTHORIZE',
          purchaseUnits: [
            {
              amount: {
                currencyCode,
                value: validatedAmount,
              },
              description: String(description || 'MilestonePay Authorization').slice(0, 127),
            },
          ],
          paymentSource: {
            paypal: {
              experienceContext: {
                // Prevents instant redirect; JS SDK handles approval UI
                userAction: 'PAY_NOW',
                returnUrl: `${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')}/payment/success`,
                cancelUrl: `${(process.env.CLIENT_URL || 'http://localhost:5173').replace(/\/+$/, '')}/payment/cancel`,
              },
            },
          },
        },
        paypalRequestId: idempotencyKey,
        prefer: 'return=representation',
      }),
    'createOrder'
  );

  const order = response.result;

  if (!order?.id) {
    throw new Error('PayPal did not return an Order ID');
  }

  console.log(`[PayPal Service] Order created | orderId=${order.id} | status=${order.status}`);

  return {
    orderId: order.id,
    status: order.status,
    links: order.links ?? [],
  };
}

/**
 * Retrieve full details for an existing order.
 *
 * @param {string} orderId
 * @returns {object} Full PayPal order object
 */
export async function getOrderDetails(orderId) {
  if (!orderId) throw new Error('orderId is required');

  console.log(`[PayPal Service] Getting order details | orderId=${orderId}`);

  const response = await callPayPalSDK(
    () => getOrdersController().getOrder({ id: orderId }),
    'getOrder'
  );

  return response.result;
}

/**
 * Authorize a buyer-approved order.
 * Call this after the PayPal SDK reports buyer approval (onApprove callback).
 *
 * @param {string} orderId – The Order ID returned by createOrder
 * @returns {{ orderId, authorizationId, authorizationStatus, amount }}
 */
export async function authorizeOrder(orderId) {
  if (!orderId) throw new Error('orderId is required');

  const idempotencyKey = generateIdempotencyKey(`authorize-${orderId}`);

  console.log(
    `[PayPal Service] Authorizing order | orderId=${orderId} | idempotencyKey=${idempotencyKey}`
  );

  const response = await callPayPalSDK(
    () =>
      getOrdersController().authorizeOrder({
        id: orderId,
        paypalRequestId: idempotencyKey,
        prefer: 'return=representation',
      }),
    'authorizeOrder'
  );

  const order = response.result;

  const authorizationId = extractAuthorizationId(order);
  const authorization = order.purchaseUnits[0].payments.authorizations[0];
  const authorizationStatus = authorization?.status ?? 'UNKNOWN';
  const amount = authorization?.amount ?? null;

  console.log(
    `[PayPal Service] Order authorized | orderId=${orderId} | authorizationId=${authorizationId} | status=${authorizationStatus}`
  );

  return {
    orderId: order.id,
    authorizationId,
    authorizationStatus,
    amount,
  };
}

/**
 * Retrieve details for an existing authorization.
 *
 * @param {string} authorizationId
 * @returns {object} Full PayPal authorization object
 */
export async function getAuthorizationDetails(authorizationId) {
  if (!authorizationId) throw new Error('authorizationId is required');

  console.log(
    `[PayPal Service] Getting authorization details | authorizationId=${authorizationId}`
  );

  const response = await callPayPalSDK(
    () =>
      getPaymentsController().getAuthorizedPayment({ authorizationId }),
    'getAuthorizedPayment'
  );

  return response.result;
}

/**
 * Capture a previously authorized payment (milestone payment).
 *
 * IMPORTANT – Production security notes (Member B must enforce these):
 *   1. Fetch milestone from MongoDB; never trust the amount from the React request.
 *   2. Verify the authenticated user is the project client.
 *   3. Verify explicit client approval exists in DB.
 *   4. Verify sufficient remaining authorization before calling this.
 *   5. Update payment records ONLY after PayPal confirms capture.
 *   6. Use a stable idempotencyKey per capture attempt (not a new one on retry).
 *
 * @param {string} authorizationId  – The Authorization ID from authorizeOrder
 * @param {string} amount           – Positive dollar amount (e.g. "3.00")
 * @param {boolean} finalCapture    – true for the last milestone capture
 * @param {string} [idempotencyKey] – Stable key for retries; generated if omitted
 * @param {string} [currency]       – ISO currency code (defaults to USD)
 * @returns {{ captureId, status, amount, finalCapture }}
 */
export async function captureAuthorization(
  authorizationId,
  amount,
  finalCapture = false,
  idempotencyKey = null,
  currency = INTEGRATION_TEST_CURRENCY
) {
  if (!authorizationId) throw new Error('authorizationId is required');

  const validatedAmount = validateAmount(amount);
  const currencyCode = String(currency || INTEGRATION_TEST_CURRENCY).trim().toUpperCase();
  const captureKey = idempotencyKey ?? generateIdempotencyKey(`capture-${authorizationId}`);

  console.log(
    `[PayPal Service] Capturing authorization | authorizationId=${authorizationId} | amount=${validatedAmount} ${currencyCode} | finalCapture=${finalCapture} | idempotencyKey=${captureKey}`
  );

  const response = await callPayPalSDK(
    () =>
      getPaymentsController().captureAuthorizedPayment({
        authorizationId,
        body: {
          amount: {
            currencyCode,
            value: validatedAmount,
          },
          finalCapture,
          noteToPayer: finalCapture
            ? 'Final milestone payment – thank you!'
            : 'Milestone payment released',
        },
        paypalRequestId: captureKey,
        prefer: 'return=representation',
      }),
    'captureAuthorizedPayment'
  );

  const capture = response.result;

  if (!capture?.id) {
    throw new Error('PayPal did not return a Capture ID');
  }

  const captureStatus = capture.status;

  // Handle expected PayPal capture states
  if (captureStatus === 'PENDING') {
    console.warn(
      `[PayPal Service] Capture is PENDING | captureId=${capture.id} | statusDetails=${JSON.stringify(capture.statusDetails)}`
    );
  } else if (captureStatus === 'DENIED') {
    console.error(
      `[PayPal Service] Capture DENIED | captureId=${capture.id} | statusDetails=${JSON.stringify(capture.statusDetails)}`
    );
    throw new Error(`Capture was denied by PayPal: ${JSON.stringify(capture.statusDetails)}`);
  } else if (captureStatus === 'COMPLETED') {
    console.log(
      `[PayPal Service] Capture COMPLETED | captureId=${capture.id} | amount=${validatedAmount}`
    );
  }

  return {
    captureId: capture.id,
    status: captureStatus,
    amount: capture.amount,
    finalCapture,
  };
}

/**
 * Void an authorization that has not been fully captured.
 * Use this if a project is cancelled before all milestones are paid.
 *
 * @param {string} authorizationId
 * @returns {{ authorizationId, status }}
 */
export async function voidAuthorization(authorizationId) {
  if (!authorizationId) throw new Error('authorizationId is required');

  console.log(`[PayPal Service] Voiding authorization | authorizationId=${authorizationId}`);

  try {
    const response = await callPayPalSDK(
      () =>
        getPaymentsController().voidPayment({
          authorizationId,
          prefer: 'return=representation',
        }),
      'voidPayment'
    );

    // A successful void returns 204 No Content (result may be null)
    const status = response.result?.status ?? 'VOIDED';

    console.log(
      `[PayPal Service] Authorization voided | authorizationId=${authorizationId} | status=${status}`
    );

    return { authorizationId, status };
  } catch (err) {
    // Handle gracefully: already voided or already fully captured
    const statusCode = err.statusCode ?? 500;
    const paypalError = err.paypalError;

    if (statusCode === 422) {
      // AUTHORIZATION_ALREADY_CAPTURED or similar
      console.warn(
        `[PayPal Service] Cannot void (422) | authorizationId=${authorizationId} | detail=${JSON.stringify(paypalError)}`
      );
      return {
        authorizationId,
        status: 'CANNOT_VOID',
        reason: paypalError?.details?.[0]?.description ?? 'Authorization cannot be voided',
      };
    }

    if (statusCode === 404) {
      console.warn(
        `[PayPal Service] Authorization not found (404) | authorizationId=${authorizationId}`
      );
      return {
        authorizationId,
        status: 'NOT_FOUND',
        reason: 'Authorization ID not found',
      };
    }

    throw err; // Re-throw unexpected errors
  }
}
