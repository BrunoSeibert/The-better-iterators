import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AiAssistant from '../chat/AiAssistant';
import Level2 from '@/pages/Level2';
import LiteratureReview from '@/pages/LiteratureReview';
import ResearchProposal from '@/pages/ResearchProposal';
import ResearchWorkspace from '@/pages/ResearchWorkspace';
import DailyCheckin from '@/components/DailyCheckin';
import CompletionModal from '@/components/CompletionModal';
import { DocumentReview } from '../document-review';
import ThesisPresentationTestMode from '../presentation-test/ThesisPresentationTestMode';
import studyonLogo from '@/assets/Study_Logo.png';
import badgerImage from '@/assets/Badger_2.png';
import scienceBadgerImage from '@/assets/ScienceBadger.png';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/authService';
import AchievementToast from '../AchievementToast';
import { BADGES } from '@/utils/badges';


const levels = Array.from({ length: 6 }, (_, index) => index + 1);
const topbarHeight = 'max(10vh, 72px)';
const assistantPanelWidth = 'clamp(320px, 32vw, 380px)';

type RectState = {
  top: number;
  left: number;
  width: number;
  height: number;
};

type HeartParticle = {
  id: number;
  left: number;
  top: number;
  size: number;
  duration: number;
  delay: number;
  driftX: number;
  driftY: number;
  scaleTo: number;
};


const LEVEL_NAMES: Record<number, string> = {
  1: 'Topic Selection', 2: 'Advisor Selection', 3: 'Research Proposal',
  4: 'Research', 5: 'Writing', 6: 'Defense Prep',
};

const UNLOCK_DEPS: Record<number, number[]> = {
  1: [], 2: [], 3: [1, 2], 4: [3], 5: [4], 6: [5],
};

function isLevelUnlocked(level: number, completedStages: number[]) {
  return UNLOCK_DEPS[level]?.every((dependency) => completedStages.includes(dependency)) ?? false;
}

function getFirstOpenLevel(completedStages: number[]) {
  return levels.find((level) => isLevelUnlocked(level, completedStages) && !completedStages.includes(level)) ?? 1;
}

function getFurthestUnlockedLevel(completedStages: number[]) {
  return [...levels].reverse().find((level) => isLevelUnlocked(level, completedStages)) ?? 1;
}

function getPreferredActiveLevel(currentLevel: number | undefined, completedStages: number[]) {
  if (
    typeof currentLevel === 'number' &&
    isLevelUnlocked(currentLevel, completedStages) &&
    !completedStages.includes(currentLevel)
  ) {
    return currentLevel;
  }

  return getFirstOpenLevel(completedStages);
}

export default function Layout() {
  const user = useAuthStore((s) => s.user);
  const setUser = useAuthStore((s) => s.setUser);
  const logout = useAuthStore((s) => s.logout);
  const completedStages = useMemo(() => user?.completedStages ?? [], [user?.completedStages]);
  const preferredActiveLevel = useMemo(() => getPreferredActiveLevel(user?.currentLevel, completedStages), [user?.currentLevel, completedStages]);
  const furthestUnlockedLevel = useMemo(() => getFurthestUnlockedLevel(completedStages), [completedStages]);
  const [activeLevel, setActiveLevel] = useState(() => {
    const stored = sessionStorage.getItem('activeLevel');
    if (stored) return parseInt(stored, 10);
    return preferredActiveLevel;
  });
  const [assistantOpen, setAssistantOpen] = useState(true);
  const [levelLoading, setLevelLoading] = useState(false);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [levelUpNumber, setLevelUpNumber] = useState<number | null>(null);
  const [levelUpExiting, setLevelUpExiting] = useState(false);
  const [dailyStreak, setDailyStreak] = useState<number | null>(() => authService.peekStreakSummary()?.currentStreak ?? null);
  const [levelSixFile, setLevelSixFile] = useState<File | null>(null);
  const [levelSixDragging, setLevelSixDragging] = useState(false);
  const [levelSixCorrecting, setLevelSixCorrecting] = useState(false);
  const [badgerTransition, setBadgerTransition] = useState<{
    from: RectState;
    to: RectState;
    phase: 'start' | 'end';
  } | null>(null);
  const navigate = useNavigate();
  const roadmapRef = useRef<HTMLDivElement | null>(null);
  const levelSixFileInputRef = useRef<HTMLInputElement | null>(null);
  const badgerButtonSlotRef = useRef<HTMLDivElement | null>(null);
  const assistantBadgerRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => { sessionStorage.setItem('activeLevel', String(activeLevel)); }, [activeLevel]);

  const badgerTransitionTimeoutRef = useRef<number | null>(null);
  const levelUpTimeoutRef = useRef<number | null>(null);
  const heartTimeoutsRef = useRef<number[]>([]);
  const heartIdRef = useRef(0);
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
  });

  const [achievementQueue, setAchievementQueue] = useState<typeof BADGES[number][]>([]);
  const [hearts, setHearts] = useState<HeartParticle[]>([]);
  const [checkinDone, setCheckinDone] = useState(() => {
    try {
      const raw = localStorage.getItem('todayCheckin');
      if (!raw) return false;
      return new Date(JSON.parse(raw).date).toDateString() === new Date().toDateString();
    } catch { return false; }
  });

  const [checkinOpen, setCheckinOpen] = useState(() => {
    try {
      const raw = localStorage.getItem('todayCheckin');
      if (!raw) return true;
      return new Date(JSON.parse(raw).date).toDateString() !== new Date().toDateString();
    } catch { return true; }
  });
  // True when there's no localStorage entry — hold the modal until DB confirms
  const [checkinVerifying, setCheckinVerifying] = useState(() => {
    try {
      const raw = localStorage.getItem('todayCheckin');
      if (!raw) return true;
      return new Date(JSON.parse(raw).date).toDateString() !== new Date().toDateString();
    } catch { return true; }
  });
  const [completionModal, setCompletionModal] = useState<{ level: number; value: string } | null>(null);
  const [completionLoading, setCompletionLoading] = useState(false);

  const prevUnlockedRef = useRef<Set<string>>(new Set());
  const isInitializedRef = useRef(false);

  const queueHeart = useCallback((heart: HeartParticle) => {
    setHearts((currentHearts) => [...currentHearts, heart]);

    const timeoutId = window.setTimeout(() => {
      setHearts((currentHearts) => currentHearts.filter((currentHeart) => currentHeart.id !== heart.id));
      heartTimeoutsRef.current = heartTimeoutsRef.current.filter((id) => id !== timeoutId);
    }, heart.duration + heart.delay + 400);

    heartTimeoutsRef.current.push(timeoutId);
  }, []);

  const spawnAmbientHeart = useCallback(() => {
    queueHeart({
      id: heartIdRef.current++,
      left: 78 + Math.random() * 18,
      top: 34 + Math.random() * 20,
      size: 14 + Math.random() * 10,
      duration: 2200 + Math.random() * 900,
      delay: Math.random() * 180,
      driftX: -16 + Math.random() * 18,
      driftY: -48 - Math.random() * 22,
      scaleTo: 1.08 + Math.random() * 0.18,
    });
  }, [queueHeart]);

  const handleAssistantBadgerClick = useCallback(() => {
    const heartCount = 3;

    for (let index = 0; index < heartCount; index += 1) {
      const angle = (Math.PI * 2 * index) / heartCount + (Math.random() - 0.5) * 0.32;
      const distance = 42 + Math.random() * 20;

      queueHeart({
        id: heartIdRef.current++,
        left: 50 + (Math.random() - 0.5) * 10,
        top: 50 + (Math.random() - 0.5) * 10,
        size: 18 + Math.random() * 8,
        duration: 620 + Math.random() * 180,
        delay: Math.random() * 40,
        driftX: Math.cos(angle) * distance,
        driftY: Math.sin(angle) * distance,
        scaleTo: 0.92 + Math.random() * 0.14,
      });
    }
  }, [queueHeart]);

  const applyLevelState = useCallback(
    async (refreshedUser: NonNullable<typeof user>, requestedActiveLevel?: number) => {
      const refreshedCompletedStages = refreshedUser.completedStages ?? [];
      const fallbackActiveLevel = getPreferredActiveLevel(
        refreshedUser.currentLevel,
        refreshedCompletedStages
      );
      const nextActiveLevel =
        typeof requestedActiveLevel === 'number'
        && isLevelUnlocked(requestedActiveLevel, refreshedCompletedStages)
          ? requestedActiveLevel
          : fallbackActiveLevel;

      setUser(refreshedUser);
      setActiveLevel(nextActiveLevel);

      if (!isInitializedRef.current) {
        const level = refreshedUser.currentLevel ?? 0;
        let streak = 0;
        try {
          const [summary, checkedInToday] = await Promise.all([
            authService.getStreakSummary({ force: true }),
            authService.getTodayCheckin(),
          ]);
          streak = summary.currentStreak;
          setDailyStreak(streak);
          setCheckinOpen(!checkedInToday);
        } catch {
          streak = 0;
        }
        setCheckinVerifying(false);
        prevUnlockedRef.current = new Set(
          BADGES.filter((b) => b.condition(streak, level)).map((b) => b.label)
        );
        isInitializedRef.current = true;
      }


      return {
        user: refreshedUser,
        activeLevel: nextActiveLevel,
        unlockedLevel: getFurthestUnlockedLevel(refreshedCompletedStages),
      };
    },
    [setUser]
  );

  const refreshLevelState = useCallback(
    async (requestedActiveLevel?: number) => {
      const { user: refreshedUser } = await authService.me();
      return applyLevelState(refreshedUser, requestedActiveLevel);
    },
    [applyLevelState]
  );

  const handlePointerDown = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;
    if (!container) return;
    const target = event.target as HTMLElement;
    if (target.closest('button')) return;
    dragState.current = { isDragging: true, startX: event.clientX, scrollLeft: container.scrollLeft };
    container.setPointerCapture(event.pointerId);
  }, []);

  const handlePointerMove = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;
    if (!container || !dragState.current.isDragging) return;
    container.scrollLeft = dragState.current.scrollLeft - (event.clientX - dragState.current.startX);
  }, []);

  const handleWheel = useCallback((event: ReactWheelEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;
    if (!container || container.scrollWidth <= container.clientWidth) return;
    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY;
    if (delta === 0) return;
    event.preventDefault();
    container.scrollLeft += delta;
  }, []);

  const handlePointerUp = useCallback((event: ReactPointerEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;
    dragState.current.isDragging = false;
    if (container?.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId);
  }, []);

  useEffect(() => {
    if (!user) {
      return;
    }

    setActiveLevel((currentActiveLevel) =>
      isLevelUnlocked(currentActiveLevel, completedStages) ? currentActiveLevel : preferredActiveLevel
    );
  }, [completedStages, preferredActiveLevel, user]);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      return;
    }

    let isMounted = true;

    const storedLevel = parseInt(sessionStorage.getItem('activeLevel') ?? '', 10) || undefined;
    refreshLevelState(storedLevel)
      .catch(() => {
        if (!isMounted) {
          return;
        }

        logout();
        navigate('/');
      });

    return () => {
      isMounted = false;
    };
  }, [logout, navigate, refreshLevelState]);

  useEffect(() => {
    return () => {
      if (levelUpTimeoutRef.current !== null) {
        window.clearTimeout(levelUpTimeoutRef.current);
      }
      if (badgerTransitionTimeoutRef.current !== null) {
        window.clearTimeout(badgerTransitionTimeoutRef.current);
      }
      heartTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
    };
  }, []);

  useEffect(() => {
    const handler = (e: Event) => {
      const unlockedLevel = (e as CustomEvent<{ unlockedLevel: number }>).detail?.unlockedLevel;
      setLevelUpNumber(unlockedLevel ?? null);
      setLevelUpExiting(false);
      setShowLevelUp(true);
      if (levelUpTimeoutRef.current !== null) window.clearTimeout(levelUpTimeoutRef.current);
      levelUpTimeoutRef.current = window.setTimeout(() => {
        setLevelUpExiting(true);
        window.setTimeout(() => {
          setShowLevelUp(false);
          setLevelUpExiting(false);
          levelUpTimeoutRef.current = null;
        }, 400);
      }, 1500);
    };
    window.addEventListener('level-up', handler);
    return () => window.removeEventListener('level-up', handler);
  }, []);

  useEffect(() => {
    if (!completionModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCompletionModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [completionModal]);

  useEffect(() => {
    if (!assistantOpen) {
      setHearts([]);
      heartTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      heartTimeoutsRef.current = [];
      return;
    }

    const intervalId = window.setInterval(spawnAmbientHeart, 5000);

    return () => {
      window.clearInterval(intervalId);
      heartTimeoutsRef.current.forEach((timeoutId) => window.clearTimeout(timeoutId));
      heartTimeoutsRef.current = [];
      setHearts([]);
    };
  }, [assistantOpen, spawnAmbientHeart]);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      return;
    }

    let isMounted = true;

    authService
      .getStreakSummary({ force: true })
      .then((summary) => {
        if (isMounted) {
          setDailyStreak(summary.currentStreak);
        }
      })
      .catch(() => {
        if (isMounted && authService.peekStreakSummary() === null) {
          setDailyStreak(0);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const level = user?.currentLevel ?? 0;
  const resolvedDailyStreak = dailyStreak ?? 0;

  useEffect(() => {
    if (!isInitializedRef.current) return;
    
    const newlyUnlocked = BADGES.filter((badge) => {
      const isUnlocked = badge.condition(resolvedDailyStreak, level);
      const wasUnlocked = prevUnlockedRef.current.has(badge.label);
      return isUnlocked && !wasUnlocked;
    });

    prevUnlockedRef.current = new Set(
      BADGES.filter((b) => b.condition(resolvedDailyStreak, level)).map((b) => b.label)
    );

    if (newlyUnlocked.length > 0) {
      setAchievementQueue((prev) => [...prev, ...newlyUnlocked]);
    }
  }, [level, resolvedDailyStreak]);

  const updateLevel = async (action: 'reset' | 'progress') => {
    if (levelLoading) {
      return;
    }

    setLevelLoading(true);

    try {

      const refreshedState = action === 'reset'
        ? await (async () => {
        const { user: refreshedUser } = await authService.resetLevel();
            return applyLevelState(refreshedUser);
          })()
        : await (async () => {
            const { user: refreshedUser } = await authService.progressLevel();
            return applyLevelState(refreshedUser);
          })();

      if (action === 'progress') {
        setLevelUpNumber(refreshedState.unlockedLevel);
        setLevelUpExiting(false);
        setShowLevelUp(true);
        if (levelUpTimeoutRef.current !== null) {
          window.clearTimeout(levelUpTimeoutRef.current);
        }
        // start exit animation at 2.6s, unmount at 3s
        levelUpTimeoutRef.current = window.setTimeout(() => {
          setLevelUpExiting(true);
          window.setTimeout(() => {
            setShowLevelUp(false);
            setLevelUpExiting(false);
            levelUpTimeoutRef.current = null;
          }, 400);
        }, 1500);
      }
    } finally {
      setLevelLoading(false);
    }
  };

  const handleLevelSelect = useCallback((level: number) => {
    if (levelLoading) return;
    if (isLevelUnlocked(level, completedStages)) setActiveLevel(level);
  }, [levelLoading, completedStages]);

  const handleLevelSixFile = (file: File | null) => {
    if (!file) {
      return;
    }

    setLevelSixFile(file);
    setLevelSixCorrecting(true);
    setLevelSixDragging(false);
  };

  const handleLevelSixFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    handleLevelSixFile(event.target.files?.[0] ?? null);
  };

  const handleLevelSixDrop = (event: DragEvent<HTMLLabelElement>) => {
    event.preventDefault();
    setLevelSixDragging(false);
    handleLevelSixFile(event.dataTransfer.files?.[0] ?? null);
  };

  const resetLevelSixFileState = () => {
    setLevelSixFile(null);
    setLevelSixCorrecting(false);
    setLevelSixDragging(false);

    if (levelSixFileInputRef.current) {
      levelSixFileInputRef.current.value = '';
    }
  };

  const openAssistant = () => {
    setAssistantOpen(true);
  };

  const handleMarkComplete = async () => {
    if (!completionModal) return;
    const { level, value } = completionModal;
    if ([1, 2, 3].includes(level) && !value.trim()) return;
    setCompletionLoading(true);
    try {
      const result = await authService.completeLevel(level);
      if ([1, 2, 3].includes(level)) {
        await authService.setLevelMetadata(level, value.trim());
      }
      setCompletionModal(null);
      const refreshedState = await applyLevelState(result.user);
      setLevelUpNumber(refreshedState.unlockedLevel);
      setLevelUpExiting(false);
      setShowLevelUp(true);
      if (levelUpTimeoutRef.current !== null) window.clearTimeout(levelUpTimeoutRef.current);
      levelUpTimeoutRef.current = window.setTimeout(() => {
        setLevelUpExiting(true);
        window.setTimeout(() => {
          setShowLevelUp(false);
          setLevelUpExiting(false);
          levelUpTimeoutRef.current = null;
        }, 400);
      }, 1500);
    } finally {
      setCompletionLoading(false);
    }
  };

  const handleCheckinButtonClick = () => {
    setCheckinOpen(true);
  };

const closeAssistant = () => {
    const source = assistantBadgerRef.current?.getBoundingClientRect();
    const target = badgerButtonSlotRef.current?.getBoundingClientRect();

    if (!source || !target) {
      setAssistantOpen(false);
      return;
    }

    const from = {
      top: source.top,
      left: source.left,
      width: source.width,
      height: source.height,
    };
    const to = {
      top: target.top,
      left: target.left,
      width: target.width,
      height: target.height,
    };

    if (badgerTransitionTimeoutRef.current !== null) {
      window.clearTimeout(badgerTransitionTimeoutRef.current);
    }

    setBadgerTransition({ from, to, phase: 'start' });
    setAssistantOpen(false);

    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        setBadgerTransition((current) =>
          current ? { ...current, phase: 'end' } : null
        );
      });
    });

    badgerTransitionTimeoutRef.current = window.setTimeout(() => {
      setBadgerTransition(null);
      badgerTransitionTimeoutRef.current = null;
    }, 320);
  };

  const badgerTransitionStyle: CSSProperties | undefined = badgerTransition
    ? {
        top: badgerTransition.phase === 'start'
          ? badgerTransition.from.top
          : badgerTransition.to.top,
        left: badgerTransition.phase === 'start'
          ? badgerTransition.from.left
          : badgerTransition.to.left,
        width: badgerTransition.phase === 'start'
          ? badgerTransition.from.width
          : badgerTransition.to.width,
        height: badgerTransition.phase === 'start'
          ? badgerTransition.from.height
          : badgerTransition.to.height,
      }
    : undefined;
  const showTopbarBadgerImage = !assistantOpen && !badgerTransition;
  const showTopbarBadgerButton = !assistantOpen || Boolean(badgerTransition);

  return (
    <div className="min-h-screen bg-neutral-300 text-neutral-950">
      {showLevelUp && (
        <div
          className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', animation: 'levelup-backdrop-in 0.3s ease forwards' }}
        >
          <div
            className="flex flex-col items-center gap-5 px-14 py-10 text-center"
            style={{
              backgroundColor: 'rgba(250,250,250,1)',
              border: '2px solid rgba(212,212,216,1)',
              borderRadius: 18,
              boxShadow: '0 8px 40px rgba(0,0,0,0.12)',
              animation: levelUpExiting ? 'levelup-card-out 0.4s ease forwards' : 'levelup-card-in 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards',
            }}
          >
            <div
              className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(38,38,38,1)', animation: 'levelup-check 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.15s both' }}
            >
              <svg viewBox="0 0 24 24" className="h-8 w-8" style={{ fill: 'rgba(250,250,250,1)' }}>
                <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(113,113,122,1)' }}>Congratulations</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(38,38,38,1)' }}>One step closer to your thesis</p>
              {levelUpNumber && (
                <p className="mt-2 text-sm" style={{ color: 'rgba(113,113,122,1)' }}>{LEVEL_NAMES[levelUpNumber]} is now unlocked</p>
              )}
            </div>
          </div>
        </div>
      )}
      <header className="fixed inset-x-0 top-0 z-30 flex h-[10vh] min-h-[72px] items-center justify-start bg-neutral-800 px-4 sm:px-6 lg:px-8">
        <img
          src={studyonLogo}
          alt="Studyon logo"
          className="h-12 w-12 object-contain brightness-0 invert"
        />
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="ml-2 flex items-center gap-2 rounded-md px-4 py-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
          aria-label="Back to Dashboard"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2Z"/>
          </svg>
          <span className="text-sm font-medium">Dashboard</span>
        </button>
        <div className="ml-8 flex items-center gap-3 lg:ml-12">
          <button
            type="button"
            onClick={() => updateLevel('reset')}
            disabled={levelLoading}
            className="invisible pointer-events-none rounded-full border border-neutral-700 bg-neutral-900 px-5 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
            aria-hidden="true"
            tabIndex={-1}
          >
            Reset Level
          </button>
        </div>
        <div className="ml-auto flex items-center gap-1">
        
          <button
            onClick={handleCheckinButtonClick}
            className={`hidden rounded-xl border px-3 py-1.5 text-xs font-semibold shadow-sm transition ${checkinDone ? 'border-green-200 bg-green-50 text-green-700 hover:bg-green-100' : 'border-neutral-200 bg-white text-neutral-600 hover:bg-neutral-50'}`}
          >
            {checkinDone ? '✓ Checked in' : 'Daily check-in'}
          </button>
        <div ref={badgerButtonSlotRef} className="relative h-12 w-12 shrink-0">
          {showTopbarBadgerButton && (
            <button
              type="button"
              onClick={openAssistant}
              className="relative h-full w-full overflow-hidden rounded-[15%] transition hover:opacity-80"
              aria-label="Show AI Assistant"
            >
              <span className="absolute left-1.5 top-1.5 z-10 h-2.5 w-2.5 rounded-full bg-red-500" />
              {showTopbarBadgerImage && (
                <img
                  src={badgerImage}
                  alt="Badger"
                  className="h-full w-full rounded-[15%] object-cover"
                />
              )}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={() => navigate('/streak')}
          className="flex items-center gap-1.5 rounded-md px-5 py-2.5 text-orange-400 transition hover:bg-white/5"
          aria-label="Open streak page"
        >
          <span aria-hidden="true" className="text-3xl leading-none">{'\u{1F525}'}</span>
          <span
            className="text-[1.45rem] leading-none text-orange-400"
            style={{ fontFamily: '"Arial Black", "Avenir Next", sans-serif', fontWeight: 900 }}
          >
            {dailyStreak === null ? '...' : dailyStreak}
          </span>
        </button>
        <button
          type="button"
          onClick={() => navigate('/profile', { state: { returnTo: '/app' } })}
          className="flex items-center gap-2 rounded-md px-5 py-3 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
          aria-label="Profile"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
            <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12Zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8Z"/>
          </svg>
          <span className="text-sm font-medium">Profile</span>
        </button>
      </div>

      </header>

      <main
        className="min-h-screen pt-[max(10vh,72px)] transition-[padding-right] duration-200"
        style={{ paddingRight: assistantOpen ? assistantPanelWidth : '0px' }}
      >
        <section className="flex min-w-0 flex-col min-h-[calc(100vh-max(10vh,72px))]">
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
              <div className="relative h-14 w-full min-w-[36rem] px-1 sm:min-w-[42rem]">
                <div className="absolute left-6 right-6 top-1/2 h-[3px] -translate-y-1/2 rounded-sm border border-[rgba(196,177,160,0.55)] bg-neutral-200" />
                <div
                  className="absolute left-6 top-1/2 h-[3px] -translate-y-1/2 rounded-sm border border-[rgba(196,177,160,0.88)] bg-[rgba(206,183,161,1)] transition-all"
                  style={{
                    width: `calc((100% - 3rem) * ${Math.max(0, (furthestUnlockedLevel - 1) / (levels.length - 1))})`,
                  }}
                />

                <div className="relative flex h-14 w-full flex-nowrap items-center justify-between gap-3 px-1 sm:gap-4">
                  {levels.map((level) => {
                    const isActive = level === activeLevel;
                    const isUnlocked = isLevelUnlocked(level, completedStages);
                    const isCompleted = completedStages.includes(level);

                    return (
                      <button
                        key={level}
                        type="button"
                        onClick={() => isUnlocked && void handleLevelSelect(level)}
                        disabled={!isUnlocked}
                        className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-[0.4rem] border-2 text-base font-bold shadow-[0_1px_0_rgba(81,60,45,0.08)] transition ${
                          isActive
                            ? 'border-[rgba(81,60,45,1)] bg-[rgba(81,60,45,1)] text-[rgba(252,248,243,1)]'
                            : isCompleted
                              ? 'border-[rgba(150,201,89,1)] bg-[rgba(224,252,190,1)] text-[rgba(58,110,31,1)] hover:border-[rgba(132,186,73,1)] hover:bg-[rgba(232,255,205,1)]'
                            : isUnlocked
                              ? 'border-[rgba(196,177,160,1)] bg-[rgba(231,214,194,1)] text-[rgba(95,72,54,1)] hover:border-[rgba(175,152,130,1)] hover:bg-[rgba(238,223,205,1)]'
                            : 'cursor-not-allowed border-neutral-300 bg-neutral-100 text-neutral-400'
                        }`}
                        aria-pressed={isActive}
                        aria-label={isUnlocked ? `Show level ${level}` : `Level ${level} is locked`}
                      >
                        {isCompleted ? (
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                            <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
                          </svg>
                        ) : isUnlocked ? (
                          level
                        ) : (
                          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
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

          {completedStages.length < levels.length && !completedStages.includes(activeLevel) && (
            <div className="flex items-center justify-end bg-neutral-100 border-b border-neutral-200 px-4 py-2">
              <button
                type="button"
                onClick={() => setCompletionModal({ level: activeLevel, value: '' })}
                disabled={levelLoading}
                className="rounded-full border border-neutral-300 bg-white px-4 py-1.5 text-xs font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Mark complete ✓
              </button>
            </div>
          )}

          <div className="flex flex-1 bg-white px-2 py-2 sm:px-3 sm:py-3 overflow-visible">
            <div
              className={`flex flex-1 rounded-md ${
                levelSixCorrecting || activeLevel === 2
                  ? 'bg-transparent p-0 overflow-visible'
                  : activeLevel === 6
                    ? 'bg-neutral-200/70 p-3 overflow-visible'
                  : 'bg-neutral-200/70 p-3 overflow-visible'
              }`}
            >
              {activeLevel === 1 && <LiteratureReview />}
              {activeLevel === 2 && <Level2 />}
              {activeLevel === 3 && <ResearchProposal onMarkComplete={() => setCompletionModal({ level: 3, value: '' })} />}
              {activeLevel === 4 && <ResearchWorkspace />}
              {activeLevel === 5 && (
                levelSixCorrecting ? (
                  levelSixFile ? (
                    <DocumentReview
                      file={levelSixFile}
                      onChangeDocument={resetLevelSixFileState}
                      assistantOpen={assistantOpen}
                    />
                  ) : null
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-4 overflow-visible">
                    <div className="relative z-10 flex w-full items-start overflow-visible">
                      <div className="max-w-[34rem] flex-1 pl-4 text-left pr-40">
                        <h2 className="text-3xl font-semibold text-neutral-800">Get Thesis Feedback</h2>
                        <p className="mt-2 text-sm leading-6 text-neutral-500">Upload your draft to see detailed comments on what works and what to improve.</p>
                      </div>
                      <img
                        src={scienceBadgerImage}
                        alt="Science badger mascot"
                        className="pointer-events-none absolute left-[80%] -top-1 z-20 h-40 w-40 -translate-x-1/2 object-contain"
                      />
                    </div>
                    <label
                      onDragOver={(event) => {
                        event.preventDefault();
                        setLevelSixDragging(true);
                      }}
                      onDragLeave={() => setLevelSixDragging(false)}
                      onDrop={handleLevelSixDrop}
                      className={`group flex h-[80%] w-full cursor-pointer flex-col items-center justify-center rounded-md border-2 border-dashed px-6 text-center transition ${
                        levelSixDragging
                          ? 'border-neutral-600 bg-neutral-100'
                          : 'border-neutral-300 bg-white'
                      }`}
                    >
                      <input
                        ref={levelSixFileInputRef}
                        type="file"
                        accept=".pdf,.doc,.docx,.txt,.rtf"
                        onChange={handleLevelSixFileChange}
                        className="hidden"
                      />
                      <span className="text-lg font-medium text-neutral-700">
                        Drag to insert file
                      </span>
                      <span className="mt-2 text-sm text-neutral-400">
                        PDF, DOC, DOCX, TXT, RTF
                      </span>
                      <span className="mt-5 rounded-[0.32rem] border-2 border-[rgba(166,166,166,0.82)] bg-[rgba(246,246,246,0.98)] px-5 py-2 text-sm font-medium text-[rgba(79,79,79,0.96)] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.6)] transition group-hover:border-[rgba(132,132,132,0.9)] group-hover:bg-[rgba(250,250,250,0.99)] group-hover:text-[rgba(47,47,47,0.96)]">
                        Choose file
                      </span>
                      {levelSixFile && (
                        <span className="mt-4 rounded-full bg-neutral-100 px-4 py-2 text-sm text-neutral-700">
                          {levelSixFile.name}
                        </span>
                      )}
                    </label>
                  </div>
                )
              )}
              {activeLevel === 6 && <ThesisPresentationTestMode />}
            </div>
            <Outlet />
          </div>
        </section>

      </main>

      {assistantOpen && (
        <aside
          className="fixed right-0 z-20 border-l border-neutral-200 bg-white px-3 py-8 pl-4 text-neutral-900"
          style={{
            top: topbarHeight,
            height: `calc(100vh - ${topbarHeight})`,
            width: assistantPanelWidth,
          }}
        >
          <div className="relative flex justify-center">
            <button
              type="button"
              onClick={handleAssistantBadgerClick}
              className="relative flex justify-center overflow-visible border-0 bg-transparent p-0 focus:outline-none"
              aria-label="Celebrate with the AI assistant"
            >
              <img
                ref={assistantBadgerRef}
                src={badgerImage}
                alt="Badger"
                className="h-24 w-24 rounded-full object-cover"
              />
              <div className="pointer-events-none absolute inset-0 overflow-visible" aria-hidden="true">
                {hearts.map((heart) => (
                  <span
                    key={heart.id}
                    className="absolute select-none text-[rgba(198,24,24,0.46)] drop-shadow-[0_2px_5px_rgba(160,16,16,0.18)]"
                    style={{
                      left: `${heart.left}%`,
                      top: `${heart.top}%`,
                      fontSize: `${heart.size}px`,
                      ['--assistant-heart-drift-x' as string]: `${heart.driftX}px`,
                      ['--assistant-heart-drift-y' as string]: `${heart.driftY}px`,
                      ['--assistant-heart-scale-to' as string]: `${heart.scaleTo}`,
                      animation: `assistant-heart-float ${heart.duration}ms ease-out ${heart.delay}ms forwards`,
                    }}
                  >
                    {String.fromCharCode(0x2665)}
                  </span>
                ))}
              </div>
            </button>
            <button
              onClick={closeAssistant}
              className="absolute left-0 -top-6 rounded-lg p-4 text-xl text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
              aria-label="Close AI Assistant"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24" className="h-3.5 w-3.5">
                <path
                  d="M6 6L18 18M18 6L6 18"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.8"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
          <div className="mt-4 h-[calc(100%-6rem)] min-h-[280px]">
            <AiAssistant />
          </div>
        </aside>
      )}

      {badgerTransition && (
        <div
          className="pointer-events-none fixed z-40 overflow-hidden rounded-[15%] transition-[top,left,width,height] duration-300 ease-out"
          style={badgerTransitionStyle}
          aria-hidden="true"
        >
          <img
            src={badgerImage}
            alt=""
            className="h-full w-full rounded-[15%] object-cover shadow-[0_18px_40px_-20px_rgba(23,23,23,0.85)]"
          />
        </div>
      )}
      <div className="pointer-events-none fixed bottom-6 left-6 z-50 flex flex-col gap-3">
        {achievementQueue.slice(0, 3).map((badge) => (
          <AchievementToast
            key={badge.label}
            emoji={badge.emoji}
            label={badge.label}
            description={badge.description}
            onDone={() =>
              setAchievementQueue((prev) => prev.filter((b) => b.label !== badge.label))
            }
          />
        ))}
      </div>

      {completionModal !== null && (
        <CompletionModal
          level={completionModal.level}
          value={completionModal.value}
          loading={completionLoading}
          onChange={(v) => setCompletionModal({ level: completionModal.level, value: v })}
          onConfirm={handleMarkComplete}
          onClose={() => setCompletionModal(null)}
        />
      )}

      {/* Daily check-in modal */}
      {checkinOpen && !checkinVerifying && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(24,24,27,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => setCheckinOpen(false)}
        >
          <div
            className="relative w-full mx-4 overflow-y-auto"
            style={{
              maxWidth: 600, maxHeight: '90vh',
              backgroundColor: 'rgba(250,250,250,1)',
              border: '2px solid rgba(212,212,216,1)',
              borderRadius: 14,
              padding: '2rem',
              boxShadow: '0 8px 40px rgba(0,0,0,0.1)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(113,113,122,1)' }}>
                Daily check-in
              </p>
              <button
                onClick={() => setCheckinOpen(false)}
                style={{ fontSize: 16, color: 'rgba(113,113,122,1)', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}
              >
                ✕
              </button>
            </div>
            <DailyCheckin onComplete={() => { setCheckinDone(true); }} />
          </div>
        </div>
      )}
    </div>
  );
}

