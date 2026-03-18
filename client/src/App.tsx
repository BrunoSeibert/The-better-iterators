import { Navigate, Outlet, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import LoginPage from '@/pages/LoginPage';
import StreakPage from '@/pages/StreakPage';
import { useAuthStore } from '@/store/authStore';

function ProtectedRoute() {
  const token = useAuthStore((state) => state.token);

  if (!token) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<Layout />} />
        <Route path="/streak" element={<StreakPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
