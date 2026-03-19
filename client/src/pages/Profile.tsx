import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-neutral-100 px-8 py-12">
      <div className="mx-auto max-w-xl rounded-3xl bg-white p-10 shadow-sm">
        <h1 className="mb-8 text-2xl font-bold text-neutral-900">Profile</h1>

        <div className="flex flex-col gap-4">
          <div className="rounded-2xl bg-neutral-50 px-6 py-4">
            <p className="text-xs font-medium text-neutral-400">Email</p>
            <p className="mt-1 text-sm font-semibold text-neutral-800">{user?.email ?? '—'}</p>
          </div>
          <div className="rounded-2xl bg-neutral-50 px-6 py-4">
            <p className="text-xs font-medium text-neutral-400">Current Level</p>
            <p className="mt-1 text-sm font-semibold text-neutral-800">{user?.currentLevel ?? '—'}</p>
          </div>
          {/* Add more fields here later */}
        </div>

        <button
          type="button"
          onClick={() => { logout(); navigate('/login'); }}
          className="mt-10 w-full rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          Logout
        </button>
        <button
          type="button"
          onClick={() => { navigate('/app'); }}
          className="mt-10 w-full rounded-full bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition hover:bg-neutral-700"
        >
          Back to App
        </button>
      </div>
    </div>
  );
}
