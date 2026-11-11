import { useAuth } from '../hooks/useAuth';
import ClientDashboard from './ClientDashboard';
import FreelancerDashboard from './FreelancerDashboard';

export default function DashboardPage() {
  const { user } = useAuth();

  if (user?.role === 'freelancer') {
    return <FreelancerDashboard />;
  }

  return <ClientDashboard />;
}

