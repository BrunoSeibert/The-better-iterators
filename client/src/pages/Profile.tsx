import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useNavigate } from 'react-router-dom';
import * as authService from '@/services/authService';

const BADGES = [
  { emoji: '🎖️', label: 'First Step',  description: 'Join StudyOn',           condition: (_streak: number, level: number) => level >= 1 },
  { emoji: '🔥', label: 'On Fire',     description: 'Reach a 3-day streak',    condition: (streak: number) => streak >= 3 },
  { emoji: '🎓', label: 'Scholar',     description: 'Reach level 3',           condition: (_streak: number, level: number) => level >= 3 },
  { emoji: '🚀', label: 'Rocket',      description: 'Reach level 5',           condition: (_streak: number, level: number) => level >= 5 },
  { emoji: '💡', label: 'Innovator',   description: 'Reach level 6',           condition: (_streak: number, level: number) => level >= 6 },
  { emoji: '👑', label: 'Champion',    description: 'Complete all 7 levels',   condition: (_streak: number, level: number) => level >= 7 },
];

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const level = user?.currentLevel ?? 0;
  const completedStages = user?.completedStages ?? [];

  const [streak, setStreak] = useState(0);

  useEffect(() => {
    let isMounted = true;
    authService.getStreakSummary()
      .then((data) => { if (isMounted) setStreak(data.currentStreak); })
      .catch(() => { if (isMounted) setStreak(0); });
    return () => { isMounted = false; };
  }, []);

  const unlockedCount = BADGES.filter((b) => b.condition(streak, level)).length;

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-12 sm:px-8">

      <button
        type="button"
        onClick={() => navigate('/app')}
        className="mb-8 flex items-center gap-2 text-sm font-medium text-neutral-500 transition hover:text-neutral-900"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
        Back to App
      </button>

      <div className="mx-auto max-w-2xl space-y-6">

        {/* Header card */}
        <div className="rounded-3xl bg-neutral-900 px-8 py-10 text-white">
          <div className="flex items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-neutral-700 text-3xl font-bold text-white">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-lg font-bold">{user?.email ?? '—'}</p>
              <p className="mt-1 text-sm text-neutral-400">Level {level} · {completedStages.length} stages completed</p>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex justify-between text-xs text-neutral-400">
              <span>Progress</span>
              <span>{completedStages.length} / 7 levels</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-neutral-700">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${(completedStages.length / 7) * 100}%` }}
              />
            </div>
          </div>
        </div>

        {/* Badges card */}
        <div className="rounded-3xl bg-white px-8 py-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">Badges</h2>
            <span className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">
              {unlockedCount} / {BADGES.length} unlocked
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {BADGES.map((badge) => {
              const unlocked = badge.condition(streak, level);
              return (
                <div key={badge.label} className="group relative flex flex-col items-center gap-2">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-2xl border text-3xl transition ${
                      unlocked
                        ? 'border-neutral-200 bg-neutral-50 shadow-sm'
                        : 'border-neutral-100 bg-neutral-100 grayscale opacity-40'
                    }`}
                  >
                    {badge.emoji}
                  </div>
                  <span className="text-center text-xs font-medium text-neutral-500">{badge.label}</span>
                  <div className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                    {badge.description}
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account card */}
        <div className="rounded-3xl bg-white px-8 py-8 shadow-sm">
          <h2 className="mb-6 text-lg font-bold text-neutral-900">Account</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-6 py-4">
              <span className="text-xs font-medium text-neutral-400">Email</span>
              <span className="text-sm font-semibold text-neutral-800">{user?.email ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-6 py-4">
              <span className="text-xs font-medium text-neutral-400">Current Level</span>
              <span className="text-sm font-semibold text-neutral-800">{level}</span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-6 py-4">
              <span className="text-xs font-medium text-neutral-400">Daily Streak</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-500">
                🔥 {streak} days
              </span>
            </div>
            <div className="flex items-center justify-between rounded-2xl bg-neutral-50 px-6 py-4">
              <span className="text-xs font-medium text-neutral-400">Completed Stages</span>
              <span className="text-sm font-semibold text-neutral-800">{completedStages.join(', ') || '—'}</span>
            </div>
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={() => { logout(); navigate('/login'); }}
          className="w-full rounded-full border border-neutral-200 bg-white px-6 py-3 text-sm font-semibold text-neutral-600 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600"
        >
          Logout
        </button>

      </div>
    </div>
  );
}

