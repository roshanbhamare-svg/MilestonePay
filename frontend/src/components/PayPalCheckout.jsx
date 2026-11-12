/**
 * PayPalCheckout.jsx
 *
 * Integration test component for MilestonePay PayPal payment flow.
 * Uses @paypal/react-paypal-js SDK v6 API.
 *
 * Flow:
 *   1. PayPalProvider loads SDK with clientId
 *   2. User clicks PayPal button
 *   3. createOrder() calls Express POST /api/paypal/create-order
 *   4. Returns { orderId } to PayPal SDK
 *   5. PayPal opens Sandbox checkout
 *   6. Buyer approves payment
 *   7. onApprove() calls Express POST /api/paypal/authorize/:orderId
 *   8. Displays Authorization ID and status
 *
 * IMPORTANT:
 *   - No immediate capture in onApprove (authorization only)
 *   - Client Secret is NEVER exposed here
 *   - Uses VITE_PAYPAL_CLIENT_ID and VITE_API_URL from .env
 */

import { useState, useCallback } from 'react';
import {
  PayPalProvider,
  PayPalOneTimePaymentButton,
} from '@paypal/react-paypal-js/sdk-v6';
import axios from 'axios';

const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5001').replace(/\/+$/, '');
const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

// ─────────────────────────────────────────────────────────────────────────────
// Inner checkout component (must be inside PayPalProvider)
// ─────────────────────────────────────────────────────────────────────────────

function CheckoutButton({ onAuthorizationComplete, onError, onCancel, setStatusMessage }) {
  const [isLoading, setIsLoading] = useState(false);

  /**
   * createOrder – Called when user clicks the PayPal button.
   * Calls our Express backend to create the authorization order.
   * Returns { orderId } as required by the v6 SDK.
   */
  const createOrder = useCallback(async () => {
    setIsLoading(true);
    setStatusMessage('Creating order…');

    try {
      const response = await axios.post(`${API_URL}/api/paypal/create-order`);
      const { orderId } = response.data.data;

      setStatusMessage(`Order created: ${orderId}. Opening PayPal checkout…`);
      console.log('[PayPal] Order created:', orderId);

      return { orderId };
    } catch (err) {
      const message =
        err.response?.data?.error || err.message || 'Failed to create order';
      console.error('[PayPal] createOrder error:', message);
      setIsLoading(false);
      setStatusMessage('');
      onError(message);
      throw err; // SDK requires this to be rethrown
    }
  }, [onError, setStatusMessage]);

  /**
   * onApprove – Called after buyer approves the payment in the PayPal popup.
   * Calls our Express backend to authorize the order.
   * Does NOT capture – capture happens after client approves a milestone.
   */
  const onApprove = useCallback(
    async (data) => {
      const orderId = data?.orderId;

      if (!orderId) {
        onError('No order ID returned from PayPal approval');
        return;
      }

      setStatusMessage(`Buyer approved. Authorizing order ${orderId}…`);
      console.log('[PayPal] Buyer approved order:', orderId);

      try {
        const response = await axios.post(`${API_URL}/api/paypal/authorize/${orderId}`);
        const authData = response.data.data;

        console.log('[PayPal] Authorization result:', authData);
        setIsLoading(false);
        onAuthorizationComplete(authData);
      } catch (err) {
        const message =
          err.response?.data?.error || err.message || 'Authorization failed';
        console.error('[PayPal] Authorization error:', message);
        setIsLoading(false);
        onError(message);
      }
    },
    [onAuthorizationComplete, onError, setStatusMessage]
  );

  /**
   * onCancel – Called when buyer cancels the PayPal checkout.
   */
  const handleCancel = useCallback(() => {
    console.log('[PayPal] Buyer cancelled checkout');
    setIsLoading(false);
    setStatusMessage('');
    onCancel();
  }, [onCancel, setStatusMessage]);

  return (
    <div style={{ minHeight: '45px' }}>
      {isLoading && (
        <div style={styles.loadingBadge}>
          <span style={styles.spinner} />
          Processing…
        </div>
      )}
      <PayPalOneTimePaymentButton
        createOrder={createOrder}
        onApprove={onApprove}
        onCancel={handleCancel}
        onError={(err) => {
          console.error('[PayPal] SDK error:', err);
          setIsLoading(false);
          onError(err?.message || 'PayPal SDK error');
        }}
      />
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Main PayPalCheckout Component
// ─────────────────────────────────────────────────────────────────────────────

export default function PayPalCheckout() {
  const [authResult, setAuthResult] = useState(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [cancelled, setCancelled] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  const handleAuthorizationComplete = useCallback((data) => {
    setAuthResult(data);
    setErrorMessage('');
    setCancelled(false);
    setStatusMessage('');
  }, []);

  const handleError = useCallback((message) => {
    setErrorMessage(message);
    setAuthResult(null);
    setCancelled(false);
  }, []);

  const handleCancel = useCallback(() => {
    setCancelled(true);
    setAuthResult(null);
    setErrorMessage('');
  }, []);

  const handleReset = () => {
    setAuthResult(null);
    setErrorMessage('');
    setCancelled(false);
    setStatusMessage('');
  };

  if (!PAYPAL_CLIENT_ID) {
    return (
      <div style={styles.container}>
        <div style={styles.card}>
          <div style={{ ...styles.alert, ...styles.alertError }}>
            <strong>Configuration Error:</strong> VITE_PAYPAL_CLIENT_ID is not set in{' '}
            <code>frontend/.env</code>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        {/* Header */}
        <div style={styles.header}>
          <h1 style={styles.title}>MilestonePay</h1>
          <p style={styles.subtitle}>AI-Powered Milestone-Based Payment Platform</p>
          <div style={styles.badge}>PayPal Sandbox Integration Test</div>
        </div>

        {/* Payment Info */}
        <div style={styles.paymentInfo}>
          <div style={styles.paymentRow}>
            <span style={styles.paymentLabel}>Test Project</span>
            <span style={styles.paymentValue}>Integration Test Authorization</span>
          </div>
          <div style={styles.paymentRow}>
            <span style={styles.paymentLabel}>Amount</span>
            <span style={{ ...styles.paymentValue, ...styles.amount }}>$10.00 USD</span>
          </div>
          <div style={styles.paymentRow}>
            <span style={styles.paymentLabel}>Payment Type</span>
            <span style={styles.paymentValue}>Authorization only (no immediate charge)</span>
          </div>
          <div style={styles.paymentRow}>
            <span style={styles.paymentLabel}>Environment</span>
            <span style={{ ...styles.paymentValue, color: '#f59e0b' }}>Sandbox</span>
          </div>
        </div>

        {/* Flow Info */}
        <div style={styles.flowInfo}>
          <p style={styles.flowTitle}>How this works:</p>
          <ol style={styles.flowList}>
            <li>Click the PayPal button below</li>
            <li>Log in with your Sandbox buyer account</li>
            <li>Approve the $10.00 authorization</li>
            <li>No money is charged — funds are reserved</li>
            <li>Each milestone will trigger a partial capture</li>
          </ol>
        </div>

        {/* Status Message */}
        {statusMessage && (
          <div style={{ ...styles.alert, ...styles.alertInfo }}>
            {statusMessage}
          </div>
        )}

        {/* Error State */}
        {errorMessage && (
          <div style={{ ...styles.alert, ...styles.alertError }}>
            <strong>Error:</strong> {errorMessage}
            <button style={styles.retryButton} onClick={handleReset}>
              Try Again
            </button>
          </div>
        )}

        {/* Cancelled State */}
        {cancelled && (
          <div style={{ ...styles.alert, ...styles.alertWarning }}>
            Payment cancelled. Click the button below to try again.
            <button style={styles.retryButton} onClick={handleReset}>
              Try Again
            </button>
          </div>
        )}

        {/* Success State */}
        {authResult ? (
          <div style={styles.successPanel}>
            <div style={styles.successIcon}>✓</div>
            <h2 style={styles.successTitle}>Authorization Successful!</h2>
            <p style={styles.successSubtitle}>
              Funds are reserved. Payment will be captured as milestones are completed and
              approved.
            </p>

            <div style={styles.resultGrid}>
              <div style={styles.resultItem}>
                <span style={styles.resultLabel}>Order ID</span>
                <code style={styles.resultValue}>{authResult.orderId}</code>
              </div>
              <div style={styles.resultItem}>
                <span style={styles.resultLabel}>Authorization ID</span>
                <code style={styles.resultValue}>{authResult.authorizationId}</code>
              </div>
              <div style={styles.resultItem}>
                <span style={styles.resultLabel}>Authorization Status</span>
                <span
                  style={{
                    ...styles.resultValue,
                    color: authResult.authorizationStatus === 'CREATED' ? '#10b981' : '#f59e0b',
                    fontWeight: 600,
                  }}
                >
                  {authResult.authorizationStatus}
                </span>
              </div>
              {authResult.amount && (
                <div style={styles.resultItem}>
                  <span style={styles.resultLabel}>Authorized Amount</span>
                  <span style={styles.resultValue}>
                    {authResult.amount.currencyCode} {authResult.amount.value}
                  </span>
                </div>
              )}
            </div>

            <div style={{ ...styles.alert, ...styles.alertInfo, marginTop: '16px' }}>
              <strong>Next Steps (Member B):</strong> The backend can now capture milestone
              payments using Authorization ID via{' '}
              <code>POST /api/paypal/capture/{authResult.authorizationId}</code>
            </div>

            <button style={styles.resetButton} onClick={handleReset}>
              Test Another Payment
            </button>
          </div>
        ) : (
          /* PayPal Button */
          !cancelled && !errorMessage && (
            <div style={styles.buttonContainer}>
              <PayPalProvider
                clientId={PAYPAL_CLIENT_ID}
                environment="sandbox"
                components={['paypal-payments']}
                pageType="checkout"
              >
                <CheckoutButton
                  onAuthorizationComplete={handleAuthorizationComplete}
                  onError={handleError}
                  onCancel={handleCancel}
                  setStatusMessage={setStatusMessage}
                />
              </PayPalProvider>
              <p style={styles.sandboxNote}>
                Use your PayPal Sandbox buyer account to test
              </p>
            </div>
          )
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Styles (inline to avoid CSS conflicts with Member C's future design)
// ─────────────────────────────────────────────────────────────────────────────

const styles = {
  container: {
    minHeight: '100vh',
    backgroundColor: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '24px',
    fontFamily:
      '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  },
  card: {
    backgroundColor: '#1e293b',
    borderRadius: '16px',
    padding: '40px',
    width: '100%',
    maxWidth: '560px',
    boxShadow: '0 25px 50px rgba(0,0,0,0.5)',
    border: '1px solid #334155',
  },
  header: {
    textAlign: 'center',
    marginBottom: '32px',
  },
  title: {
    fontSize: '28px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 8px',
    letterSpacing: '-0.5px',
  },
  subtitle: {
    fontSize: '14px',
    color: '#94a3b8',
    margin: '0 0 12px',
  },
  badge: {
    display: 'inline-block',
    backgroundColor: '#1d4ed8',
    color: '#bfdbfe',
    fontSize: '11px',
    fontWeight: '600',
    padding: '4px 10px',
    borderRadius: '20px',
    letterSpacing: '0.5px',
  },
  paymentInfo: {
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    padding: '20px',
    marginBottom: '20px',
    border: '1px solid #334155',
  },
  paymentRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '8px 0',
    borderBottom: '1px solid #1e293b',
  },
  paymentLabel: {
    fontSize: '13px',
    color: '#64748b',
  },
  paymentValue: {
    fontSize: '13px',
    color: '#cbd5e1',
    textAlign: 'right',
  },
  amount: {
    fontSize: '18px',
    fontWeight: '700',
    color: '#10b981',
  },
  flowInfo: {
    marginBottom: '24px',
  },
  flowTitle: {
    fontSize: '13px',
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  flowList: {
    fontSize: '13px',
    color: '#64748b',
    paddingLeft: '20px',
    margin: 0,
    lineHeight: '1.8',
  },
  alert: {
    borderRadius: '8px',
    padding: '12px 16px',
    fontSize: '13px',
    marginBottom: '16px',
  },
  alertError: {
    backgroundColor: '#7f1d1d',
    color: '#fca5a5',
    border: '1px solid #991b1b',
  },
  alertWarning: {
    backgroundColor: '#78350f',
    color: '#fcd34d',
    border: '1px solid #92400e',
  },
  alertInfo: {
    backgroundColor: '#1e3a5f',
    color: '#93c5fd',
    border: '1px solid #1d4ed8',
    lineHeight: '1.6',
  },
  retryButton: {
    display: 'block',
    marginTop: '8px',
    backgroundColor: 'transparent',
    border: '1px solid currentColor',
    borderRadius: '6px',
    padding: '6px 12px',
    cursor: 'pointer',
    fontSize: '12px',
    color: 'inherit',
  },
  buttonContainer: {
    marginTop: '8px',
  },
  sandboxNote: {
    textAlign: 'center',
    fontSize: '12px',
    color: '#475569',
    marginTop: '12px',
  },
  loadingBadge: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    fontSize: '13px',
    color: '#94a3b8',
    marginBottom: '8px',
  },
  spinner: {
    display: 'inline-block',
    width: '12px',
    height: '12px',
    border: '2px solid #334155',
    borderTopColor: '#3b82f6',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  successPanel: {
    textAlign: 'center',
  },
  successIcon: {
    width: '56px',
    height: '56px',
    backgroundColor: '#064e3b',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '24px',
    color: '#10b981',
    margin: '0 auto 16px',
    border: '2px solid #10b981',
  },
  successTitle: {
    fontSize: '20px',
    fontWeight: '700',
    color: '#f8fafc',
    margin: '0 0 8px',
  },
  successSubtitle: {
    fontSize: '13px',
    color: '#94a3b8',
    margin: '0 0 24px',
    lineHeight: '1.6',
  },
  resultGrid: {
    backgroundColor: '#0f172a',
    borderRadius: '10px',
    padding: '16px',
    textAlign: 'left',
    border: '1px solid #334155',
  },
  resultItem: {
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    padding: '10px 0',
    borderBottom: '1px solid #1e293b',
  },
  resultLabel: {
    fontSize: '11px',
    fontWeight: '600',
    color: '#64748b',
    textTransform: 'uppercase',
    letterSpacing: '0.5px',
  },
  resultValue: {
    fontSize: '13px',
    color: '#cbd5e1',
    wordBreak: 'break-all',
    fontFamily: 'monospace',
  },
  resetButton: {
    marginTop: '20px',
    backgroundColor: '#1d4ed8',
    color: '#fff',
    border: 'none',
    borderRadius: '8px',
    padding: '10px 20px',
    fontSize: '14px',
    fontWeight: '600',
    cursor: 'pointer',
  },
};
