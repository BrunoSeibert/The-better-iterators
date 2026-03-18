import {
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import AiAssistant from '../chat/AiAssistant';
import studyonLogo from '@/assets/Studyon_Logo.png';

const levels = Array.from({ length: 8 }, (_, index) => index + 1);
const unlockedLevel = 5;

export default function Layout() {
  const [activeLevel, setActiveLevel] = useState(1);
  const [assistantOpen, setAssistantOpen] = useState(true);
  const navigate = useNavigate();
  const roadmapRef = useRef<HTMLDivElement | null>(null);
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

  return (
    <div className="min-h-screen bg-neutral-300 text-neutral-950">
      <header className="flex h-[10vh] min-h-[72px] items-center justify-start bg-black px-4 sm:px-6 lg:px-8">
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
          <svg aria-hidden="true" viewBox="0 0 24 24" className="h-8 w-8 fill-current">
            <path d="M13.09 2.91c.42 2.37-.54 3.98-1.47 5.53-.86 1.44-1.68 2.8-1.24 4.72.2.85.71 1.67 1.44 2.31-.13-1.7.61-2.9 1.37-4.11.92-1.46 1.87-2.98 1.5-5.28 2.52 1.77 4.31 4.75 4.31 7.92A7 7 0 1 1 7 11.9c.25-1.73 1.2-3.3 2.58-4.37-.27 2.03.34 3.27 1.04 4.18.06-1.92 1-3.48 1.9-4.98.98-1.63 1.91-3.18 1.57-5.82Z" />
          </svg>
          <span className="text-xl font-semibold text-orange-400">1</span>
        </button>
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
                  style={{
                    width: `calc(${((unlockedLevel - 1) / (levels.length - 1)) * 100}% - 3rem)`,
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
                        className={`relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-sm font-semibold shadow-[0_0_0_6px_rgba(245,245,245,0.95)] transition ${
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

          <div className="flex-1 bg-white px-8 py-8">
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-[2.5rem] bg-neutral-200/70">
              <p className="text-[clamp(7rem,20vw,16rem)] font-bold leading-none text-neutral-400/70">
                {activeLevel}
              </p>
            </div>
            <Outlet />
          </div>
        </section>

        <div className="relative flex">
          {!assistantOpen && (
            <button
              onClick={() => setAssistantOpen(true)}
              className="absolute -left-5 top-1/2 z-10 flex h-16 w-5 -translate-y-1/2 items-center justify-center rounded-l-full border border-r-0 border-neutral-200 bg-white text-neutral-400 shadow-md hover:text-neutral-700"
              aria-label="Open AI Assistant"
            >
              {'<'}
            </button>
          )}
          {assistantOpen && (
            <aside className="h-[90vh] min-h-[540px] w-[320px] shrink-0 border-l border-neutral-200 bg-white px-6 py-8 text-neutral-900 lg:w-[380px]">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.3em] text-neutral-400">
                    Assistant
                  </p>
                  <h2 className="mt-3 text-2xl font-semibold">AI Assistant</h2>
                </div>
                <button
                  onClick={() => setAssistantOpen(false)}
                  className="mt-1 rounded-lg p-1 text-neutral-400 hover:bg-neutral-100 hover:text-neutral-700"
                  aria-label="Close AI Assistant"
                >
                  x
                </button>
              </div>
              <div className="mt-6 h-[calc(100%-5rem)] min-h-[280px]">
                <AiAssistant />
              </div>
            </aside>
          )}
        </div>
      </main>
    </div>
  );
}
