import { useState } from 'react';
import { Sparkles, Plus, Trash2, Check, Scale } from 'lucide-react';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { aiService } from '../../services/aiService';
import { formatCurrency, formatDateInput, getErrorMessage } from '../../utils/formatters';

export default function AIMilestoneGenerator({
  projectId = null,
  title,
  description,
  budget,
  currency = 'USD',
  deadline,
  milestones,
  onChange,
  onSaveToProject = null,
  saving = false,
}) {
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState('');
  const [isMockResult, setIsMockResult] = useState(aiService.isMockMode());

  const numericBudget = Number(budget) || 0;
  const allocated = milestones.reduce((sum, m) => sum + (Number(m.paymentAmount) || 0), 0);
  const diff = Math.round((numericBudget - allocated) * 100) / 100;
  const isBalanced = milestones.length > 0 && Math.abs(diff) <= 0.01;

  const handleGenerate = async () => {
    setError('');
    if (!title?.trim() || !description?.trim() || numericBudget <= 0) {
      setError('Enter project title, description, and a positive budget before generating milestones.');
      return;
    }

    setGenerating(true);
    try {
      const result = await aiService.generateMilestones({
        projectId,
        title,
        description,
        budget: numericBudget,
        currency,
        deadline,
      });
      setIsMockResult(result.isMock);
      onChange(result.milestones);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to generate milestones'));
    } finally {
      setGenerating(false);
    }
  };

  const updateField = (index, field, value) => {
    const next = milestones.map((m, i) => (i === index ? { ...m, [field]: value } : m));
    onChange(next);
  };

  const addMilestone = () => {
    const fallbackDeadline = deadline
      ? new Date(deadline).toISOString()
      : new Date(Date.now() + 14 * 86400000).toISOString();

    onChange([
      ...milestones,
      {
        title: `Milestone ${milestones.length + 1}`,
        description: 'Deliverable implementation and verification.',
        paymentAmount: Math.max(0, diff),
        deadline: fallbackDeadline,
        deliverables: [{ title: 'Deliverable', description: 'Source code and documentation' }],
        acceptanceCriteria: [{ criteria: 'Requirements verified', completed: false }],
        order: milestones.length + 1,
      },
    ]);
  };

  const removeMilestone = (index) => {
    onChange(milestones.filter((_, i) => i !== index).map((m, idx) => ({ ...m, order: idx + 1 })));
  };

  const autoBalanceLast = () => {
    if (milestones.length === 0) return;
    const lastIdx = milestones.length - 1;
    const othersSum = milestones
      .slice(0, lastIdx)
      .reduce((sum, m) => sum + (Number(m.paymentAmount) || 0), 0);
    const remaining = Math.max(0, Math.round((numericBudget - othersSum) * 100) / 100);
    updateField(lastIdx, 'paymentAmount', remaining);
  };

  return (
    <div className="flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600 }}>
              AI Milestone Breakdown
            </h3>
            <span className="badge badge-ai">
              <Sparkles size={12} />
              {isMockResult ? 'Mock AI Layer' : 'LangGraph AI'}
            </span>
          </div>
          <p className="text-sm text-muted" style={{ marginTop: '4px' }}>
            Generate structured milestones that sum to your project budget, then adjust before saving.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="ai" onClick={handleGenerate} loading={generating} icon={Sparkles}>
            {milestones.length > 0 ? 'Regenerate with AI' : 'Generate Milestones with AI'}
          </Button>
          <Button variant="secondary" onClick={addMilestone} icon={Plus}>
            Add Row
          </Button>
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      {milestones.length > 0 && (
        <>
          <div
            style={{
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              background: 'var(--bg-app)',
              border: `1px solid ${isBalanced ? 'rgba(16, 185, 129, 0.35)' : 'rgba(245, 158, 11, 0.4)'}`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '10px',
            }}
          >
            <div className="flex items-center gap-3 flex-wrap">
              <span className="text-sm">
                Allocated:{' '}
                <strong>
                  {formatCurrency(allocated, currency)} / {formatCurrency(numericBudget, currency)}
                </strong>
              </span>
              {isBalanced ? (
                <span className="badge badge-success">
                  <Check size={12} /> Matches Budget
                </span>
              ) : (
                <span className="badge badge-warning">
                  {diff > 0
                    ? `${formatCurrency(diff, currency)} remaining`
                    : `${formatCurrency(Math.abs(diff), currency)} over budget`}
                </span>
              )}
            </div>
            {!isBalanced && (
              <Button size="sm" variant="warning" icon={Scale} onClick={autoBalanceLast}>
                Balance Last Milestone
              </Button>
            )}
          </div>

          <div className="flex-col gap-3">
            {milestones.map((m, idx) => (
              <div
                key={idx}
                style={{
                  padding: '16px',
                  borderRadius: 'var(--radius-md)',
                  background: 'var(--bg-surface-2)',
                  border: '1px solid var(--border)',
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className="badge badge-info">Milestone #{idx + 1}</span>
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => removeMilestone(idx)}
                  >
                    Remove
                  </Button>
                </div>

                <div className="grid grid-cols-3">
                  <div className="form-group" style={{ gridColumn: 'span 1' }}>
                    <label className="form-label">Title</label>
                    <input
                      className="form-input"
                      value={m.title}
                      onChange={(e) => updateField(idx, 'title', e.target.value)}
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Amount ({currency})</label>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className="form-input"
                      value={m.paymentAmount}
                      onChange={(e) =>
                        updateField(idx, 'paymentAmount', parseFloat(e.target.value) || 0)
                      }
                    />
                  </div>
                  <div className="form-group">
                    <label className="form-label">Deadline</label>
                    <input
                      type="date"
                      className="form-input"
                      value={formatDateInput(m.deadline)}
                      onChange={(e) =>
                        updateField(
                          idx,
                          'deadline',
                          e.target.value ? new Date(e.target.value).toISOString() : ''
                        )
                      }
                    />
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: '10px' }}>
                  <label className="form-label">Description</label>
                  <textarea
                    className="form-textarea"
                    style={{ minHeight: '64px' }}
                    value={m.description}
                    onChange={(e) => updateField(idx, 'description', e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-2">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-muted">Deliverables</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Plus}
                        onClick={() =>
                          updateField(idx, 'deliverables', [
                            ...(m.deliverables || []),
                            { title: '', description: '' },
                          ])
                        }
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex-col gap-2">
                      {(m.deliverables || []).map((d, dIdx) => (
                        <div key={dIdx} className="flex gap-2 items-center">
                          <input
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            placeholder="Title"
                            value={d.title}
                            onChange={(e) =>
                              updateField(
                                idx,
                                'deliverables',
                                (m.deliverables || []).map((row, rIdx) =>
                                  rIdx === dIdx ? { ...row, title: e.target.value } : row
                                )
                              )
                            }
                          />
                          <input
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            placeholder="Details"
                            value={d.description}
                            onChange={(e) =>
                              updateField(
                                idx,
                                'deliverables',
                                (m.deliverables || []).map((row, rIdx) =>
                                  rIdx === dIdx ? { ...row, description: e.target.value } : row
                                )
                              )
                            }
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() =>
                              updateField(
                                idx,
                                'deliverables',
                                (m.deliverables || []).filter((_, rIdx) => rIdx !== dIdx)
                              )
                            }
                            aria-label="Remove deliverable"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-muted">Acceptance Criteria</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        icon={Plus}
                        onClick={() =>
                          updateField(idx, 'acceptanceCriteria', [
                            ...(m.acceptanceCriteria || []),
                            { criteria: '', completed: false },
                          ])
                        }
                      >
                        Add
                      </Button>
                    </div>
                    <div className="flex-col gap-2">
                      {(m.acceptanceCriteria || []).map((c, cIdx) => (
                        <div key={cIdx} className="flex gap-2 items-center">
                          <input
                            className="form-input"
                            style={{ padding: '6px 8px', fontSize: '12px' }}
                            placeholder="Acceptance criterion"
                            value={c.criteria}
                            onChange={(e) =>
                              updateField(
                                idx,
                                'acceptanceCriteria',
                                (m.acceptanceCriteria || []).map((row, rIdx) =>
                                  rIdx === cIdx ? { ...row, criteria: e.target.value } : row
                                )
                              )
                            }
                          />
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={Trash2}
                            onClick={() =>
                              updateField(
                                idx,
                                'acceptanceCriteria',
                                (m.acceptanceCriteria || []).filter((_, rIdx) => rIdx !== cIdx)
                              )
                            }
                            aria-label="Remove criterion"
                          />
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {onSaveToProject && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted">
                Saving replaces current milestones on this project in MongoDB.
              </span>
              <Button
                variant="success"
                loading={saving}
                disabled={!isBalanced}
                onClick={() => onSaveToProject(milestones)}
              >
                Save Milestones to Project
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

