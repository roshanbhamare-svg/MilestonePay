export default function StatCard({
  label,
  value,
  helper,
  icon: Icon,
  tone = 'brand',
}) {
  const toneStyles = {
    brand: { background: 'var(--brand-soft)', color: '#93c5fd' },
    success: { background: 'var(--success-soft)', color: '#6ee7b7' },
    warning: { background: 'var(--warning-soft)', color: '#fcd34d' },
    ai: { background: 'var(--ai-soft)', color: '#c4b5fd' },
    info: { background: 'var(--info-soft)', color: '#67e8f9' },
  }[tone] || { background: 'var(--brand-soft)', color: '#93c5fd' };

  return (
    <div className="stat-card">
      <div>
        <div className="stat-label">{label}</div>
        <div className="stat-value">{value}</div>
        {helper && <div className="stat-helper">{helper}</div>}
      </div>
      {Icon && (
        <div className="stat-icon" style={toneStyles}>
          <Icon size={20} />
        </div>
      )}
    </div>
  );
}

