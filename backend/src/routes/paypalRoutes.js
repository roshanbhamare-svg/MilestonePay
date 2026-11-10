/**
 * PayPal Routes
 *
 * Mounts all PayPal payment API endpoints under /api/paypal
 * Routes are registered in server.js via: app.use('/api/paypal', paypalRoutes)
 */

import express from 'express';
import {
  handleCreateOrder,
  handleAuthorizeOrder,
  handleCaptureAuthorization,
  handleVoidAuthorization,
  handleGetOrderDetails,
  handleGetAuthorizationDetails,
} from '../controllers/paypalController.js';

const router = express.Router();

// ─────────────────────────────────────────────────────────────────────────────
// PayPal Payment Routes
// ─────────────────────────────────────────────────────────────────────────────

/**
 * POST /api/paypal/create-order
 * Create a new PayPal authorization order ($10 USD sandbox test).
 */
router.post('/create-order', handleCreateOrder);

/**
 * POST /api/paypal/authorize/:orderId
 * Authorize a buyer-approved PayPal order.
 * Call after the React PayPal SDK reports buyer approval.
 */
router.post('/authorize/:orderId', handleAuthorizeOrder);

/**
 * POST /api/paypal/capture/:authorizationId
 * [SANDBOX/DEV ONLY] Capture a milestone payment.
 * Body: { amount: "3.00", finalCapture: false }
 *
 * PRODUCTION: This endpoint is disabled outside sandbox.
 * Member B must implement the production capture endpoint with:
 *   - Authentication middleware
 *   - Milestone ID lookup
 *   - Client approval verification
 *   - Amount fetched from MongoDB (never from request body)
 */
router.post('/capture/:authorizationId', handleCaptureAuthorization);

/**
 * POST /api/paypal/void/:authorizationId
 * Void an unused authorization (e.g., project cancelled).
 */
router.post('/void/:authorizationId', handleVoidAuthorization);

/**
 * GET /api/paypal/order/:orderId
 * Retrieve order details by Order ID.
 */
router.get('/order/:orderId', handleGetOrderDetails);

/**
 * GET /api/paypal/authorization/:authorizationId
 * Retrieve authorization details by Authorization ID.
 */
router.get('/authorization/:authorizationId', handleGetAuthorizationDetails);

export default router;
