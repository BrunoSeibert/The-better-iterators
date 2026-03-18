import { Routes, Route } from 'react-router-dom';
import Layout from '@/components/layout/Layout';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Layout />}>
        {/* Add routes here */}
      </Route>
    </Routes>
  );
}
