import {
  type CSSProperties,
  type ChangeEvent,
  type DragEvent,
  useEffect,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import AiAssistant from '../chat/AiAssistant';
import Level2 from '@/pages/Level2';
import studyonLogo from '@/assets/Studyon_Logo.png';
import badgerImage from '@/assets/Badger_2.png';
import { useAuthStore } from '@/store/authStore';
import * as authService from '@/services/authService';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

const levels = Array.from({ length: 7 }, (_, index) => index + 1);
const topbarHeight = 'max(10vh, 72px)';
const assistantPanelWidth = 'clamp(320px, 32vw, 380px)';
const getAssistantPanelPixels = (viewportWidth: number) =>
  Math.min(380, Math.max(320, viewportWidth * 0.32));
const getPdfPreviewWidth = (
  viewportWidth: number,
  isAssistantOpen: boolean,
  containerWidth?: number
) => {
  const fallbackWidth =
    viewportWidth - (isAssistantOpen ? getAssistantPanelPixels(viewportWidth) : 0) - 176;
  const availableWidth = containerWidth ?? fallbackWidth;

  return Math.max(220, Math.min(760, Math.floor(availableWidth - 96)));
};

type RectState = {
  top: number;
  left: number;
  width: number;
  height: number;
};

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
  const [levelSixFile, setLevelSixFile] = useState<File | null>(null);
  const [levelSixDragging, setLevelSixDragging] = useState(false);
  const [levelSixCorrecting, setLevelSixCorrecting] = useState(false);
  const [levelSixPreviewKind, setLevelSixPreviewKind] = useState<
    'text' | 'pdf' | 'document' | null
  >(null);
  const [levelSixPdfPages, setLevelSixPdfPages] = useState(0);
  const [levelSixPdfRenderWidth, setLevelSixPdfRenderWidth] = useState(() =>
    typeof window === 'undefined' ? 220 : getPdfPreviewWidth(window.innerWidth, true)
  );
  const [levelSixPreviewText, setLevelSixPreviewText] = useState('');
  const [levelSixPreviewUrl, setLevelSixPreviewUrl] = useState<string | null>(null);
  const [badgerTransition, setBadgerTransition] = useState<{
    from: RectState;
    to: RectState;
    phase: 'start' | 'end';
  } | null>(null);
  const navigate = useNavigate();
  const roadmapRef = useRef<HTMLDivElement | null>(null);
  const levelSixFileInputRef = useRef<HTMLInputElement | null>(null);
  const levelSixPdfContainerRef = useRef<HTMLDivElement | null>(null);
  const badgerButtonSlotRef = useRef<HTMLDivElement | null>(null);
  const assistantBadgerRef = useRef<HTMLImageElement | null>(null);
  const badgerTransitionTimeoutRef = useRef<number | null>(null);
  const levelUpTimeoutRef = useRef<number | null>(null);
  const dragState = useRef({
    isDragging: false,
    startX: 0,
    scrollLeft: 0,
  });

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;

    if (!container) {
      return;
    }

    const target = event.target as HTMLElement;

    if (target.closest('button')) {
      return;
    }

    dragState.current = {
      isDragging: true,
      startX: event.clientX,
      scrollLeft: container.scrollLeft,
    };

    container.setPointerCapture(event.pointerId);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;

    if (!container || !dragState.current.isDragging) {
      return;
    }

    const deltaX = event.clientX - dragState.current.startX;
    container.scrollLeft = dragState.current.scrollLeft - deltaX;
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;

    if (!container) {
      return;
    }

    if (container.scrollWidth <= container.clientWidth) {
      return;
    }

    const delta = Math.abs(event.deltaX) > Math.abs(event.deltaY)
      ? event.deltaX
      : event.deltaY;

    if (delta === 0) {
      return;
    }

    event.preventDefault();
    container.scrollLeft += delta;
  };

  const handlePointerUp = (event: ReactPointerEvent<HTMLDivElement>) => {
    const container = roadmapRef.current;

    dragState.current.isDragging = false;

    if (container?.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId);
    }
  };

  useEffect(() => {
    if (!user?.current_level) {
      return;
    }

    setUnlockedLevel(user.current_level);
    setActiveLevel((currentActiveLevel) =>
      currentActiveLevel > user.current_level ? user.current_level : currentActiveLevel
    );
  }, [user?.current_level]);

  useEffect(() => {
    if ((user && typeof user.current_level === 'number') || !localStorage.getItem('token')) {
      return;
    }

    let isMounted = true;

    authService
      .me()
      .then(({ user: fetchedUser }) => {
        if (!isMounted) {
          return;
        }

        setUser(fetchedUser);
        setUnlockedLevel(fetchedUser.current_level);
        setActiveLevel(fetchedUser.current_level);
      })
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
  }, [logout, navigate, setUser, user]);

  useEffect(() => {
    return () => {
      if (levelUpTimeoutRef.current !== null) {
        window.clearTimeout(levelUpTimeoutRef.current);
      }
      if (badgerTransitionTimeoutRef.current !== null) {
        window.clearTimeout(badgerTransitionTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (levelSixPreviewKind !== 'pdf') {
      return;
    }

    const updateWidth = () => {
      const viewportWidth = window.innerWidth;
      const containerWidth = levelSixPdfContainerRef.current?.clientWidth;
      const nextWidth = getPdfPreviewWidth(viewportWidth, assistantOpen, containerWidth);
      setLevelSixPdfRenderWidth(nextWidth);
    };

    updateWidth();

    const container = levelSixPdfContainerRef.current;
    if (!container) {
      window.addEventListener('resize', updateWidth);

      return () => {
        window.removeEventListener('resize', updateWidth);
      };
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(container);
    window.addEventListener('resize', updateWidth);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateWidth);
    };
  }, [assistantOpen, levelSixPreviewKind]);

  useEffect(() => {
    if (!levelSixFile) {
      setLevelSixPreviewKind(null);
      setLevelSixPdfPages(0);
      setLevelSixPreviewText('');
      setLevelSixPreviewUrl(null);
      return;
    }

    let isMounted = true;
    let objectUrl: string | null = null;
    const extension = levelSixFile.name.split('.').pop()?.toLowerCase() ?? '';

    const loadPreview = async () => {
      if (['txt', 'md', 'rtf'].includes(extension) || levelSixFile.type.startsWith('text/')) {
        const text = await levelSixFile.text();

        if (!isMounted) {
          return;
        }

        setLevelSixPreviewKind('text');
        setLevelSixPdfPages(0);
        setLevelSixPreviewText(text);
        setLevelSixPreviewUrl(null);
        return;
      }

      if (extension === 'pdf' || levelSixFile.type === 'application/pdf') {
        objectUrl = URL.createObjectURL(levelSixFile);

        if (!isMounted) {
          return;
        }

        setLevelSixPreviewKind('pdf');
        setLevelSixPdfPages(0);
        setLevelSixPdfRenderWidth(getPdfPreviewWidth(window.innerWidth, assistantOpen));
        setLevelSixPreviewText('');
        setLevelSixPreviewUrl(objectUrl);
        return;
      }

      objectUrl = URL.createObjectURL(levelSixFile);

      if (!isMounted) {
        return;
      }

      setLevelSixPreviewKind('document');
      setLevelSixPdfPages(0);
      setLevelSixPreviewText('');
      setLevelSixPreviewUrl(objectUrl);
    };

    loadPreview().catch(() => {
      if (!isMounted) {
        return;
      }

      setLevelSixPreviewKind('document');
      setLevelSixPdfPages(0);
      setLevelSixPreviewText('');
      setLevelSixPreviewUrl(null);
    });

    return () => {
      isMounted = false;
      if (objectUrl) {
        URL.revokeObjectURL(objectUrl);
      }
    };
  }, [levelSixFile]);

  useEffect(() => {
    if (!localStorage.getItem('token')) {
      return;
    }

    let isMounted = true;

    authService
      .getStreakSummary()
      .then((summary) => {
        if (isMounted) {
          setDailyStreak(summary.currentStreak);
        }
      })
      .catch(() => {
        if (isMounted) {
          setDailyStreak(0);
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const updateLevel = async (action: 'reset' | 'progress') => {
    if (levelLoading) {
      return;
    }

    setLevelLoading(true);

    try {
      const response =
        action === 'reset'
          ? await authService.resetLevel()
          : await authService.progressLevel();

      const previousLevel = unlockedLevel;
      setUser(response.user);
      setUnlockedLevel(response.user.current_level);
      setActiveLevel(response.user.current_level);

      if (action === 'progress' && response.user.current_level > previousLevel) {
        setShowLevelUp(true);
        if (levelUpTimeoutRef.current !== null) {
          window.clearTimeout(levelUpTimeoutRef.current);
        }
        levelUpTimeoutRef.current = window.setTimeout(() => {
          setShowLevelUp(false);
          levelUpTimeoutRef.current = null;
        }, 500);
      }
    } finally {
      setLevelLoading(false);
    }
  };

  const handleLevelSixFile = (file: File | null) => {
    if (!file) {
      return;
    }

    setLevelSixFile(file);
    setLevelSixCorrecting(false);
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
    setLevelSixPreviewKind(null);
    setLevelSixPdfPages(0);
    setLevelSixPreviewText('');
    setLevelSixPreviewUrl(null);

    if (levelSixFileInputRef.current) {
      levelSixFileInputRef.current.value = '';
    }
  };

  const openAssistant = () => {
    setAssistantOpen(true);
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
        <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center bg-yellow-300/85">
          <span className="text-5xl font-bold uppercase tracking-[0.3em] text-neutral-950">
            Level up
          </span>
        </div>
      )}
      <header className="fixed inset-x-0 top-0 z-30 flex h-[10vh] min-h-[72px] items-center justify-start bg-black px-4 sm:px-6 lg:px-8">
        <img
          src={studyonLogo}
          alt="Studyon logo"
          className="h-14 w-14 object-contain brightness-0 invert"
        />
        <button
          type="button"
          onClick={() => navigate('/streak')}
          className="ml-4 flex items-center gap-3 rounded-full bg-neutral-950/40 px-5 py-2.5 text-orange-400 transition hover:bg-neutral-950/60"
          aria-label="Open streak page"
        >
          <span aria-hidden="true" className="text-3xl leading-none">{'\u{1F525}'}</span>
          <span className="text-xl font-semibold text-orange-400">{dailyStreak} days</span>
        </button>
        <div className="ml-8 flex items-center gap-3 lg:ml-12">
          <button
            type="button"
            onClick={() => updateLevel('reset')}
            disabled={levelLoading}
            className="rounded-full border border-neutral-700 bg-neutral-900 px-5 py-2 text-sm font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Reset Level
          </button>
          {activeLevel !== 7 && (
            <button
              type="button"
              onClick={() => updateLevel('progress')}
              disabled={levelLoading}
              className="rounded-full bg-white px-5 py-2 text-sm font-medium text-neutral-900 transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Progress Level
              </button>
            )}
        </div>
        <div className="ml-auto flex items-center gap-2">
          <div ref={badgerButtonSlotRef} className="relative h-12 w-12 shrink-0">
            {showTopbarBadgerButton && (
              <button
                type="button"
                onClick={openAssistant}
                className="relative h-full w-full overflow-hidden rounded-[15%] border border-neutral-800 bg-neutral-900 p-1 transition hover:bg-neutral-800"
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
            onClick={() => { logout(); navigate('/login'); }}
            className="flex items-center gap-2 rounded-full px-4 py-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
            aria-label="Logout"
          >
            <span className="text-sm font-medium">Logout</span>
          </button>
        </div>
      </header>

      <main
        className="min-h-screen pt-[max(10vh,72px)] transition-[padding-right] duration-200"
        style={{ paddingRight: assistantOpen ? assistantPanelWidth : '0px' }}
      >
        <section className="flex min-h-[calc(100vh-max(10vh,72px))] min-w-0 flex-col">
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
                  style={{
                    width: `calc((100% - 3rem) * ${Math.max(0, (unlockedLevel - 1) / (levels.length - 1))})`,
                  }}
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
                        aria-pressed={isActive}
                        aria-label={
                          isUnlocked
                            ? `Show level ${level}`
                            : `Level ${level} is locked`
                        }
                      >
                        {isUnlocked ? (
                          level
                        ) : (
                          <svg
                            aria-hidden="true"
                            viewBox="0 0 24 24"
                            className="h-4 w-4 fill-current"
                          >
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

          <div className="flex flex-1 bg-white px-2 py-2 sm:px-3 sm:py-3">
            <div className="flex min-h-full flex-1 rounded-md bg-neutral-200/70 p-3">
              {activeLevel === 2 && <Level2 />}
              {activeLevel === 6 && (
                levelSixCorrecting ? (
                  <div className="flex h-full w-full flex-col rounded-md bg-neutral-100 px-5 py-5 text-neutral-900">
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
                          Review
                        </p>
                        {levelSixFile && (
                          <p className="mt-2 text-lg font-medium text-neutral-700">
                            {levelSixFile.name}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={resetLevelSixFileState}
                        className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
                      >
                        Change Document
                      </button>
                    </div>

                    <div className="mt-5 min-h-0 flex-1 rounded-md bg-white">
                      {levelSixPreviewKind === 'text' ? (
                        <div className="h-full overflow-y-auto px-6 py-6">
                          <div className="w-full whitespace-pre-wrap text-left text-base leading-8 text-neutral-700">
                            {levelSixPreviewText}
                          </div>
                        </div>
                      ) : levelSixPreviewKind === 'pdf' && levelSixPreviewUrl ? (
                        <div
                          ref={levelSixPdfContainerRef}
                          className="h-full overflow-x-hidden overflow-y-auto bg-neutral-100 px-4 py-8 sm:px-6"
                        >
                          <div className="flex w-full flex-col items-center gap-8">
                            <Document
                              file={levelSixPreviewUrl}
                              loading={
                                <div className="flex min-h-[16rem] items-center justify-center rounded-[1.5rem] bg-white text-sm text-neutral-500">
                                  Loading PDF...
                                </div>
                              }
                              error={
                                <div className="flex min-h-[16rem] items-center justify-center rounded-[1.5rem] bg-white px-6 text-center text-sm text-neutral-500">
                                  This PDF could not be rendered in the review panel.
                                </div>
                              }
                              onLoadSuccess={({ numPages }) => setLevelSixPdfPages(numPages)}
                            >
                              {Array.from({ length: levelSixPdfPages }, (_, index) => (
                                <div key={`pdf-page-${index + 1}`} className="w-full max-w-full">
                                  <div className="overflow-hidden rounded-[1.5rem] bg-white shadow-[0_20px_45px_-30px_rgba(23,23,23,0.28)]">
                                    <Page
                                      pageNumber={index + 1}
                                      width={levelSixPdfRenderWidth}
                                      renderAnnotationLayer={false}
                                      renderTextLayer={false}
                                      className="mx-auto"
                                    />
                                  </div>
                                  {index < levelSixPdfPages - 1 && <div className="h-[10px]" />}
                                </div>
                              ))}
                            </Document>
                          </div>
                        </div>
                      ) : levelSixPreviewUrl ? (
                        <iframe
                          src={levelSixPreviewUrl}
                          title="Uploaded document preview"
                          className="h-full w-full rounded-md bg-white"
                        />
                      ) : (
                        <div className="flex h-full items-center justify-center px-6 text-center text-sm text-neutral-500">
                          This document preview is not available in-browser yet, but the file is loaded and ready to swap.
                        </div>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="flex h-full w-full flex-col items-center justify-center gap-5">
                    <div className="w-full text-left">
                      <h2 className="text-3xl font-semibold text-neutral-800">Writing</h2>
                      <p className="mt-1 text-sm text-neutral-500">Get Feedback from our Badger AI</p>
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
                      <span className="mt-5 rounded-full border border-neutral-300 bg-neutral-50 px-5 py-2 text-sm font-medium text-neutral-600 transition group-hover:border-neutral-400 group-hover:bg-neutral-100">
                        Choose file
                      </span>
                      {levelSixFile && (
                        <span className="mt-4 rounded-full bg-neutral-100 px-4 py-2 text-sm text-neutral-700">
                          {levelSixFile.name}
                        </span>
                      )}
                    </label>
                    {levelSixFile && (
                      <div className="flex items-center justify-center">
                        <button
                          type="button"
                          onClick={() => setLevelSixCorrecting(true)}
                          className="rounded-full bg-neutral-900 px-10 py-4 text-base font-semibold text-white shadow-[0_18px_40px_-20px_rgba(23,23,23,0.95)] transition hover:bg-neutral-800"
                        >
                          Correct
                        </button>
                      </div>
                    )}
                  </div>
                )
              )}
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
            <div className="flex justify-center">
              <img
                ref={assistantBadgerRef}
                src={badgerImage}
                alt="Badger"
                className="h-24 w-24 rounded-full object-cover"
              />
            </div>
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
    </div>
  );
}

