export default function LoadingSpinner({ label = 'Loading...', fullScreen = false }) {
  return (
    <div
      style={{
        minHeight: fullScreen ? '100vh' : '180px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '12px',
        color: 'var(--text-muted)',
      }}
    >
      <span
        className="spinner"
        style={{ width: '28px', height: '28px', borderWidth: '3px', color: 'var(--brand)' }}
      />
      <span style={{ fontSize: '13px' }}>{label}</span>
    </div>
  );
}

