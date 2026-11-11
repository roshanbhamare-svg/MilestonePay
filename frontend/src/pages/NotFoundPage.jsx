import { Link } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

export default function NotFoundPage() {
  return (
    <div className="auth-page" style={{ textAlign: 'center' }}>
      <div className="auth-card">
        <div className="badge badge-warning mb-3">404</div>
        <h1 style={{ margin: '0 0 8px', fontSize: '24px' }}>Page Not Found</h1>
        <p className="text-muted mb-6">
          The page you requested does not exist or has been moved.
        </p>
        <Link to="/dashboard" className="btn btn-primary">
          <ArrowLeft size={16} /> Return to Dashboard
        </Link>
      </div>
    </div>
  );
}

