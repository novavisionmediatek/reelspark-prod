import { Navigate, Route, Routes } from 'react-router-dom';
import { useAuth } from './lib/AuthProvider';
import { Layout } from './components/Layout';
import { Login } from './pages/Login';
import { Dashboard } from './pages/Dashboard';
import { Videos } from './pages/Videos';
import { Users } from './pages/Users';
import { Payments } from './pages/Payments';
import { Referrals } from './pages/Referrals';
import { Reports } from './pages/Reports';
import { Settings } from './pages/Settings';

function ProtectedRoutes() {
  const { isAdmin } = useAuth();

  if (!isAdmin) return <Navigate to="/login" replace />;

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Dashboard />} />
        <Route path="videos" element={<Videos />} />
        <Route path="users" element={<Users />} />
        <Route path="payments" element={<Payments />} />
        <Route path="referrals" element={<Referrals />} />
        <Route path="reports" element={<Reports />} />
        <Route path="settings" element={<Settings />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const { loading, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-bg text-text-muted text-sm">Loading…</div>
    );
  }

  return (
    <Routes>
      {/* Login also handles the "signed in but not an admin" state itself,
          so it must NOT redirect away just because a session exists. */}
      <Route path="/login" element={isAdmin ? <Navigate to="/" replace /> : <Login />} />
      <Route path="/*" element={<ProtectedRoutes />} />
    </Routes>
  );
}
