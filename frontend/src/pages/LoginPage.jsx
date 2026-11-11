import { useState } from 'react';
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ShieldCheck, LogIn } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import { useToast } from '../hooks/useToast';
import Button from '../components/common/Button';
import Alert from '../components/common/Alert';
import { getErrorMessage } from '../utils/formatters';

export default function LoginPage() {
  const { isAuthenticated, login } = useAuth();
  const toast = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const destination = location.state?.from?.pathname || '/dashboard';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email.trim() || !password) {
      setError('Email and password are required.');
      return;
    }

    setSubmitting(true);
    try {
      const user = await login({ email: email.trim(), password });
      toast.success(`Welcome back, ${user.name}!`);
      navigate(destination, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err, 'Invalid email or password'));
    } finally {
      setSubmitting(false);
    }
  };

  const fillDemo = (role) => {
    setEmail(role === 'client' ? 'client@milestonepay.com' : 'freelancer@milestonepay.com');
    setPassword('password123');
    setError('');
  };

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="flex items-center gap-2 mb-6">
          <div className="brand-mark">
            <ShieldCheck size={18} />
          </div>
          <div>
            <div style={{ fontWeight: 700, fontSize: '17px' }}>MilestonePay</div>
            <div className="text-sm text-muted">Sign in to your account</div>
          </div>
        </div>

        {error && (
          <Alert variant="danger" className="mb-4">
            {error}
          </Alert>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label" htmlFor="login-email">
              Email Address
            </label>
            <input
              id="login-email"
              type="email"
              className="form-input"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="login-password">
              Password
            </label>
            <input
              id="login-password"
              type="password"
              className="form-input"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            size="lg"
            loading={submitting}
            icon={LogIn}
            style={{ width: '100%' }}
          >
            Sign In
          </Button>
        </form>

        <div
          style={{
            marginTop: '18px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border)',
          }}
        >
          <div className="text-sm text-muted mb-2">Quick-fill Seeded Demo Credentials:</div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              style={{ flex: 1 }}
              onClick={() => fillDemo('client')}
            >
              Demo Client
            </Button>
            <Button
              size="sm"
              variant="secondary"
              style={{ flex: 1 }}
              onClick={() => fillDemo('freelancer')}
            >
              Demo Freelancer
            </Button>
          </div>
        </div>

        <p className="text-sm text-muted" style={{ textAlign: 'center', marginTop: '20px' }}>
          Don&apos;t have an account?{' '}
          <Link to="/register" style={{ color: '#93c5fd', fontWeight: 600 }}>
            Create one
          </Link>
        </p>
      </div>
    </div>
  );
}

