import { useNavigate } from 'react-router-dom';

export default function StreakPage() {
  const navigate = useNavigate();

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950 px-6 py-8 text-neutral-100 sm:px-10">
      <div className="flex">
        <button
          type="button"
          onClick={() => navigate('/')}
          className="rounded-[0.4rem] border border-red-500 px-5 py-2 text-sm font-semibold text-red-400 transition hover:bg-red-500/10"
        >
          Back
        </button>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <p className="text-[clamp(3rem,8vw,6rem)] font-semibold tracking-[-0.04em] text-neutral-100">
          Streak
        </p>
      </div>
    </main>
  );
}
