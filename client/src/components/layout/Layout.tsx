import {
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AiAssistant from '../chat/AiAssistant';
import studyonLogo from '@/assets/Studyon_Logo.png';
import badgerImage from '@/assets/Badger_2.png';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/authService';

const levels = Array.from({ length: 7 }, (_, index) => index + 1);

const BADGES = [
  { emoji: '🎖️', label: 'First Step',  description: 'Join StudyOnd',          condition: (_streak: number, _level: number) => true },
  { emoji: '🔥', label: 'On Fire',     description: 'Reach a 3-day streak',    condition: (streak: number, _level: number) => streak >= 3 },
  { emoji: '🎓', label: 'Scholar',     description: 'Reach level 3',           condition: (_streak: number, level: number) => level >= 3 },
  { emoji: '🚀', label: 'Rocket',      description: 'Reach level 5',           condition: (_streak: number, level: number) => level >= 5 },
  { emoji: '💡', label: 'Innovator',   description: 'Reach level 6',           condition: (_streak: number, level: number) => level >= 6 },
  { emoji: '👑', label: 'Champion',    description: 'Complete all 7 levels',   condition: (_streak: number, level: number) => level >= 7 },
];

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const [activeLevel, setActiveLevel] = useState(() => user?.current_level ?? 1);
  const [unlockedLevel, setUnlockedLevel] = useState(() => user?.current_level ?? 1);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [levelLoading, setLevelLoading] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [dailyStreak, setDailyStreak] = useState(0);
  const [badgesOpen, setBadgesOpen] = useState(false);
  const [notification, setNotification] = useState<{ emoji: string; label: string } | null>(null);
  const [notifVisible, setNotifVisible] = useState(false);
  const prevUnlockedBadges = useRef<Set<string>>(new Set());
  const navigate = useNavigate();
  const roadmapRef = useRef<HTMLDivElement | null>(null);
  const levelUpTimeoutRef = useRef<number | null>(null);
  const dragState = useRef({ isDragging: false, startX: 0, scrollLeft: 0 });

  // Check for newly unlocked badges
  useEffect(() => {
    BADGES.forEach((badge) => {
      const unlocked = badge.condition(dailyStreak, unlockedLevel);
      const wasUnlocked = prevUnlockedBadges.current.has(badge.label);
      if (unlocked && !wasUnlocked && prevUnlockedBadges.current.size > 0) {
        setNotification({ emoji: badge.emoji, label: badge.label });
        setNotifVisible(true);
        setTimeout(() => setNotifVisible(false), 3500);
      }
      if (unlocked) prevUnlockedBadges.current.add(badge.label);
    });
  }, [dailyStreak, unlockedLevel]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;
    if (!container) return;
    if ((event.target as HTMLElement).closest('button')) return;
    dragState.current = { isDragging: true, startX: event.clientX, scrollLeft: container.scrollLeft };
    container.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;
    if (!container || !dragState.current.isDragging) return;
    container.scrollLeft = dragState.current.scrollLeft - (event.clientX - dragState.current.startX);
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    event.preventDefault();
    container.scrollLeft += delta;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    dragState.current.isDragging = false;
    if (roadmapRef.current?.hasPointerCapture(event.pointerId)) {
      roadmapRef.current.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    if (!user?.current_level) return;
    setUnlockedLevel(user.current_level);
    setActiveLevel((cur) => cur > user.current_level ? user.current_level : cur);
  }, [user?.current_level]);

  useEffect(() => {
    if ((user && typeof user.current_level === 'number') || !localStorage.getItem('token')) return;
    let isMounted = true;
    authService.me()
      .then(({ user: fetchedUser }) => {
        if (!isMounted) return;
        setUser(fetchedUser);
        setUnlockedLevel(fetchedUser.current_level);
        setActiveLevel(fetchedUser.current_level);
      })
      .catch(() => { if (isMounted) { logout(); navigate('/'); } });
    return () => { isMounted = false; };
  }, [logout, navigate, setUser, user]);

  useEffect(() => {
    return () => { if (levelUpTimeoutRef.current !== null) window.clearTimeout(levelUpTimeoutRef.current); };
  }, []);

  useEffect(() => {
    if (!localStorage.getItem('token')) return;
    let isMounted = true;
    authService.getStreakSummary()
      .then((summary) => { if (isMounted) setDailyStreak(summary.currentStreak); })
      .catch(() => { if (isMounted) setDailyStreak(0); });
    return () => { isMounted = false; };
  }, []);

  const updateLevel = async (action: 'reset' | 'progress') => {
    if (levelLoading) return;
    setLevelLoading(true);
    try {
      const response = action === 'reset' ? await authService.resetLevel() : await authService.progressLevel();
      const previousLevel = unlockedLevel;
      setUser(response.user);
      setUnlockedLevel(response.user.current_level);
      setActiveLevel(response.user.current_level);
      if (action === 'progress' && response.user.current_level > previousLevel) {
        setShowLevelUp(true);
        if (levelUpTimeoutRef.current !== null) window.clearTimeout(levelUpTimeoutRef.current);
        levelUpTimeoutRef.current = window.setTimeout(() => { setShowLevelUp(false); levelUpTimeoutRef.current = null; }, 500);
      }
    } finally {
      setLevelLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-300 text-neutral-950">

      {/* Level Up overlay */}
      {showLevelUp && (
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-yellow-300/85">
          <span className="text-5xl font-bold uppercase tracking-[0.3em] text-neutral-950">Level up</span>
        </div>
      )}

      {/* Achievement notification — always in DOM, slides in/out */}
      <div
        className={`fixed bottom-6 left-6 z-50 flex items-center gap-3 rounded-2xl bg-neutral-900 px-5 py-4 shadow-xl transition-all duration-500 ${
          notifVisible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0 pointer-events-none'
        }`}
      >
        <span className="text-3xl">{notification?.emoji}</span>
        <div>
          <p className="text-xs font-medium text-neutral-400">Achievement unlocked</p>
          <p className="text-sm font-bold text-white">{notification?.label}</p>
        </div>
      </div>

      {/* Badges modal */}
      {badgesOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setBadgesOpen(false)}
        >
          <div
            className="relative w-full max-w-md rounded-3xl bg-white px-8 py-8 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <button
              onClick={() => setBadgesOpen(false)}
              className="absolute right-4 top-4 rounded-lg p-2 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4">
                <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
              </svg>
            </button>

            <h2 className="mb-6 text-xl font-bold text-neutral-900">Your Badges</h2>

            <div className="grid grid-cols-3 gap-4">
              {BADGES.map((badge) => {
                const unlocked = badge.condition(dailyStreak, unlockedLevel);
                return (
                  <div key={badge.label} className="group relative">
                    <div
                      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 transition ${
                        unlocked
                          ? 'border-neutral-200 bg-neutral-50'
                          : 'border-neutral-100 bg-neutral-100 opacity-40 grayscale'
                      }`}
                    >
                      <span className="text-4xl">{badge.emoji}</span>
                      <span className="text-center text-xs font-medium text-neutral-600">{badge.label}</span>
                    </div>
                    {/* Tooltip */}
                    <div className="pointer-events-none absolute -top-10 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-neutral-900 px-3 py-1.5 text-xs text-white opacity-0 shadow-lg transition group-hover:opacity-100">
                      {badge.description}
                      <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <header className="flex h-[10vh] min-h-[72px] items-center justify-start bg-black px-4 sm:px-6 lg:px-8">
        <img src={studyonLogo} alt="Studyon logo" className="h-14 w-14 object-contain brightness-0 invert" />
        <button
          type="button"
          onClick={() => navigate('/streak')}
          className="ml-4 flex items-center gap-3 rounded-full bg-neutral-950/40 px-5 py-2.5 text-orange-400 transition hover:bg-neutral-950/60"
        >
          <span className="text-3xl leading-none">{'\u{1F525}'}</span>
          <span className="text-xl font-semibold text-orange-400">{dailyStreak} days</span>
        </button>
        <button
          type="button"
          onClick={() => setBadgesOpen(true)}
          className="ml-4 flex items-center gap-3 rounded-full bg-neutral-950/40 px-5 py-2.5 text-yellow-400 transition hover:bg-neutral-950/60"
        >
          <span className="text-3xl leading-none">🎖️</span>
          <span className="text-xl font-semibold text-yellow-400">Badges</span>
        </button>
        <div className="ml-auto">
          <button
            type="button"
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
          >
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </header>

      <main className="flex min-h-[90vh]">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[10vh] min-h-[88px] items-center border-b border-neutral-300 bg-neutral-100 px-4 sm:px-6 lg:px-8">
            <div
              ref={roadmapRef}
              className="roadmap-scroll w-full overflow-x-auto overflow-y-hidden py-3"
              onPointerDown={handlePointerDown}
              onPointerMove={handlePointerMove}
              onPointerUp={handlePointerUp}
              onPointerCancel={handlePointerUp}
              onPointerLeave={handlePointerUp}
              onWheel={handleWheel}
            >
              <div className="relative h-12 w-full min-w-[36rem] px-1 sm:min-w-[42rem]">
                <div className="absolute left-6 right-6 top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-200" />
                <div
                  className="absolute left-6 top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-700 transition-all"
                  style={{ width: `calc((100% - 3rem) * ${Math.max(0, (unlockedLevel - 1) / (levels.length - 1))})` }}
                />
                <div className="relative flex h-12 w-full flex-nowrap items-center justify-between gap-3 px-1 sm:gap-4">
                  {levels.map((level) => {
                    const isActive = level === activeLevel;
                    const isUnlocked = level <= unlockedLevel;
                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => isUnlocked && setActiveLevel(level)}
                        disabled={!isUnlocked}
                        className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition ${
                          isUnlocked
                            ? isActive
                              ? 'border-neutral-800 bg-neutral-800 text-white'
                              : 'border-neutral-300 bg-neutral-50 text-neutral-700 hover:border-neutral-500 hover:bg-white'
                            : 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400'
                        }`}
                      >
                        {isUnlocked ? level : (
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                            <path d="M16 10V8a4 4 0 1 0-8 0v2H7v10h10V10h-1Zm-6-2a2 2 0 1 1 4 0v2h-4V8Zm5 10H9v-6h6v6Z" />
                          </svg>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="flex-1 bg-white px-8 py-8">
            <div className="flex h-full min-h-[320px] flex-col rounded-[2.5rem] bg-neutral-200/70 px-8 py-8">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => updateLevel('reset')}
                  disabled={levelLoading}
                  className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reset Level
                </button>
                {activeLevel !== 7 && (
                  <button
                    type="button"
                    onClick={() => updateLevel('progress')}
                    disabled={levelLoading}
                    className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white transition hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Progress Level
                  </button>
                )}
              </div>
              <div className="flex flex-1 items-center justify-center">
                <p className="text-[clamp(7rem,20vw,16rem)] font-bold leading-none text-neutral-400/70">{activeLevel}</p>
              </div>
            </div>
            <Outlet />
          </div>
        </section>

        <div className="relative flex">
          {!assistantOpen && (
            <button
              onClick={() => setAssistantOpen(true)}
              className="absolute -left-12 top-1/2 z-10 -translate-y-1/2 overflow-hidden rounded-full shadow-lg transition hover:shadow-xl"
            >
              <img src={badgerImage} alt="Badger" className="h-20 w-20 object-cover" />
            </button>
          )}
          {assistantOpen && (
            <aside className="h-[90vh] min-h-[540px] w-[320px] shrink-0 border-l border-neutral-200 bg-white px-3 pl-4 py-8 text-neutral-900 lg:w-[380px]">
              <div className="relative flex justify-center">
                <img src={badgerImage} alt="Badger" className="h-24 w-24 rounded-full object-cover" />
                <button
                  onClick={() => setAssistantOpen(false)}
                  className="absolute left-0 -top-6 rounded-lg p-4 text-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                >
                  <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
                    <path d="M6 6L18 18M18 6L6 18" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
              <div className="mt-4 h-[calc(100%-6rem)] min-h-[280px]">
                <AiAssistant />
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}



