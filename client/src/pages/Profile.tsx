import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLocation, useNavigate } from 'react-router-dom';
import * as authService from '@/services/authService';
import { BADGES } from '@/utils/badges';

export default function Profile() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();
  const location = useLocation();
  const returnTo = (location.state as { returnTo?: string } | null)?.returnTo ?? '/app';

  const level = user?.currentLevel ?? 0;
  const completedStages = user?.completedStages ?? [];

  const [streak, setStreak] = useState<number | null>(() => authService.peekStreakSummary()?.currentStreak ?? null);

  useEffect(() => {
    authService.me()
      .then(({ user: refreshedUser }) => {
        useAuthStore.getState().setUser(refreshedUser);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    authService.getStreakSummary({ force: true })
      .then((data) => {
        if (isMounted) {
          setStreak(data.currentStreak);
        }
      })
      .catch(() => {
        if (isMounted && authService.peekStreakSummary() === null) {
          setStreak(0);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const streakValue = streak ?? 0;
  const unlockedCount = BADGES.filter((b) => b.condition(streakValue, level)).length;

  return (
    <div className="min-h-screen bg-neutral-100 px-4 py-12 sm:px-8">
      <button
        type="button"
        onClick={() => navigate(returnTo)}
        className="mb-8 flex items-center gap-2 rounded-[0.32rem] border-2 border-[rgba(176,176,176,0.95)] bg-[rgba(246,246,246,0.98)] px-4 py-2 text-sm font-medium text-[rgba(108,108,108,0.96)] transition hover:border-[rgba(150,150,150,0.98)] hover:bg-[rgba(252,252,252,1)] hover:text-[rgba(82,82,82,0.98)]"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
        Back to App
      </button>

      <div className="mx-auto max-w-2xl space-y-6">
        <div className="rounded-[0.7rem] border-2 border-[rgba(56,40,29,1)] bg-[rgba(81,60,45,1)] px-8 py-10 text-[rgba(249,241,232,1)]">
          <div className="flex items-center gap-6">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[0.7rem] bg-[rgba(106,80,61,1)] text-3xl font-bold text-[rgba(255,246,235,1)]">
              {user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-lg font-bold">{user?.email ?? '—'}</p>
              <p className="mt-1 text-sm text-[rgba(228,210,194,0.82)]">
                Level {level} · {completedStages.length} stages completed
              </p>
            </div>
          </div>

          <div className="mt-8">
            <div className="mb-2 flex justify-between text-xs text-[rgba(228,210,194,0.82)]">
              <span>Progress</span>
              <span>{completedStages.length} / 7 levels</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-[999px] bg-[rgba(124,95,73,1)]">
              <div
                className="h-full rounded-[999px] bg-[rgba(248,233,219,0.98)] transition-all"
                style={{ width: `${(completedStages.length / 7) * 100}%` }}
              />
            </div>
          </div>
        </div>

        <div className="rounded-[0.7rem] border-2 border-[rgba(214,205,194,0.9)] bg-white px-8 py-8 shadow-sm">
          <div className="mb-6 flex items-center justify-between">
            <h2 className="text-lg font-bold text-neutral-900">Badges</h2>
            <span className="rounded-[0.32rem] border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-500">
              {unlockedCount} / {BADGES.length} unlocked
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {BADGES.map((badge) => {
              const unlocked = badge.condition(streakValue, level);
              return (
                <div key={badge.label} className="group relative flex flex-col items-center gap-2">
                  <div
                    className={`flex h-16 w-16 items-center justify-center rounded-[0.55rem] border text-3xl transition ${
                      unlocked
                        ? 'border-neutral-200 bg-neutral-50 shadow-sm'
                        : 'border-neutral-100 bg-neutral-100 grayscale opacity-40'
                    }`}
                  >
                    {badge.emoji}
                  </div>
                  <span className="text-center text-xs font-medium text-neutral-500">{badge.label}</span>
                  <div className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-[0.45rem] bg-neutral-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                    {badge.description}
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        <div className="rounded-[0.7rem] border-2 border-[rgba(214,205,194,0.9)] bg-white px-8 py-8 shadow-sm">
          <h2 className="mb-6 text-lg font-bold text-neutral-900">Account</h2>
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-[0.55rem] bg-neutral-50 px-6 py-4">
              <span className="text-xs font-medium text-neutral-400">Email</span>
              <span className="text-sm font-semibold text-neutral-800">{user?.email ?? '—'}</span>
            </div>
            <div className="flex items-center justify-between rounded-[0.55rem] bg-neutral-50 px-6 py-4">
              <span className="text-xs font-medium text-neutral-400">Current Level</span>
              <span className="text-sm font-semibold text-neutral-800">{level}</span>
            </div>
            <div className="flex items-center justify-between rounded-[0.55rem] bg-neutral-50 px-6 py-4">
              <span className="text-xs font-medium text-neutral-400">Daily Streak</span>
              <span className="flex items-center gap-1.5 text-sm font-semibold text-orange-500">
                <span aria-hidden="true">🔥</span>
                {streak === null ? 'Loading...' : `${streak} days`}
              </span>
            </div>
            <div className="flex items-center justify-between rounded-[0.55rem] bg-neutral-50 px-6 py-4">
              <span className="text-xs font-medium text-neutral-400">Completed Stages</span>
              <span className="text-sm font-semibold text-neutral-800">{completedStages.join(', ') || '—'}</span>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            logout();
            navigate('/login', { state: { returnTo } });
          }}
          className="w-full rounded-[0.32rem] border-2 border-[rgba(132,28,28,0.98)] bg-[rgba(186,43,43,0.98)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[rgba(171,35,35,0.98)]"
        >
          Logout
        </button>
      </div>
    </div>
  );
}
