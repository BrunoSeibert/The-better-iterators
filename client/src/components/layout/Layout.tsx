import { useState } from 'react';
import { Outlet } from 'react-router-dom';

const levels = Array.from({ length: 8 }, (_, index) => index + 1);
const unlockedLevel = 5;

export default function Layout() {
  const [activeLevel, setActiveLevel] = useState(1);

  return (
    <div className="min-h-screen bg-neutral-300 text-neutral-950">
      <header className="h-[10vh] min-h-[72px] bg-black" />

      <main className="flex min-h-[90vh]">
        <section className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-[10vh] min-h-[72px] items-center border-b border-neutral-300 bg-neutral-100 px-8">
            <div className="relative w-full">
              <div className="absolute left-0 right-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-200" />
              <div
                className="absolute left-0 top-1/2 h-2 -translate-y-1/2 rounded-full bg-neutral-700 transition-all"
                style={{
                  width: `${((unlockedLevel - 1) / (levels.length - 1)) * 100}%`,
                }}
              />

              <div className="relative flex flex-wrap items-center justify-between gap-2">
              {levels.map((level) => {
                const isActive = level === activeLevel;
                const isUnlocked = level <= unlockedLevel;

                return (
                  <button
                    key={level}
                    type="button"
                    onClick={() => isUnlocked && setActiveLevel(level)}
                    disabled={!isUnlocked}
                    className={`relative z-10 flex h-12 w-12 items-center justify-center rounded-full border text-sm font-semibold shadow-[0_0_0_6px_rgba(245,245,245,0.95)] transition ${
                      isUnlocked
                        ? isActive
                          ? 'border-neutral-800 bg-neutral-800 text-white'
                          : 'border-neutral-300 bg-neutral-50 text-neutral-700 hover:border-neutral-500 hover:bg-white'
                        : 'cursor-not-allowed border-neutral-200 bg-neutral-100 text-neutral-400'
                    }`}
                    aria-pressed={isActive}
                    aria-label={
                      isUnlocked ? `Show level ${level}` : `Level ${level} is locked`
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

          <div className="flex-1 bg-white px-8 py-8">
            <div className="flex h-full min-h-[320px] items-center justify-center rounded-[2rem] bg-neutral-100">
              <div className="flex h-[min(56vh,520px)] w-full max-w-[860px] items-center justify-center rounded-[2.5rem] bg-neutral-200/70">
                <p className="text-[clamp(7rem,20vw,16rem)] font-bold leading-none text-neutral-400/70">
                  {activeLevel}
                </p>
              </div>
            </div>
            <Outlet />
          </div>
        </section>

        <aside className="h-[90vh] min-h-[540px] w-[320px] shrink-0 border-l border-neutral-500 bg-neutral-500 px-6 py-8 text-white lg:w-[380px]">
          <p className="text-xs uppercase tracking-[0.3em] text-neutral-200">
            Assistant
          </p>
          <h2 className="mt-3 text-2xl font-semibold">AI Assistant</h2>
          <div className="mt-6 flex h-[calc(100%-5rem)] min-h-[280px] items-center justify-center rounded-2xl border border-white/20 bg-black/10 p-6 text-center text-sm text-neutral-100">
            Right-side panel reserved for the chat interface.
          </div>
        </aside>
      </main>
    </div>
  );
}
