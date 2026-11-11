import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  Activity,
  Clock,
  CheckCircle2,
  Wallet,
  DollarSign,
  ArrowRight,
  Handshake,
} from 'lucide-react';
import StatCard from '../components/common/StatCard';
import Card from '../components/common/Card';
import Table from '../components/common/Table';
import StatusBadge from '../components/common/StatusBadge';
import Alert from '../components/common/Alert';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { projectApi } from '../api/projectApi';
import { milestoneApi } from '../api/milestoneApi';
import { paymentApi } from '../api/paymentApi';
import { notificationApi } from '../api/notificationApi';
import { formatCurrency, formatCurrencySummary, formatDate, formatRelativeTime, getErrorMessage } from '../utils/formatters';

export default function FreelancerDashboard() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [projects, setProjects] = useState([]);
  const [allMilestones, setAllMilestones] = useState([]);
  const [payments, setPayments] = useState([]);
  const [notifications, setNotifications] = useState([]);

  useEffect(() => {
    let active = true;

    const loadDashboard = async () => {
      setLoading(true);
      setError('');
      try {
        const [projList, notifData] = await Promise.all([
          projectApi.getMyProjects(),
          notificationApi.getMyNotifications().catch(() => ({ notifications: [] })),
        ]);

        const milestoneResults = await Promise.allSettled(
          projList.map(async (p) => {
            const list = await milestoneApi.getProjectMilestones(p._id);
            return list.map((m) => ({
              ...m,
              projectTitle: p.title,
              projectCurrency: p.currency,
            }));
          })
        );

        const paymentResults = await Promise.allSettled(
          projList.map((p) => paymentApi.getProjectPayments(p._id))
        );

        if (!active) return;

        setProjects(projList);
        setNotifications(notifData.notifications || []);
        setAllMilestones(
          milestoneResults
            .filter((r) => r.status === 'fulfilled')
            .flatMap((r) => r.value || [])
        );
        setPayments(
          paymentResults
            .filter((r) => r.status === 'fulfilled' && r.value)
            .map((r) => r.value)
        );
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err, 'Failed to load freelancer dashboard'));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    loadDashboard();
    return () => {
      active = false;
    };
  }, []);

  if (loading) {
    return <LoadingSpinner label="Loading freelancer dashboard..." />;
  }

  const assignedProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
  const pendingAgreementProjects = projects.filter((p) => p.status === 'AGREEMENT_PENDING');

  const pendingDeliverables = allMilestones.filter((m) =>
    ['PENDING', 'IN_PROGRESS', 'CHANGES_REQUESTED'].includes(m.status)
  );
  const completedMilestones = allMilestones.filter((m) =>
    ['APPROVED', 'PAID'].includes(m.status)
  );
  const paymentsReceivedText = formatCurrencySummary(
    payments,
    (p) => p.totalCaptured || 0,
    (p) => p.currency
  );
  const unpaidMilestones = allMilestones.filter((m) => m.status !== 'PAID');
  const pendingMilestonePaymentsText = formatCurrencySummary(
    unpaidMilestones,
    (m) => m.paymentAmount || 0,
    (m) => m.projectCurrency
  );

  const deliverableColumns = [
    {
      key: 'title',
      header: 'Milestone',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
            #{row.order} {row.title}
          </div>
          <div className="text-sm text-dim">{row.projectTitle}</div>
        </div>
      ),
    },
    {
      key: 'paymentAmount',
      header: 'Payout',
      render: (row) => formatCurrency(row.paymentAmount, row.projectCurrency),
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (row) => formatDate(row.deadline),
    },
    {
      key: 'status',
      header: 'Status',
      render: (row) => <StatusBadge status={row.status} />,
    },
  ];

  return (
    <div className="flex-col gap-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Freelancer Dashboard</h1>
          <p className="page-subtitle">
            Track assigned projects, milestone deliverables, revisions, and captured payouts.
          </p>
        </div>
        <Link to="/projects" className="btn btn-secondary">
          Browse Assigned Projects <ArrowRight size={15} />
        </Link>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {pendingAgreementProjects.length > 0 && (
        <Alert variant="warning" title="Project Agreement Awaiting Your Acceptance">
          <div className="flex items-center justify-between flex-wrap gap-2 mt-2">
            <span>
              You have {pendingAgreementProjects.length} project invitation(s) waiting for agreement
              review.
            </span>
            <Link
              to={`/projects/${pendingAgreementProjects[0]._id}`}
              className="btn btn-warning btn-sm"
            >
              <Handshake size={14} /> Review Agreement
            </Link>
          </div>
        </Alert>
      )}

      <div className="grid grid-cols-3">
        <StatCard
          label="Assigned Projects"
          value={assignedProjects}
          helper={`${pendingAgreementProjects.length} pending agreement`}
          icon={Briefcase}
          tone="brand"
        />
        <StatCard
          label="Active Projects"
          value={activeProjects}
          helper="In progress right now"
          icon={Activity}
          tone="info"
        />
        <StatCard
          label="Pending Deliverables"
          value={pendingDeliverables.length}
          helper={`${pendingDeliverables.filter((m) => m.status === 'CHANGES_REQUESTED').length} require revisions`}
          icon={Clock}
          tone="warning"
        />
        <StatCard
          label="Completed Milestones"
          value={completedMilestones.length}
          helper="Approved or paid"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Payments Received"
          value={paymentsReceivedText}
          helper="Captured via PayPal"
          icon={Wallet}
          tone="success"
        />
        <StatCard
          label="Pending Milestone Payments"
          value={pendingMilestonePaymentsText}
          helper="Remaining across unpaid milestones"
          icon={DollarSign}
          tone="ai"
        />
      </div>

      <div className="grid grid-cols-3">
        <div style={{ gridColumn: 'span 2' }}>
          <Card
            title="Upcoming Deliverables"
            subtitle="Open a milestone's project workspace to start work or submit deliverables."
          >
            <Table
              columns={deliverableColumns}
              data={pendingDeliverables.slice(0, 6)}
              emptyTitle="No pending deliverables"
              emptyDescription="All assigned deliverables are submitted, under review, or completed."
              onRowClick={(row) => navigate(`/projects/${row.projectId}`)}
            />
          </Card>
        </div>

        <Card
          title="Recent Activity"
          subtitle="Reviews & payment alerts"
          action={
            <Link to="/notifications" className="btn btn-ghost btn-sm">
              All
            </Link>
          }
        >
          {notifications.length === 0 ? (
            <div className="text-sm text-dim">No recent activity yet.</div>
          ) : (
            <div className="flex-col gap-3">
              {notifications.slice(0, 6).map((n) => (
                <div
                  key={n._id}
                  style={{
                    paddingBottom: '10px',
                    borderBottom: '1px solid var(--border)',
                  }}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>{n.title}</span>
                    <span className="text-sm text-dim">{formatRelativeTime(n.createdAt)}</span>
                  </div>
                  <div className="text-sm text-muted" style={{ marginTop: '2px' }}>
                    {n.message}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}

