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

const C = {
  darkBrown:  'rgba(81,60,45,1)',
  midBrown:   'rgba(114,96,84,1)',
  tan:        'rgba(197,171,146,1)',
  lightTan:   'rgba(231,214,194,1)',
  cream:      'rgba(252,248,243,1)',
  warmWhite:  'rgba(245,239,231,1)',
  border:     'rgba(196,177,160,1)',
  mutedText:  'rgba(140,115,95,1)',
};

const LEVEL_NAMES: Record<number, string> = {
  1: 'Literature Review', 2: 'Topic Selection', 3: 'Research Proposal',
  4: 'Research', 5: 'Writing', 6: 'Defense Prep',
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
  if (days === null) return <span style={{ fontSize: 11, color: C.mutedText }}>No deadline</span>;
  if (days < 0) return <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(185,28,28,1)', backgroundColor: 'rgba(254,226,226,1)', padding: '1px 8px', borderRadius: 99 }}>{Math.abs(days)}d overdue</span>;
  if (days <= 7) return <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(154,52,18,1)', backgroundColor: 'rgba(255,237,213,1)', padding: '1px 8px', borderRadius: 99 }}>In {days}d</span>;
  return <span style={{ fontSize: 11, color: C.mutedText }}>In {days} days</span>;
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

  const [checkinDone, setCheckinDone] = useState(() => {
    try {
      const raw = localStorage.getItem('todayCheckin');
      if (!raw) return false;
      return new Date(JSON.parse(raw).date).toDateString() === new Date().toDateString();
    } catch { return false; }
  });
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
      <div className="flex h-screen w-full items-center justify-center" style={{ backgroundColor: C.warmWhite }}>
        <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: C.border, borderTopColor: C.darkBrown }} />
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

  const nextLevelDeadline = [1, 2, 3, 4, 5, 6]
    .filter((l) => !completedStages.includes(l) && levelDeadlineMap[l])
    .sort((a, b) => new Date(levelDeadlineMap[a]!).getTime() - new Date(levelDeadlineMap[b]!).getTime())[0];

  const sectionLabel = (text: string) => (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.mutedText, marginBottom: 10 }}>{text}</p>
  );

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ backgroundColor: C.cream, border: `1px solid ${C.border}`, borderRadius: 12, padding: '1.25rem', ...style }}>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen pb-16" style={{ backgroundColor: C.warmWhite }}>
      {/* Navbar */}
      <header className="sticky top-0 z-30 flex h-[max(10vh,72px)] items-center gap-4 px-4 sm:px-6 lg:px-8" style={{ backgroundColor: C.darkBrown, borderBottom: `1px solid rgba(56,40,29,1)` }}>
        <img src={studyonLogo} alt="Studyon logo" className="h-12 w-12 object-contain brightness-0 invert shrink-0" />
        <div className="flex items-center gap-3">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.tan }}>Dashboard</p>
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition"
            style={{ color: C.lightTan, border: `1px solid rgba(120,90,68,1)` }}
          >
            Workspace →
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => !checkinDone && setCheckinOpen(true)}
            disabled={checkinDone}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition"
            style={checkinDone
              ? { backgroundColor: 'rgba(152,195,121,0.25)', color: 'rgba(180,220,140,1)', border: '1px solid rgba(152,195,121,0.4)', cursor: 'default' }
              : { backgroundColor: C.lightTan, color: C.darkBrown, border: `1px solid ${C.tan}` }
            }
          >
            {checkinDone ? '✓ Checked in' : 'Daily check-in'}
          </button>
          <button
            onClick={() => navigate('/profile', { state: { returnTo: '/dashboard' } })}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition"
            style={{ color: C.tan, border: `1px solid rgba(120,90,68,1)` }}
          >
            <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
              <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12Zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8Z"/>
            </svg>
            Profile
          </button>
        </div>
      </header>

      {/* Check-in modal */}
      {checkinOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(40,28,20,0.55)', backdropFilter: 'blur(3px)' }} onClick={() => setCheckinOpen(false)}>
          <div className="relative mx-4 w-full overflow-y-auto" style={{ maxWidth: 600, maxHeight: '90vh', backgroundColor: C.cream, border: `1px solid ${C.border}`, borderRadius: 14, padding: '2rem', boxShadow: '0 8px 40px rgba(81,60,45,0.18)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.mutedText }}>Daily check-in</p>
              <button onClick={() => setCheckinOpen(false)} style={{ fontSize: 16, color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <DailyCheckin onComplete={() => { setCheckinDone(true); setCheckinOpen(false); }} />
          </div>
        </div>
      )}

      <div className="mx-auto max-w-4xl px-4 pt-8 flex flex-col gap-6">

        {/* Welcome */}
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <img src={badgerImage} alt="Badger mascot" className="h-28 w-28 rounded-2xl object-cover" />
          <h1 style={{ fontSize: 28, fontWeight: 700, color: C.darkBrown }}>Welcome back, {displayName} 👋</h1>
        </div>

        {/* Stats */}
        <div className="mx-auto grid w-full max-w-lg grid-cols-3 gap-3">
          {[
            { label: 'day streak',       value: `🔥 ${streak}` },
            { label: 'until submission', value: daysToDeadline !== null ? (daysToDeadline < 0 ? `${Math.abs(daysToDeadline)}d late` : `${daysToDeadline}d`) : '—' },
            { label: 'levels done',      value: `${completedStages.length}/6` },
          ].map(({ label, value }) => (
            <div key={label} className="text-center rounded-xl py-3 px-2" style={{ backgroundColor: C.cream, border: `1px solid ${C.border}` }}>
              <p style={{ fontSize: 18, fontWeight: 700, color: C.darkBrown }}>{value}</p>
              <p style={{ fontSize: 11, color: C.mutedText, marginTop: 2 }}>{label}</p>
            </div>
          ))}
        </div>

        {/* Level cards */}
        <section>
          {sectionLabel('Your Progress')}
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((level) => {
              const completed = completedStages.includes(level);
              const unlocked = isLevelUnlocked(level, completedStages);
              const isCurrent = !completed && unlocked;
              const days = daysUntil(levelDeadlineMap[level]);
              const overdue = days !== null && days < 0 && !completed;

              return (
                <div
                  key={level}
                  onClick={() => goToLevel(level)}
                  style={{
                    backgroundColor: completed ? 'rgba(220,240,200,0.5)' : C.cream,
                    border: `1px solid ${completed ? 'rgba(152,195,121,0.6)' : C.border}`,
                    borderRadius: 12,
                    padding: '1rem',
                    cursor: unlocked ? 'pointer' : 'not-allowed',
                    opacity: unlocked ? 1 : 0.5,
                    transition: 'box-shadow 0.15s ease',
                  }}
                  className={unlocked ? 'hover:shadow-md' : ''}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span style={{
                      fontSize: 11, fontWeight: 700, borderRadius: 99, padding: '2px 10px',
                      backgroundColor: completed ? 'rgba(152,195,121,0.3)' : isCurrent ? C.darkBrown : C.lightTan,
                      color: completed ? 'rgba(60,120,30,1)' : isCurrent ? C.cream : C.mutedText,
                    }}>
                      {completed ? '✓ Done' : isCurrent ? 'Current' : 'Locked'}
                    </span>
                    <span style={{ fontSize: 11, color: C.mutedText }}>Level {level}</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.darkBrown }}>{LEVEL_NAMES[level]}</p>
                  {levelDeadlineMap[level] && !completed && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <DeadlinePill days={days} />
                      {overdue && <span style={{ fontSize: 11, color: C.mutedText, fontStyle: 'italic' }}>Keep going!</span>}
                    </div>
                  )}
                  {!unlocked && <p style={{ fontSize: 11, color: C.mutedText, marginTop: 4 }}>Complete previous levels first</p>}
                </div>
              );
            })}
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-2">

          {/* Deadline manager */}
          <section>
            {sectionLabel('Thesis Deadline')}
            {card(<>
              {!editingDeadline ? (<>
                <div>
                  <p style={{ fontSize: 11, color: C.mutedText }}>Submission date</p>
                  <p style={{ fontSize: 18, fontWeight: 700, color: C.darkBrown, marginTop: 2 }}>{formatDate(deadlines.main)}</p>
                  {nextLevelDeadline && (
                    <p style={{ fontSize: 11, color: C.mutedText, marginTop: 4 }}>
                      Next: Level {nextLevelDeadline} ({LEVEL_NAMES[nextLevelDeadline]}) — {formatDate(levelDeadlineMap[nextLevelDeadline])}{' '}
                      <DeadlinePill days={daysUntil(levelDeadlineMap[nextLevelDeadline])} />
                    </p>
                  )}
                </div>
                <button
                  onClick={() => { setDeadlineInput(deadlines.main ?? ''); setEditingDeadline(true); }}
                  style={{ marginTop: 10, fontSize: 12, color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                >
                  {deadlines.main ? 'Change deadline' : 'Set deadline'}
                </button>
              </>) : (<>
                <input
                  type="date"
                  value={deadlineInput}
                  onChange={(e) => setDeadlineInput(e.target.value)}
                  min={new Date().toISOString().slice(0, 10)}
                  className="w-full focus:outline-none"
                  style={{ backgroundColor: C.warmWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: '9px 14px', fontSize: 14, color: C.darkBrown, marginBottom: 10 }}
                />
                <div className="flex gap-2">
                  <button onClick={handleDeadlineSave} style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, backgroundColor: C.darkBrown, color: C.cream, border: 'none', cursor: 'pointer' }}>Save</button>
                  <button onClick={() => setEditingDeadline(false)} style={{ padding: '8px 14px', borderRadius: 8, fontSize: 13, color: C.mutedText, background: 'none', border: `1px solid ${C.border}`, cursor: 'pointer' }}>Cancel</button>
                </div>
              </>)}

              {deadlines.main && (
                <div style={{ borderTop: `1px solid ${C.border}`, marginTop: 14, paddingTop: 12 }}>
                  <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.mutedText, marginBottom: 8 }}>Suggested level deadlines</p>
                  {[1, 2, 3, 4, 5, 6].map((l) => {
                    const done = completedStages.includes(l);
                    return (
                      <div key={l} className="flex items-center justify-between" style={{ marginBottom: 5 }}>
                        <span style={{ fontSize: 12, color: done ? C.mutedText : C.midBrown, textDecoration: done ? 'line-through' : 'none' }}>
                          Level {l} · {LEVEL_NAMES[l]}
                        </span>
                        {done ? <span style={{ fontSize: 12, color: 'rgba(80,160,40,1)' }}>✓</span> : <DeadlinePill days={daysUntil(levelDeadlineMap[l])} />}
                      </div>
                    );
                  })}
                </div>
              )}
            </>)}
          </section>

          {/* Recent activity */}
          <section>
            {sectionLabel('Recent Activity')}
            {card(
              data?.recentActivity.length === 0
                ? <p style={{ fontSize: 13, color: C.mutedText }}>No activity yet. Start working on your thesis!</p>
                : <>{data?.recentActivity.map((a) => (
                    <div
                      key={a.id}
                      onClick={() => a.level && goToLevel(a.level, a.step_context)}
                      className="group flex items-start gap-2 rounded-lg px-2 py-1.5 -mx-2 transition"
                      style={{ cursor: a.level ? 'pointer' : 'default' }}
                      onMouseEnter={(e) => { if (a.level) (e.currentTarget as HTMLDivElement).style.backgroundColor = C.warmWhite; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = 'transparent'; }}
                    >
                      <span style={{ marginTop: 7, height: 6, width: 6, flexShrink: 0, borderRadius: '50%', backgroundColor: C.tan, display: 'inline-block' }} />
                      <div className="flex-1 min-w-0">
                        <p style={{ fontSize: 13, color: C.darkBrown }}>{a.action}</p>
                        <div className="flex items-center gap-2" style={{ marginTop: 2 }}>
                          {a.level && <span style={{ fontSize: 11, color: C.mutedText }}>Level {a.level} · {LEVEL_NAMES[a.level]}</span>}
                          <span style={{ fontSize: 11, color: C.mutedText }}>{new Date(a.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</span>
                        </div>
                      </div>
                      {a.level && <span style={{ fontSize: 12, color: C.tan, flexShrink: 0, marginTop: 4 }}>→</span>}
                    </div>
                  ))}</>
            )}
          </section>
        </div>

        {/* Todo list */}
        <section>
          {sectionLabel('To-Do')}
          {card(<>
            {data?.todos.map((todo) => (
              <div key={todo.id} className="group flex items-center gap-3" style={{ marginBottom: 8 }}>
                <button onClick={() => handleToggle(todo)} style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
                  <div style={{
                    height: 20, width: 20, borderRadius: '50%', border: `2px solid ${todo.done ? 'rgba(100,180,60,1)' : C.border}`,
                    backgroundColor: todo.done ? 'rgba(100,180,60,1)' : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease',
                  }}>
                    {todo.done && <svg viewBox="0 0 24 24" style={{ height: 12, width: 12, fill: C.cream }}><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                  </div>
                </button>
                <span style={{ flex: 1, fontSize: 13, color: todo.done ? C.mutedText : C.darkBrown, textDecoration: todo.done ? 'line-through' : 'none' }}>{todo.text}</span>
                {todo.level_link && (
                  <span
                    onClick={() => goToLevel(todo.level_link!)}
                    style={{ flexShrink: 0, cursor: 'pointer', borderRadius: 99, padding: '2px 10px', fontSize: 11, color: C.mutedText, backgroundColor: C.lightTan, border: `1px solid ${C.border}` }}
                  >
                    Level {todo.level_link}
                  </span>
                )}
                <button onClick={() => handleDelete(todo.id)} className="opacity-0 group-hover:opacity-100 transition" style={{ flexShrink: 0, background: 'none', border: 'none', cursor: 'pointer', color: C.tan, fontSize: 13 }}>✕</button>
              </div>
            ))}

            <div className="flex gap-2" style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${C.border}` }}>
              <input
                value={newTodo}
                onChange={(e) => setNewTodo(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAddTodo()}
                placeholder="Add a task…"
                className="flex-1 focus:outline-none"
                style={{ backgroundColor: C.warmWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.darkBrown }}
              />
              <select
                value={newTodoLevel}
                onChange={(e) => setNewTodoLevel(e.target.value ? Number(e.target.value) : '')}
                className="focus:outline-none"
                style={{ backgroundColor: C.warmWhite, border: `1px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: C.mutedText }}
              >
                <option value="">No level</option>
                {[1, 2, 3, 4, 5, 6].map((l) => <option key={l} value={l}>Level {l}</option>)}
              </select>
              <button
                onClick={handleAddTodo}
                disabled={!newTodo.trim()}
                style={{ padding: '8px 18px', borderRadius: 8, fontSize: 13, fontWeight: 700, backgroundColor: C.darkBrown, color: C.cream, border: 'none', cursor: newTodo.trim() ? 'pointer' : 'not-allowed', opacity: newTodo.trim() ? 1 : 0.4 }}
              >
                Add
              </button>
            </div>
          </>)}
        </section>

      </div>
    </div>
  );
}
