import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, LogOut, Menu, CheckCheck } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';
import { notificationApi } from '../../api/notificationApi';
import { formatRelativeTime, getInitials } from '../../utils/formatters';

export default function Navbar({ onMenuToggle }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [notifOpen, setNotifOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const popoverRef = useRef(null);

  useEffect(() => {
    let active = true;

    const loadNotifications = async () => {
      try {
        const res = await notificationApi.getMyNotifications();
        if (active) {
          setNotifications(res.notifications || []);
          setUnreadCount(res.unreadCount || 0);
        }
      } catch {
        // Keep header stable even if notifications fail to fetch
      }
    };

    loadNotifications();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);

  const handleMarkRead = async (id, projectId) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, read: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch {
      // ignore
    }
    setNotifOpen(false);
    if (projectId) {
      navigate(`/projects/${projectId}`);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // ignore
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <header className="top-navbar">
      <div className="navbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          onClick={onMenuToggle}
          aria-label="Open navigation menu"
        >
          <Menu size={18} />
        </button>
        <div className="text-sm text-muted">
          Signed in as <strong style={{ color: 'var(--text-primary)' }}>{user?.name}</strong>
        </div>
      </div>

      <div className="navbar-right">
        <div className="popover-wrap" ref={popoverRef}>
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            onClick={() => setNotifOpen((prev) => !prev)}
            aria-label="Notifications"
            style={{ position: 'relative', padding: '8px 10px' }}
          >
            <Bell size={16} />
            {unreadCount > 0 && (
              <span
                style={{
                  position: 'absolute',
                  top: '-5px',
                  right: '-5px',
                  background: 'var(--brand)',
                  color: '#fff',
                  borderRadius: '999px',
                  minWidth: '18px',
                  height: '18px',
                  fontSize: '11px',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '0 4px',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <div className="popover-panel">
              <div
                className="flex items-center justify-between"
                style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)' }}
              >
                <span style={{ fontWeight: 600, fontSize: '13px' }}>
                  Notifications ({unreadCount} unread)
                </span>
                {unreadCount > 0 && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={handleMarkAllRead}
                  >
                    <CheckCheck size={14} /> Mark all read
                  </button>
                )}
              </div>

              <div style={{ maxHeight: '300px', overflowY: 'auto' }}>
                {notifications.length === 0 ? (
                  <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-dim)', fontSize: '13px' }}>
                    No notifications yet.
                  </div>
                ) : (
                  notifications.slice(0, 6).map((item) => (
                    <button
                      key={item._id}
                      type="button"
                      onClick={() => handleMarkRead(item._id, item.projectId)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        background: item.read ? 'transparent' : 'rgba(59, 130, 246, 0.08)',
                        border: 'none',
                        borderBottom: '1px solid var(--border)',
                        padding: '10px 14px',
                        cursor: 'pointer',
                        color: 'var(--text-primary)',
                      }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span style={{ fontSize: '13px', fontWeight: item.read ? 500 : 700 }}>
                          {item.title}
                        </span>
                        <span className="text-sm text-dim">
                          {formatRelativeTime(item.createdAt)}
                        </span>
                      </div>
                      <div className="text-sm text-muted" style={{ marginTop: '3px' }}>
                        {item.message}
                      </div>
                    </button>
                  ))
                )}
              </div>

              <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', textAlign: 'center' }}>
                <Link
                  to="/notifications"
                  onClick={() => setNotifOpen(false)}
                  style={{ fontSize: '12px', color: '#93c5fd', fontWeight: 600 }}
                >
                  View all notifications →
                </Link>
              </div>
            </div>
          )}
        </div>

        <Link
          to="/profile"
          className="flex items-center gap-2"
          style={{
            padding: '4px 10px 4px 4px',
            borderRadius: '999px',
            border: '1px solid var(--border)',
            background: 'var(--bg-surface-2)',
          }}
        >
          <span
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '999px',
              background: 'var(--brand-soft)',
              color: '#93c5fd',
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            {getInitials(user?.name)}
          </span>
          <span style={{ fontSize: '12px', textTransform: 'capitalize', color: 'var(--text-secondary)' }}>
            {user?.role}
          </span>
        </Link>

        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={handleLogout}
          title="Log out"
        >
          <LogOut size={16} />
          <span>Logout</span>
        </button>
      </div>
    </header>
  );
}

