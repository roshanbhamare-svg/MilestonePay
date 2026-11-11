import { AlertCircle, CheckCircle2, Info, AlertTriangle, Sparkles } from 'lucide-react';

const ICON_MAP = {
  info: Info,
  success: CheckCircle2,
  warning: AlertTriangle,
  danger: AlertCircle,
  ai: Sparkles,
};

export default function Alert({ variant = 'info', title, children, className = '', style }) {
  const Icon = ICON_MAP[variant] || Info;

  return (
    <div className={`alert alert-${variant} ${className}`.trim()} style={style} role="alert">
      <Icon size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
      <div style={{ flex: 1 }}>
        {title && <div style={{ fontWeight: 600, marginBottom: children ? '2px' : 0 }}>{title}</div>}
        {children}
      </div>
    </div>
  );
}

