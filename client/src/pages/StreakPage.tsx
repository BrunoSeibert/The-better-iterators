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
  const [summary, setSummary] = useState<authService.StreakSummary | null>(() => authService.peekStreakSummary());
  const [isLoading, setIsLoading] = useState(() => authService.peekStreakSummary() === null);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);

    authService.getStreakSummary({ force: true }).then((data) => {
      if (isMounted) {
        setSummary(data);
        setIsLoading(false);
      }
    }).catch(() => {
      if (isMounted) {
        setSummary((currentSummary) => currentSummary ?? authService.peekStreakSummary());
        setIsLoading(false);
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
    <main className="flex min-h-screen items-center justify-center bg-neutral-100 px-3 py-4 text-neutral-900 sm:px-6 sm:py-8">
      <div className="flex w-full max-w-[30rem] flex-col rounded-[0.58rem] border-2 border-[rgba(214,205,194,0.9)] bg-white px-[clamp(0.8rem,2vw,1.25rem)] py-[clamp(0.9rem,2.4vw,1.25rem)] shadow-[0_24px_60px_rgba(23,23,23,0.08)] sm:min-h-[31rem]">
        <div className="flex w-full justify-start pb-[clamp(0.2rem,0.8vw,0.5rem)]">
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="rounded-[0.32rem] border-2 border-[rgba(132,28,28,0.98)] bg-[rgba(186,43,43,0.98)] px-[clamp(0.85rem,2.8vw,1.25rem)] py-[clamp(0.42rem,1.5vw,0.5rem)] text-[clamp(0.95rem,2.5vw,1rem)] font-semibold text-white transition hover:bg-[rgba(171,35,35,0.98)]"
          >
            Back
          </button>
        </div>

        <div className="flex flex-1 flex-col items-center justify-center">
          <div className="mb-[clamp(0.8rem,2.8vw,1.3rem)] text-center">
            <h1 className="text-[clamp(1.35rem,4.8vw,1.7rem)] font-semibold tracking-[-0.04em] text-neutral-900">
              Daily Streak
            </h1>
          </div>

          <div className="flex w-full flex-col items-center">
            <div className="grid w-full max-w-[18rem] grid-cols-7 gap-y-[clamp(0.2rem,0.9vw,0.5rem)] text-center text-[clamp(0.72rem,2vw,0.875rem)] font-semibold text-neutral-500">
              {weekDays.map((day) => (
                <div key={day}>{day}</div>
              ))}
            </div>

            <div className="mt-[clamp(0.1rem,0.7vw,0.35rem)] grid w-full max-w-[18rem] grid-cols-7 gap-y-[clamp(0.2rem,0.9vw,0.5rem)]">
              {calendarDays.map((item) => {
                if (item.type === 'empty') {
                  return <div key={item.key} className="h-[clamp(0.85rem,2vw,0.95rem)]" />;
                }

                return (
                  <div key={item.key} className="flex flex-col items-center justify-center gap-0.5">
                    {item.isStreakDay ? (
                      <span aria-hidden="true" className="text-[clamp(0.88rem,2.4vw,1rem)] leading-none">{'\u{1F525}'}</span>
                    ) : (
                      <span
                        className={`h-[clamp(0.8rem,2.2vw,1rem)] w-[clamp(0.8rem,2.2vw,1rem)] rounded-full border ${
                          item.isActive
                            ? 'border-teal-400 bg-teal-400'
                            : item.isFuture
                              ? 'border-neutral-300 bg-transparent'
                              : 'border-neutral-300 bg-neutral-300'
                        }`}
                      />
                    )}
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 10 6"
                      className={`h-[clamp(0.35rem,1vw,0.5rem)] w-[clamp(0.55rem,1.4vw,0.75rem)] fill-black transition-opacity ${item.isToday ? 'opacity-100' : 'opacity-0'}`}
                    >
                      <path d="M5 0 10 6H0z" />
                    </svg>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-[clamp(0.8rem,2.8vw,1.3rem)] pb-[clamp(0.2rem,1vw,0.75rem)] text-center">
            <div className="flex items-center justify-center gap-[clamp(0.4rem,1.8vw,0.65rem)] text-orange-500">
              <span aria-hidden="true" className="text-[clamp(1.75rem,6vw,2.35rem)] leading-none">{'\u{1F525}'}</span>
              <span className="text-[clamp(1.3rem,4.8vw,1.7rem)] font-semibold leading-none tracking-[-0.04em] text-neutral-900">
                {isLoading && !summary ? '...' : `${summary?.currentStreak ?? 0} DAYS`}
              </span>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

