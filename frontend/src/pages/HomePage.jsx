import { Link, Navigate } from 'react-router-dom';
import { ShieldCheck, Sparkles, Lock, CheckCircle2, ArrowRight, FlaskConical } from 'lucide-react';
import { useAuth } from '../hooks/useAuth';
import LoadingSpinner from '../components/common/LoadingSpinner';

export default function HomePage() {
  const { isAuthenticated, loading } = useAuth();

  if (loading) {
    return <LoadingSpinner fullScreen label="Loading MilestonePay..." />;
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />;
  }

  const features = [
    {
      icon: Sparkles,
      title: 'AI Milestone Planning',
      description: 'Break project scopes into clear deliverables, acceptance criteria, and balanced budgets.',
    },
    {
      icon: Lock,
      title: 'PayPal Authorization Escrow',
      description: 'Clients authorize total project funds upfront via PayPal without immediate capture.',
    },
    {
      icon: CheckCircle2,
      title: 'Human-Approved Releases',
      description: 'AI evaluates GitHub & file submissions; clients retain final approval before capture.',
    },
  ];

  return (
    <div
      style={{
        minHeight: '100vh',
        background:
          'radial-gradient(circle at top center, rgba(59,130,246,0.16), transparent 45%), var(--bg-app)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <header
        style={{
          padding: '18px 32px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          maxWidth: '1200px',
          width: '100%',
          margin: '0 auto',
        }}
      >
        <div className="brand-logo">
          <div className="brand-mark">
            <ShieldCheck size={18} />
          </div>
          <span>MilestonePay</span>
        </div>

        <div className="flex items-center gap-3">
          <Link to="/checkout" className="btn btn-ghost btn-sm">
            <FlaskConical size={15} /> PayPal Test
          </Link>
          <Link to="/login" className="btn btn-secondary btn-sm">
            Sign In
          </Link>
          <Link to="/register" className="btn btn-primary btn-sm">
            Get Started
          </Link>
        </div>
      </header>

      <main
        style={{
          flex: 1,
          maxWidth: '1120px',
          width: '100%',
          margin: '0 auto',
          padding: '64px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          textAlign: 'center',
        }}
      >
        <span className="badge badge-ai mb-4">
          <Sparkles size={13} /> AI-Powered Freelance Escrow Platform
        </span>

        <h1
          style={{
            margin: 0,
            fontSize: 'clamp(32px, 5vw, 52px)',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            lineHeight: 1.12,
            maxWidth: '780px',
          }}
        >
          Release Milestone Payments Only When Deliverables Pass Review
        </h1>

        <p
          className="text-muted"
          style={{
            marginTop: '18px',
            maxWidth: '640px',
            fontSize: '16px',
            lineHeight: 1.65,
          }}
        >
          MilestonePay pairs structured project agreements and AI deliverable evaluations with real
          PayPal authorization and partial-capture workflows.
        </p>

        <div className="flex items-center gap-3 flex-wrap mt-6" style={{ justifyContent: 'center' }}>
          <Link to="/register" className="btn btn-primary btn-lg">
            Create Account <ArrowRight size={16} />
          </Link>
          <Link to="/login" className="btn btn-secondary btn-lg">
            Sign In to Workspace
          </Link>
        </div>

        <div className="grid grid-cols-3 mt-6" style={{ width: '100%', marginTop: '56px', textAlign: 'left' }}>
          {features.map((feat) => {
            const Icon = feat.icon;
            return (
              <div key={feat.title} className="card">
                <div
                  className="stat-icon mb-3"
                  style={{ background: 'var(--brand-soft)', color: '#93c5fd' }}
                >
                  <Icon size={20} />
                </div>
                <h3 style={{ margin: '0 0 6px', fontSize: '16px', fontWeight: 600 }}>{feat.title}</h3>
                <p className="text-muted" style={{ margin: 0, fontSize: '13px' }}>
                  {feat.description}
                </p>
              </div>
            );
          })}
        </div>
      </main>
    </div>
  );
}

