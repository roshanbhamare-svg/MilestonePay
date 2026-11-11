import { useState, useEffect } from 'react';
import {
  Sparkles,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ShieldAlert,
  ThumbsUp,
  RotateCcw,
  Wallet,
} from 'lucide-react';
import Button from '../common/Button';
import Alert from '../common/Alert';
import LoadingSpinner from '../common/LoadingSpinner';
import { aiService } from '../../services/aiService';
import { getErrorMessage } from '../../utils/formatters';

export default function AIEvaluationPanel({
  milestone,
  submissions = [],
  userRole,
  paymentAuthorized = false,
  onStartReview,
  onApprove,
  onRequestChanges,
  onCapturePayment,
}) {
  const [evaluation, setEvaluation] = useState(null);
  const [isMock, setIsMock] = useState(aiService.isMockMode());
  const [loading, setLoading] = useState(false);
  const [evaluating, setEvaluating] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [showChangesBox, setShowChangesBox] = useState(false);
  const [changeReason, setChangeReason] = useState('');
  const [error, setError] = useState('');

  const latestSubmission = submissions[0] || null;
  const isClient = userRole === 'client';

  useEffect(() => {
    if (!milestone?._id) return;
    let active = true;

    const loadExisting = async () => {
      setLoading(true);
      setError('');
      try {
        const res = await aiService.getMilestoneEvaluation(milestone._id);
        if (active) {
          setEvaluation(res.evaluation);
          setIsMock(res.isMock);
        }
      } catch (err) {
        if (active) {
          setError(getErrorMessage(err, 'Failed to load AI evaluation'));
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadExisting();

    return () => {
      active = false;
    };
  }, [milestone?._id]);

  const handleRunEvaluation = async () => {
    if (!latestSubmission) {
      setError('A freelancer submission is required before running AI evaluation.');
      return;
    }

    setEvaluating(true);
    setError('');
    try {
      const res = await aiService.evaluateSubmission({
        milestone,
        submission: latestSubmission,
      });
      setEvaluation(res.evaluation);
      setIsMock(res.isMock);
    } catch (err) {
      setError(getErrorMessage(err, 'AI evaluation failed'));
    } finally {
      setEvaluating(false);
    }
  };

  const handleApproveClick = async () => {
    setActionLoading(true);
    setError('');
    try {
      await onApprove(milestone);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to approve milestone'));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRequestChangesSubmit = async (e) => {
    e.preventDefault();
    if (!changeReason.trim()) {
      setError('Please enter a clear reason explaining what modifications are required.');
      return;
    }
    setActionLoading(true);
    setError('');
    try {
      await onRequestChanges(milestone, changeReason.trim());
      setShowChangesBox(false);
      setChangeReason('');
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to request modifications'));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h4 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>
              AI Deliverable Evaluation Report
            </h4>
            <span className="badge badge-ai">
              <Sparkles size={12} />
              {isMock ? 'Mock AI Service' : 'LangGraph Evaluation'}
            </span>
          </div>
          <p className="text-sm text-muted" style={{ marginTop: '2px' }}>
            Evaluates submitted deliverables against milestone acceptance criteria.
          </p>
        </div>

        <Button
          variant="ai"
          size="sm"
          icon={Sparkles}
          loading={evaluating}
          disabled={!latestSubmission}
          onClick={handleRunEvaluation}
        >
          {evaluation ? 'Re-run AI Evaluation' : 'Run AI Evaluation'}
        </Button>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {loading ? (
        <LoadingSpinner label="Checking evaluation report..." />
      ) : !latestSubmission ? (
        <Alert variant="info">
          No work has been submitted for this milestone yet. AI evaluation becomes available once the
          freelancer submits deliverables.
        </Alert>
      ) : !evaluation ? (
        <Alert variant="ai" title="Ready for AI Verification">
          Latest submission (v{latestSubmission.version}) has not been evaluated yet. Click{' '}
          <strong>Run AI Evaluation</strong> to analyze deliverables against acceptance criteria.
        </Alert>
      ) : (
        <div
          style={{
            background: 'var(--bg-app)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-md)',
            padding: '16px',
          }}
        >
          {/* Score & Recommendation Header */}
          <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div
                style={{
                  width: '54px',
                  height: '54px',
                  borderRadius: '12px',
                  background:
                    evaluation.overallScore >= 80
                      ? 'var(--success-soft)'
                      : evaluation.overallScore >= 50
                        ? 'var(--warning-soft)'
                        : 'var(--danger-soft)',
                  color:
                    evaluation.overallScore >= 80
                      ? '#6ee7b7'
                      : evaluation.overallScore >= 50
                        ? '#fcd34d'
                        : '#fca5a5',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '18px',
                  fontWeight: 700,
                }}
              >
                {evaluation.overallScore}%
              </div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>Criteria Compliance Score</div>
                <div className="text-sm text-muted">
                  Status: {evaluation.status} • Based on submission v{latestSubmission.version}
                </div>
              </div>
            </div>
          </div>

          {/* Criteria Results */}
          {evaluation.criteriaResults?.length > 0 && (
            <div className="mb-4">
              <div className="text-sm font-semibold text-muted mb-2">Criteria Evaluation</div>
              <div className="flex-col gap-2">
                {evaluation.criteriaResults.map((item, idx) => (
                  <div
                    key={idx}
                    style={{
                      padding: '10px 12px',
                      borderRadius: 'var(--radius-sm)',
                      background: 'var(--bg-surface)',
                      border: '1px solid var(--border)',
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '10px',
                    }}
                  >
                    {item.met ? (
                      <CheckCircle2 size={16} color="#10b981" style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <XCircle size={16} color="#ef4444" style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: 500 }}>{item.criteria}</div>
                      {item.comments && (
                        <div className="text-sm text-muted" style={{ marginTop: '2px' }}>
                          {item.comments}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Completed & Missing Columns */}
          <div className="grid grid-cols-2 mb-4">
            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(16, 185, 129, 0.06)',
                border: '1px solid rgba(16, 185, 129, 0.25)',
              }}
            >
              <div className="text-sm font-semibold mb-2" style={{ color: '#6ee7b7' }}>
                Completed Requirements ({evaluation.completedRequirements?.length || 0})
              </div>
              {evaluation.completedRequirements?.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {evaluation.completedRequirements.map((req, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{req}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-dim">None marked complete.</span>
              )}
            </div>

            <div
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.25)',
              }}
            >
              <div className="text-sm font-semibold mb-2" style={{ color: '#fca5a5' }}>
                Missing Requirements ({evaluation.missingRequirements?.length || 0})
              </div>
              {evaluation.missingRequirements?.length > 0 ? (
                <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                  {evaluation.missingRequirements.map((req, idx) => (
                    <li key={idx} style={{ marginBottom: '4px' }}>{req}</li>
                  ))}
                </ul>
              ) : (
                <span className="text-sm text-dim">No missing requirements detected.</span>
              )}
            </div>
          </div>

          {/* Improvement Suggestions */}
          {evaluation.improvementSuggestions?.length > 0 && (
            <div
              className="mb-4"
              style={{
                padding: '12px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
              }}
            >
              <div className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: '#fcd34d' }}>
                <Lightbulb size={15} /> Improvement Suggestions
              </div>
              <ul style={{ margin: 0, paddingLeft: '18px', fontSize: '12px', color: 'var(--text-secondary)' }}>
                {evaluation.improvementSuggestions.map((tip, idx) => (
                  <li key={idx} style={{ marginBottom: '4px' }}>{tip}</li>
                ))}
              </ul>
            </div>
          )}

          {/* AI Recommendation */}
          {evaluation.recommendations && (
            <Alert variant="ai" title="AI Recommendation">
              {evaluation.recommendations}
            </Alert>
          )}
        </div>
      )}

      {/* Client Human-in-the-loop Approval Controls */}
      {isClient && (
        <div
          style={{
            padding: '14px 16px',
            borderRadius: 'var(--radius-md)',
            background: 'var(--bg-surface-2)',
            border: '1px solid var(--border-strong)',
          }}
        >
          <div className="flex items-center gap-2 text-sm text-muted mb-3">
            <ShieldAlert size={15} color="#93c5fd" />
            <span>
              <strong>Human Approval Authority:</strong> AI only advises. Milestone approval and
              PayPal capture remain explicit client actions.
            </span>
          </div>

          {['SUBMITTED', 'RESUBMITTED'].includes(milestone.status) && (
            <Button
              variant="primary"
              loading={actionLoading}
              onClick={async () => {
                setActionLoading(true);
                try {
                  await onStartReview(milestone);
                } finally {
                  setActionLoading(false);
                }
              }}
            >
              Move Milestone to Under Review
            </Button>
          )}

          {milestone.status === 'UNDER_REVIEW' && (
            <div className="flex-col gap-3">
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="success"
                  icon={ThumbsUp}
                  loading={actionLoading}
                  onClick={handleApproveClick}
                >
                  Approve Milestone
                </Button>
                <Button
                  variant="danger"
                  icon={RotateCcw}
                  onClick={() => setShowChangesBox((prev) => !prev)}
                >
                  Request Modifications
                </Button>
              </div>

              {showChangesBox && (
                <form onSubmit={handleRequestChangesSubmit} className="flex-col gap-2">
                  <textarea
                    className="form-textarea"
                    placeholder="Explain what must be fixed or added before approval..."
                    value={changeReason}
                    onChange={(e) => setChangeReason(e.target.value)}
                    required
                  />
                  <div className="flex gap-2">
                    <Button type="submit" variant="danger" size="sm" loading={actionLoading}>
                      Send Modification Request
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setShowChangesBox(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              )}
            </div>
          )}

          {milestone.status === 'APPROVED' && (
            <div className="flex items-center justify-between flex-wrap gap-2">
              <span className="text-sm text-muted">
                Milestone is approved. Trigger PayPal capture to release funds and mark it Paid.
              </span>
              <Button
                variant="success"
                icon={Wallet}
                disabled={!paymentAuthorized}
                onClick={() => onCapturePayment(milestone)}
              >
                {paymentAuthorized ? 'Capture Milestone Payment' : 'Authorize PayPal First'}
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

