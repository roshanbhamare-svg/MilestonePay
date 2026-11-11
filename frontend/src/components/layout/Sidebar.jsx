import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  FolderKanban,
  PlusCircle,
  CreditCard,
  Bell,
  UserCircle,
  FlaskConical,
  ShieldCheck,
  X,
} from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

export default function Sidebar({ isOpen, onClose }) {
  const { user } = useAuth();
  const isClient = user?.role === 'client';

  const primaryLinks = [
    { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/projects', label: 'Projects', icon: FolderKanban },
    ...(isClient ? [{ to: '/projects/new', label: 'New Project', icon: PlusCircle }] : []),
    { to: '/payments', label: 'Payments', icon: CreditCard },
    { to: '/notifications', label: 'Notifications', icon: Bell },
    { to: '/profile', label: 'Profile', icon: UserCircle },
  ];

  return (
    <>
      <div
        className={`sidebar-overlay ${isOpen ? 'open' : ''}`}
        onClick={onClose}
        aria-hidden="true"
      />
      <aside className={`sidebar ${isOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <NavLink to="/dashboard" className="brand-logo" onClick={onClose}>
            <div className="brand-mark">
              <ShieldCheck size={18} />
            </div>
            <span>MilestonePay</span>
          </NavLink>
          <button
            type="button"
            className="mobile-menu-btn"
            onClick={onClose}
            aria-label="Close sidebar"
          >
            <X size={16} />
          </button>
        </div>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <div className="sidebar-section-label">
            {isClient ? 'Client Workspace' : 'Freelancer Workspace'}
          </div>
          {primaryLinks.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.to === '/projects'}
                onClick={onClose}
                className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
              >
                <Icon size={18} />
                <span>{item.label}</span>
              </NavLink>
            );
          })}

          <div className="sidebar-section-label">Sandbox Tools</div>
          <NavLink
            to="/checkout"
            onClick={onClose}
            className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}
          >
            <FlaskConical size={18} />
            <span>PayPal Sandbox Test</span>
          </NavLink>
        </nav>

        <div className="sidebar-footer">
          <div className="flex items-center justify-between">
            <span>Role</span>
            <span className="badge badge-info" style={{ textTransform: 'capitalize' }}>
              {user?.role || 'user'}
            </span>
          </div>
          <div style={{ marginTop: '6px' }}>PayPal Sandbox • LangGraph AI</div>
        </div>
      </aside>
    </>
  );
}

