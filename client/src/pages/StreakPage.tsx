import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authService from '@/services/authService';

const C = {
  darkBrown:  'rgba(38,38,38,1)',
  midBrown:   'rgba(82,82,91,1)',
  tan:        'rgba(161,161,170,1)',
  lightTan:   'rgba(228,228,231,1)',
  cream:      'rgba(250,250,250,1)',
  warmWhite:  'rgba(244,244,245,1)',
  border:     'rgba(212,212,216,1)',
  mutedText:  'rgba(113,113,122,1)',
};

function getLocalDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function StreakPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<authService.StreakSummary | null>(() => authService.peekStreakSummary());
  const [isLoading, setIsLoading] = useState(() => authService.peekStreakSummary() === null);

  useEffect(() => {
    let isMounted = true;
    setIsLoading(true);
    authService.getStreakSummary({ force: true }).then((data) => {
      if (isMounted) { setSummary(data); setIsLoading(false); }
    }).catch(() => {
      if (isMounted) {
        setSummary((currentSummary) => currentSummary ?? authService.peekStreakSummary());
        setIsLoading(false);
      }
    });
    return () => { isMounted = false; };
  }, []);

  const calendarDays = useMemo(() => {
    const now = new Date();
    const year = summary?.year ?? now.getFullYear();
    const monthIndex = (summary?.month ?? (now.getMonth() + 1)) - 1;
    const firstDay = new Date(year, monthIndex, 1);
    const daysInMonth = new Date(year, monthIndex + 1, 0).getDate();
    const startOffset = firstDay.getDay();
    const activeDates = new Set(summary?.activeDates ?? []);
    const streakDates = new Set(summary?.streakDates ?? []);

    return Array.from({ length: 42 }, (_, index) => {
      const dayNumber = index - startOffset + 1;
      if (dayNumber < 1 || dayNumber > daysInMonth) {
        return { key: `empty-${index}`, type: 'empty' as const };
      }
      const dateKey = [
        year,
        String(monthIndex + 1).padStart(2, '0'),
        String(dayNumber).padStart(2, '0'),
      ].join('-');
      const todayKey = getLocalDateKey(new Date());
      const isFuture = dateKey > todayKey;
      const isActive = activeDates.has(dateKey);
      return {
        key: dateKey,
        type: 'day' as const,
        isActive,
        isStreakDay: streakDates.has(dateKey),
        isFuture,
        isToday: dateKey === todayKey,
      };
    });
  }, [summary]);

  const monthName = new Date(
    summary?.year ?? new Date().getFullYear(),
    (summary?.month ?? new Date().getMonth() + 1) - 1,
    1,
  ).toLocaleString('en-US', { month: 'long', year: 'numeric' });

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <div className="min-h-screen px-4 py-12 sm:px-8" style={{ backgroundColor: C.warmWhite }}>
      <button
        type="button"
        onClick={() => navigate('/app')}
        className="mb-8 flex items-center gap-2 px-4 py-2 text-sm font-medium transition rounded-lg"
        style={{ color: C.darkBrown, backgroundColor: C.lightTan, border: '2px solid rgba(224,224,228,1)' }}
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
          <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
        </svg>
        Back
      </button>

      <div className="mx-auto max-w-sm">
        <div className="rounded-xl px-8 py-7" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>

          <h1 className="mb-5 text-xl font-bold text-center" style={{ color: C.darkBrown }}>Daily Streak</h1>

          {/* Current streak count */}
          <div className="mb-6 flex items-center justify-center gap-3">
            <span aria-hidden="true" className="text-4xl leading-none">🔥</span>
            <span className="text-3xl font-bold" style={{ color: C.darkBrown }}>
              {isLoading && !summary ? '…' : `${summary?.currentStreak ?? 0} days`}
            </span>
          </div>

          {/* Month label */}
          <p className="mb-3 text-center text-xs font-semibold uppercase tracking-widest" style={{ color: C.mutedText }}>
            {monthName}
          </p>

          {/* Week day headers */}
          <div className="grid grid-cols-7 gap-y-2 text-center text-xs font-semibold mb-1" style={{ color: C.mutedText }}>
            {weekDays.map((d, i) => <div key={i}>{d}</div>)}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-y-2">
            {calendarDays.map((item) => {
              if (item.type === 'empty') return <div key={item.key} className="h-8" />;
              return (
                <div key={item.key} className="flex items-center justify-center">
                  {item.isStreakDay ? (
                    <span aria-hidden="true" className="text-lg leading-none">🔥</span>
                  ) : (
                    <div
                      className="h-7 w-7 rounded-full"
                      style={{
                        backgroundColor: item.isActive
                          ? C.darkBrown
                          : item.isFuture
                            ? 'transparent'
                            : C.lightTan,
                        border: `2px solid ${item.isToday ? C.darkBrown : item.isActive ? C.darkBrown : C.border}`,
                        boxShadow: item.isToday ? `0 0 0 2px ${C.warmWhite}, 0 0 0 4px ${C.darkBrown}` : 'none',
                      }}
                    />
                  )}
                </div>
              );
            })}
          </div>

        </div>
      </div>
    </div>
  );
}
