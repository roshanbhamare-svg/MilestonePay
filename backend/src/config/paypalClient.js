/**
 * PayPal SDK Client Configuration
 *
 * Initializes the PayPal Server SDK client using credentials from environment variables.
 * Exports reusable OrdersController and PaymentsController instances.
 *
 * Uses @paypal/paypal-server-sdk v2.5.0 (ESM build).
 *
 * NOTE: Initialization is lazy (called on first use) so that dotenv.config()
 * in server.js runs before validation checks fire.
 */

import {
  Client,
  Environment,
  OrdersController,
  PaymentsController,
} from '@paypal/paypal-server-sdk';

let _ordersController = null;
let _paymentsController = null;

/**
 * Initialize and return the PayPal SDK controllers.
 * Called lazily on first use so environment variables are loaded first.
 */
function getControllers() {
  if (_ordersController && _paymentsController) {
    return { ordersController: _ordersController, paymentsController: _paymentsController };
  }

  const PAYPAL_CLIENT_ID = process.env.PAYPAL_CLIENT_ID;
  const PAYPAL_CLIENT_SECRET = process.env.PAYPAL_CLIENT_SECRET;
  const PAYPAL_ENV = process.env.PAYPAL_ENV || 'sandbox';

  if (!PAYPAL_CLIENT_ID) {
    throw new Error('[PayPal] PAYPAL_CLIENT_ID is missing from environment variables');
  }

  if (!PAYPAL_CLIENT_SECRET) {
    throw new Error('[PayPal] PAYPAL_CLIENT_SECRET is missing from environment variables');
  }

  const sdkEnvironment =
    PAYPAL_ENV === 'production' ? Environment.Production : Environment.Sandbox;

  console.log(`[PayPal] Initializing SDK in ${PAYPAL_ENV} mode`);

  /**
   * PayPal SDK Client
   * Handles OAuth 2.0 token management automatically via clientCredentialsAuthCredentials.
   */
  const paypalClient = new Client({
    clientCredentialsAuthCredentials: {
      oAuthClientId: PAYPAL_CLIENT_ID,
      oAuthClientSecret: PAYPAL_CLIENT_SECRET,
    },
    environment: sdkEnvironment,
    timeout: 30000,
  });

  _ordersController = new OrdersController(paypalClient);
  _paymentsController = new PaymentsController(paypalClient);

  console.log('[PayPal] SDK client and controllers initialized successfully');

  return { ordersController: _ordersController, paymentsController: _paymentsController };
}

/**
 * Lazily-initialized OrdersController proxy.
 * Returns the singleton OrdersController, initializing on first call.
 */
export function getOrdersController() {
  return getControllers().ordersController;
}

/**
 * Lazily-initialized PaymentsController proxy.
 * Returns the singleton PaymentsController, initializing on first call.
 */
export function getPaymentsController() {
  return getControllers().paymentsController;
}
