import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Wallet, ShieldCheck, Clock, ArrowRight } from 'lucide-react';
import Card from '../components/common/Card';
import StatCard from '../components/common/StatCard';
import Table from '../components/common/Table';
import StatusBadge from '../components/common/StatusBadge';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { projectApi } from '../api/projectApi';
import { paymentApi } from '../api/paymentApi';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatCurrencySummary, formatDateTime, getErrorMessage } from '../utils/formatters';

export default function PaymentsPage() {
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let active = true;

    const loadPayments = async () => {
      setLoading(true);
      setError('');
      try {
        const projects = await projectApi.getMyProjects();
        const paymentResults = await Promise.allSettled(
          projects.map(async (proj) => {
            const payment = await paymentApi.getProjectPayments(proj._id);
            return { project: proj, payment };
          })
        );

        if (!active) return;

        const combined = paymentResults
          .filter((r) => r.status === 'fulfilled')
          .map((r) => r.value);
        setRows(combined);
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Failed to fetch payment records'));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadPayments();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingSpinner label="Loading payment history..." />;
  }

  const withPayments = rows.filter((r) => r.payment);
  const authorizedPayments = withPayments.filter((r) =>
    ['AUTHORIZED', 'PARTIALLY_CAPTURED', 'COMPLETED'].includes(r.payment.status)
  );
  const totalAuthorizedText = formatCurrencySummary(
    authorizedPayments,
    (r) => r.payment.totalAuthorized || 0,
    (r) => r.payment.currency || r.project.currency
  );
  const totalCapturedText = formatCurrencySummary(
    withPayments,
    (r) => r.payment.totalCaptured || 0,
    (r) => r.payment.currency || r.project.currency
  );
  const totalPendingReleaseText = formatCurrencySummary(
    authorizedPayments,
    (r) => Math.max(0, (r.payment.totalAuthorized || 0) - (r.payment.totalCaptured || 0)),
    (r) => r.payment.currency || r.project.currency
  );

  const allCaptures = withPayments.flatMap((r) =>
    (r.payment.captures || []).map((c) => ({
      ...c,
      projectId: r.project._id,
      projectTitle: r.project.title,
      currency: r.payment.currency || r.project.currency || 'USD',
    }))
  );

  const projectPaymentCols = [
    {
      key: 'project',
      header: 'Project',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.project.title}</div>
          <div className="text-sm text-dim">
            Order: {row.payment?.paypalOrderId || 'Not initiated'}
          </div>
        </div>
      ),
    },
    {
      key: 'authId',
      header: 'Authorization ID',
      render: (row) => (
        <code style={{ fontSize: '12px' }}>{row.payment?.authorizationId || '—'}</code>
      ),
    },
    {
      key: 'authorized',
      header: 'Authorized',
      render: (row) =>
        formatCurrency(
          row.payment?.totalAuthorized ?? row.project.budget,
          row.payment?.currency || row.project.currency
        ),
    },
    {
      key: 'captured',
      header: 'Captured',
      render: (row) => (
        <strong style={{ color: '#6ee7b7' }}>
          {formatCurrency(
            row.payment?.totalCaptured ?? 0,
            row.payment?.currency || row.project.currency
          )}
        </strong>
      ),
    },
    {
      key: 'status',
      header: 'Payment Status',
      render: (row) => (
        <StatusBadge
          status={row.payment?.status || 'PENDING'}
          label={row.payment ? undefined : 'NOT AUTHORIZED'}
        />
      ),
    },
    {
      key: 'link',
      header: '',
      render: (row) => (
        <Link to={`/projects/${row.project._id}`} className="btn btn-ghost btn-sm">
          Manage <ArrowRight size={13} />
        </Link>
      ),
    },
  ];

  const captureCols = [
    {
      key: 'captureId',
      header: 'Capture ID',
      render: (row) => <code style={{ fontSize: '12px' }}>{row.captureId}</code>,
    },
    {
      key: 'projectTitle',
      header: 'Project',
      render: (row) => (
        <Link to={`/projects/${row.projectId}`} style={{ color: '#93c5fd', fontWeight: 600 }}>
          {row.projectTitle}
        </Link>
      ),
    },
    {
      key: 'amount',
      header: 'Amount',
      render: (row) => <strong>{formatCurrency(row.amount, row.currency)}</strong>,
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
    {
      key: 'capturedAt',
      header: 'Date',
      render: (row) => formatDateTime(row.capturedAt),
    },
  ];

  return (
    <div className="flex-col gap-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Payments & PayPal Ledger</h1>
          <p className="page-subtitle">
            {isClient
              ? 'Overview of authorized escrows and captured milestone payouts.'
              : 'Track authorized project reserves and released PayPal milestone payouts.'}
          </p>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-3">
        <StatCard
          label="Total Authorized Escrow"
          value={totalAuthorizedText}
          helper={`${withPayments.length} project payment records`}
          icon={ShieldCheck}
          tone="brand"
        />
        <StatCard
          label={isClient ? 'Total Captured & Paid' : 'Total Payouts Received'}
          value={totalCapturedText}
          helper={`${allCaptures.length} capture transactions`}
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Remaining Authorized Funds"
          value={totalPendingReleaseText}
          helper="Held awaiting milestone approvals"
          icon={Clock}
          tone="warning"
        />
      </div>

      <Card title="Project Payment Authorizations">
        <Table
          columns={projectPaymentCols}
          data={rows}
          rowKey={(r) => r.project._id}
          emptyTitle="No projects found"
          emptyDescription="Payment authorizations appear here as projects become active."
        />
      </Card>

      <Card title="Milestone Capture Transactions">
        <Table
          columns={captureCols}
          data={allCaptures}
          rowKey={(r) => r.captureId}
          emptyTitle="No capture transactions yet"
          emptyDescription="Milestone captures appear after client approval and PayPal confirmation."
        />
      </Card>
    </div>
  );
}

