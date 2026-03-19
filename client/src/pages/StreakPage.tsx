import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as authService from '@/services/authService';

function getLocalDateKey(date: Date) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export default function StreakPage() {
  const navigate = useNavigate();
  const [summary, setSummary] = useState<{
    firstLoginDate: string;
    currentStreak: number;
    activeDates: string[];
    streakDates: string[];
    month: number;
    year: number;
  } | null>(null);

  useEffect(() => {
    let isMounted = true;

    authService.getStreakSummary().then((data) => {
      if (isMounted) {
        setSummary(data);
      }
    }).catch(() => {
      if (isMounted) {
        setSummary(null);
      }
    });

    return () => {
      isMounted = false;
    };
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

  const weekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

  return (
    <main className="flex min-h-screen items-center justify-center bg-neutral-950 px-6 py-8 text-neutral-100 sm:px-10">
      <div className="w-full max-w-[30rem] rounded-[1.1rem] border border-neutral-800 bg-neutral-900 px-6 py-4 shadow-[0_30px_80px_rgba(0,0,0,0.45)] sm:aspect-[3/2] sm:px-7 sm:py-3">
        <div className="flex">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="rounded-[0.55rem] border border-red-500/70 px-5 py-2 text-base font-semibold text-red-400 transition hover:bg-red-500/10"
          >
            Back
          </button>
        </div>

        <div className="mt-0.5 text-center">
          <h1 className="text-[1.7rem] font-semibold tracking-[-0.04em] text-white">
            Daily Streak
          </h1>
        </div>

        <div className="mx-auto mt-2 max-w-xs grid grid-cols-7 gap-y-2 text-center text-sm font-semibold text-neutral-500">
          {weekDays.map((day) => (
            <div key={day}>{day}</div>
          ))}
        </div>

        <div className="mx-auto mt-1.5 max-w-xs grid grid-cols-7 gap-y-2">
          {calendarDays.map((item) => {
            if (item.type === 'empty') {
              return <div key={item.key} className="h-3.5" />;
            }

            return (
              <div key={item.key} className="flex flex-col items-center justify-center gap-0.5">
                {item.isStreakDay ? (
                  <span aria-hidden="true" className="text-base leading-none">{'\u{1F525}'}</span>
                ) : (
                  <span
                    className={`h-4 w-4 rounded-full border ${
                      item.isActive
                        ? 'border-teal-400 bg-teal-400'
                        : item.isFuture
                          ? 'border-neutral-600 bg-transparent'
                          : 'border-neutral-700 bg-neutral-700'
                    }`}
                  />
                )}
                <svg
                  aria-hidden="true"
                  viewBox="0 0 10 6"
                  className={`h-2 w-3 fill-orange-400 transition-opacity ${item.isToday ? 'opacity-100' : 'opacity-0'}`}
                >
                  <path d="M5 0 10 6H0z" />
                </svg>
              </div>
            );
          })}
        </div>

        <div className="mt-1 text-center pb-4">
          <div className="flex items-center justify-center gap-2.5 text-orange-400">
            <span aria-hidden="true" className="text-[2.35rem] leading-none">{'\u{1F525}'}</span>
            <span className="text-[1.7rem] font-semibold tracking-[-0.04em] leading-none">
              {summary?.currentStreak ?? 0} DAYS
            </span>
          </div>

        </div>
      </div>
    </main>
  );
}

