import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, FolderPlus } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import AIMilestoneGenerator from '../components/milestones/AIMilestoneGenerator';
import { projectApi } from '../api/projectApi';
import { milestoneApi } from '../api/milestoneApi';
import { useToast } from '../hooks/useToast';
import { formatDateInput, getErrorMessage } from '../utils/formatters';

export default function CreateProjectPage() {
  const navigate = useNavigate();
  const toast = useToast();

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [budget, setBudget] = useState('10');
  const [currency, setCurrency] = useState('USD');
  const [deadline, setDeadline] = useState(() =>
    formatDateInput(new Date(Date.now() + 30 * 86400000))
  );
  const [freelancerId, setFreelancerId] = useState('');
  const [acceptClientAgreement, setAcceptClientAgreement] = useState(true);
  const [freelancers, setFreelancers] = useState([]);
  const [generatedMilestones, setGeneratedMilestones] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const loadFreelancers = async () => {
      try {
        const list = await projectApi.getFreelancers();
        if (active) setFreelancers(list || []);
      } catch {
        // Non-blocking if freelancer list fails
      }
    };
    loadFreelancers();
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedBudget = parseFloat(budget);
    if (!title.trim() || !description.trim() || Number.isNaN(parsedBudget) || parsedBudget <= 0 || !deadline) {
      setError('Title, description, positive budget, and deadline are required.');
      return;
    }

    if (generatedMilestones.length > 0) {
      const sum = generatedMilestones.reduce((acc, m) => acc + (Number(m.paymentAmount) || 0), 0);
      if (Math.abs(sum - parsedBudget) > 0.01) {
        setError(
          `AI milestone amounts (${sum.toFixed(2)}) must equal the project budget (${parsedBudget.toFixed(2)}) before saving.`
        );
        return;
      }
    }

    setSubmitting(true);
    try {
      const project = await projectApi.createProject({
        title: title.trim(),
        description: description.trim(),
        budget: parsedBudget,
        currency,
        deadline: new Date(deadline).toISOString(),
      });

      if (generatedMilestones.length > 0) {
        await milestoneApi.createBulkMilestones(project._id, generatedMilestones);
      }

      if (freelancerId) {
        await projectApi.assignFreelancer(project._id, freelancerId);
        if (acceptClientAgreement) {
          await projectApi.acceptAgreement(project._id);
        }
      }

      toast.success('Project created successfully!');
      navigate(`/projects/${project._id}`);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to create project'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="flex-col gap-6">
      <div className="page-header">
        <div>
          <Link to="/projects" className="btn btn-ghost btn-sm mb-2">
            <ArrowLeft size={14} /> Back to Projects
          </Link>
          <h1 className="page-title">Create New Project</h1>
          <p className="page-subtitle">
            Define your project scope, generate AI milestone plans, and invite a freelancer.
          </p>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <form onSubmit={handleSubmit} className="flex-col gap-6">
        <Card title="1. Project Scope & Assignment">
          <div className="form-group">
            <label className="form-label" htmlFor="proj-title">
              Project Title *
            </label>
            <input
              id="proj-title"
              className="form-input"
              placeholder="e.g., React SaaS Dashboard with Authentication & Payments"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="proj-desc">
              Project Description & Requirements *
            </label>
            <textarea
              id="proj-desc"
              className="form-textarea"
              style={{ minHeight: '110px' }}
              placeholder="Describe features, tech stack, deliverables, and key goals..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-3">
            <div className="form-group">
              <label className="form-label" htmlFor="proj-budget">
                Total Budget *
              </label>
              <input
                id="proj-budget"
                type="number"
                min="1"
                step="0.01"
                className="form-input"
                value={budget}
                onChange={(e) => setBudget(e.target.value)}
                required
              />
              <span className="form-hint">
                Note: PayPal Sandbox order helper defaults to $10.00 USD in Member A/B&apos;s current backend.
              </span>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="proj-currency">
                Currency
              </label>
              <select
                id="proj-currency"
                className="form-select"
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
              >
                <option value="USD">USD ($)</option>
                <option value="EUR">EUR (€)</option>
                <option value="GBP">GBP (£)</option>
                <option value="INR">INR (₹)</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="proj-deadline">
                Project Deadline *
              </label>
              <input
                id="proj-deadline"
                type="date"
                className="form-input"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-2">
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label className="form-label" htmlFor="proj-freelancer">
                Assign Freelancer (Optional)
              </label>
              <select
                id="proj-freelancer"
                className="form-select"
                value={freelancerId}
                onChange={(e) => setFreelancerId(e.target.value)}
              >
                <option value="">Leave as Draft (Assign later)</option>
                {freelancers.map((fl) => (
                  <option key={fl._id} value={fl._id}>
                    {fl.name} ({fl.email})
                  </option>
                ))}
              </select>
            </div>

            {freelancerId && (
              <div className="flex items-center" style={{ paddingTop: '24px' }}>
                <label className="flex items-center gap-2" style={{ cursor: 'pointer', fontSize: '13px' }}>
                  <input
                    type="checkbox"
                    checked={acceptClientAgreement}
                    onChange={(e) => setAcceptClientAgreement(e.target.checked)}
                  />
                  <span>Automatically accept client side of project agreement</span>
                </label>
              </div>
            )}
          </div>

          {freelancerId && (() => {
            const picked = freelancers.find((fl) => fl._id === freelancerId);
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
                  {picked.name} — Freelancer Profile
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

        <Card title="2. AI-Generated Milestones & Agreement Plan">
          <AIMilestoneGenerator
            title={title}
            description={description}
            budget={budget}
            currency={currency}
            deadline={deadline}
            milestones={generatedMilestones}
            onChange={setGeneratedMilestones}
          />
        </Card>

        <div className="flex items-center justify-between flex-wrap gap-3">
          <Link to="/projects" className="btn btn-secondary">
            Cancel
          </Link>
          <Button type="submit" variant="primary" size="lg" loading={submitting} icon={freelancerId ? CheckCircle2 : FolderPlus}>
            {freelancerId
              ? 'Create Project & Send Agreement'
              : 'Save Project Draft'}
          </Button>
        </div>
      </form>
    </div>
  );
}

