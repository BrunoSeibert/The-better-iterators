import { useEffect, useState } from 'react';
import { useAuthStore } from '@/store/authStore';
import { useLocation, useNavigate } from 'react-router-dom';
import * as authService from '@/services/authService';
import { BADGES } from '@/utils/badges';

const C = {
  darkBrown:  'rgba(81,60,45,1)',
  midBrown:   'rgba(114,96,84,1)',
  tan:        'rgba(197,171,146,1)',
  lightTan:   'rgba(231,214,194,1)',
  cream:      'rgba(252,248,243,1)',
  warmWhite:  'rgba(245,239,231,1)',
  border:     'rgba(196,177,160,1)',
  mutedText:  'rgba(140,115,95,1)',
};

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
      .then(({ user: refreshedUser }) => { useAuthStore.getState().setUser(refreshedUser); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    let isMounted = true;
    authService.getStreakSummary({ force: true })
      .then((data) => { if (isMounted) setStreak(data.currentStreak); })
      .catch(() => { if (isMounted && authService.peekStreakSummary() === null) setStreak(0); });
    return () => { isMounted = false; };
  }, []);

  const streakValue = streak ?? 0;
  const unlockedCount = BADGES.filter((b) => b.condition(streakValue, level)).length;

  return (
    <div className="min-h-screen px-4 py-12 sm:px-8" style={{ backgroundColor: C.warmWhite }}>
      <button
        type="button"
        onClick={() => navigate(returnTo)}
        className="mb-8 flex items-center gap-2 px-4 py-2 text-sm font-medium transition rounded-lg"
        style={{ color: C.mutedText, backgroundColor: C.lightTan, border: `1px solid ${C.border}` }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
        Back
      </button>

      <div className="mx-auto max-w-2xl space-y-5">

        {/* Header card */}
        <div className="rounded-xl px-8 py-8" style={{ backgroundColor: C.darkBrown, border: `1px solid rgba(56,40,29,1)` }}>
          <div className="flex items-center gap-5">
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-xl text-3xl font-bold"
              style={{ backgroundColor: 'rgba(106,80,61,1)', color: C.cream }}
            >
              {user?.name?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? '?'}
            </div>
            <div>
              <p className="text-lg font-bold" style={{ color: C.cream }}>{user?.name ?? user?.email ?? '—'}</p>
              <p className="mt-0.5 text-sm" style={{ color: C.tan }}>
                Level {level} · {completedStages.length} stages completed
              </p>
            </div>
          </div>

          <div className="mt-7">
            <div className="mb-2 flex justify-between text-xs" style={{ color: C.tan }}>
              <span>Progress</span>
              <span>{completedStages.length} / 6 stages</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full" style={{ backgroundColor: 'rgba(124,95,73,1)' }}>
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${(completedStages.length / 6) * 100}%`, backgroundColor: C.lightTan }}
              />
            </div>
          </div>
        </div>

        {/* Badges card */}
        <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `1px solid ${C.border}` }}>
          <div className="mb-5 flex items-center justify-between">
            <h2 className="text-base font-bold" style={{ color: C.darkBrown }}>Badges</h2>
            <span
              className="rounded-full px-3 py-1 text-xs font-semibold"
              style={{ backgroundColor: C.lightTan, color: C.mutedText, border: `1px solid ${C.border}` }}
            >
              {unlockedCount} / {BADGES.length} unlocked
            </span>
          </div>

          <div className="grid grid-cols-3 gap-4 sm:grid-cols-6">
            {BADGES.map((badge) => {
              const unlocked = badge.condition(streakValue, level);
              return (
                <div key={badge.label} className="group relative flex flex-col items-center gap-2">
                  <div
                    className="flex h-16 w-16 items-center justify-center rounded-xl text-3xl transition"
                    style={unlocked
                      ? { backgroundColor: C.lightTan, border: `1px solid ${C.border}` }
                      : { backgroundColor: C.warmWhite, border: `1px solid ${C.border}`, opacity: 0.4, filter: 'grayscale(1)' }
                    }
                  >
                    {badge.emoji}
                  </div>
                  <span className="text-center text-xs font-medium" style={{ color: C.mutedText }}>{badge.label}</span>
                  <div
                    className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg px-3 py-1.5 text-xs opacity-0 shadow-lg transition group-hover:opacity-100"
                    style={{ backgroundColor: C.darkBrown, color: C.cream }}
                  >
                    {badge.description}
                    <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent" style={{ borderTopColor: C.darkBrown }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Account card */}
        <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `1px solid ${C.border}` }}>
          <h2 className="mb-5 text-base font-bold" style={{ color: C.darkBrown }}>Account</h2>
          <div className="space-y-2">
            {[
              { label: 'Email',            value: user?.email ?? '—' },
              { label: 'Current Level',    value: String(level) },
              { label: 'Daily Streak',     value: streak === null ? 'Loading…' : `🔥 ${streak} days` },
              { label: 'Completed Stages', value: completedStages.join(', ') || '—' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex items-center justify-between rounded-lg px-5 py-3.5"
                style={{ backgroundColor: C.warmWhite, border: `1px solid ${C.border}` }}
              >
                <span className="text-xs font-semibold uppercase tracking-wider" style={{ color: C.mutedText }}>{label}</span>
                <span className="text-sm font-semibold" style={{ color: C.darkBrown }}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Logout */}
        <button
          type="button"
          onClick={() => { logout(); navigate('/login', { state: { returnTo } }); }}
          className="w-full rounded-lg py-3 text-sm font-bold transition"
          style={{ backgroundColor: C.lightTan, color: C.darkBrown, border: `1px solid ${C.border}` }}
        >
          Log out
        </button>

      </div>
    </div>
  );
}
