const LEVEL_NAMES: Record<number, string> = {
  1: 'Literature Review',
  2: 'Topic Selection',
  3: 'Research Proposal',
  4: 'Research',
  5: 'Writing',
  6: 'Defense Prep',
};

export default function CompletionModal({
  level,
  value,
  loading,
  onChange,
  onConfirm,
  onClose,
}: {
  level: number;
  value: string;
  loading: boolean;
  onChange: (v: string) => void;
  onConfirm: () => void;
  onClose: () => void;
}) {
  const isTextLevel = [1, 2, 3].includes(level);
  const label =
    level === 1 ? 'Thesis topic' : level === 2 ? 'Advisor name' : 'Research question';
  const placeholder =
    level === 1
      ? 'Enter your thesis topic...'
      : level === 2
        ? "Enter your advisor's name..."
        : 'Enter your research question...';
  const canSubmit = !isTextLevel || value.trim().length > 0;

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center"
      style={{ backgroundColor: 'rgba(24,24,27,0.55)', backdropFilter: 'blur(3px)' }}
      onClick={onClose}
    >
      <div
        className="mx-4 w-full"
        style={{
          maxWidth: 480,
          backgroundColor: 'rgba(250,250,250,1)',
          border: '1px solid rgba(161,161,170,1)',
          borderRadius: 14,
          padding: '1.75rem',
          boxShadow: '0 8px 40px rgba(39,39,42,0.16)',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-5 flex items-center justify-between">
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: '0.09em',
              textTransform: 'uppercase',
              color: 'rgba(113,113,122,1)',
            }}
          >
            Level {level} - {LEVEL_NAMES[level]}
          </p>
          <button
            onClick={onClose}
            style={{
              fontSize: 16,
              color: 'rgba(113,113,122,1)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            x
          </button>
        </div>

        {isTextLevel ? (
          <div className="flex flex-col gap-4">
            <p style={{ fontSize: 13, color: 'rgba(39,39,42,1)' }}>{label}</p>
            {level === 3 ? (
              <textarea
                autoFocus
                rows={3}
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                style={{
                  background: 'rgba(244,244,245,1)',
                  border: '1px solid rgba(161,161,170,1)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'rgba(39,39,42,1)',
                  outline: 'none',
                  resize: 'vertical',
                  width: '100%',
                }}
              />
            ) : (
              <input
                autoFocus
                type="text"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && canSubmit) onConfirm();
                }}
                placeholder={placeholder}
                style={{
                  background: 'rgba(244,244,245,1)',
                  border: '1px solid rgba(161,161,170,1)',
                  borderRadius: 8,
                  padding: '10px 14px',
                  fontSize: 13,
                  color: 'rgba(39,39,42,1)',
                  outline: 'none',
                  width: '100%',
                }}
              />
            )}
          </div>
        ) : (
          <p style={{ fontSize: 14, color: 'rgba(39,39,42,1)' }}>
            Mark <strong>{LEVEL_NAMES[level]}</strong> as complete?
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2">
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              border: '1px solid rgba(161,161,170,1)',
              background: 'none',
              color: 'rgba(82,82,91,1)',
              cursor: 'pointer',
            }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!canSubmit || loading}
            style={{
              padding: '8px 18px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              border: 'none',
              background: canSubmit ? 'rgba(39,39,42,1)' : 'rgba(212,212,216,1)',
              color: canSubmit ? 'rgba(250,250,250,1)' : 'rgba(113,113,122,1)',
              cursor: canSubmit ? 'pointer' : 'not-allowed',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Saving...' : 'Confirm'}
          </button>
        </div>
      </div>
    </div>
  );
}
