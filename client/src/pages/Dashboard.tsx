import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDashboard, updateMainDeadline, createTodo, toggleTodo, deleteTodo,
  type DashboardData, type Todo, type DashboardDeadlines,
} from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { peekStreakSummary } from '@/services/authService';
import DailyCheckin from '@/components/DailyCheckin';
import studyonLogo from '@/assets/Study_Logo.png';
import badgerImage from '@/assets/Badger_2.png';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Literature Review',
  2: 'Topic Selection',
  3: 'Research Proposal',
  4: 'Research',
  5: 'Writing',
  6: 'Defense Prep',
};

const UNLOCK_DEPS: Record<number, number[]> = {
  1: [], 2: [], 3: [1, 2], 4: [3], 5: [4], 6: [5],
};

function isLevelUnlocked(level: number, completedStages: number[]) {
  return UNLOCK_DEPS[level]?.every((d) => completedStages.includes(d)) ?? false;
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function DeadlinePill({ days }: { days: number | null }) {
  if (days === null) return <span className="text-xs text-neutral-400">No deadline set</span>;
  if (days < 0) return <span className="rounded-full bg-red-50 px-2 py-0.5 text-xs font-semibold text-red-600">{Math.abs(days)}d overdue</span>;
  if (days <= 7) return <span className="rounded-full bg-orange-50 px-2 py-0.5 text-xs font-semibold text-orange-600">In {days}d</span>;
  return <span className="text-xs text-neutral-500">In {days} days</span>;
}

export default function Dashboard() {
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [newTodo, setNewTodo] = useState('');
  const [newTodoLevel, setNewTodoLevel] = useState<number | ''>('');
  const [editingDeadline, setEditingDeadline] = useState(false);
  const [deadlineInput, setDeadlineInput] = useState('');
  const streak = peekStreakSummary()?.currentStreak ?? 0;

  const [checkinOpen, setCheckinOpen] = useState(false);

  useEffect(() => {
    getDashboard().then((d) => { setData(d); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  const handleAddTodo = async () => {
    if (!newTodo.trim() || !data) return;
    const todo = await createTodo(newTodo.trim(), newTodoLevel || undefined);
    setData((d) => d ? { ...d, todos: [...d.todos, todo] } : d);
    setNewTodo('');
    setNewTodoLevel('');
  };

  const handleToggle = async (todo: Todo) => {
    const updated = await toggleTodo(todo.id, !todo.done);
    setData((d) => d ? { ...d, todos: d.todos.map((t) => t.id === updated.id ? updated : t) } : d);
  };

  const handleDelete = async (id: string) => {
    await deleteTodo(id);
    setData((d) => d ? { ...d, todos: d.todos.filter((t) => t.id !== id) } : d);
  };

  const handleDeadlineSave = async () => {
    if (!deadlineInput) return;
    const result = await updateMainDeadline(deadlineInput);
    setData((d) => d ? {
      ...d,
      deadlines: {
        main: deadlineInput,
        level1: result.levels[1], level2: result.levels[2], level3: result.levels[3],
        level4: result.levels[4], level5: result.levels[5], level6: result.levels[6],
      },
    } : d);
    setEditingDeadline(false);
  };

  const goToLevel = (level: number, stepContext?: number | null) => {
    if (!data) return;
    if (!isLevelUnlocked(level, data.user.completedStages)) return;
    sessionStorage.setItem('activeLevel', String(level));
    if (level === 3 && stepContext != null) {
      const userId = user?.id ?? 'anon';
      const raw = sessionStorage.getItem(`${userId}:proposal_state`);
      const existing = raw ? JSON.parse(raw) : {};
      sessionStorage.setItem(`${userId}:proposal_state`, JSON.stringify({ ...existing, step: stepContext }));
    }
    navigate('/app');
  };

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
      </div>
    );
  }

  const deadlines: DashboardDeadlines = data?.deadlines ?? { main: null, level1: null, level2: null, level3: null, level4: null, level5: null, level6: null };
  const completedStages = data?.user.completedStages ?? [];
  const daysToDeadline = daysUntil(deadlines.main);
  const levelDeadlineMap: Record<number, string | null> = {
    1: deadlines.level1, 2: deadlines.level2, 3: deadlines.level3,
    4: deadlines.level4, 5: deadlines.level5, 6: deadlines.level6,
  };
  const displayName = user?.name?.split(' ')[0] ?? 'there';

  // Find next overdue or upcoming level deadline
  const nextLevelDeadline = [1, 2, 3, 4, 5, 6]
    .filter((l) => !completedStages.includes(l) && levelDeadlineMap[l])
    .sort((a, b) => new Date(levelDeadlineMap[a]!).getTime() - new Date(levelDeadlineMap[b]!).getTime())[0];

  return (
    <div className="min-h-screen bg-neutral-100 pb-16">
      {/* Header */}
      <header className="sticky top-0 z-30 flex h-[max(10vh,72px)] items-center justify-start bg-black px-4 sm:px-6 lg:px-8 gap-4">
        <img src={studyonLogo} alt="Studyon logo" className="h-12 w-12 object-contain brightness-0 invert shrink-0" />
        <div className="flex items-center gap-3">
          <p className="text-sm font-semibold uppercase tracking-widest text-neutral-400">Dashboard</p>
          <button
            type="button"
            onClick={() => navigate('/app')}
            className="flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium text-neutral-300 transition hover:bg-neutral-800 hover:text-white"
          >
            <span aria-hidden="true">🔨</span>
            Workspace
          </button>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => navigate('/streak')}
            className="hidden flex items-center gap-2 rounded-full bg-neutral-950/40 px-4 py-2 text-orange-400 transition hover:bg-neutral-950/60"
          >
            <span className="text-2xl leading-none">🔥</span>
            <span className="text-base font-semibold text-orange-400">{streak} days</span>
          </button>
          <button
            type="button"
            onClick={() => navigate('/profile', { state: { returnTo: '/dashboard' } })}
            className="flex items-center gap-2 rounded-md px-4 py-2 text-neutral-400 transition hover:bg-neutral-800 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12Zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8Z"/>
            </svg>
            <span className="text-sm font-medium">Profile</span>
          </button>
        </div>
      </header>

      {/* Daily check-in modal */}
      {checkinOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ backgroundColor: 'rgba(40,28,20,0.55)', backdropFilter: 'blur(3px)' }}
          onClick={() => setCheckinOpen(false)}
        >
          <div
            className="relative w-full mx-4 overflow-y-auto"
            style={{ maxWidth: 600, maxHeight: '90vh', backgroundColor: 'rgba(252,248,243,1)', border: '1px solid rgba(196,177,160,1)', borderRadius: 14, padding: '2rem', boxShadow: '0 8px 40px rgba(81,60,45,0.18)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(140,115,95,1)' }}>Daily check-in</p>
              <button onClick={() => setCheckinOpen(false)} style={{ fontSize: 16, color: 'rgba(140,115,95,1)', lineHeight: 1, background: 'none', border: 'none', cursor: 'pointer', padding: '2px 6px', borderRadius: 4 }}>✕</button>
            </div>
            <DailyCheckin onComplete={() => setCheckinOpen(false)} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 pt-6 flex flex-col gap-6">
        <div className="flex flex-col items-center justify-center gap-4 py-2 text-center">
          <img
            src={badgerImage}
            alt="Badger mascot"
            className="h-24 w-24 rounded-[18px] object-cover"
          />
          <h2 className="text-4xl font-bold tracking-tight text-black">
            Welcome back, {displayName} {'\u{1F389}'}
          </h2>
        </div>

        {/* Stats row */}
        <div className="mx-auto grid w-[60%] min-w-[32rem] grid-cols-3 gap-3">
          <div className="rounded-md bg-white border border-neutral-300 px-3 py-2.5 text-center shadow-sm">
            <p className="text-xl font-bold text-orange-500">🔥 {streak}</p>
            <p className="text-xs text-neutral-500 mt-1">day streak</p>
          </div>
          <div className="rounded-md bg-white border border-neutral-300 px-3 py-2.5 text-center shadow-sm">
            <p className="text-xl font-bold text-neutral-900">
              {daysToDeadline !== null ? (daysToDeadline < 0 ? `${Math.abs(daysToDeadline)}d late` : `${daysToDeadline}d`) : '—'}
            </p>
            <p className="text-xs text-neutral-500 mt-1">until submission</p>
          </div>
          <div className="rounded-md bg-white border border-neutral-300 px-3 py-2.5 text-center shadow-sm">
            <p className="text-xl font-bold text-neutral-900">{completedStages.length}<span className="text-sm font-normal text-neutral-400">/6</span></p>
            <p className="text-xs text-neutral-500 mt-1">levels done</p>
          </div>
        </div>

        {/* Progress — level cards */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Your Progress</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((level) => {
              const completed = completedStages.includes(level);
              const unlocked = isLevelUnlocked(level, completedStages);
              const isCurrent = !completed && unlocked;
              const deadline = levelDeadlineMap[level];
              const days = daysUntil(deadline);
              const overdue = days !== null && days < 0 && !completed;

              return (
                <div
                  key={level}
                  onClick={() => goToLevel(level)}
                  className={`flex flex-col gap-2 rounded-md border p-4 shadow-sm transition ${
                    unlocked
                      ? completed
                        ? 'cursor-pointer hover:shadow-md hover:border-green-500'
                        : 'cursor-pointer hover:shadow-md hover:border-neutral-500'
                      : 'cursor-not-allowed opacity-50'
                  } ${completed ? 'border-green-200 bg-green-50' : 'border-neutral-300 bg-white'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className={`text-xs font-semibold rounded-full px-2.5 py-0.5 ${
                      completed ? 'bg-green-100 text-green-700' :
                      isCurrent ? 'bg-neutral-900 text-white' :
                      'bg-neutral-100 text-neutral-500'
                    }`}>
                      {completed ? '✓ Done' : isCurrent ? 'Current' : 'Locked'}
                    </span>
                    <span className="text-xs text-neutral-400">Level {level}</span>
                  </div>
                  <p className="font-semibold text-neutral-900 text-sm">{LEVEL_NAMES[level]}</p>
                  {deadline && !completed && (
                    <div className="flex items-center gap-1.5">
                      <DeadlinePill days={days} />
                      {overdue && <p className="text-xs text-red-500 italic">Don't worry, keep going!</p>}
                    </div>
                  )}
                  {!unlocked && <p className="text-xs text-neutral-400">Complete previous levels first</p>}
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Deadline manager */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Thesis Deadline</h2>
            <div className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm flex flex-col gap-3">
              {!editingDeadline ? (
                <>
                  <div>
                    <p className="text-xs text-neutral-400">Submission date</p>
                    <p className="text-lg font-semibold text-neutral-900">{formatDate(deadlines.main)}</p>
                    {nextLevelDeadline && (
                      <p className="text-xs text-neutral-500 mt-1">
                        Next: Level {nextLevelDeadline} ({LEVEL_NAMES[nextLevelDeadline]}) — {formatDate(levelDeadlineMap[nextLevelDeadline])}
                        {' '}<DeadlinePill days={daysUntil(levelDeadlineMap[nextLevelDeadline])} />
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => { setDeadlineInput(deadlines.main ?? ''); setEditingDeadline(true); }}
                    className="self-start rounded-md border border-neutral-300 px-3 py-1.5 text-xs text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-700"
                  >
                    {deadlines.main ? 'Change deadline' : 'Set deadline'}
                  </button>
                </>
              ) : (
                <>
                  <input
                    type="date"
                    value={deadlineInput}
                    onChange={(e) => setDeadlineInput(e.target.value)}
                    min={new Date().toISOString().slice(0, 10)}
                    className="w-full rounded-md border border-neutral-300 px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
                  />
                  <div className="flex gap-2">
                    <button onClick={handleDeadlineSave} className="rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700">Save</button>
                    <button onClick={() => setEditingDeadline(false)} className="rounded-md border border-neutral-300 px-4 py-2 text-sm text-neutral-500 transition hover:border-neutral-500 hover:text-neutral-700">Cancel</button>
                  </div>
                </>
              )}

              {/* Level deadline list */}
              {deadlines.main && (
                <div className="border-t border-neutral-100 pt-3 flex flex-col gap-1.5">
                  <p className="text-xs font-semibold text-neutral-400 mb-1">Suggested level deadlines</p>
                  {[1, 2, 3, 4, 5, 6].map((l) => {
                    const d = levelDeadlineMap[l];
                    const days = daysUntil(d);
                    const done = completedStages.includes(l);
                    return (
                      <div key={l} className="flex items-center justify-between text-xs">
                        <span className={done ? 'line-through text-neutral-400' : 'text-neutral-700'}>
                          Level {l} · {LEVEL_NAMES[l]}
                        </span>
                        {done ? <span className="text-green-600">✓</span> : <DeadlinePill days={days} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </section>

          {/* Recent activity */}
          <section>
            <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">Recent Activity</h2>
            <div className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm flex flex-col gap-2">
              {data?.recentActivity.length === 0 ? (
                <p className="text-sm text-neutral-400">No activity yet. Start working on your thesis!</p>
              ) : (
                data?.recentActivity.map((a) => (
                  <div
                    key={a.id}
                    onClick={() => a.level && goToLevel(a.level, a.step_context)}
                    className={`-mx-2 flex items-start gap-2 rounded-md px-2 py-1.5 transition ${a.level ? 'group cursor-pointer hover:bg-neutral-50' : ''}`}
                  >
                    <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-400 mt-2" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-neutral-700">{a.action}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {a.level && (
                          <span className="text-xs text-neutral-400">Level {a.level} · {LEVEL_NAMES[a.level]}</span>
                        )}
                        <span className="text-xs text-neutral-400">{new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                      </div>
                    </div>
                    {a.level && (
                      <span className="shrink-0 text-xs text-neutral-300 group-hover:text-neutral-500 transition mt-1">→</span>
                    )}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>

        {/* Todo list */}
        <section>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-neutral-400 mb-3">To-Do</h2>
          <div className="rounded-md border border-neutral-300 bg-white p-4 shadow-sm flex flex-col gap-2">
            {data?.todos.map((todo) => (
              <div key={todo.id} className="flex items-center gap-3 group">
                <button onClick={() => handleToggle(todo)} className="shrink-0">
                  <div className={`h-5 w-5 rounded-full border-2 flex items-center justify-center transition ${todo.done ? 'border-green-500 bg-green-500' : 'border-neutral-300'}`}>
                    {todo.done && <svg viewBox="0 0 24 24" className="h-3 w-3 fill-white"><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                  </div>
                </button>
                <span className={`flex-1 text-sm ${todo.done ? 'line-through text-neutral-400' : 'text-neutral-700'}`}>{todo.text}</span>
                {todo.level_link && (
                  <span
                    onClick={() => goToLevel(todo.level_link!)}
                    className="shrink-0 cursor-pointer rounded-md border border-neutral-300 bg-neutral-100 px-2 py-0.5 text-xs text-neutral-500 transition hover:border-neutral-500 hover:bg-neutral-200"
                  >
                    Level {todo.level_link}
                  </span>
                )}
                <button onClick={() => handleDelete(todo.id)} className="shrink-0 opacity-0 group-hover:opacity-100 text-neutral-300 hover:text-red-400 transition text-xs">✕</button>
              </div>
            ))}

            {/* Add new todo */}
            <div className="mt-2 flex gap-2 border-t border-neutral-100 pt-2">
              <input
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                placeholder="Add a task…"
                className="flex-1 rounded-md border border-neutral-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-neutral-300"
              />
              <select
                value={newTodoLevel}
                onChange={(e) => setNewTodoLevel(e.target.value ? Number(e.target.value) : '')}
                className="rounded-md border border-neutral-300 px-2 py-2 text-sm text-neutral-500 focus:outline-none"
              >
                <option value="">No level</option>
                {[1, 2, 3, 4, 5, 6].map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
              <button
                onClick={handleAddTodo}
                disabled={!newTodo.trim()}
                className="rounded-md border border-neutral-900 bg-neutral-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-neutral-700 disabled:opacity-40"
              >
                Add
              </button>
            </div>
          </div>
        </section>

      </div>
    </div>
  );
}


