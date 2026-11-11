import { Inbox } from 'lucide-react';

export default function EmptyState({
  title = 'Nothing here yet',
  description = '',
  icon: Icon = Inbox,
  action = null,
}) {
  return (
    <div
      style={{
        padding: '36px 20px',
        textAlign: 'center',
        border: '1px dashed var(--border-strong)',
        borderRadius: 'var(--radius-md)',
        background: 'rgba(15, 23, 42, 0.35)',
      }}
    >
      <div
        style={{
          width: '44px',
          height: '44px',
          borderRadius: '12px',
          background: 'var(--bg-elevated)',
          color: 'var(--text-muted)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: '12px',
        }}
      >
        <Icon size={22} />
      </div>
      <div style={{ fontWeight: 600, fontSize: '15px', color: 'var(--text-primary)' }}>{title}</div>
      {description && (
        <p style={{ margin: '6px auto 0', maxWidth: '420px', fontSize: '13px', color: 'var(--text-muted)' }}>
          {description}
        </p>
      )}
      {action && <div style={{ marginTop: '16px' }}>{action}</div>}
    </div>
  );
}

