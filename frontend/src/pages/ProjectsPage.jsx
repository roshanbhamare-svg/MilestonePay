import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PlusCircle, Search, Calendar, User } from 'lucide-react';
import Card from '../components/common/Card';
import Table from '../components/common/Table';
import StatusBadge from '../components/common/StatusBadge';
import Alert from '../components/common/Alert';
import { projectApi } from '../api/projectApi';
import { useAuth } from '../hooks/useAuth';
import { formatCurrency, formatDate, getErrorMessage } from '../utils/formatters';

const STATUS_FILTERS = ['ALL', 'DRAFT', 'AGREEMENT_PENDING', 'ACTIVE', 'COMPLETED', 'CANCELLED'];

export default function ProjectsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const isClient = user?.role === 'client';

  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  useEffect(() => {
    let active = true;

    const loadProjects = async () => {
      setLoading(true);
      setError('');
      try {
        const list = await projectApi.getMyProjects();
        if (active) setProjects(list);
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Failed to fetch projects'));
      } finally {
        if (active) setLoading(false);
      }
    };

    loadProjects();
    return () => {
      active = false;
    };
  }, []);

  const filtered = projects.filter((p) => {
    const matchesStatus = statusFilter === 'ALL' || p.status === statusFilter;
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      p.title?.toLowerCase().includes(q) ||
      p.description?.toLowerCase().includes(q) ||
      p.freelancerId?.name?.toLowerCase().includes(q) ||
      p.clientId?.name?.toLowerCase().includes(q);
    return matchesStatus && matchesSearch;
  });

  const columns = [
    {
      key: 'title',
      header: 'Project Title',
      render: (row) => (
        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.title}</div>
          <div className="text-sm text-dim" style={{ maxWidth: '360px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {row.description}
          </div>
        </div>
      ),
    },
    {
      key: 'counterparty',
      header: isClient ? 'Freelancer' : 'Client',
      render: (row) => {
        const person = isClient ? row.freelancerId : row.clientId;
        return person ? (
          <div className="flex items-center gap-2">
            <User size={14} color="#94a3b8" />
            <span>{person.name}</span>
          </div>
        ) : (
          <span className="text-dim">Unassigned</span>
        );
      },
    },
    {
      key: 'budget',
      header: 'Budget',
      render: (row) => <strong>{formatCurrency(row.budget, row.currency)}</strong>,
    },
    {
      key: 'deadline',
      header: 'Deadline',
      render: (row) => (
        <span className="flex items-center gap-1 text-sm">
          <Calendar size={13} color="#94a3b8" />
          {formatDate(row.deadline)}
        </span>
      ),
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
          <h1 className="page-title">Projects</h1>
          <p className="page-subtitle">
            {isClient
              ? 'Manage project agreements, milestones, and PayPal escrow authorizations.'
              : 'View assigned projects, accept agreements, and submit milestone deliverables.'}
          </p>
        </div>
        {isClient && (
          <Link to="/projects/new" className="btn btn-primary">
            <PlusCircle size={16} /> Create Project
          </Link>
        )}
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
          <div className="flex items-center gap-2 flex-wrap">
            {STATUS_FILTERS.map((status) => (
              <button
                key={status}
                type="button"
                onClick={() => setStatusFilter(status)}
                className={`btn btn-sm ${statusFilter === status ? 'btn-primary' : 'btn-secondary'}`}
              >
                {status.replace('_', ' ')}
              </button>
            ))}
          </div>

          <div style={{ position: 'relative', minWidth: '240px' }}>
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '11px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-dim)',
              }}
            />
            <input
              className="form-input"
              style={{ paddingLeft: '34px' }}
              placeholder="Search projects..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>

        <Table
          columns={columns}
          data={filtered}
          loading={loading}
          emptyTitle="No matching projects"
          emptyDescription={
            isClient
              ? 'Create a new project to break down milestones and invite a freelancer.'
              : 'Projects assigned to you by clients will appear here.'
          }
          onRowClick={(row) => navigate(`/projects/${row._id}`)}
        />
      </Card>
    </div>
  );
}

