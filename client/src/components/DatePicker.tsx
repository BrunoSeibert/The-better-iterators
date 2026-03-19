import { useEffect, useRef, useState } from 'react';

const C = {
  darkBrown: 'rgba(38,38,38,1)',
  midBrown:  'rgba(82,82,91,1)',
  tan:       'rgba(161,161,170,1)',
  lightTan:  'rgba(228,228,231,1)',
  cream:     'rgba(250,250,250,1)',
  warmWhite: 'rgba(244,244,245,1)',
  border:    'rgba(212,212,216,1)',
  mutedText: 'rgba(113,113,122,1)',
};

const DAYS = ['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function toYMD(d: Date) {
  return d.toISOString().slice(0, 10);
}

function parseYMD(s: string): Date | null {
  if (!s) return null;
  const d = new Date(s + 'T00:00:00');
  return isNaN(d.getTime()) ? null : d;
}

type Props = {
  value: string; // 'YYYY-MM-DD' or ''
  onChange: (val: string) => void;
  min?: string;
  placeholder?: string;
};

export default function DatePicker({ value, onChange, min, placeholder = 'Select a date' }: Props) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const minDate = min ? parseYMD(min) : today;

  const selected = parseYMD(value);
  const [open, setOpen] = useState(false);
  const [cursor, setCursor] = useState<{ year: number; month: number }>(() => {
    const base = selected ?? today;
    return { year: base.getFullYear(), month: base.getMonth() };
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  function prevMonth() {
    setCursor(c => c.month === 0
      ? { year: c.year - 1, month: 11 }
      : { year: c.year, month: c.month - 1 });
  }

  function nextMonth() {
    setCursor(c => c.month === 11
      ? { year: c.year + 1, month: 0 }
      : { year: c.year, month: c.month + 1 });
  }

  // Build grid: Monday-first
  const firstDay = new Date(cursor.year, cursor.month, 1);
  const lastDay  = new Date(cursor.year, cursor.month + 1, 0);
  // 0=Sun..6=Sat → Mon-first offset
  const startOffset = (firstDay.getDay() + 6) % 7;
  const cells: (number | null)[] = [
    ...Array(startOffset).fill(null),
    ...Array.from({ length: lastDay.getDate() }, (_, i) => i + 1),
  ];
  // pad to full weeks
  while (cells.length % 7 !== 0) cells.push(null);

  function selectDay(day: number) {
    const d = new Date(cursor.year, cursor.month, day);
    onChange(toYMD(d));
    setOpen(false);
  }

  function isDisabled(day: number) {
    if (!minDate) return false;
    const d = new Date(cursor.year, cursor.month, day);
    return d < minDate;
  }

  function isSelected(day: number) {
    if (!selected) return false;
    return selected.getFullYear() === cursor.year &&
           selected.getMonth() === cursor.month &&
           selected.getDate() === day;
  }

  function isToday(day: number) {
    return today.getFullYear() === cursor.year &&
           today.getMonth() === cursor.month &&
           today.getDate() === day;
  }

  const displayValue = selected
    ? selected.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          borderRadius: 12,
          border: `2px solid ${open ? C.darkBrown : C.border}`,
          backgroundColor: C.cream,
          cursor: 'pointer',
          fontSize: 14,
          color: displayValue ? C.darkBrown : C.mutedText,
          transition: 'border-color 0.15s ease',
        }}
      >
        <span>{displayValue || placeholder}</span>
        <svg viewBox="0 0 24 24" style={{ width: 16, height: 16, fill: 'none', stroke: C.mutedText, strokeWidth: 2, flexShrink: 0 }}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        </svg>
      </button>

      {/* Calendar dropdown */}
      {open && (
        <div style={{
          position: 'absolute',
          top: 'calc(100% + 8px)',
          left: 0,
          zIndex: 999,
          width: 300,
          backgroundColor: C.cream,
          border: `2px solid ${C.border}`,
          borderRadius: 14,
          boxShadow: '0 8px 32px rgba(0,0,0,0.10)',
          padding: '16px',
          userSelect: 'none',
        }}>
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
            <button
              type="button"
              onClick={prevMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, color: C.midBrown, fontSize: 16, lineHeight: 1 }}
            >
              ‹
            </button>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.darkBrown }}>
              {MONTHS[cursor.month]} {cursor.year}
            </span>
            <button
              type="button"
              onClick={nextMonth}
              style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px 8px', borderRadius: 8, color: C.midBrown, fontSize: 16, lineHeight: 1 }}
            >
              ›
            </button>
          </div>

          {/* Day labels */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 6 }}>
            {DAYS.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: C.mutedText, padding: '2px 0', letterSpacing: '0.05em' }}>
                {d}
              </div>
            ))}
          </div>

          {/* Days grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {cells.map((day, i) => {
              if (!day) return <div key={i} />;
              const disabled = isDisabled(day);
              const sel      = isSelected(day);
              const tod      = isToday(day);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => !disabled && selectDay(day)}
                  style={{
                    width: '100%',
                    aspectRatio: '1',
                    borderRadius: 8,
                    border: tod && !sel ? `2px solid ${C.border}` : '2px solid transparent',
                    backgroundColor: sel ? C.darkBrown : 'transparent',
                    color: sel ? C.cream : disabled ? C.lightTan : C.darkBrown,
                    fontSize: 13,
                    fontWeight: sel ? 700 : 400,
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    transition: 'background-color 0.1s ease',
                  }}
                  onMouseEnter={e => { if (!disabled && !sel) (e.currentTarget as HTMLButtonElement).style.backgroundColor = C.lightTan; }}
                  onMouseLeave={e => { if (!sel) (e.currentTarget as HTMLButtonElement).style.backgroundColor = 'transparent'; }}
                >
                  {day}
                </button>
              );
            })}
          </div>

          {/* Footer */}
          {value && (
            <button
              type="button"
              onClick={() => { onChange(''); setOpen(false); }}
              style={{ marginTop: 12, width: '100%', fontSize: 12, color: C.mutedText, background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}
            >
              Clear
            </button>
          )}
        </div>
      )}
    </div>
  );
}
