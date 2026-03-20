import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getDashboard, updateMainDeadline, updateLevelDeadline, createTodo, toggleTodo, deleteTodo, completeLevel,
  getLevelMetadata, setLevelMetadata,
  type DashboardData, type Todo, type DashboardDeadlines,
} from '@/services/authService';
import { useAuthStore } from '@/store/authStore';
import { peekStreakSummary } from '@/services/authService';
import DailyCheckin from '@/components/DailyCheckin';
import CompletionModal from '@/components/CompletionModal';
import DatePicker from '@/components/DatePicker';
import studyonLogo from '@/assets/Study_Logo.png';
import badgerImage from '@/assets/Badger_2.png';

const C = {
  darkBrown:  'rgba(38,38,38,1)',
  midBrown:   'rgba(82,82,91,1)',
  tan:        'rgba(161,161,170,1)',
  lightTan:   'rgba(228,228,231,1)',
  cream:      'rgba(250,250,250,1)',
  warmWhite:  'rgba(244,244,245,1)',
  border:     'rgba(212,212,216,1)',
  mutedText:  'rgba(113,113,122,1)',
  success:    'rgba(163,204,96,1)',
  successSoft:'rgba(234,247,202,0.95)',
};

const LEVEL_NAMES: Record<number, string> = {
  1: 'Topic Selection', 2: 'Advisor Selection', 3: 'Research Proposal',
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
  const diff = new Date(dateStr.slice(0, 10) + 'T00:00:00').getTime() - new Date().setHours(0, 0, 0, 0);
  return Math.ceil(diff / (1000 * 60 * 60 * 24));
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  // Slice to YYYY-MM-DD to avoid UTC→local timezone shift when the DB returns ISO datetime strings
  const d = new Date(dateStr.slice(0, 10) + 'T00:00:00');
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
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
  const [editingLevelDeadline, setEditingLevelDeadline] = useState<number | null>(null);
  const [levelDeadlineInput, setLevelDeadlineInput] = useState('');
  const streak = peekStreakSummary()?.currentStreak ?? 0;

  const [checkinOpen, setCheckinOpen] = useState(false);

  const [completionModal, setCompletionModal] = useState<{ level: number; value: string } | null>(null);
  const [completionLoading, setCompletionLoading] = useState(false);
  const [levelUpNumber, setLevelUpNumber] = useState<number | null>(null);
  const [levelUpVisible, setLevelUpVisible] = useState(false);
  const [levelUpExiting, setLevelUpExiting] = useState(false);
  const levelUpTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showLevelUpAnimation = (unlockedLevel: number) => {
    if (levelUpTimerRef.current) clearTimeout(levelUpTimerRef.current);
    setLevelUpNumber(unlockedLevel);
    setLevelUpExiting(false);
    setLevelUpVisible(true);
    levelUpTimerRef.current = setTimeout(() => {
      setLevelUpExiting(true);
      setTimeout(() => { setLevelUpVisible(false); setLevelUpExiting(false); }, 400);
    }, 1500);
  };
  const [subtitles, setSubtitles] = useState<Record<number, string>>({});
  const [editingSubtitle, setEditingSubtitle] = useState<number | null>(null);
  const [subtitleInput, setSubtitleInput] = useState('');
  const [subtitleSaving, setSubtitleSaving] = useState(false);

  useEffect(() => {
    getLevelMetadata().then((meta) => setSubtitles(meta as Record<number, string>)).catch(() => {});
  }, []);

  const SUBTITLE_LABELS: Record<number, string> = {
    1: 'Thesis topic', 2: 'Advisor name', 3: 'Research question',
  };

  async function saveSubtitle(level: number) {
    if (!subtitleInput.trim()) return;
    setSubtitleSaving(true);
    try {
      await setLevelMetadata(level, subtitleInput.trim());
      setSubtitles((prev) => ({ ...prev, [level]: subtitleInput.trim() }));
      setEditingSubtitle(null);
    } finally {
      setSubtitleSaving(false);
    }
  }

  useEffect(() => {
    if (!completionModal) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setCompletionModal(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [completionModal]);

  const handleMarkComplete = async () => {
    if (!completionModal || !data) return;
    const { level, value } = completionModal;
    if ([1, 2, 3].includes(level) && !value.trim()) return;
    setCompletionLoading(true);
    try {
      const result = await completeLevel(level);
      if ([1, 2, 3].includes(level)) {
        await setLevelMetadata(level, value.trim());
        setSubtitles((prev) => ({ ...prev, [level]: value.trim() }));
      }
      setData((prev) => prev ? { ...prev, user: result.user } : prev);
      setCompletionModal(null);
      showLevelUpAnimation(result.user.currentLevel);
    } finally {
      setCompletionLoading(false);
    }
  };

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
    try {
      const result = await updateMainDeadline(deadlineInput);
      setData((d) => d ? {
        ...d,
        deadlines: {
          main: deadlineInput,
          level1: result.levels[1] ?? null, level2: result.levels[2] ?? null, level3: result.levels[3] ?? null,
          level4: result.levels[4] ?? null, level5: result.levels[5] ?? null, level6: result.levels[6] ?? null,
        },
      } : d);
      setEditingDeadline(false);
    } catch {
      alert('Failed to save deadline. Please try again.');
    }
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
      <div className="flex h-screen w-full items-center justify-center bg-neutral-100">
        <div className="h-6 w-6 animate-spin rounded-full border-2" style={{ borderColor: 'rgba(212,212,216,1)', borderTopColor: 'rgba(38,38,38,1)' }} />
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



  const sectionLabel = (text: string) => (
    <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.mutedText, marginBottom: 10 }}>{text}</p>
  );

  const card = (children: React.ReactNode, style?: React.CSSProperties) => (
    <div style={{ backgroundColor: C.cream, border: `2px solid ${C.border}`, borderRadius: 12, padding: '1.25rem', ...style }}>
      {children}
    </div>
  );

  return (
    <div className="min-h-screen bg-neutral-100 pb-16">
      {/* Navbar */}
      <header className="sticky top-0 z-30 flex h-[max(10vh,72px)] items-center gap-4 border-b border-neutral-700 bg-neutral-800 px-4 sm:px-6 lg:px-8">
        <img src={studyonLogo} alt="Studyon logo" className="h-12 w-12 object-contain brightness-0 invert shrink-0" />
        <div className="flex items-center gap-3">
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: 'rgba(212,212,216,1)' }}>Dashboard</p>
          <button
            onClick={() => navigate('/app')}
            className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition"
            style={{ color: 'rgba(229,229,229,1)', border: '2px solid rgba(82,82,91,1)' }}
          >
            Workspace →
          </button>
        </div>
        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={() => navigate('/profile', { state: { returnTo: '/dashboard' } })}
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm transition"
            style={{ color: 'rgba(212,212,216,1)', border: '2px solid rgba(82,82,91,1)' }}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center" style={{ backgroundColor: 'rgba(24,24,27,0.55)', backdropFilter: 'blur(3px)' }} onClick={() => setCheckinOpen(false)}>
          <div className="relative mx-4 w-full overflow-y-auto" style={{ maxWidth: 600, maxHeight: '90vh', backgroundColor: C.cream, border: `2px solid ${C.border}`, borderRadius: 14, padding: '2rem', boxShadow: '0 8px 40px rgba(24,24,27,0.16)' }} onClick={(e) => e.stopPropagation()}>
            <div className="mb-6 flex items-center justify-between">
              <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.09em', textTransform: 'uppercase', color: C.mutedText }}>Daily check-in</p>
              <button onClick={() => setCheckinOpen(false)} style={{ fontSize: 16, color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer' }}>✕</button>
            </div>
            <DailyCheckin onComplete={() => {}} />
          </div>
        </div>
      )}

      {/* Level-up animation */}
      {levelUpVisible && (
        <div className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center"
          style={{ backgroundColor: 'rgba(0,0,0,0.35)', backdropFilter: 'blur(6px)', animation: 'levelup-backdrop-in 0.3s ease forwards' }}>
          <div className="flex flex-col items-center gap-5 px-14 py-10 text-center"
            style={{ backgroundColor: 'rgba(252,248,243,1)', border: '1px solid rgba(196,177,160,1)', borderRadius: 18, boxShadow: '0 8px 40px rgba(81,60,45,0.22)', animation: levelUpExiting ? 'levelup-card-out 0.4s ease forwards' : 'levelup-card-in 0.45s cubic-bezier(0.34,1.56,0.64,1) forwards' }}>
            <div className="flex h-16 w-16 items-center justify-center rounded-full"
              style={{ backgroundColor: 'rgba(81,60,45,1)', animation: 'levelup-check 0.5s cubic-bezier(0.34,1.56,0.64,1) 0.15s both' }}>
              <svg viewBox="0 0 24 24" className="h-8 w-8" style={{ fill: 'rgba(252,248,243,1)' }}>
                <path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17Z" />
              </svg>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest" style={{ color: 'rgba(140,115,95,1)' }}>Congratulations</p>
              <p className="mt-1 text-2xl font-semibold" style={{ color: 'rgba(81,60,45,1)' }}>One step closer to your thesis</p>
              {levelUpNumber && <p className="mt-2 text-sm" style={{ color: 'rgba(140,115,95,1)' }}>{LEVEL_NAMES[levelUpNumber]} is now unlocked</p>}
            </div>
          </div>
        </div>
      )}

      {/* Mark complete modal */}
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
            <div key={label} className="text-center rounded-xl py-3 px-2" style={{ backgroundColor: C.cream, border: `2px solid ${C.border}` }}>
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
                    backgroundColor: completed ? C.successSoft : C.cream,
                    border: `2px solid ${completed ? C.success : C.border}`,
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
                      backgroundColor: completed ? 'rgba(163,204,96,0.22)' : isCurrent ? C.darkBrown : C.lightTan,
                      color: completed ? 'rgba(95,128,39,1)' : isCurrent ? C.cream : C.mutedText,
                    }}>
                      {completed ? '✓ Done' : isCurrent ? 'Current' : 'Locked'}
                    </span>
                    <span style={{ fontSize: 11, color: C.mutedText }}>Level {level}</span>
                  </div>
                  <p style={{ fontSize: 13, fontWeight: 600, color: C.darkBrown }}>{LEVEL_NAMES[level]}</p>
                  {[1, 2, 3].includes(level) && completed && (
                    editingSubtitle === level ? (
                      <div className="mt-2" onClick={(e) => e.stopPropagation()}>
                        <input
                          autoFocus
                          value={subtitleInput}
                          onChange={(e) => setSubtitleInput(e.target.value)}
                          onKeyDown={(e) => { if (e.key === 'Enter') saveSubtitle(level); if (e.key === 'Escape') setEditingSubtitle(null); }}
                          placeholder={SUBTITLE_LABELS[level]}
                          style={{ width: '100%', fontSize: 11, padding: '4px 8px', borderRadius: 6, border: `1px solid ${C.tan}`, color: C.darkBrown, backgroundColor: 'white', outline: 'none' }}
                        />
                        <div className="mt-1 flex gap-1">
                          <button
                            onClick={() => saveSubtitle(level)}
                            disabled={subtitleSaving || !subtitleInput.trim()}
                            style={{ fontSize: 10, fontWeight: 700, padding: '3px 10px', borderRadius: 99, border: 'none', backgroundColor: C.darkBrown, color: C.cream, cursor: 'pointer', opacity: subtitleSaving || !subtitleInput.trim() ? 0.4 : 1 }}
                          >
                            {subtitleSaving ? '…' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingSubtitle(null)}
                            style={{ fontSize: 10, padding: '3px 10px', borderRadius: 99, border: `1px solid ${C.border}`, backgroundColor: 'transparent', color: C.mutedText, cursor: 'pointer' }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="mt-1 flex items-center gap-1 group/sub" onClick={(e) => e.stopPropagation()}>
                        <p style={{ fontSize: 11, color: C.mutedText, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                          {subtitles[level] || <span style={{ fontStyle: 'italic' }}>Not set</span>}
                        </p>
                        <button
                          onClick={() => { setSubtitleInput(subtitles[level] ?? ''); setEditingSubtitle(level); }}
                          className="opacity-0 group-hover/sub:opacity-100 transition"
                          style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.warmWhite, color: C.mutedText, cursor: 'pointer', flexShrink: 0 }}
                        >
                          ✎
                        </button>
                      </div>
                    )
                  )}
                  {![1, 2, 3].includes(level) && subtitles[level] && (
                    <p style={{ fontSize: 11, color: C.mutedText, marginTop: 2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {subtitles[level]}
                    </p>
                  )}
                  {levelDeadlineMap[level] && !completed && (
                    <div className="mt-1.5 flex items-center gap-1.5">
                      <DeadlinePill days={days} />
                      {overdue && <span style={{ fontSize: 11, color: C.mutedText, fontStyle: 'italic' }}>Keep going!</span>}
                    </div>
                  )}
                  {!unlocked && <p style={{ fontSize: 11, color: C.mutedText, marginTop: 4 }}>Complete previous levels first</p>}
                  {isCurrent && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setCompletionModal({ level, value: '' }); }}
                      style={{
                        marginTop: 10, fontSize: 11, fontWeight: 700, padding: '4px 12px',
                        borderRadius: 99, border: `1px solid ${C.tan}`,
                        background: C.lightTan, color: C.darkBrown, cursor: 'pointer',
                      }}
                    >
                      Mark complete
                    </button>
                  )}
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
              {/* Main deadline */}
              <div style={{ marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: C.mutedText }}>Submission date</p>
                {!editingDeadline ? (
                  <div className="flex items-center justify-between">
                    <p style={{ fontSize: 18, fontWeight: 700, color: C.darkBrown, marginTop: 2 }}>{formatDate(deadlines.main)}</p>
                    <button
                      onClick={() => { setDeadlineInput((deadlines.main ?? '').slice(0, 10)); setEditingDeadline(true); }}
                      style={{ fontSize: 11, color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer', padding: 0, textDecoration: 'underline' }}
                    >
                      {deadlines.main ? 'Change' : 'Set'}
                    </button>
                  </div>
                ) : (
                  <div className="mt-2 flex flex-col gap-2">
                    <DatePicker value={deadlineInput} onChange={setDeadlineInput} min={new Date().toISOString().slice(0, 10)} />
                    <div className="flex gap-2">
                      <button onClick={handleDeadlineSave} style={{ padding: '7px 16px', borderRadius: 8, fontSize: 12, fontWeight: 700, backgroundColor: C.darkBrown, color: C.cream, border: 'none', cursor: 'pointer' }}>Save</button>
                      <button onClick={() => setEditingDeadline(false)} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, color: C.mutedText, background: 'none', border: `2px solid ${C.border}`, cursor: 'pointer' }}>Cancel</button>
                    </div>
                  </div>
                )}
              </div>

              {/* Per-level deadlines */}
              <div style={{ borderTop: `1px solid ${C.border}`, paddingTop: 12 }}>
                <p style={{ fontSize: 10, fontWeight: 700, letterSpacing: '0.07em', textTransform: 'uppercase', color: C.mutedText, marginBottom: 8 }}>Level deadlines</p>
                {[1, 2, 3, 4, 5, 6].map((l) => {
                  const done = completedStages.includes(l);
                  const isEditingThis = editingLevelDeadline === l;
                  return (
                    <div key={l} style={{ marginBottom: 8 }}>
                      <div className="group/dl flex items-center justify-between">
                        <span style={{ fontSize: 12, color: done ? C.mutedText : C.midBrown, textDecoration: done ? 'line-through' : 'none' }}>
                          Level {l} · {LEVEL_NAMES[l]}
                        </span>
                        <div className="flex items-center gap-2">
                          {done
                            ? <span style={{ fontSize: 12, color: 'rgba(80,160,40,1)' }}>✓</span>
                            : <DeadlinePill days={daysUntil(levelDeadlineMap[l])} />
                          }
                          {!isEditingThis && (
                            <button
                              onClick={() => { setLevelDeadlineInput((levelDeadlineMap[l] ?? '').slice(0, 10)); setEditingLevelDeadline(l); }}
                              className="opacity-0 group-hover/dl:opacity-100 transition"
                              style={{ fontSize: 10, padding: '2px 6px', borderRadius: 6, border: `1px solid ${C.border}`, backgroundColor: C.warmWhite, color: C.mutedText, cursor: 'pointer' }}
                            >
                              ✎
                            </button>
                          )}
                        </div>
                      </div>
                      {isEditingThis && (
                        <div className="mt-1.5 flex flex-col gap-1.5">
                          <DatePicker value={levelDeadlineInput} onChange={setLevelDeadlineInput} min={new Date().toISOString().slice(0, 10)} />
                          <div className="flex gap-1.5">
                            <button
                              onClick={async () => {
                                try {
                                  const { levels } = await updateLevelDeadline(l, levelDeadlineInput);
                                  setData((d) => d ? {
                                    ...d,
                                    deadlines: {
                                      ...d.deadlines,
                                      level1: levels[1] ?? null, level2: levels[2] ?? null,
                                      level3: levels[3] ?? null, level4: levels[4] ?? null,
                                      level5: levels[5] ?? null, level6: levels[6] ?? null,
                                    },
                                  } : d);
                                  setEditingLevelDeadline(null);
                                } catch {
                                  alert('Failed to save deadline. Please try again.');
                                }
                              }}
                              style={{ padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, backgroundColor: C.darkBrown, color: C.cream, border: 'none', cursor: 'pointer' }}
                            >
                              Save
                            </button>
                            <button
                              onClick={() => setEditingLevelDeadline(null)}
                              style={{ padding: '6px 10px', borderRadius: 8, fontSize: 12, color: C.mutedText, background: 'none', border: `2px solid ${C.border}`, cursor: 'pointer' }}
                            >
                              Cancel
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
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
                    height: 20, width: 20, borderRadius: '50%', border: `2px solid ${todo.done ? C.success : C.border}`,
                    backgroundColor: todo.done ? C.success : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s ease',
                  }}>
                    {todo.done && <svg viewBox="0 0 24 24" style={{ height: 12, width: 12, fill: C.cream }}><path d="M9 16.17 4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/></svg>}
                  </div>
                </button>
                <span style={{ flex: 1, fontSize: 13, color: todo.done ? C.mutedText : C.darkBrown, textDecoration: todo.done ? 'line-through' : 'none' }}>{todo.text}</span>
                {todo.level_link && (
                  <span
                    onClick={() => goToLevel(todo.level_link!)}
                    style={{ flexShrink: 0, cursor: 'pointer', borderRadius: 99, padding: '2px 10px', fontSize: 11, color: C.mutedText, backgroundColor: C.lightTan, border: `2px solid ${C.border}` }}
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
                  style={{ backgroundColor: C.warmWhite, border: `2px solid ${C.border}`, borderRadius: 8, padding: '8px 12px', fontSize: 13, color: C.darkBrown }}
              />
              <select
                value={newTodoLevel}
                onChange={(e) => setNewTodoLevel(e.target.value ? Number(e.target.value) : '')}
                className="focus:outline-none"
                style={{ backgroundColor: C.warmWhite, border: `2px solid ${C.border}`, borderRadius: 8, padding: '8px 10px', fontSize: 13, color: C.mutedText }}
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
