import { useState, useCallback } from 'react';
import {
  PayPalProvider,
  PayPalOneTimePaymentButton,
} from '@paypal/react-paypal-js/sdk-v6';
import { ShieldCheck, Wallet, Ban, CheckCircle2, Clock, AlertTriangle, RefreshCw } from 'lucide-react';
import Card from '../common/Card';
import Button from '../common/Button';
import Alert from '../common/Alert';
import StatusBadge from '../common/StatusBadge';
import Table from '../common/Table';
import { paymentApi } from '../../api/paymentApi';
import { useToast } from '../../hooks/useToast';
import { formatCurrency, formatDateTime, getErrorMessage } from '../../utils/formatters';

const PAYPAL_CLIENT_ID = import.meta.env.VITE_PAYPAL_CLIENT_ID;

function ProjectPayPalButton({ projectId, onAuthorized, onError, setStatusMsg }) {
  const createOrder = useCallback(async () => {
    setStatusMsg('Creating PayPal authorization order...');
    try {
      const result = await paymentApi.authorizeProjectPayment(projectId);
      setStatusMsg(`Order ${result.orderId} created. Complete approval in PayPal window...`);
      return { orderId: result.orderId };
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to create PayPal authorization order');
      setStatusMsg('');
      onError(msg);
      throw err;
    }
  }, [projectId, onError, setStatusMsg]);

  const onApprove = useCallback(
    async (data) => {
      const orderId = data?.orderId;
      if (!orderId) {
        onError('No Order ID returned by PayPal');
        return;
      }
      setStatusMsg(`Finalizing backend authorization for order ${orderId}...`);
      try {
        const result = await paymentApi.completeAuthorization(orderId);
        setStatusMsg('');
        onAuthorized(result);
      } catch (err) {
        setStatusMsg('');
        onError(getErrorMessage(err, 'Failed to complete PayPal authorization'));
      }
    },
    [onAuthorized, onError, setStatusMsg]
  );

  return (
    <PayPalOneTimePaymentButton
      createOrder={createOrder}
      onApprove={onApprove}
      onCancel={() => setStatusMsg('PayPal checkout was cancelled.')}
      onError={(err) => {
        setStatusMsg('');
        onError(err?.message || 'PayPal checkout encountered an error');
      }}
    />
  );
}

export default function ProjectPaymentPanel({
  project,
  milestones = [],
  payment,
  userRole,
  onRefresh,
}) {
  const toast = useToast();
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [capturingId, setCapturingId] = useState(null);
  const [voiding, setVoiding] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const isClient = userRole === 'client';
  const currency = payment?.currency || project?.currency || 'USD';
  const totalAuthorized = payment?.totalAuthorized ?? project?.budget ?? 0;
  const totalCaptured = payment?.totalCaptured ?? 0;
  const remaining = Math.max(0, totalAuthorized - totalCaptured);
  const pctCaptured =
    totalAuthorized > 0 ? Math.min(100, Math.round((totalCaptured / totalAuthorized) * 100)) : 0;

  const isAuthorizedActive = ['AUTHORIZED', 'PARTIALLY_CAPTURED'].includes(payment?.status);
  const needsAuthorization =
    !payment || ['PENDING', 'FAILED', 'VOIDED'].includes(payment.status);

  const milestoneMap = new Map(milestones.map((m) => [m._id, m]));

  const handleCaptureMilestone = async (milestone) => {
    setCapturingId(milestone._id);
    setErrorMsg('');
    try {
      const res = await paymentApi.captureMilestonePayment(milestone._id);
      toast.success(
        `Captured ${formatCurrency(res.amount, currency)} for "${milestone.title}" (Capture ID: ${res.captureId})`
      );
      await onRefresh();
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to capture milestone payment');
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setCapturingId(null);
    }
  };

  const handleVoidAuthorization = async () => {
    setVoiding(true);
    setErrorMsg('');
    try {
      await paymentApi.voidProjectPayment(project._id);
      toast.info('Project PayPal authorization voided.');
      await onRefresh();
    } catch (err) {
      const msg = getErrorMessage(err, 'Failed to void authorization');
      setErrorMsg(msg);
      toast.error(msg);
    } finally {
      setVoiding(false);
    }
  };

  const captureColumns = [
    {
      key: 'captureId',
      header: 'Capture ID',
      render: (row) => <code style={{ fontSize: '12px' }}>{row.captureId}</code>,
    },
    {
      key: 'milestoneId',
      header: 'Milestone',
      render: (row) => {
        const ms = milestoneMap.get(row.milestoneId);
        return ms ? `#${ms.order} ${ms.title}` : row.milestoneId;
      },
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => (
        <strong style={{ color: '#6ee7b7' }}>{formatCurrency(row.amount, currency)}</strong>
      ),
    },
    {
      key: 'status',
      header: 'Transaction Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'finalCapture',
      header: 'Type',
      render: (row) => (
        <span className="badge badge-neutral">
          {row.finalCapture ? 'Final Capture' : 'Partial Capture'}
        </span>
      ),
    },
    {
      key: 'capturedAt',
      header: 'Captured At',
      render: (row) => formatDateTime(row.capturedAt),
    },
  ];

  return (
    <div className="flex-col gap-6">
      {errorMsg && <Alert variant="danger">{errorMsg}</Alert>}
      {statusMsg && <Alert variant="info">{statusMsg}</Alert>}

      {/* Payment Summary Card */}
      <Card
        title="Project Escrow & PayPal Authorization"
        subtitle="Funds are authorized upfront via PayPal and captured per approved milestone."
        action={
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="ghost"
              icon={RefreshCw}
              loading={refreshing}
              onClick={async () => {
                setRefreshing(true);
                try {
                  await onRefresh();
                  toast.info('Payment status refreshed.');
                } finally {
                  setRefreshing(false);
                }
              }}
            >
              Refresh
            </Button>
            <StatusBadge
              status={payment?.status || 'PENDING'}
              label={payment ? undefined : 'NOT AUTHORIZED'}
            />
          </div>
        }
      >
        <div className="grid grid-cols-3 mb-4">
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="text-sm text-muted">Project Budget / Authorized</div>
            <div style={{ fontSize: '22px', fontWeight: 700, marginTop: '4px' }}>
              {formatCurrency(totalAuthorized, currency)}
            </div>
          </div>
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="text-sm text-muted">Total Captured</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#6ee7b7', marginTop: '4px' }}>
              {formatCurrency(totalCaptured, currency)}
            </div>
          </div>
          <div
            style={{
              padding: '14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
            }}
          >
            <div className="text-sm text-muted">Remaining Held</div>
            <div style={{ fontSize: '22px', fontWeight: 700, color: '#93c5fd', marginTop: '4px' }}>
              {formatCurrency(payment ? remaining : 0, currency)}
            </div>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between text-sm text-muted mb-2">
            <span>Capture Progress</span>
            <span>{pctCaptured}% released</span>
          </div>
          <div className="progress-track">
            <div className="progress-fill" style={{ width: `${pctCaptured}%` }} />
          </div>
        </div>

        {payment && (
          <div
            className="grid grid-cols-2 mb-4"
            style={{
              padding: '12px 14px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: '1px solid var(--border)',
              fontSize: '12px',
            }}
          >
            <div>
              <span className="text-dim">PayPal Order ID: </span>
              <code className="mono">{payment.paypalOrderId || '—'}</code>
            </div>
            <div>
              <span className="text-dim">Authorization ID: </span>
              <code className="mono">{payment.authorizationId || '—'}</code>
            </div>
          </div>
        )}

        {/* Authorize Action (Client) */}
        {isClient && needsAuthorization && (
          <div
            style={{
              padding: '18px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-surface-2)',
              border: '1px solid var(--border-strong)',
            }}
          >
            {project?.status !== 'ACTIVE' ? (
              <Alert variant="warning" title="Project Must Be Active">
                Both client and freelancer must accept the project agreement before PayPal funds can
                be authorized (current status: <strong>{project?.status}</strong>).
              </Alert>
            ) : !PAYPAL_CLIENT_ID ? (
              <Alert variant="danger">
                <code>VITE_PAYPAL_CLIENT_ID</code> is missing in <code>frontend/.env</code>.
              </Alert>
            ) : (
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <ShieldCheck size={18} color="#93c5fd" />
                  <strong style={{ fontSize: '15px' }}>Authorize Payment via PayPal Sandbox</strong>
                </div>
                <p className="text-sm text-muted mb-4">
                  Approve authorization with your PayPal Sandbox buyer account. No immediate charge
                  is made until you approve individual milestones.
                </p>
                <div style={{ maxWidth: '340px' }}>
                  <PayPalProvider
                    clientId={PAYPAL_CLIENT_ID}
                    environment="sandbox"
                    components={['paypal-payments']}
                    pageType="checkout"
                  >
                    <ProjectPayPalButton
                      projectId={project._id}
                      onAuthorized={async () => {
                        toast.success('PayPal authorization confirmed and saved!');
                        await onRefresh();
                      }}
                      onError={(msg) => setErrorMsg(msg)}
                      setStatusMsg={setStatusMsg}
                    />
                  </PayPalProvider>
                </div>
              </div>
            )}
          </div>
        )}

        {isClient && payment?.status === 'AUTHORIZED' && (
          <div className="flex items-center justify-between flex-wrap gap-2 mt-3">
            <span className="text-sm text-muted">
              No milestone captures executed yet. You may void unused authorization if cancelling.
            </span>
            <Button
              variant="danger"
              size="sm"
              icon={Ban}
              loading={voiding}
              onClick={handleVoidAuthorization}
            >
              Void Authorization
            </Button>
          </div>
        )}
      </Card>

      {/* Milestone-wise Capture Controls */}
      <Card
        title="Milestone-Wise Payment Release"
        subtitle="Approved milestones can be captured individually from the project's PayPal authorization."
      >
        <div className="flex-col gap-3">
          {milestones.map((m) => {
            const captureRecord = payment?.captures?.find(
              (c) => c.milestoneId === m._id
            );

            return (
              <div
                key={m._id}
                className="flex items-center justify-between flex-wrap gap-3"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border)',
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span style={{ fontWeight: 600 }}>
                      #{m.order} {m.title}
                    </span>
                    <StatusBadge status={m.status} />
                  </div>
                  <div className="text-sm text-muted" style={{ marginTop: '3px' }}>
                    Allocation: <strong>{formatCurrency(m.paymentAmount, currency)}</strong>
                    {captureRecord ? ` • Capture ID: ${captureRecord.captureId}` : ''}
                  </div>
                </div>

                <div>
                  {m.status === 'PAID' ? (
                    <span className="badge badge-success">
                      <CheckCircle2 size={12} /> Captured
                    </span>
                  ) : m.status === 'APPROVED' && isClient ? (
                    <Button
                      size="sm"
                      variant="success"
                      icon={Wallet}
                      loading={capturingId === m._id}
                      disabled={!isAuthorizedActive}
                      onClick={() => handleCaptureMilestone(m)}
                    >
                      {isAuthorizedActive ? 'Capture Funds' : 'Authorize Project First'}
                    </Button>
                  ) : m.status === 'APPROVED' ? (
                    <span className="badge badge-warning">
                      <Clock size={12} /> Awaiting Client Capture
                    </span>
                  ) : (
                    <span className="text-sm text-dim flex items-center gap-1">
                      <AlertTriangle size={13} /> Approval required before capture
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Transaction Capture History */}
      <Card
        title="Payment Transaction History"
        subtitle="Verified backend PayPal capture records for this project."
      >
        <Table
          columns={captureColumns}
          data={payment?.captures || []}
          rowKey={(row) => row.captureId}
          emptyTitle="No capture transactions yet"
          emptyDescription="Once milestones are approved and captured through PayPal, each transaction record appears here."
        />
      </Card>
    </div>
  );
}

