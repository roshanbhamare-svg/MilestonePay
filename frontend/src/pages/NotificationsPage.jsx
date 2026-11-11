import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Bell, Check, CheckCheck, ExternalLink } from 'lucide-react';
import Card from '../components/common/Card';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import EmptyState from '../components/common/EmptyState';
import LoadingSpinner from '../components/common/LoadingSpinner';
import { notificationApi } from '../api/notificationApi';
import { formatDateTime, getErrorMessage } from '../utils/formatters';

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      try {
        const res = await notificationApi.getMyNotifications();
        if (active) {
          setNotifications(res.notifications || []);
          setUnreadCount(res.unreadCount || 0);
        }
      } catch (err) {
        if (active) setError(getErrorMessage(err, 'Failed to fetch notifications'));
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, []);

  const handleMarkRead = async (id) => {
    try {
      await notificationApi.markAsRead(id);
      setNotifications((prev) => prev.map((n) => (n._id === id ? { ...n, read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to mark notification as read'));
    }
  };

  const handleMarkAll = async () => {
    try {
      await notificationApi.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch (err) {
      setError(getErrorMessage(err, 'Failed to mark all read'));
    }
  };

  const visible =
    filter === 'UNREAD' ? notifications.filter((n) => !n.read) : notifications;

  return (
    <div className="flex-col gap-6">
      <div className="page-header">
        <div>
          <h1 className="page-title">Notifications</h1>
          <p className="page-subtitle">
            {unreadCount} unread notification{unreadCount === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant={filter === 'ALL' ? 'primary' : 'secondary'}
            onClick={() => setFilter('ALL')}
          >
            All ({notifications.length})
          </Button>
          <Button
            size="sm"
            variant={filter === 'UNREAD' ? 'primary' : 'secondary'}
            onClick={() => setFilter('UNREAD')}
          >
            Unread ({unreadCount})
          </Button>
          {unreadCount > 0 && (
            <Button size="sm" variant="ghost" icon={CheckCheck} onClick={handleMarkAll}>
              Mark all read
            </Button>
          )}
        </div>
      </div>

      {error && <Alert variant="danger">{error}</Alert>}

      <Card>
        {loading ? (
          <LoadingSpinner label="Loading notifications..." />
        ) : visible.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={filter === 'UNREAD' ? 'All caught up!' : 'No notifications yet'}
            description="Notifications for milestone submissions, evaluations, and PayPal captures appear here."
          />
        ) : (
          <div className="flex-col gap-3">
            {visible.map((item) => (
              <div
                key={item._id}
                className="flex items-start justify-between flex-wrap gap-3"
                style={{
                  padding: '14px 16px',
                  borderRadius: 'var(--radius-md)',
                  background: item.read ? 'var(--bg-app)' : 'rgba(59, 130, 246, 0.08)',
                  border: `1px solid ${item.read ? 'var(--border)' : 'rgba(59, 130, 246, 0.32)'}`,
                }}
              >
                <div>
                  <div className="flex items-center gap-2">
                    {!item.read && <span className="badge badge-info">New</span>}
                    <strong style={{ fontSize: '14px' }}>{item.title}</strong>
                  </div>
                  <p className="text-muted" style={{ margin: '4px 0', fontSize: '13px' }}>
                    {item.message}
                  </p>
                  <span className="text-sm text-dim">{formatDateTime(item.createdAt)}</span>
                </div>

                <div className="flex items-center gap-2">
                  {item.projectId && (
                    <Link to={`/projects/${item.projectId}`} className="btn btn-secondary btn-sm">
                      Open Project <ExternalLink size={12} />
                    </Link>
                  )}
                  {!item.read && (
                    <Button
                      size="sm"
                      variant="ghost"
                      icon={Check}
                      onClick={() => handleMarkRead(item._id)}
                    >
                      Mark read
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  );
}

