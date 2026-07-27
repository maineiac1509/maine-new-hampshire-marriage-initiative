import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '@/lib/AuthContext';
import { isAdmin } from '@/lib/permissions';

// Route-level enforcement for administrative pages. Navigation hiding alone
// is not sufficient — a volunteer navigating directly to an admin URL is
// redirected away. Data-level enforcement is handled by existing RLS.
export default function AdminRoute() {
  const { user } = useAuth();
  if (!isAdmin(user)) {
    return <Navigate to="/" replace />;
  }
  return <Outlet />;
}