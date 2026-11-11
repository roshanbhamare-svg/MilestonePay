import { useState, useCallback, useRef } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { ToastContext } from './toastContextValue';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const idRef = useRef(1);

  const dismiss = useCallback((id) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const showToast = useCallback(
    (message, type = 'info', durationMs = 4200) => {
      const id = idRef.current++;
      setToasts((prev) => [...prev, { id, message, type }]);
      if (durationMs > 0) {
        setTimeout(() => {
          dismiss(id);
        }, durationMs);
      }
      return id;
    },
    [dismiss]
  );

  const toast = {
    success: (msg) => showToast(msg, 'success'),
    error: (msg) => showToast(msg, 'error', 5500),
    info: (msg) => showToast(msg, 'info'),
  };

  return (
    <ToastContext.Provider value={toast}>
      {children}
      {toasts.length > 0 && (
        <div className="toast-stack" role="status" aria-live="polite">
          {toasts.map((item) => {
            const Icon =
              item.type === 'success'
                ? CheckCircle2
                : item.type === 'error'
                  ? AlertCircle
                  : Info;
            const iconColor =
              item.type === 'success'
                ? '#10b981'
                : item.type === 'error'
                  ? '#ef4444'
                  : '#3b82f6';

            return (
              <div key={item.id} className="toast-item">
                <div className="flex items-center gap-2">
                  <Icon size={18} color={iconColor} style={{ flexShrink: 0 }} />
                  <span>{item.message}</span>
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="btn-ghost"
                  style={{ border: 'none', padding: '2px', cursor: 'pointer' }}
                  aria-label="Close notification"
                >
                  <X size={15} />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </ToastContext.Provider>
  );
}

