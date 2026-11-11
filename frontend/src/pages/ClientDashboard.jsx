import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  FolderKanban,
  Activity,
  CheckCircle2,
  DollarSign,
  Flag,
  Wallet,
  PlusCircle,
  ArrowRight,
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

export default function ClientDashboard() {
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
          projList.map((p) => milestoneApi.getProjectMilestones(p._id))
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
          setError(getErrorMessage(err, 'Failed to load client dashboard'));
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
    return <LoadingSpinner label="Loading client dashboard..." />;
  }

  const totalProjects = projects.length;
  const activeProjects = projects.filter((p) => p.status === 'ACTIVE').length;
  const completedProjects = projects.filter((p) => p.status === 'COMPLETED').length;
  const activeBudgetProjects = projects.filter((p) => p.status !== 'CANCELLED');
  const totalBudgetText = formatCurrencySummary(
    activeBudgetProjects,
    (p) => p.budget || 0,
    (p) => p.currency
  );

  const completedMilestones = allMilestones.filter((m) =>
    ['APPROVED', 'PAID'].includes(m.status)
  ).length;
  const pendingMilestones = allMilestones.filter(
    (m) => !['APPROVED', 'PAID'].includes(m.status)
  ).length;
  const totalPaymentsMadeText = formatCurrencySummary(
    payments,
    (p) => p.totalCaptured || 0,
    (p) => p.currency
  );
  const authorizedPayments = payments.filter((p) =>
    ['AUTHORIZED', 'PARTIALLY_CAPTURED', 'COMPLETED'].includes(p.status)
  );
  const totalAuthorizedText = formatCurrencySummary(
    authorizedPayments,
    (p) => p.totalAuthorized || 0,
    (p) => p.currency
  );

  const projectColumns = [
    {
      key: 'title',
      header: 'Project',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.title}</div>
          <div className="text-sm text-dim">
            {row.freelancerId ? `Freelancer: ${row.freelancerId.name}` : 'No freelancer assigned'}
          </div>
        </div>
      ),
    },
    {
      key: 'budget',
      header: 'Budget',
      render: (row) => formatCurrency(row.budget, row.currency),
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
    {
      key: 'actions',
      header: '',
      render: () => (
        <span className="text-sm" style={{ color: '#93c5fd', fontWeight: 600 }}>
          Open →
        </span>
      ),
    },
  ];

  return (
    <div className="flex-col gap-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Client Dashboard</h1>
          <p className="page-subtitle">
            Monitor project budgets, milestone reviews, and PayPal escrow releases.
          </p>
        </div>
        <Link to="/projects/new" className="btn btn-primary">
          <PlusCircle size={16} /> Create Project
        </Link>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <div className="grid grid-cols-3">
        <StatCard
          label="Total Created Projects"
          value={totalProjects}
          helper={`${projects.filter((p) => p.status === 'DRAFT').length} drafts • ${projects.filter((p) => p.status === 'AGREEMENT_PENDING').length} awaiting agreement`}
          icon={FolderKanban}
          tone="brand"
        />
        <StatCard
          label="Active Projects"
          value={activeProjects}
          helper="Currently in execution"
          icon={Activity}
          tone="info"
        />
        <StatCard
          label="Completed Projects"
          value={completedProjects}
          helper="All milestones paid"
          icon={CheckCircle2}
          tone="success"
        />
        <StatCard
          label="Total Project Budget"
          value={totalBudgetText}
          helper={`${totalAuthorizedText} authorized via PayPal`}
          icon={DollarSign}
          tone="ai"
        />
        <StatCard
          label="Milestones Progress"
          value={`${completedMilestones} / ${allMilestones.length}`}
          helper={`${completedMilestones} completed • ${pendingMilestones} pending`}
          icon={Flag}
          tone="warning"
        />
        <StatCard
          label="Total Payments Made"
          value={totalPaymentsMadeText}
          helper="Captured across milestone approvals"
          icon={Wallet}
          tone="success"
        />
      </div>

      <div className="grid grid-cols-3">
        <div style={{ gridColumn: 'span 2' }}>
          <Card
            title="Recent Projects"
            subtitle="Click any project to manage milestones, submissions, or PayPal payments."
            action={
              <Link to="/projects" className="btn btn-ghost btn-sm">
                View all <ArrowRight size={14} />
              </Link>
            }
          >
            <Table
              columns={projectColumns}
              data={projects.slice(0, 6)}
              emptyTitle="No projects created yet"
              emptyDescription="Create your first project and generate AI milestones to begin."
              onRowClick={(row) => navigate(`/projects/${row._id}`)}
            />
          </Card>
        </div>

        <Card
          title="Recent Project Activity"
          subtitle="Latest notifications & updates"
          action={
            <Link to="/notifications" className="btn btn-ghost btn-sm">
              All
            </Link>
          }
        >
          {notifications.length === 0 ? (
            <div className="text-sm text-dim">No recent activity recorded yet.</div>
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
