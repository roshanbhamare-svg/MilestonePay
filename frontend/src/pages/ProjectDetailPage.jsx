import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  ArrowLeft,
  Calendar,
  UserPlus,
  Handshake,
  XCircle,
  Plus,
  Sparkles,
  CreditCard,
  Flag,
  Edit3,
  CheckCircle2,
  Bot,
  User,
} from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import StatusBadge from '../components/common/StatusBadge';
import Alert from '../components/common/Alert';
import Modal from '../components/common/Modal';
import LoadingSpinner from '../components/common/LoadingSpinner';
import EmptyState from '../components/common/EmptyState';
import MilestoneCard from '../components/milestones/MilestoneCard';
import MilestoneFormModal from '../components/milestones/MilestoneFormModal';
import AIMilestoneGenerator from '../components/milestones/AIMilestoneGenerator';
import SubmissionModal from '../components/submissions/SubmissionModal';
import SubmissionHistory from '../components/submissions/SubmissionHistory';
import AIEvaluationPanel from '../components/ai/AIEvaluationPanel';
import AIProjectAssistant from '../components/ai/AIProjectAssistant';
import ProjectPaymentPanel from '../components/payments/ProjectPaymentPanel';
import { projectApi } from '../api/projectApi';
import { milestoneApi } from '../api/milestoneApi';
import { submissionApi } from '../api/submissionApi';
import { approvalApi } from '../api/approvalApi';
import { paymentApi } from '../api/paymentApi';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import {
  formatCurrency,
  formatDate,
  formatDateInput,
  getErrorMessage,
  getInitials,
} from '../utils/formatters';

export default function ProjectDetailPage() {
  const { projectId } = useParams();
  const { user } = useAuth();
  const toast = useToast();

  const [project, setProject] = useState(null);
  const [milestones, setMilestones] = useState([]);
  const [payment, setPayment] = useState(null);
  const [freelancers, setFreelancers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('milestones');

  // Agreement & assignment controls
  const [selectedFreelancerId, setSelectedFreelancerId] = useState('');
  const [agreementBusy, setAgreementBusy] = useState(false);

  // Edit Project Modal (DRAFT)
  const [editProjectOpen, setEditProjectOpen] = useState(false);
  const [editForm, setEditForm] = useState({
    title: '',
    description: '',
    budget: '',
    currency: 'USD',
    deadline: '',
  });
  const [savingProject, setSavingProject] = useState(false);

  // Milestone Create/Edit Modal
  const [milestoneModalOpen, setMilestoneModalOpen] = useState(false);
  const [editingMilestone, setEditingMilestone] = useState(null);

  // Bulk AI Milestones Modal
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiDraftMilestones, setAiDraftMilestones] = useState([]);
  const [savingBulkAi, setSavingBulkAi] = useState(false);

  // Freelancer Submission Modal
  const [submitModalMilestone, setSubmitModalMilestone] = useState(null);

  // Milestone Inspection Modal (Submissions + AI Evaluation + Review)
  const [inspectMilestone, setInspectMilestone] = useState(null);
  const [inspectSubmissions, setInspectSubmissions] = useState([]);
  const [loadingSubmissions, setLoadingSubmissions] = useState(false);
  const [milestoneActionBusy, setMilestoneActionBusy] = useState(false);

  // Counterparty Profile Modal
  const [profileModalOpen, setProfileModalOpen] = useState(false);
  const [profileModalUser, setProfileModalUser] = useState(null);
  const [loadingProfile, setLoadingProfile] = useState(false);

  const openProfileModal = async (userId) => {
    if (!userId) return;
    setProfileModalOpen(true);
    setLoadingProfile(true);
    try {
      const profile = await projectApi.getUserById(userId);
      setProfileModalUser(profile);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to load user profile'));
      setProfileModalOpen(false);
    } finally {
      setLoadingProfile(false);
    }
  };

  const isClient = user?.role === 'client';
  const isFreelancer = user?.role === 'freelancer';

  const fetchWorkspaceData = useCallback(async () => {
    const [proj, msList, payData] = await Promise.all([
      projectApi.getProjectById(projectId),
      milestoneApi.getProjectMilestones(projectId),
      paymentApi.getProjectPayments(projectId),
    ]);

    let flList = [];
    if (isClient && proj.status === 'DRAFT') {
      flList = await projectApi.getFreelancers().catch(() => []);
    }
    return { proj, msList, payData, flList };
  }, [projectId, isClient]);

  const loadAll = useCallback(async () => {
    setError('');
    try {
      const { proj, msList, payData, flList } = await fetchWorkspaceData();
      setProject(proj);
      setMilestones(msList);
      setPayment(payData);
      if (flList.length > 0 || proj.status === 'DRAFT') {
        setFreelancers(flList);
      }
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to load project workspace'));
    } finally {
      setLoading(false);
    }
  }, [fetchWorkspaceData]);

  useEffect(() => {
    let active = true;

    const init = async () => {
      try {
        const { proj, msList, payData, flList } = await fetchWorkspaceData();
        if (!active) return;
        setProject(proj);
        setMilestones(msList);
        setPayment(payData);
        setFreelancers(flList);
        setError('');
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err, 'Failed to load project workspace'));
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    init();
    return () => {
      active = false;
    };
  }, [fetchWorkspaceData]);

  const openInspectModal = async (milestone) => {
    setInspectMilestone(milestone);
    setLoadingSubmissions(true);
    try {
      const list = await submissionApi.getSubmissions(milestone._id);
      setInspectSubmissions(list);
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to fetch submissions'));
      setInspectSubmissions([]);
    } finally {
      setLoadingSubmissions(false);
    }
  };

  const refreshInspectedMilestone = async (targetId) => {
    const [msList, subs] = await Promise.all([
      milestoneApi.getProjectMilestones(projectId),
      submissionApi.getSubmissions(targetId),
    ]);
    setMilestones(msList);
    setInspectSubmissions(subs);
    const updated = msList.find((m) => m._id === targetId) || null;
    setInspectMilestone(updated);
  };

  const handleAssignFreelancer = async () => {
    if (!selectedFreelancerId) {
      toast.error('Select a freelancer first.');
      return;
    }
    setAgreementBusy(true);
    try {
      await projectApi.assignFreelancer(project._id, selectedFreelancerId);
      toast.success('Freelancer assigned! Agreement is now pending acceptance.');
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to assign freelancer'));
    } finally {
      setAgreementBusy(false);
    }
  };

  const handleAcceptAgreement = async () => {
    setAgreementBusy(true);
    try {
      const updated = await projectApi.acceptAgreement(project._id);
      toast.success(
        updated.status === 'ACTIVE'
          ? 'Both parties accepted! Project is now ACTIVE.'
          : 'Your agreement acceptance has been recorded.'
      );
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to accept agreement'));
    } finally {
      setAgreementBusy(false);
    }
  };

  const handleRejectAgreement = async () => {
    setAgreementBusy(true);
    try {
      await projectApi.rejectAgreement(project._id);
      toast.info('Agreement rejected. Project returned to DRAFT.');
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to reject agreement'));
    } finally {
      setAgreementBusy(false);
    }
  };

  const handleCancelProject = async () => {
    if (!window.confirm('Cancel this project? This action cannot be undone.')) return;
    setAgreementBusy(true);
    try {
      await projectApi.cancelProject(project._id);
      toast.info('Project cancelled.');
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to cancel project'));
    } finally {
      setAgreementBusy(false);
    }
  };

  const openEditProject = () => {
    setEditForm({
      title: project.title || '',
      description: project.description || '',
      budget: String(project.budget ?? ''),
      currency: project.currency || 'USD',
      deadline: formatDateInput(project.deadline),
    });
    setEditProjectOpen(true);
  };

  const handleUpdateProject = async (e) => {
    e.preventDefault();
    setSavingProject(true);
    try {
      await projectApi.updateProject(project._id, {
        title: editForm.title.trim(),
        description: editForm.description.trim(),
        budget: parseFloat(editForm.budget),
        currency: editForm.currency,
        deadline: new Date(editForm.deadline).toISOString(),
      });
      toast.success('Project updated.');
      setEditProjectOpen(false);
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update project'));
    } finally {
      setSavingProject(false);
    }
  };

  const handleSaveMilestoneForm = async (payload) => {
    if (editingMilestone?._id) {
      await milestoneApi.updateMilestone(editingMilestone._id, payload);
      toast.success('Milestone updated.');
    } else {
      await milestoneApi.createMilestone(project._id, payload);
      toast.success('Milestone added.');
    }
    await loadAll();
  };

  const handleSaveBulkAiMilestones = async (generatedList) => {
    setSavingBulkAi(true);
    try {
      await milestoneApi.createBulkMilestones(project._id, generatedList);
      toast.success('AI milestones saved to project!');
      setAiModalOpen(false);
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to save milestones'));
    } finally {
      setSavingBulkAi(false);
    }
  };

  const handleStartWork = async (milestone) => {
    setMilestoneActionBusy(true);
    try {
      await milestoneApi.updateMilestoneStatus(milestone._id, 'IN_PROGRESS');
      toast.success(`Started "${milestone.title}". You can now submit deliverables.`);
      await loadAll();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to update milestone status'));
    } finally {
      setMilestoneActionBusy(false);
    }
  };

  const handleStartReview = async (milestone) => {
    setMilestoneActionBusy(true);
    try {
      await approvalApi.startReview(milestone._id);
      toast.info(`"${milestone.title}" is now Under Review.`);
      await loadAll();
      if (inspectMilestone?._id === milestone._id) {
        await refreshInspectedMilestone(milestone._id);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to start review'));
    } finally {
      setMilestoneActionBusy(false);
    }
  };

  const handleApproveMilestone = async (milestone) => {
    await approvalApi.approveMilestone(milestone._id);
    toast.success(`Approved "${milestone.title}". Ready for PayPal payment capture.`);
    await loadAll();
    if (inspectMilestone?._id === milestone._id) {
      await refreshInspectedMilestone(milestone._id);
    }
  };

  const handleRequestChanges = async (milestone, reason) => {
    await approvalApi.requestChanges(milestone._id, reason);
    toast.info('Modification request sent to freelancer.');
    await loadAll();
    if (inspectMilestone?._id === milestone._id) {
      await refreshInspectedMilestone(milestone._id);
    }
  };

  const handleCapturePayment = async (milestone) => {
    setMilestoneActionBusy(true);
    try {
      const res = await paymentApi.captureMilestonePayment(milestone._id);
      toast.success(
        `Captured ${formatCurrency(res.amount, project.currency)} via PayPal (Capture ID: ${res.captureId})`
      );
      await loadAll();
      if (inspectMilestone?._id === milestone._id) {
        await refreshInspectedMilestone(milestone._id);
      }
    } catch (err) {
      toast.error(getErrorMessage(err, 'PayPal capture failed'));
    } finally {
      setMilestoneActionBusy(false);
    }
  };

  if (loading) {
    return <LoadingSpinner label="Loading project workspace..." />;
  }

  if (error || !project) {
    return (
      <div className="flex-col gap-4">
        <Link to="/projects" className="btn btn-secondary btn-sm" style={{ alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} /> Back to Projects
        </Link>
        <Alert variant="danger">{error || 'Project not found'}</Alert>
      </div>
    );
  }

  const allocatedTotal = milestones.reduce((sum, m) => sum + (m.paymentAmount || 0), 0);
  const remainingBudget = Math.max(0, Math.round((project.budget - allocatedTotal) * 100) / 100);
  const paidMilestones = milestones.filter((m) => m.status === 'PAID').length;
  const milestonePct =
    milestones.length > 0 ? Math.round((paidMilestones / milestones.length) * 100) : 0;

  const isPaymentAuthorized = ['AUTHORIZED', 'PARTIALLY_CAPTURED'].includes(payment?.status);
  const canEditMilestones =
    isClient && ['DRAFT', 'AGREEMENT_PENDING'].includes(project.status);
  const userAccepted = isClient
    ? project.agreement?.clientAccepted
    : project.agreement?.freelancerAccepted;

  return (
    <div className="flex-col gap-6">
      {/* Header */}
      <div>
        <Link to="/projects" className="btn btn-ghost btn-sm mb-2">
          <ArrowLeft size={14} /> Back to Projects
        </Link>

        <div className="page-header" style={{ marginBottom: 0 }}>
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-2">
              <StatusBadge status={project.status} />
              {payment && (
                <StatusBadge
                  status={payment.status}
                  label={`PayPal: ${payment.status.replace('_', ' ')}`}
                />
              )}
            </div>
            <h1 className="page-title">{project.title}</h1>
            <p className="page-subtitle" style={{ maxWidth: '780px' }}>
              {project.description}
            </p>
          </div>

          {isClient && (
            <div className="flex items-center gap-2 flex-wrap">
              {project.status === 'DRAFT' && (
                <Button variant="secondary" icon={Edit3} onClick={openEditProject}>
                  Edit Draft
                </Button>
              )}
              {!['COMPLETED', 'CANCELLED'].includes(project.status) && (
                <Button
                  variant="danger"
                  icon={XCircle}
                  loading={agreementBusy}
                  onClick={handleCancelProject}
                >
                  Cancel Project
                </Button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Metadata Strip */}
      <div className="grid grid-cols-4">
        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="text-sm text-muted">Project Budget</div>
          <div style={{ fontSize: '20px', fontWeight: 700, marginTop: '4px' }}>
            {formatCurrency(project.budget, project.currency)}
          </div>
          <div className="text-sm text-dim">
            {formatCurrency(allocatedTotal, project.currency)} in milestones
          </div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Client</span>
            {project.clientId?._id && (
              <button
                type="button"
                onClick={() => openProfileModal(project.clientId._id)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 6px', fontSize: '11px' }}
              >
                <User size={12} /> Profile
              </button>
            )}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '6px' }}>
            {project.clientId?.name || '—'}
          </div>
          <div className="text-sm text-dim">{project.clientId?.email || ''}</div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted">Assigned Freelancer</span>
            {project.freelancerId?._id && (
              <button
                type="button"
                onClick={() => openProfileModal(project.freelancerId._id)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '2px 6px', fontSize: '11px' }}
              >
                <User size={12} /> Profile
              </button>
            )}
          </div>
          <div style={{ fontSize: '15px', fontWeight: 600, marginTop: '6px' }}>
            {project.freelancerId?.name || 'Not assigned yet'}
          </div>
          <div className="text-sm text-dim">{project.freelancerId?.email || 'Select below'}</div>
        </div>

        <div className="card" style={{ padding: '14px 16px' }}>
          <div className="text-sm text-muted">Deadline & Progress</div>
          <div className="flex items-center gap-2" style={{ fontSize: '15px', fontWeight: 600, marginTop: '6px' }}>
            <Calendar size={14} color="#94a3b8" />
            {formatDate(project.deadline)}
          </div>
          <div className="text-sm text-dim">
            {paidMilestones} / {milestones.length} milestones paid ({milestonePct}%)
          </div>
        </div>
      </div>

      {/* Freelancer Assignment (Client in DRAFT) */}
      {isClient && project.status === 'DRAFT' && (
        <Card
          title="Assign Freelancer to Start Agreement"
          subtitle="Choose a registered freelancer to move this project into AGREEMENT_PENDING."
        >
          <div className="flex items-center gap-3 flex-wrap">
            <select
              className="form-select"
              style={{ maxWidth: '360px' }}
              value={selectedFreelancerId}
              onChange={(e) => setSelectedFreelancerId(e.target.value)}
            >
              <option value="">Select freelancer...</option>
              {freelancers.map((fl) => (
                <option key={fl._id} value={fl._id}>
                  {fl.name} ({fl.email})
                </option>
              ))}
            </select>
            <Button
              variant="primary"
              icon={UserPlus}
              loading={agreementBusy}
              onClick={handleAssignFreelancer}
            >
              Assign & Send Agreement
            </Button>
          </div>
          {selectedFreelancerId && (() => {
            const picked = freelancers.find((fl) => fl._id === selectedFreelancerId);
            if (!picked) return null;
            return (
              <div
                className="mt-4"
                style={{
                  padding: '12px 14px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-app)',
                  border: '1px solid var(--border)',
                }}
              >
                <div style={{ fontWeight: 600, fontSize: '13px' }}>
                  {picked.name} — Profile Preview
                </div>
                {picked.profile?.bio && (
                  <p className="text-sm text-muted" style={{ margin: '4px 0 8px' }}>
                    {picked.profile.bio}
                  </p>
                )}
                {picked.profile?.skills?.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {picked.profile.skills.map((skill) => (
                      <span key={skill} className="badge badge-info">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })()}
        </Card>
      )}

      {/* Agreement Acceptance Banner (AGREEMENT_PENDING) */}
      {project.status === 'AGREEMENT_PENDING' && (
        <Card
          title="Project Agreement Pending"
          subtitle="Both client and freelancer must accept the scope, budget, and milestones before work and PayPal authorization begin."
        >
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3 flex-wrap">
              <span
                className={`badge ${
                  project.agreement?.clientAccepted ? 'badge-success' : 'badge-warning'
                }`}
              >
                <CheckCircle2 size={12} />
                Client: {project.agreement?.clientAccepted ? 'Accepted' : 'Pending'}
              </span>
              <span
                className={`badge ${
                  project.agreement?.freelancerAccepted ? 'badge-success' : 'badge-warning'
                }`}
              >
                <CheckCircle2 size={12} />
                Freelancer: {project.agreement?.freelancerAccepted ? 'Accepted' : 'Pending'}
              </span>
            </div>

            <div className="flex items-center gap-2">
              {!userAccepted && (
                <Button
                  variant="success"
                  icon={Handshake}
                  loading={agreementBusy}
                  onClick={handleAcceptAgreement}
                >
                  Accept Agreement
                </Button>
              )}
              <Button
                variant="danger"
                loading={agreementBusy}
                onClick={handleRejectAgreement}
              >
                Reject Agreement
              </Button>
            </div>
          </div>
        </Card>
      )}

      {/* Workspace Tabs */}
      <div>
        <div className="tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'milestones' ? 'active' : ''}`}
            onClick={() => setActiveTab('milestones')}
          >
            <Flag size={15} />
            Milestones & Deliverables ({milestones.length})
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'payments' ? 'active' : ''}`}
            onClick={() => setActiveTab('payments')}
          >
            <CreditCard size={15} />
            PayPal Payments & Captures
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'assistant' ? 'active' : ''}`}
            onClick={() => setActiveTab('assistant')}
          >
            <Bot size={15} />
            AI Assistant
          </button>
        </div>

        {activeTab === 'milestones' ? (
          <div className="flex-col gap-4">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div style={{ flex: 1, minWidth: '240px' }}>
                <div className="flex items-center justify-between text-sm text-muted mb-2">
                  <span>Overall Milestone Completion</span>
                  <span>
                    {paidMilestones} of {milestones.length} paid ({milestonePct}%)
                  </span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${milestonePct}%` }} />
                </div>
              </div>

              {canEditMilestones && (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ai"
                    size="sm"
                    icon={Sparkles}
                    onClick={() => {
                      setAiDraftMilestones(
                        milestones.map((m) => ({
                          title: m.title,
                          description: m.description,
                          paymentAmount: m.paymentAmount,
                          deadline: m.deadline,
                          deliverables: m.deliverables || [],
                          acceptanceCriteria: m.acceptanceCriteria || [],
                          order: m.order,
                        }))
                      );
                      setAiModalOpen(true);
                    }}
                  >
                    AI Milestone Planner
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    icon={Plus}
                    disabled={remainingBudget <= 0}
                    onClick={() => {
                      setEditingMilestone(null);
                      setMilestoneModalOpen(true);
                    }}
                  >
                    Add Milestone
                  </Button>
                </div>
              )}
            </div>

            {isClient && project.status === 'ACTIVE' && !isPaymentAuthorized && payment?.status !== 'COMPLETED' && (
              <Alert variant="warning" title="PayPal Authorization Recommended">
                This project is Active, but PayPal funds have not been authorized yet. Switch to the{' '}
                <button
                  type="button"
                  onClick={() => setActiveTab('payments')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#fcd34d',
                    textDecoration: 'underline',
                    cursor: 'pointer',
                    fontWeight: 600,
                    padding: 0,
                  }}
                >
                  PayPal Payments tab
                </button>{' '}
                to authorize funds before capturing approved milestones.
              </Alert>
            )}

            {milestones.length === 0 ? (
              <EmptyState
                icon={Flag}
                title="No milestones added yet"
                description={
                  isClient
                    ? 'Add milestones manually or generate a balanced breakdown with AI.'
                    : 'The client has not configured project milestones yet.'
                }
              />
            ) : (
              <div className="flex-col gap-4">
                {milestones.map((m) => (
                  <MilestoneCard
                    key={m._id}
                    milestone={m}
                    currency={project.currency}
                    projectStatus={project.status}
                    userRole={user?.role}
                    paymentAuthorized={isPaymentAuthorized}
                    actionLoading={milestoneActionBusy}
                    onStartWork={handleStartWork}
                    onOpenSubmit={(ms) => setSubmitModalMilestone(ms)}
                    onEdit={(ms) => {
                      setEditingMilestone(ms);
                      setMilestoneModalOpen(true);
                    }}
                    onStartReview={handleStartReview}
                    onOpenReviewPanel={openInspectModal}
                    onCapturePayment={handleCapturePayment}
                  />
                ))}
              </div>
            )}
          </div>
        ) : activeTab === 'payments' ? (
          <ProjectPaymentPanel
            project={project}
            milestones={milestones}
            payment={payment}
            userRole={user?.role}
            onRefresh={loadAll}
          />
        ) : (
          <AIProjectAssistant
            project={project}
            milestones={milestones}
            payment={payment}
          />
        )}
      </div>

      {/* Edit Draft Project Modal */}
      <Modal
        isOpen={editProjectOpen}
        onClose={() => setEditProjectOpen(false)}
        title="Edit Draft Project"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditProjectOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={savingProject} onClick={handleUpdateProject}>
              Save Project
            </Button>
          </>
        }
      >
        <form onSubmit={handleUpdateProject}>
          <div className="form-group">
            <label className="form-label">Title</label>
            <input
              className="form-input"
              value={editForm.title}
              onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))}
              required
            />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea
              className="form-textarea"
              value={editForm.description}
              onChange={(e) => setEditForm((p) => ({ ...p, description: e.target.value }))}
              required
            />
          </div>
          <div className="grid grid-cols-3">
            <div className="form-group">
              <label className="form-label">Budget</label>
              <input
                type="number"
                min="1"
                step="0.01"
                className="form-input"
                value={editForm.budget}
                onChange={(e) => setEditForm((p) => ({ ...p, budget: e.target.value }))}
                required
              />
            </div>
            <div className="form-group">
              <label className="form-label">Currency</label>
              <select
                className="form-select"
                value={editForm.currency}
                onChange={(e) => setEditForm((p) => ({ ...p, currency: e.target.value }))}
              >
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
                <option value="GBP">GBP</option>
                <option value="INR">INR</option>
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Deadline</label>
              <input
                type="date"
                className="form-input"
                value={editForm.deadline}
                onChange={(e) => setEditForm((p) => ({ ...p, deadline: e.target.value }))}
                required
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Single Milestone Add/Edit Modal */}
      <MilestoneFormModal
        isOpen={milestoneModalOpen}
        onClose={() => setMilestoneModalOpen(false)}
        onSubmit={handleSaveMilestoneForm}
        initialData={editingMilestone}
        currency={project.currency}
        remainingBudget={remainingBudget}
      />

      {/* Bulk AI Milestones Modal */}
      <Modal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        title="AI Milestone Planner"
        size="lg"
      >
        <AIMilestoneGenerator
          projectId={project._id}
          title={project.title}
          description={project.description}
          budget={project.budget}
          currency={project.currency}
          deadline={project.deadline}
          milestones={aiDraftMilestones}
          onChange={setAiDraftMilestones}
          onSaveToProject={handleSaveBulkAiMilestones}
          saving={savingBulkAi}
        />
      </Modal>

      {/* Freelancer Work Submission Modal */}
      <SubmissionModal
        isOpen={Boolean(submitModalMilestone)}
        onClose={() => setSubmitModalMilestone(null)}
        milestone={submitModalMilestone}
        onSubmitted={async () => {
          toast.success('Work submitted successfully!');
          await loadAll();
        }}
      />

      {/* Milestone Submissions & AI Evaluation Inspection Modal */}
      <Modal
        isOpen={Boolean(inspectMilestone)}
        onClose={() => setInspectMilestone(null)}
        title={
          inspectMilestone
            ? `Milestone #${inspectMilestone.order}: ${inspectMilestone.title}`
            : 'Milestone Review'
        }
        size="lg"
        footer={
          <Button variant="secondary" onClick={() => setInspectMilestone(null)}>
            Close
          </Button>
        }
      >
        {inspectMilestone && (
          <div className="flex-col gap-6">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <StatusBadge status={inspectMilestone.status} />
                <span className="text-sm text-muted">
                  Amount:{' '}
                  <strong>
                    {formatCurrency(inspectMilestone.paymentAmount, project.currency)}
                  </strong>
                </span>
              </div>
              {isFreelancer &&
                ['IN_PROGRESS', 'CHANGES_REQUESTED'].includes(inspectMilestone.status) && (
                  <Button
                    size="sm"
                    variant="primary"
                    onClick={() => {
                      const target = inspectMilestone;
                      setInspectMilestone(null);
                      setSubmitModalMilestone(target);
                    }}
                  >
                    Submit / Resubmit Work
                  </Button>
                )}
            </div>

            <div>
              <h4 style={{ margin: '0 0 12px', fontSize: '15px', fontWeight: 600 }}>
                Submission History ({inspectSubmissions.length})
              </h4>
              {loadingSubmissions ? (
                <LoadingSpinner label="Loading submissions..." />
              ) : (
                <SubmissionHistory submissions={inspectSubmissions} />
              )}
            </div>

            <div style={{ borderTop: '1px solid var(--border)', paddingTop: '18px' }}>
              <AIEvaluationPanel
                milestone={inspectMilestone}
                submissions={inspectSubmissions}
                userRole={user?.role}
                paymentAuthorized={isPaymentAuthorized}
                onStartReview={handleStartReview}
                onApprove={handleApproveMilestone}
                onRequestChanges={handleRequestChanges}
                onCapturePayment={handleCapturePayment}
              />
            </div>
          </div>
        )}
      </Modal>

      {/* Counterparty Profile Modal */}
      <Modal
        isOpen={profileModalOpen}
        onClose={() => {
          setProfileModalOpen(false);
          setProfileModalUser(null);
        }}
        title={profileModalUser ? `${profileModalUser.name} — Profile` : 'User Profile'}
        footer={
          <Button variant="secondary" onClick={() => setProfileModalOpen(false)}>
            Close
          </Button>
        }
      >
        {loadingProfile ? (
          <LoadingSpinner label="Loading profile..." />
        ) : profileModalUser ? (
          <div className="flex-col gap-4">
            <div className="flex items-center gap-3">
              {profileModalUser.profile?.avatar ? (
                <img
                  src={profileModalUser.profile.avatar}
                  alt={profileModalUser.name}
                  style={{ width: '56px', height: '56px', borderRadius: '999px', objectFit: 'cover' }}
                />
              ) : (
                <div
                  style={{
                    width: '56px',
                    height: '56px',
                    borderRadius: '999px',
                    background: 'var(--brand-soft)',
                    color: '#93c5fd',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '20px',
                    fontWeight: 700,
                  }}
                >
                  {getInitials(profileModalUser.name)}
                </div>
              )}
              <div>
                <div style={{ fontWeight: 700, fontSize: '16px' }}>{profileModalUser.name}</div>
                <div className="text-sm text-muted">{profileModalUser.email}</div>
                <span className="badge badge-info mt-2" style={{ textTransform: 'capitalize' }}>
                  {profileModalUser.role}
                </span>
              </div>
            </div>

            {profileModalUser.profile?.bio && (
              <div>
                <div className="text-sm font-semibold text-muted mb-1">Bio</div>
                <p style={{ margin: 0, fontSize: '13px', color: 'var(--text-secondary)' }}>
                  {profileModalUser.profile.bio}
                </p>
              </div>
            )}

            {profileModalUser.profile?.skills?.length > 0 && (
              <div>
                <div className="text-sm font-semibold text-muted mb-2">Skills</div>
                <div className="flex flex-wrap gap-2">
                  {profileModalUser.profile.skills.map((skill) => (
                    <span key={skill} className="badge badge-info">
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
