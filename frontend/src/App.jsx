import { BrowserRouter, Routes, Route, Link } from 'react-router-dom';
import { CheckCircle2, XCircle } from 'lucide-react';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/routing/ProtectedRoute';
import DashboardLayout from './components/layout/DashboardLayout';
import PayPalCheckout from './components/PayPalCheckout';
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import DashboardPage from './pages/DashboardPage';
import ProjectsPage from './pages/ProjectsPage';
import CreateProjectPage from './pages/CreateProjectPage';
import ProjectDetailPage from './pages/ProjectDetailPage';
import PaymentsPage from './pages/PaymentsPage';
import NotificationsPage from './pages/NotificationsPage';
import ProfilePage from './pages/ProfilePage';
import NotFoundPage from './pages/NotFoundPage';

function PayPalResultPage({ success }) {
  return (
    <div className="auth-page" style={{ textAlign: 'center' }}>
      <div className="auth-card">
        <div
          style={{
            display: 'inline-flex',
            padding: '12px',
            borderRadius: '999px',
            background: success ? 'var(--success-soft)' : 'var(--danger-soft)',
            color: success ? '#6ee7b7' : '#fca5a5',
            marginBottom: '14px',
          }}
        >
          {success ? <CheckCircle2 size={28} /> : <XCircle size={28} />}
        </div>
        <h1 style={{ margin: '0 0 8px', fontSize: '22px' }}>
          {success ? 'PayPal Approval Received' : 'PayPal Checkout Cancelled'}
        </h1>
        <p className="text-muted mb-6">
          {success
            ? 'Your PayPal order approval was received. Return to your project workspace to review authorization status.'
            : 'No payment authorization was completed. You can retry from your project payments tab.'}
        </p>
        <Link to="/dashboard" className="btn btn-primary">
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

function ProtectedPage({ children, allowedRoles = null }) {
  return (
    <ProtectedRoute allowedRoles={allowedRoles}>
      <DashboardLayout>{children}</DashboardLayout>
    </ProtectedRoute>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />

            <Route path="/checkout" element={<PayPalCheckout />} />
            <Route path="/payment/success" element={<PayPalResultPage success />} />
            <Route path="/payment/cancel" element={<PayPalResultPage success={false} />} />

            <Route
              path="/dashboard"
              element={
                <ProtectedPage>
                  <DashboardPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/projects"
              element={
                <ProtectedPage>
                  <ProjectsPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/projects/new"
              element={
                <ProtectedPage allowedRoles={['client']}>
                  <CreateProjectPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/projects/:projectId"
              element={
                <ProtectedPage>
                  <ProjectDetailPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/payments"
              element={
                <ProtectedPage>
                  <PaymentsPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/notifications"
              element={
                <ProtectedPage>
                  <NotificationsPage />
                </ProtectedPage>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedPage>
                  <ProfilePage />
                </ProtectedPage>
              }
            />

            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
