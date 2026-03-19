import { useEffect, useRef, useState } from 'react';
import {
  proposalTopicFeedback,
  proposalSectionFeedback,
  proposalGenerateFinal,
  logActivity,
  type ProposalMessage,
} from '@/services/authService';
import { useAuthStore } from '@/store/authStore';

// ── persistence helpers ──────────────────────────────────────────────────────
function load<T>(key: string): T | null {
  try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function save(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

// ── types ────────────────────────────────────────────────────────────────────
type FeedbackEntry = {
  role: 'ai' | 'user';
  critique?: string;
  suggestion?: string;
  feasibility?: 'high' | 'medium' | 'low';
  text?: string; // for user follow-up messages
};

type SectionKey = 'question' | 'motivation' | 'approach' | 'outcome';

type SectionState = {
  content: string;
  feedback: FeedbackEntry[];
};

type ProposalState = {
  step: number;
  topic: { title: string; description: string };
  sections: Record<SectionKey, SectionState>;
  finalProposal: { title: string; body: string } | null;
};

const SECTION_KEYS: SectionKey[] = ['question', 'motivation', 'approach', 'outcome'];

const STEP_META = [
  {
    key: 'topic',
    label: 'Topic',
    title: 'Your Research Topic',
    placeholder: 'Describe the topic you want to write your thesis about…',
    hint: 'What is the subject area and angle you want to explore? Be as specific as you can.',
  },
  {
    key: 'question',
    label: 'Research Question',
    title: 'Core Research Question',
    placeholder: 'e.g. How does X influence Y in the context of Z?',
    hint: 'Frame a single, focused question your thesis will answer. Avoid yes/no questions.',
  },
  {
    key: 'motivation',
    label: 'Motivation',
    title: 'Why This Matters',
    placeholder: 'Explain why this topic is relevant, what gap it fills, and why now…',
    hint: 'What problem does this research address? Who benefits from the findings?',
  },
  {
    key: 'approach',
    label: 'Approach',
    title: 'Research Approach',
    placeholder: 'Describe your methodology — data sources, methods, tools…',
    hint: 'How will you conduct the research? Qualitative, quantitative, mixed? What data will you use?',
  },
  {
    key: 'outcome',
    label: 'Expected Outcome',
    title: 'Expected Contribution',
    placeholder: 'What will your thesis deliver? What new knowledge or artefact will it produce?',
    hint: 'Be concrete — a framework, a model, empirical findings, design recommendations?',
  },
  { key: 'final', label: 'Final Proposal', title: 'Your Research Proposal', hint: '' },
];

const FEASIBILITY_COLOR: Record<string, string> = {
  high: 'text-green-600 bg-green-50 border-green-200',
  medium: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  low: 'text-red-600 bg-red-50 border-red-200',
};

const DEFAULT_STATE: ProposalState = {
  step: 0,
  topic: { title: '', description: '' },
  sections: {
    question: { content: '', feedback: [] },
    motivation: { content: '', feedback: [] },
    approach: { content: '', feedback: [] },
    outcome: { content: '', feedback: [] },
  },
  finalProposal: null,
};

// ── component ─────────────────────────────────────────────────────────────────
export default function ResearchProposal({ onMarkComplete }: { onMarkComplete?: () => void } = {}) {
  const userId = useAuthStore((s) => s.user?.id ?? 'anon');
  const k = (key: string) => `${userId}:${key}`;

  const [state, setState] = useState<ProposalState>(() => load(k('proposal_state')) ?? DEFAULT_STATE);
  const [loading, setLoading] = useState(false);
  const [followUp, setFollowUp] = useState('');
  const [generating, setGenerating] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => { save(k('proposal_state'), state); }, [state]);

  const step = state.step;
  const meta = STEP_META[step];

  // current text input value
  const currentContent = step === 0
    ? state.topic.description
    : state.sections[SECTION_KEYS[step - 1]]?.content ?? '';

  const currentFeedback = step === 0
    ? (load<FeedbackEntry[]>(k('proposal_topic_feedback')) ?? [])
    : state.sections[SECTION_KEYS[step - 1]]?.feedback ?? [];

  // ── setters ─────────────────────────────────────────────────────────────────
  const setContent = (val: string) => {
    if (step === 0) {
      setState((s) => ({ ...s, topic: { ...s.topic, description: val } }));
    } else {
      const key = SECTION_KEYS[step - 1];
      setState((s) => ({
        ...s,
        sections: { ...s.sections, [key]: { ...s.sections[key], content: val } },
      }));
    }
  };

  const setTopicTitle = (val: string) => {
    setState((s) => ({ ...s, topic: { ...s.topic, title: val } }));
  };

  const appendFeedback = (entry: FeedbackEntry) => {
    if (step === 0) {
      const prev = load<FeedbackEntry[]>(k('proposal_topic_feedback')) ?? [];
      save(k('proposal_topic_feedback'), [...prev, entry]);
    } else {
      const key = SECTION_KEYS[step - 1];
      setState((s) => ({
        ...s,
        sections: {
          ...s.sections,
          [key]: { ...s.sections[key], feedback: [...s.sections[key].feedback, entry] },
        },
      }));
    }
  };

  // ── get feedback ─────────────────────────────────────────────────────────────
  const getFeedback = async (userFollowUp?: string) => {
    setLoading(true);
    try {
      const existingMessages: ProposalMessage[] = currentFeedback.flatMap((f): ProposalMessage[] => {
        if (f.role === 'ai') return [{ role: 'assistant', content: `${f.critique ?? ''}\n\nSuggestion: ${f.suggestion ?? ''}` }];
        return [{ role: 'user', content: f.text ?? '' }];
      });

      if (userFollowUp) {
        appendFeedback({ role: 'user', text: userFollowUp });
        existingMessages.push({ role: 'user', content: userFollowUp });
      }

      if (step === 0) {
        const result = await proposalTopicFeedback(state.topic.title, state.topic.description, existingMessages);
        appendFeedback({ role: 'ai', ...result });
        logActivity('Got AI feedback on research topic', 3, 0);
      } else {
        const key = SECTION_KEYS[step - 1];
        const allSections: Record<string, string> = {};
        SECTION_KEYS.forEach((k) => { allSections[k] = state.sections[k].content; });
        const result = await proposalSectionFeedback(key, currentContent, allSections, existingMessages);
        appendFeedback({ role: 'ai', ...result });
        logActivity(`Got AI feedback on proposal ${key}`, 3, step);
      }

      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } finally {
      setLoading(false);
      setFollowUp('');
    }
  };

  const handleFollowUp = () => {
    if (!followUp.trim()) return;
    getFeedback(followUp.trim());
  };

  // ── navigation ───────────────────────────────────────────────────────────────
  const canAdvance = step === 0
    ? state.topic.title.trim().length > 0
    : currentContent.trim().length > 0;

  const handleNext = async () => {
    if (step < 5) {
      const stepLabels = ['topic', 'research question', 'motivation', 'approach', 'expected outcome'];
      logActivity(`Completed proposal step: ${stepLabels[step]}`, 3, step);
      setState((s) => ({ ...s, step: s.step + 1 }));
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 50);
    }
    if (step === 4) {
      // moving to final — generate proposal
      setGenerating(true);
      try {
        const result = await proposalGenerateFinal(state.topic, {
          question: state.sections.question.content,
          motivation: state.sections.motivation.content,
          approach: state.sections.approach.content,
          outcome: state.sections.outcome.content,
        });
        setState((s) => ({ ...s, finalProposal: result, step: 5 }));
        logActivity('Generated final research proposal', 3, 5);
      } finally {
        setGenerating(false);
      }
    }
  };

  const handleBack = () => {
    setState((s) => ({ ...s, step: Math.max(0, s.step - 1) }));
  };

  const applySuggestion = (suggestion: string) => {
    if (step === 0) setTopicTitle(suggestion);
    else setContent(suggestion);
  };

  const copyProposal = () => {
    if (state.finalProposal) {
      navigator.clipboard.writeText(`# ${state.finalProposal.title}\n\n${state.finalProposal.body}`);
      onMarkComplete?.();
    }
  };

  const resetProposal = () => {
    setState(DEFAULT_STATE);
    save(k('proposal_topic_feedback'), []);
  };

  // ── render topic feedback (loaded from sessionStorage for step 0) ──────────
  const topicFeedback = load<FeedbackEntry[]>(k('proposal_topic_feedback')) ?? [];
  const renderedFeedback = step === 0 ? topicFeedback : currentFeedback;

  // ── final loading ─────────────────────────────────────────────────────────
  if (step === 5 && generating) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          <span className="text-sm">Assembling your proposal…</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-0 overflow-y-auto">

      {/* Step indicator */}
      <div className="sticky top-0 z-10 border-b border-neutral-200 bg-white px-6 py-3">
        <div className="flex items-center gap-1.5">
          {STEP_META.map((s, i) => (
            <div key={s.key} className="flex items-center gap-1.5">
              <button
                onClick={() => i < step && setState((st) => ({ ...st, step: i }))}
                className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                  i === step
                    ? 'bg-neutral-900 text-white'
                    : i < step
                      ? 'bg-neutral-200 text-neutral-700 hover:bg-neutral-300 cursor-pointer'
                      : 'bg-neutral-100 text-neutral-400 cursor-default'
                }`}
              >
                {i < step ? '✓ ' : ''}{s.label}
              </button>
              {i < STEP_META.length - 1 && (
                <div className={`h-px w-4 ${i < step ? 'bg-neutral-400' : 'bg-neutral-200'}`} />
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-1 flex-col gap-6 p-6">

        {/* Step header */}
        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
            Step {step + 1} of {STEP_META.length} · Research Proposal
          </p>
          <h2 className="mt-1 text-xl font-semibold text-neutral-900">{meta.title}</h2>
          {meta.hint && <p className="mt-1 text-sm text-neutral-500">{meta.hint}</p>}
        </div>

        {/* ── Final proposal view ── */}
        {step === 5 && state.finalProposal && (
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl border border-neutral-200 bg-white p-6 shadow-sm">
              <h3 className="text-lg font-semibold text-neutral-900 mb-4">{state.finalProposal.title}</h3>
              <div className="prose prose-sm max-w-none text-neutral-700 whitespace-pre-wrap">
                {state.finalProposal.body}
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={copyProposal}
                className="rounded-2xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90"
                style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
              >
                Copy to clipboard
              </button>
              <button
                onClick={resetProposal}
                className="rounded-2xl border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50"
              >
                Start over
              </button>
            </div>
          </div>
        )}

        {/* ── Input steps (0–4) ── */}
        {step < 5 && (
          <>
            {/* Topic step has two fields */}
            {step === 0 && (
              <div className="flex flex-col gap-3">
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-500">Topic title</label>
                  <input
                    value={state.topic.title}
                    onChange={(e) => setTopicTitle(e.target.value)}
                    placeholder="e.g. AI-driven personalisation in e-learning platforms"
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-semibold text-neutral-500">Brief description (optional)</label>
                  <textarea
                    value={state.topic.description}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder={meta.placeholder}
                    rows={3}
                    className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-none"
                  />
                </div>
              </div>
            )}

            {/* Section steps */}
            {step > 0 && (
              <div className="flex flex-col gap-3">
                <textarea
                  value={currentContent}
                  onChange={(e) => setContent(e.target.value)}
                  placeholder={meta.placeholder}
                  rows={5}
                  className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-none"
                />
              </div>
            )}

            {/* Get feedback button */}
            <button
              onClick={() => getFeedback()}
              disabled={loading || (step === 0 ? !state.topic.title.trim() : !currentContent.trim())}
              className="self-start rounded-2xl border border-neutral-200 px-5 py-2 text-sm font-semibold text-neutral-700 transition hover:bg-neutral-50 disabled:opacity-40"
            >
              {loading ? 'Getting feedback…' : renderedFeedback.length > 0 ? 'Re-evaluate' : 'Get AI feedback'}
            </button>

            {/* Feedback thread */}
            {renderedFeedback.length > 0 && (
              <div className="flex flex-col gap-3">
                <div className="h-px bg-neutral-100" />
                <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">AI Feedback</p>

                {renderedFeedback.map((entry, i) => (
                  <div key={i}>
                    {entry.role === 'user' && (
                      <div className="flex justify-end">
                        <div className="max-w-[80%] rounded-2xl bg-neutral-900 px-4 py-3 text-sm text-white">
                          {entry.text}
                        </div>
                      </div>
                    )}
                    {entry.role === 'ai' && (
                      <div className="flex flex-col gap-2">
                        {/* Feasibility badge (topic step only) */}
                        {entry.feasibility && (
                          <span className={`self-start rounded-full border px-3 py-0.5 text-xs font-semibold ${FEASIBILITY_COLOR[entry.feasibility]}`}>
                            Feasibility: {entry.feasibility}
                          </span>
                        )}
                        {/* Critique */}
                        <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                          <p className="text-xs font-semibold text-neutral-400 mb-1">Feedback</p>
                          <p className="text-sm text-neutral-700">{entry.critique}</p>
                        </div>
                        {/* Suggestion */}
                        {entry.suggestion && (
                          <div className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
                            <div className="flex items-start justify-between gap-2">
                              <div>
                                <p className="text-xs font-semibold text-blue-500 mb-1">{step === 0 ? 'Suggested title' : 'Suggested improvement'}</p>
                                <p className="text-sm text-blue-900">{entry.suggestion}</p>
                              </div>
                              <button
                                onClick={() => applySuggestion(entry.suggestion!)}
                                className="shrink-0 rounded-xl border border-blue-200 bg-white px-3 py-1 text-xs font-semibold text-blue-600 hover:bg-blue-50 transition"
                              >
                                Apply
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                {/* Follow-up input */}
                <div className="flex gap-2 mt-1">
                  <input
                    value={followUp}
                    onChange={(e) => setFollowUp(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFollowUp()}
                    placeholder="Ask a follow-up question…"
                    className="flex-1 rounded-2xl border border-neutral-200 bg-white px-4 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300"
                  />
                  <button
                    onClick={handleFollowUp}
                    disabled={!followUp.trim() || loading}
                    className="rounded-2xl px-4 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                    style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                  >
                    Ask
                  </button>
                </div>
              </div>
            )}
          </>
        )}

        {/* Navigation */}
        <div className="flex items-center gap-3 pt-2">
          {step > 0 && step < 5 && (
            <button
              onClick={handleBack}
              className="rounded-2xl border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50"
            >
              ← Back
            </button>
          )}
          {step < 5 && (
            <button
              onClick={handleNext}
              disabled={!canAdvance || generating}
              className="rounded-2xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
              style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
            >
              {step === 4 ? (generating ? 'Generating…' : 'Generate Proposal →') : 'Next →'}
            </button>
          )}
        </div>

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
