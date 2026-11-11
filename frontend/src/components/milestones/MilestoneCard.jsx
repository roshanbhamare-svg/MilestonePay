import {
  Calendar,
  CheckCircle2,
  Circle,
  Clock,
  Edit3,
  Eye,
  Play,
  Send,
  Sparkles,
  Wallet,
  AlertTriangle,
} from 'lucide-react';
import StatusBadge from '../common/StatusBadge';
import Button from '../common/Button';
import { formatCurrency, formatDate, isOverdue } from '../../utils/formatters';

export default function MilestoneCard({
  milestone,
  currency = 'USD',
  projectStatus,
  userRole,
  paymentAuthorized = false,
  actionLoading = false,
  onStartWork,
  onOpenSubmit,
  onEdit,
  onStartReview,
  onOpenReviewPanel,
  onCapturePayment,
}) {
  const isClient = userRole === 'client';
  const isFreelancer = userRole === 'freelancer';
  const overdue = isOverdue(milestone.deadline, milestone.status);

  const canEdit = isClient && milestone.status === 'PENDING' && ['DRAFT', 'AGREEMENT_PENDING'].includes(projectStatus);
  const canStartWork = isFreelancer && milestone.status === 'PENDING' && projectStatus === 'ACTIVE';
  const canSubmitWork =
    isFreelancer && ['IN_PROGRESS', 'CHANGES_REQUESTED'].includes(milestone.status);
  const canStartReview =
    isClient && ['SUBMITTED', 'RESUBMITTED'].includes(milestone.status);
  const canReviewDecision = isClient && milestone.status === 'UNDER_REVIEW';
  const canCapture = isClient && milestone.status === 'APPROVED';

  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px',
      }}
    >
      <div className="flex items-start justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="badge badge-neutral">Milestone #{milestone.order}</span>
            <StatusBadge status={milestone.status} />
            {overdue && (
              <span className="badge badge-danger">
                <AlertTriangle size={12} /> Overdue
              </span>
            )}
          </div>
          <h3 style={{ margin: '10px 0 4px', fontSize: '17px', fontWeight: 600 }}>
            {milestone.title}
          </h3>
          <p className="text-muted" style={{ margin: 0, fontSize: '13px' }}>
            {milestone.description}
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '20px', fontWeight: 700, color: '#6ee7b7' }}>
            {formatCurrency(milestone.paymentAmount, currency)}
          </div>
          <div className="flex items-center gap-1 text-sm text-muted" style={{ justifyContent: 'flex-end', marginTop: '4px' }}>
            <Calendar size={13} />
            <span>Due {formatDate(milestone.deadline)}</span>
          </div>
        </div>
      </div>

      {/* Deliverables & Acceptance Criteria */}
      <div className="grid grid-cols-2 mt-4">
        <div
          style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            Deliverables ({milestone.deliverables?.length || 0})
          </div>
          {milestone.deliverables?.length > 0 ? (
            <ul style={{ margin: 0, paddingLeft: '16px', fontSize: '13px', color: 'var(--text-muted)' }}>
              {milestone.deliverables.map((d, idx) => (
                <li key={idx} style={{ marginBottom: '4px' }}>
                  <strong style={{ color: 'var(--text-primary)' }}>{d.title}</strong>
                  {d.description ? ` — ${d.description}` : ''}
                </li>
              ))}
            </ul>
          ) : (
            <span className="text-sm text-dim">No specific deliverables listed.</span>
          )}
        </div>

        <div
          style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '12px 14px',
          }}
        >
          <div className="text-sm font-semibold mb-2" style={{ color: 'var(--text-secondary)' }}>
            Acceptance Criteria ({milestone.acceptanceCriteria?.length || 0})
          </div>
          {milestone.acceptanceCriteria?.length > 0 ? (
            <div className="flex-col gap-1">
              {milestone.acceptanceCriteria.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm">
                  {c.completed || milestone.status === 'PAID' || milestone.status === 'APPROVED' ? (
                    <CheckCircle2 size={14} color="#10b981" style={{ flexShrink: 0 }} />
                  ) : (
                    <Circle size={14} color="#64748b" style={{ flexShrink: 0 }} />
                  )}
                  <span style={{ color: 'var(--text-secondary)' }}>{c.criteria}</span>
                </div>
              ))}
            </div>
          ) : (
            <span className="text-sm text-dim">No acceptance criteria defined.</span>
          )}
        </div>
      </div>

      {/* Action Footer */}
      <div
        className="flex items-center justify-between flex-wrap gap-2 mt-4"
        style={{ paddingTop: '14px', borderTop: '1px solid var(--border)' }}
      >
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="secondary"
            icon={Eye}
            onClick={() => onOpenReviewPanel(milestone)}
          >
            Submissions & AI Report
          </Button>
          {canEdit && (
            <Button size="sm" variant="ghost" icon={Edit3} onClick={() => onEdit(milestone)}>
              Edit
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canStartWork && (
            <Button
              size="sm"
              variant="primary"
              icon={Play}
              loading={actionLoading}
              onClick={() => onStartWork(milestone)}
            >
              Start Milestone
            </Button>
          )}

          {isFreelancer && milestone.status === 'PENDING' && projectStatus !== 'ACTIVE' && (
            <span className="text-sm text-dim flex items-center gap-1">
              <Clock size={13} /> Waiting for project agreement to become ACTIVE
            </span>
          )}

          {canSubmitWork && (
            <Button
              size="sm"
              variant={milestone.status === 'CHANGES_REQUESTED' ? 'warning' : 'primary'}
              icon={Send}
              onClick={() => onOpenSubmit(milestone)}
            >
              {milestone.status === 'CHANGES_REQUESTED' ? 'Resubmit Work' : 'Submit Deliverables'}
            </Button>
          )}

          {canStartReview && (
            <Button
              size="sm"
              variant="primary"
              icon={Sparkles}
              loading={actionLoading}
              onClick={() => onStartReview(milestone)}
            >
              Start Client Review
            </Button>
          )}

          {canReviewDecision && (
            <Button
              size="sm"
              variant="ai"
              icon={Sparkles}
              onClick={() => onOpenReviewPanel(milestone)}
            >
              Inspect AI Report & Approve / Request Changes
            </Button>
          )}

          {canCapture && (
            <Button
              size="sm"
              variant="success"
              icon={Wallet}
              loading={actionLoading}
              disabled={!paymentAuthorized}
              title={
                paymentAuthorized
                  ? 'Capture authorized PayPal funds for this milestone'
                  : 'Authorize project payment via PayPal first'
              }
              onClick={() => onCapturePayment(milestone)}
            >
              {paymentAuthorized ? 'Release PayPal Payment' : 'Authorize PayPal First'}
            </Button>
          )}

          {milestone.status === 'PAID' && (
            <span className="badge badge-success">
              <CheckCircle2 size={12} /> Payment Captured
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

