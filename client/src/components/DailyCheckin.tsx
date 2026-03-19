import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore } from '@/store/authStore';

const LEVEL_NAMES: Record<number, string> = {
  1: 'Explore topics & literature review',
  2: 'Find an advisor',
  3: 'Research proposal',
  4: 'Actual research',
  5: 'Writing',
  6: 'Defense',
  7: 'Completed',
};

const UNLOCK_DEPS: Record<number, number[]> = {
  1: [], 2: [], 3: [1], 4: [1, 2, 3], 5: [4], 6: [5], 7: [6],
};

export type CheckinData = {
  date: string;
  energy: number;
  focus: string;
  lastProgress: string;
  timeAvailable: string;
  blocker: string;
};

type Props = {
  onComplete: (data: CheckinData) => void;
};

const TIME_OPTIONS = ['20 min', '1h', '2h', 'half day', 'full day'];

export default function DailyCheckin({ onComplete }: Props) {
  const token = useAuthStore((s) => s.token);
  const user = useAuthStore((s) => s.user);

  const [energy, setEnergy] = useState<number | null>(null);
  const [focus, setFocus] = useState('');
  const [lastProgress, setLastProgress] = useState('');
  const [time, setTime] = useState('');
  const [blocker, setBlocker] = useState('');

  const [submitted, setSubmitted] = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  const canSubmit = energy !== null && focus.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    const data: CheckinData = {
      date: new Date().toISOString(),
      energy: energy!,
      focus: focus.trim(),
      lastProgress: lastProgress.trim(),
      timeAvailable: time,
      blocker: blocker.trim(),
    };
    localStorage.setItem('todayCheckin', JSON.stringify(data));
    onComplete(data);
    setSubmitted(true);
    setAiLoading(true);

    const energyLabel = ['', 'exhausted', 'tired', 'okay', 'good', 'energized'][data.energy];

    const currentLevel = user?.currentLevel ?? 1;
    const rawCompleted = user?.completedStages ?? [];
    const completedStages = rawCompleted.length > 0
      ? rawCompleted
      : Array.from({ length: currentLevel - 1 }, (_, i) => i + 1);

    const allLevels = Object.keys(UNLOCK_DEPS).map(Number);
    const unlockedIncomplete = allLevels.filter((lvl) => {
      const isUnlocked = UNLOCK_DEPS[lvl].every((dep) => completedStages.includes(dep));
      return isUnlocked && !completedStages.includes(lvl);
    });

    const allDone = completedStages.length >= allLevels.length;
    const progressContext = allDone
      ? `The student has completed all thesis stages.`
      : [
          `Current level: ${currentLevel} (${LEVEL_NAMES[currentLevel] ?? 'unknown'})`,
          `Completed: ${completedStages.length > 0 ? completedStages.map((l) => `${l} (${LEVEL_NAMES[l] ?? '?'})`).join(', ') : 'none'}`,
          `Active / in progress: ${unlockedIncomplete.map((l) => `${l} (${LEVEL_NAMES[l] ?? '?'})`).join(', ') || 'none'}`,
        ].join('\n');

    const summary = [
      `Energy: ${data.energy}/5 (${energyLabel})`,
      `Focus: ${data.focus}`,
      data.lastProgress ? `Last progress: ${data.lastProgress}` : null,
      data.timeAvailable ? `Time available: ${data.timeAvailable}` : null,
      data.blocker ? `Blocker: ${data.blocker}` : null,
    ].filter(Boolean).join('\n');

    // Save to DB and fetch history in parallel
    let checkinId: number | null = null;
    let historyContext = '';
    try {
      const [saveRes, histRes] = await Promise.all([
        fetch('/api/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(data),
        }),
        fetch('/api/checkin', { headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (saveRes.ok) {
        const saved = await saveRes.json();
        checkinId = saved.id ?? null;
      }
      if (histRes.ok) {
        const { history } = await histRes.json() as { history: any[] };
        const past = history
          .filter((h) => new Date(h.date).toDateString() !== new Date(data.date).toDateString())
          .slice(-5);
        if (past.length > 0) {
          historyContext = '\n\nPrevious sessions (most recent last):\n' + past.map((h) => {
            const d = new Date(h.date).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
            const lines = [`[${d}] focus: "${h.focus}"${h.last_progress ? `, left off: "${h.last_progress}"` : ''}`];
            if (h.ai_response) lines.push(`  → suggested: "${h.ai_response.slice(0, 120).replace(/\n/g, ' ')}…"`);
            return lines.join('\n');
          }).join('\n');
        }
      }
    } catch { /* continue without history */ }

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          messages: [{ role: 'user', content: `Here's my daily check-in:\n${summary}\n\nMy thesis progress:\n${progressContext}${historyContext}\n\nGive me a short, motivating response and one concrete suggestion to get started today — building on what was done before, not repeating the same advice.` }],
        }),
      });
      const resData = await res.json();
      const reply = resData.message?.content ?? 'Have a great session!';
      setAiResponse(reply);
      // Persist AI response to DB
      if (checkinId) {
        fetch(`/api/checkin/${checkinId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify({ aiResponse: reply }),
        }).catch(() => {});
      }
    } catch {
      setAiResponse('Have a great session today!');
    } finally {
      setAiLoading(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    color: 'var(--muted-foreground)',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  };

  const inputStyle: React.CSSProperties = {
    background: 'var(--input, transparent)',
    border: '1px solid var(--border)',
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: 14,
    color: 'var(--foreground)',
    outline: 'none',
    width: '100%',
  };

  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        <div className="rounded-xl p-4" style={{ background: 'var(--muted)', border: '1px solid var(--border)' }}>
          <p style={{ fontSize: 12, ...labelStyle, marginBottom: 8 }}>Your check-in</p>
          <p style={{ fontSize: 14, color: 'var(--foreground)' }}>
            ⚡ {energy}/5 &nbsp;·&nbsp; {focus}
            {time && <>&nbsp;·&nbsp; {time}</>}
          </p>
        </div>

        {aiLoading ? (
          <div className="flex items-center gap-2" style={{ color: 'var(--muted-foreground)', fontSize: 14 }}>
            <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
            Thinking…
          </div>
        ) : aiResponse ? (
          <div className="rounded-xl p-4" style={{ background: 'var(--background)', border: '1px solid var(--border)' }}>
            <p style={{ ...labelStyle, marginBottom: 8 }}>Studyon</p>
            <div className="prose prose-sm max-w-none" style={{ color: 'var(--foreground)' }}>
              <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
            </div>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div style={{ width: '100%' }} className="flex flex-col gap-6">

      {/* Energy */}
      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Energy level</span>
        <div className="flex gap-3 items-end">
          {[1, 2, 3, 4, 5].map((val) => {
            const active = energy === val;
            const size = 18 + val * 5;
            return (
              <button
                key={val}
                onClick={() => setEnergy(val)}
                style={{
                  width: size, height: size, borderRadius: '50%',
                  border: active ? '2px solid var(--primary)' : '2px solid var(--border)',
                  backgroundColor: active ? 'var(--primary)' : 'transparent',
                  opacity: active ? 1 : 0.35 + val * 0.13,
                  transition: 'all 0.15s ease',
                  cursor: 'pointer', flexShrink: 0,
                }}
                aria-label={`Energy ${val}`}
              />
            );
          })}
        </div>
      </div>

      {/* Where did you leave off */}
      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Where did you leave off?</span>
        <input
          type="text"
          value={lastProgress}
          onChange={(e) => setLastProgress(e.target.value)}
          placeholder="What did you last work on?"
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = 'var(--ring, var(--primary))')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      {/* Focus */}
      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Today's focus</span>
        <input
          type="text"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="What do you want to work on today?"
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = 'var(--ring, var(--primary))')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      {/* Time available */}
      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Time available</span>
        <div className="flex" style={{ border: '1px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
          {TIME_OPTIONS.map((opt, i) => {
            const active = time === opt;
            return (
              <button
                key={opt}
                onClick={() => setTime(active ? '' : opt)}
                style={{
                  flex: 1, padding: '9px 4px', fontSize: 12,
                  fontWeight: active ? 600 : 400,
                  background: active ? 'var(--primary)' : 'transparent',
                  color: active ? 'var(--primary-foreground)' : 'var(--foreground)',
                  border: 'none',
                  borderLeft: i > 0 ? '1px solid var(--border)' : 'none',
                  cursor: 'pointer',
                  transition: 'background 0.12s ease, color 0.12s ease',
                  whiteSpace: 'nowrap',
                }}
              >
                {opt}
              </button>
            );
          })}
        </div>
      </div>

      {/* Blocker */}
      <div className="flex flex-col gap-2">
        <span style={labelStyle}>Blocker</span>
        <input
          type="text"
          value={blocker}
          onChange={(e) => setBlocker(e.target.value)}
          placeholder="Anything in the way? (optional)"
          style={inputStyle}
          onFocus={(e) => (e.target.style.borderColor = 'var(--ring, var(--primary))')}
          onBlur={(e) => (e.target.style.borderColor = 'var(--border)')}
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          padding: '12px 24px', borderRadius: 12, fontSize: 14, fontWeight: 600,
          background: canSubmit ? 'var(--primary)' : 'var(--muted)',
          color: canSubmit ? 'var(--primary-foreground)' : 'var(--muted-foreground)',
          border: 'none',
          cursor: canSubmit ? 'pointer' : 'not-allowed',
          opacity: canSubmit ? 1 : 0.5,
          transition: 'all 0.15s ease',
          alignSelf: 'flex-start',
        }}
      >
        Start session →
      </button>
    </div>
  );
}
