import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import Modal from '../common/Modal';
import Button from '../common/Button';
import Alert from '../common/Alert';
import { formatDateInput, getErrorMessage } from '../../utils/formatters';

function MilestoneFormInner({
  onClose,
  onSubmit,
  initialData = null,
  currency = 'USD',
  remainingBudget = 0,
}) {
  const isEditing = Boolean(initialData?._id);

  const [title, setTitle] = useState(initialData?.title || '');
  const [description, setDescription] = useState(initialData?.description || '');
  const [paymentAmount, setPaymentAmount] = useState(
    initialData
      ? String(initialData.paymentAmount ?? '')
      : remainingBudget > 0
        ? String(remainingBudget)
        : ''
  );
  const [deadline, setDeadline] = useState(() =>
    initialData
      ? formatDateInput(initialData.deadline)
      : formatDateInput(new Date(Date.now() + 14 * 86400000))
  );
  const [deliverables, setDeliverables] = useState(
    initialData?.deliverables?.length
      ? initialData.deliverables.map((d) => ({ title: d.title || '', description: d.description || '' }))
      : [{ title: '', description: '' }]
  );
  const [acceptanceCriteria, setAcceptanceCriteria] = useState(
    initialData?.acceptanceCriteria?.length
      ? initialData.acceptanceCriteria.map((c) => ({
          criteria: c.criteria || '',
          completed: Boolean(c.completed),
        }))
      : [{ criteria: '', completed: false }]
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const parsedAmount = parseFloat(paymentAmount);
    if (!title.trim() || !description.trim() || Number.isNaN(parsedAmount) || parsedAmount <= 0 || !deadline) {
      setError('Title, description, positive payment amount, and deadline are required.');
      return;
    }

    const cleanDeliverables = deliverables
      .filter((d) => d.title.trim())
      .map((d) => ({ title: d.title.trim(), description: d.description.trim() }));

    const cleanCriteria = acceptanceCriteria
      .filter((c) => c.criteria.trim())
      .map((c) => ({ criteria: c.criteria.trim(), completed: Boolean(c.completed) }));

    setSubmitting(true);
    try {
      await onSubmit({
        title: title.trim(),
        description: description.trim(),
        paymentAmount: parsedAmount,
        deadline: new Date(deadline).toISOString(),
        deliverables: cleanDeliverables,
        acceptanceCriteria: cleanCriteria,
      });
      onClose();
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to save milestone'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      isOpen
      onClose={onClose}
      title={isEditing ? 'Edit Milestone' : 'Add Milestone'}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" loading={submitting} onClick={handleSubmit}>
            {isEditing ? 'Save Changes' : 'Create Milestone'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit}>
        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <div className="form-group">
          <label className="form-label">Milestone Title *</label>
          <input
            className="form-input"
            placeholder="e.g., Authentication & User Profiles"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </div>

        <div className="form-group">
          <label className="form-label">Description *</label>
          <textarea
            className="form-textarea"
            placeholder="Describe what must be delivered in this milestone..."
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            required
          />
        </div>

        <div className="grid grid-cols-2">
          <div className="form-group">
            <label className="form-label">Payment Amount ({currency}) *</label>
            <input
              type="number"
              min="0.01"
              step="0.01"
              className="form-input"
              value={paymentAmount}
              onChange={(e) => setPaymentAmount(e.target.value)}
              required
            />
            {!isEditing && (
              <span className="form-hint">Remaining unallocated budget: {remainingBudget} {currency}</span>
            )}
          </div>
          <div className="form-group">
            <label className="form-label">Deadline *</label>
            <input
              type="date"
              className="form-input"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="form-group">
          <div className="flex items-center justify-between mb-2">
            <label className="form-label" style={{ margin: 0 }}>Deliverables</label>
            <Button
              size="sm"
              variant="ghost"
              icon={Plus}
              onClick={() => setDeliverables((prev) => [...prev, { title: '', description: '' }])}
            >
              Add Deliverable
            </Button>
          </div>
          <div className="flex-col gap-2">
            {deliverables.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  className="form-input"
                  placeholder="Deliverable title"
                  value={item.title}
                  onChange={(e) =>
                    setDeliverables((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, title: e.target.value } : row))
                    )
                  }
                />
                <input
                  className="form-input"
                  placeholder="Short description"
                  value={item.description}
                  onChange={(e) =>
                    setDeliverables((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, description: e.target.value } : row))
                    )
                  }
                />
                {deliverables.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => setDeliverables((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove deliverable"
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <div className="flex items-center justify-between mb-2">
            <label className="form-label" style={{ margin: 0 }}>Acceptance Criteria</label>
            <Button
              size="sm"
              variant="ghost"
              icon={Plus}
              onClick={() => setAcceptanceCriteria((prev) => [...prev, { criteria: '', completed: false }])}
            >
              Add Criterion
            </Button>
          </div>
          <div className="flex-col gap-2">
            {acceptanceCriteria.map((item, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <input
                  className="form-input"
                  placeholder="e.g., Protected endpoints verify JWT and role"
                  value={item.criteria}
                  onChange={(e) =>
                    setAcceptanceCriteria((prev) =>
                      prev.map((row, i) => (i === idx ? { ...row, criteria: e.target.value } : row))
                    )
                  }
                />
                {acceptanceCriteria.length > 1 && (
                  <Button
                    size="sm"
                    variant="ghost"
                    icon={Trash2}
                    onClick={() => setAcceptanceCriteria((prev) => prev.filter((_, i) => i !== idx))}
                    aria-label="Remove criterion"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </form>
    </Modal>
  );
}

export default function MilestoneFormModal(props) {
  if (!props.isOpen) return null;
  return (
    <MilestoneFormInner
      key={props.initialData?._id || 'new'}
      {...props}
    />
  );
}
