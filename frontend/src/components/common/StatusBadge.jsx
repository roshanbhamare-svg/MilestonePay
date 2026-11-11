const STATUS_STYLE_MAP = {
  // Project statuses
  DRAFT: { label: 'Draft', tone: 'neutral' },
  AGREEMENT_PENDING: { label: 'Agreement Pending', tone: 'warning' },
  ACTIVE: { label: 'Active', tone: 'info' },
  COMPLETED: { label: 'Completed', tone: 'success' },
  CANCELLED: { label: 'Cancelled', tone: 'danger' },

  // Milestone & Submission statuses
  PENDING: { label: 'Pending', tone: 'neutral' },
  IN_PROGRESS: { label: 'In Progress', tone: 'info' },
  SUBMITTED: { label: 'Submitted', tone: 'ai' },
  RESUBMITTED: { label: 'Resubmitted', tone: 'ai' },
  UNDER_REVIEW: { label: 'Under Review', tone: 'warning' },
  CHANGES_REQUESTED: { label: 'Changes Requested', tone: 'danger' },
  APPROVED: { label: 'Approved', tone: 'success' },
  PAID: { label: 'Paid', tone: 'success' },

  // Payment statuses
  AUTHORIZED: { label: 'Authorized', tone: 'info' },
  PARTIALLY_CAPTURED: { label: 'Partially Captured', tone: 'warning' },
  FAILED: { label: 'Failed', tone: 'danger' },
  VOIDED: { label: 'Voided', tone: 'neutral' },
  DENIED: { label: 'Denied', tone: 'danger' },
};

export default function StatusBadge({ status, label }) {
  const normalized = String(status || 'UNKNOWN').toUpperCase();
  const config = STATUS_STYLE_MAP[normalized] || {
    label: status || 'Unknown',
    tone: 'neutral',
  };

  return <span className={`badge badge-${config.tone}`}>{label || config.label}</span>;
}

