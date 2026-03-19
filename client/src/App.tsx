import { Navigate, Outlet, Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import LoginPage from '@/pages/LoginPage';
import StreakPage from '@/pages/StreakPage';
import OnboardingPage from '@/pages/OnboardingPage';
import { useAuthStore } from '@/store/authStore';
import Profile from './pages/Profile';
import TopicDetailPage from '@/pages/TopicDetailPage';

function ProtectedRoute() {
  const { token, user } = useAuthStore((state) => state);

  if (!token) return <Navigate to="/" replace />;
  if (!user?.isOnboarded) return <Navigate to="/onboarding" replace />;

  return <Outlet />;
}

function OnboardingRoute() {
  const { token, user } = useAuthStore((state) => state);

  if (!token) return <Navigate to="/" replace />;
  if (user?.isOnboarded) return <Navigate to="/app" replace />;

  return <Outlet />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route element={<OnboardingRoute />}>
        <Route path="/onboarding" element={<OnboardingPage />} />
      </Route>
      <Route element={<ProtectedRoute />}>
        <Route path="/app" element={<Layout />} />
        <Route path="/streak" element={<StreakPage />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="/topics/:id" element={<TopicDetailPage />} />
      </Route>
      <Route path="/login" element={<Navigate to="/" replace />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
