import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useAuthStore } from '@/store/authStore';
import mascotBackImage from '@/assets/dailycheckin-mascot-back.png';
import mascotFrontImage from '@/assets/dailycheckin-mascot-front.png';

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

// App colour tokens
const C = {
  darkBrown:  'rgba(38,38,38,1)',
  midBrown:   'rgba(82,82,91,1)',
  tan:        'rgba(161,161,170,1)',
  lightTan:   'rgba(228,228,231,1)',
  cream:      'rgba(250,250,250,1)',
  warmWhite:  'rgba(244,244,245,1)',
  border:     'rgba(212,212,216,1)',
  mutedText:  'rgba(113,113,122,1)',
};

const layeredMascotStyle: React.CSSProperties = {
  position: 'absolute',
  top: -103,
  left: 0,
  width: 162,
  height: 162,
  objectFit: 'contain',
  pointerEvents: 'none',
};

export default function DailyCheckin({ onComplete }: Props) {
  const token = useAuthStore((s) => s.token);
  const user  = useAuthStore((s) => s.user);

  const [energy,       setEnergy]       = useState<number | null>(null);
  const [focus,        setFocus]        = useState('');
  const [lastProgress, setLastProgress] = useState('');
  const [time,         setTime]         = useState('');
  const [blocker,      setBlocker]      = useState('');

  const [submitted,  setSubmitted]  = useState(false);
  const [aiResponse, setAiResponse] = useState<string | null>(null);
  const [aiLoading,  setAiLoading]  = useState(false);

  const canSubmit = energy !== null && focus.trim().length > 0;

  async function handleSubmit() {
    if (!canSubmit) return;
    const data: CheckinData = {
      date:          new Date().toISOString(),
      energy:        energy!,
      focus:         focus.trim(),
      lastProgress:  lastProgress.trim(),
      timeAvailable: time,
      blocker:       blocker.trim(),
    };
    localStorage.setItem('todayCheckin', JSON.stringify(data));
    onComplete(data);
    setSubmitted(true);
    setAiLoading(true);

    const energyLabel = ['', 'exhausted', 'tired', 'okay', 'good', 'energized'][data.energy];
    const currentLevel    = user?.currentLevel ?? 1;
    const rawCompleted    = user?.completedStages ?? [];
    const completedStages = rawCompleted.length > 0
      ? rawCompleted
      : Array.from({ length: currentLevel - 1 }, (_, i) => i + 1);

    const allLevels        = Object.keys(UNLOCK_DEPS).map(Number);
    const unlockedIncomplete = allLevels.filter((lvl) =>
      UNLOCK_DEPS[lvl].every((dep) => completedStages.includes(dep)) && !completedStages.includes(lvl)
    );
    const allDone = completedStages.length >= allLevels.length;

    const progressContext = allDone
      ? 'The student has completed all thesis stages.'
      : [
          `Current level: ${currentLevel} (${LEVEL_NAMES[currentLevel] ?? 'unknown'})`,
          `Completed: ${completedStages.length > 0 ? completedStages.map((l) => `${l} (${LEVEL_NAMES[l] ?? '?'})`).join(', ') : 'none'}`,
          `Active / in progress: ${unlockedIncomplete.map((l) => `${l} (${LEVEL_NAMES[l] ?? '?'})`).join(', ') || 'none'}`,
        ].join('\n');

    const summary = [
      `Energy: ${data.energy}/5 (${energyLabel})`,
      `Focus: ${data.focus}`,
      data.lastProgress  ? `Last progress: ${data.lastProgress}`   : null,
      data.timeAvailable ? `Time available: ${data.timeAvailable}` : null,
      data.blocker       ? `Blocker: ${data.blocker}`              : null,
    ].filter(Boolean).join('\n');

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

  // ── Submitted state ───────────────────────────────────────────────────────
  if (submitted) {
    return (
      <div className="flex flex-col gap-4">
        {/* Summary pill */}
        <div
          className="rounded-[0.5rem] px-4 py-3 flex flex-wrap gap-x-3 gap-y-1 items-center"
          style={{ background: C.lightTan, border: `1px solid ${C.border}` }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: C.mutedText, letterSpacing: '0.07em', textTransform: 'uppercase' }}>
            Check-in
          </span>
          <span style={{ fontSize: 13, color: C.darkBrown, fontWeight: 600 }}>
            {'●'.repeat(energy ?? 0)}{'○'.repeat(5 - (energy ?? 0))}
          </span>
          <span style={{ color: C.border }}>·</span>
          <span style={{ fontSize: 13, color: C.darkBrown }}>{focus}</span>
          {time && <>
            <span style={{ color: C.border }}>·</span>
            <span style={{ fontSize: 13, color: C.midBrown }}>{time}</span>
          </>}
        </div>

        {/* AI response */}
        {aiLoading ? (
          <div className="flex items-center gap-3 px-1 py-2" style={{ color: C.mutedText, fontSize: 14 }}>
            <span
              className="inline-block h-4 w-4 animate-spin rounded-full border-2"
              style={{ borderColor: C.tan, borderTopColor: C.darkBrown }}
            />
            Thinking…
          </div>
        ) : aiResponse ? (
          <div className="relative mt-16">
            <img
              src={mascotBackImage}
              alt=""
              aria-hidden="true"
              style={{
                ...layeredMascotStyle,
                zIndex: 0,
              }}
            />
            <div
              className="rounded-[0.5rem] px-4 pt-5 pb-4"
              style={{ background: C.warmWhite, border: `1px solid ${C.border}`, position: 'relative', zIndex: 1 }}
            >
              <p style={{ fontSize: 11, fontWeight: 700, color: C.mutedText, letterSpacing: '0.08em', textTransform: 'uppercase', marginBottom: 10 }}>
                Noodle
              </p>
              <div
                className="prose prose-sm max-w-none"
                style={{ color: C.darkBrown, '--tw-prose-body': C.darkBrown, '--tw-prose-bold': C.darkBrown } as any}
              >
                <ReactMarkdown remarkPlugins={[remarkGfm]}>{aiResponse}</ReactMarkdown>
              </div>
            </div>
            <img
              src={mascotFrontImage}
              alt="Noodle"
              style={{
                ...layeredMascotStyle,
                top: -105,
                zIndex: 2,
              }}
            />
          </div>
        ) : null}
      </div>
    );
  }

  // ── Form ──────────────────────────────────────────────────────────────────
  const Label = ({ children }: { children: string }) => (
    <span style={{ fontSize: 11, fontWeight: 700, color: C.mutedText, letterSpacing: '0.08em', textTransform: 'uppercase' as const }}>
      {children}
    </span>
  );

  const inputBase: React.CSSProperties = {
    background: C.cream,
    border: `1px solid ${C.border}`,
    borderRadius: 8,
    padding: '10px 14px',
    fontSize: 14,
    color: C.darkBrown,
    outline: 'none',
    width: '100%',
    transition: 'border-color 0.12s ease',
  };

  return (
    <div className="flex flex-col gap-6" style={{ width: '100%' }}>

      {/* Energy */}
      <div className="flex flex-col gap-2">
        <Label>Energy level</Label>
        <div className="flex gap-3 items-end">
          {[1, 2, 3, 4, 5].map((val) => {
            const active = energy !== null && val <= energy;
            const size   = 18 + val * 5;
            return (
              <button
                key={val}
                onClick={() => setEnergy(val)}
                aria-label={`Energy ${val}`}
                style={{
                  width: size, height: size, borderRadius: '50%', flexShrink: 0,
                  border:           `2px solid ${active ? C.darkBrown : C.border}`,
                  backgroundColor:  active ? C.darkBrown : C.lightTan,
                  opacity:          active ? 1 : 0.4 + val * 0.12,
                  transform:        active ? 'scale(1.12)' : 'scale(1)',
                  transition:       'all 0.15s ease',
                  cursor:           'pointer',
                  boxShadow:        active ? `0 2px 6px rgba(38,38,38,0.2)` : 'none',
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Where did you leave off */}
      <div className="flex flex-col gap-2">
        <Label>Where did you leave off?</Label>
        <input
          type="text"
          value={lastProgress}
          onChange={(e) => setLastProgress(e.target.value)}
          placeholder="What did you last work on?"
          style={inputBase}
          onFocus={(e) => (e.target.style.borderColor = C.darkBrown)}
          onBlur={(e)  => (e.target.style.borderColor = C.border)}
        />
      </div>

      {/* Today's focus */}
      <div className="flex flex-col gap-2">
        <Label>Today's focus</Label>
        <input
          type="text"
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder="What do you want to work on today?"
          style={inputBase}
          onFocus={(e) => (e.target.style.borderColor = C.darkBrown)}
          onBlur={(e)  => (e.target.style.borderColor = C.border)}
        />
      </div>

      {/* Time available */}
      <div className="flex flex-col gap-2">
        <Label>Time available</Label>
        <div
          className="flex overflow-hidden"
          style={{ border: `1px solid ${C.border}`, borderRadius: 8 }}
        >
          {TIME_OPTIONS.map((opt, i) => {
            const active = time === opt;
            return (
              <button
                key={opt}
                onClick={() => setTime(active ? '' : opt)}
                style={{
                  flex: 1,
                  padding: '9px 4px',
                  fontSize: 12,
                  fontWeight: active ? 700 : 400,
                  background: active ? C.darkBrown : 'transparent',
                  color:      active ? C.cream     : C.midBrown,
                  border:     'none',
                  borderLeft: i > 0 ? `1px solid ${C.border}` : 'none',
                  cursor:     'pointer',
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
        <Label>Blocker</Label>
        <input
          type="text"
          value={blocker}
          onChange={(e) => setBlocker(e.target.value)}
          placeholder="Anything in the way? (optional)"
          style={inputBase}
          onFocus={(e) => (e.target.style.borderColor = C.darkBrown)}
          onBlur={(e)  => (e.target.style.borderColor = C.border)}
        />
      </div>

      {/* Submit */}
      <button
        onClick={handleSubmit}
        disabled={!canSubmit}
        style={{
          alignSelf:     'flex-start',
          padding:       '11px 26px',
          borderRadius:  8,
          fontSize:      14,
          fontWeight:    700,
          border:        `2px solid ${canSubmit ? C.darkBrown : C.border}`,
          background:    canSubmit ? C.tan  : C.lightTan,
          color:         canSubmit ? C.darkBrown : C.mutedText,
          cursor:        canSubmit ? 'pointer' : 'not-allowed',
          opacity:       canSubmit ? 1 : 0.55,
          transition:    'all 0.15s ease',
          letterSpacing: '0.01em',
        }}
      >
        Start session →
      </button>
    </div>
  );
}
