import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';
import LoginPage from '@/pages/LoginPage';
import StreakPage from '@/pages/StreakPage';

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<Layout />} />
      <Route path="/streak" element={<StreakPage />} />
    </Routes>
  );
}
