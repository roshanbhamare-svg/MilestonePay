/**
 * PayPal Controller
 *
 * Express request handlers for PayPal payment operations.
 * Delegates all business logic to paypalService.js.
 *
 * DEVELOPMENT-ONLY endpoints are clearly marked and disabled in production.
 */

import {
  createOrder,
  getOrderDetails,
  authorizeOrder,
  getAuthorizationDetails,
  captureAuthorization,
  voidAuthorization,
} from '../services/paypalService.js';

const IS_SANDBOX = (process.env.PAYPAL_ENV || 'sandbox') === 'sandbox';

// ─────────────────────────────────────────────────────────────────────────────
// Helper: standardized success/error response
// ─────────────────────────────────────────────────────────────────────────────

function sendSuccess(res, data, statusCode = 200) {
  return res.status(statusCode).json({ success: true, data });
}

function sendError(res, message, statusCode = 500, details = null) {
  const body = { success: false, error: message };
  if (details && IS_SANDBOX) {
    // Only expose error details in Sandbox – never in production
    body.details = details;
  }
  return res.status(statusCode).json(body);
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. Create Order  –  POST /api/paypal/create-order
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Creates a PayPal authorization order.
 * Uses a fixed $10 USD amount for the integration test.
 *
 * PRODUCTION NOTE (Member B):
 *   Replace fixed amount with the validated project budget from MongoDB.
 *   Never accept payment amounts directly from the React request.
 */
export async function handleCreateOrder(req, res) {
  try {
    const result = await createOrder();

    return sendSuccess(res, {
      orderId: result.orderId,
      status: result.status,
      links: result.links,
      _note: IS_SANDBOX
        ? 'SANDBOX MODE – Fixed $10.00 integration test amount'
        : undefined,
    }, 201);
  } catch (err) {
    console.error('[Controller] handleCreateOrder error:', err.message);
    return sendError(
      res,
      'Failed to create PayPal order',
      err.statusCode ?? 500,
      err.paypalError
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. Authorize Order  –  POST /api/paypal/authorize/:orderId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Authorizes a buyer-approved PayPal order.
 * Call after the PayPal JS SDK reports buyer approval.
 * Does NOT capture payment – capture happens after milestone approval.
 */
export async function handleAuthorizeOrder(req, res) {
  const { orderId } = req.params;

  if (!orderId) {
    return sendError(res, 'orderId parameter is required', 400);
  }

  try {
    const result = await authorizeOrder(orderId);

    return sendSuccess(res, {
      orderId: result.orderId,
      authorizationId: result.authorizationId,
      authorizationStatus: result.authorizationStatus,
      amount: result.amount,
    });
  } catch (err) {
    console.error('[Controller] handleAuthorizeOrder error:', err.message);
    return sendError(
      res,
      'Failed to authorize PayPal order',
      err.statusCode ?? 500,
      err.paypalError
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. Capture Milestone  –  POST /api/paypal/capture/:authorizationId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * [DEV/TEST ONLY] Captures a milestone payment directly with amount from request body.
 *
 * IMPORTANT – This is an INTEGRATION TEST endpoint only.
 * It accepts amount/finalCapture from the request body for testing purposes.
 *
 * PRODUCTION REPLACEMENT (Member B must implement):
 *   1. Fetch milestone from MongoDB using milestoneId.
 *   2. Verify authenticated user is the project client.
 *   3. Verify explicit client approval exists in DB.
 *   4. Use milestone amount from MongoDB (never from request body).
 *   5. Verify sufficient remaining authorization.
 *   6. Update DB payment records only after PayPal confirms capture.
 *   7. Remove this endpoint or restrict it behind authentication middleware.
 *
 * Test cases:
 *   - Capture $3 with finalCapture=false (partial)
 *   - Capture $7 with finalCapture=true  (final)
 */
export async function handleCaptureAuthorization(req, res) {
  const { authorizationId } = req.params;

  if (!authorizationId) {
    return sendError(res, 'authorizationId parameter is required', 400);
  }

  if (!IS_SANDBOX) {
    return sendError(
      res,
      'Direct capture endpoint is disabled in production. Member B must implement the production capture flow.',
      403
    );
  }

  const { amount, finalCapture = false, idempotencyKey } = req.body;

  if (!amount) {
    return sendError(res, 'amount is required in request body', 400);
  }

  const parsedAmount = parseFloat(amount);
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    return sendError(res, 'amount must be a positive number', 400);
  }

  if (typeof finalCapture !== 'boolean') {
    return sendError(res, 'finalCapture must be a boolean (true or false)', 400);
  }

  try {
    const result = await captureAuthorization(
      authorizationId,
      String(parsedAmount.toFixed(2)),
      finalCapture,
      idempotencyKey ?? null
    );

    return sendSuccess(res, {
      captureId: result.captureId,
      status: result.status,
      amount: result.amount,
      finalCapture: result.finalCapture,
      _devNote: 'SANDBOX TEST ONLY – Replace with Member B milestone capture in production',
    });
  } catch (err) {
    console.error('[Controller] handleCaptureAuthorization error:', err.message);
    return sendError(
      res,
      'Failed to capture PayPal authorization',
      err.statusCode ?? 500,
      err.paypalError
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Void Authorization  –  POST /api/paypal/void/:authorizationId
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Voids an authorization that has not been fully captured.
 * Handles already-captured and expired authorizations gracefully.
 */
export async function handleVoidAuthorization(req, res) {
  const { authorizationId } = req.params;

  if (!authorizationId) {
    return sendError(res, 'authorizationId parameter is required', 400);
  }

  try {
    const result = await voidAuthorization(authorizationId);

    return sendSuccess(res, {
      authorizationId: result.authorizationId,
      status: result.status,
      reason: result.reason ?? undefined,
    });
  } catch (err) {
    console.error('[Controller] handleVoidAuthorization error:', err.message);
    return sendError(
      res,
      'Failed to void PayPal authorization',
      err.statusCode ?? 500,
      err.paypalError
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Get Order Details  –  GET /api/paypal/order/:orderId
// ─────────────────────────────────────────────────────────────────────────────

export async function handleGetOrderDetails(req, res) {
  const { orderId } = req.params;

  if (!orderId) {
    return sendError(res, 'orderId parameter is required', 400);
  }

  try {
    const order = await getOrderDetails(orderId);

    return sendSuccess(res, {
      orderId: order.id,
      status: order.status,
      intent: order.intent,
      amount: order.purchaseUnits?.[0]?.amount ?? null,
      payments: order.purchaseUnits?.[0]?.payments ?? null,
      createTime: order.createTime,
      updateTime: order.updateTime,
    });
  } catch (err) {
    console.error('[Controller] handleGetOrderDetails error:', err.message);
    return sendError(
      res,
      'Failed to retrieve order details',
      err.statusCode ?? 500,
      err.paypalError
    );
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Get Authorization Details  –  GET /api/paypal/authorization/:authorizationId
// ─────────────────────────────────────────────────────────────────────────────

export async function handleGetAuthorizationDetails(req, res) {
  const { authorizationId } = req.params;

  if (!authorizationId) {
    return sendError(res, 'authorizationId parameter is required', 400);
  }

  try {
    const auth = await getAuthorizationDetails(authorizationId);

    return sendSuccess(res, {
      authorizationId: auth.id,
      status: auth.status,
      amount: auth.amount,
      expirationTime: auth.expirationTime,
      createTime: auth.createTime,
      updateTime: auth.updateTime,
      orderId: auth.supplementaryData?.relatedIds?.orderId ?? null,
    });
  } catch (err) {
    console.error('[Controller] handleGetAuthorizationDetails error:', err.message);
    return sendError(
      res,
      'Failed to retrieve authorization details',
      err.statusCode ?? 500,
      err.paypalError
    );
  }
}
