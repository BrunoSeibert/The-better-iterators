import { useEffect, useState } from 'react';

type Props = {
  emoji: string;
  label: string;
  description: string;
  onDone: () => void;
};

export default function AchievementToast({ emoji, label, description, onDone }: Props) {
  const [visible, setVisible] = useState(false);

  const dismiss = () => {
    setVisible(false);
    setTimeout(onDone, 500);
  };

  useEffect(() => {
    // Slide in
    const showTimer = setTimeout(() => setVisible(true), 50);
    // Slide out after 3.5s
    const hideTimer = setTimeout(() => setVisible(false), 3500);
    // Remove from DOM after animation
    const doneTimer = setTimeout(onDone, 4000);

    return () => {
      clearTimeout(showTimer);
      clearTimeout(hideTimer);
      clearTimeout(doneTimer);
    };
  }, [onDone]);

  return (
    <div
      className={`pointer-events-auto flex items-center gap-4 rounded-2xl bg-neutral-900 px-5 py-4 shadow-2xl transition-all duration-500 ease-out ${
        visible ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
      }`}
    >
      <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-neutral-800 text-2xl">
        {emoji}
      </div>
      <div className="flex-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          Achievement Unlocked
        </p>
        <p className="mt-0.5 text-sm font-bold text-white">{label}</p>
        <p className="text-xs text-neutral-400">{description}</p>
      </div>
      <button
        type="button"
        onClick={dismiss}
        className="ml-2 rounded-lg p-1.5 text-neutral-500 transition hover:bg-neutral-800 hover:text-white"
        aria-label="Dismiss"
      >
        <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
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
  );
}
