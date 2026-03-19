import { useEffect, useRef, useState } from 'react';
import { literatureStart, literatureAnalyze, literatureSuggestTopics, type Phase1Data, type PaperAnalysis, type TopicSuggestion } from '@/services/authService';

export default function LiteratureReview() {
  const [phase1, setPhase1] = useState<Phase1Data | null>(null);
  const [loadingPhase1, setLoadingPhase1] = useState(true);
  const [phase1Error, setPhase1Error] = useState<string | null>(null);

  const [papers, setPapers] = useState<PaperAnalysis[]>([]);
  const [feedback, setFeedback] = useState<Record<number, 'liked' | 'disliked'>>({});
  const [input, setInput] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzeError, setAnalyzeError] = useState<string | null>(null);

  const [suggestions, setSuggestions] = useState<TopicSuggestion[] | null>(null);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    literatureStart()
      .then((res) => { if (!cancelled) { setPhase1(res); setLoadingPhase1(false); } })
      .catch((err) => { if (!cancelled) { setPhase1Error(err.message ?? 'Failed to load'); setLoadingPhase1(false); } });
    return () => { cancelled = true; };
  }, []);

  async function handleSuggestTopics() {
    setLoadingSuggestions(true);
    setSuggestError(null);
    try {
      const result = await literatureSuggestTopics(papers, feedback);
      setSuggestions(result);
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      setSuggestError(err.message ?? 'Failed to load suggestions');
    } finally {
      setLoadingSuggestions(false);
    }
  }

  async function handleAnalyze() {
    if (!input.trim()) return;
    setAnalyzing(true);
    setAnalyzeError(null);
    try {
      const result = await literatureAnalyze(input.trim(), papers, feedback);
      setPapers((prev) => [...prev, result]);
      setInput('');
      setTimeout(() => bottomRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
    } catch (err: any) {
      setAnalyzeError(err.message ?? 'Analysis failed');
    } finally {
      setAnalyzing(false);
    }
  }

  if (loadingPhase1) {
    return (
      <div className="flex h-full w-full items-center justify-center">
        <div className="flex flex-col items-center gap-3 text-neutral-400">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-600" />
          <span className="text-sm">Generating your search guide…</span>
        </div>
      </div>
    );
  }

  if (phase1Error || !phase1) {
    return (
      <div className="flex h-full w-full items-center justify-center text-sm text-red-500">
        {phase1Error ?? 'Something went wrong.'}
      </div>
    );
  }

  return (
    <div className="flex h-full w-full flex-col gap-6 overflow-y-auto p-4">

      {/* Header */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Step 3 · Literature Review</p>
        <h2 className="mt-1 text-xl font-semibold text-neutral-900">Start your search</h2>
        <p className="mt-1 text-sm text-neutral-500">Based on your research interests, here's where to begin.</p>
      </div>

      {/* Search Terms */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Search Terms</h3>
        <div className="flex flex-wrap gap-2">
          {phase1.searchTerms.map((term, i) => (
            <span key={i} className="rounded-full border border-neutral-200 bg-white px-3 py-1 text-sm text-neutral-700 shadow-sm">
              {term}
            </span>
          ))}
        </div>
      </section>

      {/* Databases */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Recommended Databases</h3>
        <div className="grid gap-2 sm:grid-cols-2">
          {phase1.databases.map((db, i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              {db.url ? (
                <a href={db.url} target="_blank" rel="noopener noreferrer" className="font-semibold text-neutral-900 hover:underline">
                  {db.name} ↗
                </a>
              ) : (
                <p className="font-semibold text-neutral-900">{db.name}</p>
              )}
              <p className="mt-1 text-sm text-neutral-500">{db.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Starter Papers */}
      <section>
        <h3 className="mb-3 text-xs font-semibold uppercase tracking-widest text-neutral-400">Starter Papers & Authors</h3>
        <div className="flex flex-col gap-3">
          {phase1.starterPapers.map((paper, i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-start gap-2">
                <p className="font-semibold text-neutral-900 flex-1">{paper.title}</p>
                {paper.isMethodology && (
                  <span className="shrink-0 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-600">Methodology</span>
                )}
              </div>
              <p className="mt-0.5 text-sm text-neutral-500">
                {paper.authors}{paper.year ? ` · ${paper.year}` : ''}
              </p>
              <p className="mt-2 text-sm text-neutral-600">{paper.why}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Divider */}
      <div className="border-t border-neutral-200" />

      {/* Phase 2: Analyzed papers */}
      {papers.length > 0 && (
        <section className="flex flex-col gap-4">
          <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Analyzed Papers</h3>
          {papers.map((paper, i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-neutral-400">Paper {i + 1}</p>
                <div className="flex gap-1">
                  <button
                    onClick={() => setFeedback((prev) => { const next = { ...prev }; if (next[i] === 'liked') delete next[i]; else next[i] = 'liked'; return next; })}
                    className={`rounded-full px-3 py-1 text-base transition ${feedback[i] === 'liked' ? 'bg-green-100 text-green-700' : 'bg-neutral-100 text-neutral-400 hover:text-green-600'}`}
                  >👍</button>
                  <button
                    onClick={() => setFeedback((prev) => { const next = { ...prev }; if (next[i] === 'disliked') delete next[i]; else next[i] = 'disliked'; return next; })}
                    className={`rounded-full px-3 py-1 text-base transition ${feedback[i] === 'disliked' ? 'bg-red-100 text-red-700' : 'bg-neutral-100 text-neutral-400 hover:text-red-600'}`}
                  >👎</button>
                </div>
              </div>
              <p className="text-sm text-neutral-600 italic line-clamp-2 mb-3">"{paper.input}"</p>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {paper.coreThemes.map((theme, j) => (
                  <span key={j} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs font-medium text-neutral-600">
                    {theme}
                  </span>
                ))}
              </div>

              <p className="text-sm text-neutral-700 mb-3">{paper.thesisRelevance}</p>

              {paper.relatedTerms.length > 0 && (
                <div className="mb-3">
                  <p className="text-xs font-semibold text-neutral-400 mb-1">Related search terms</p>
                  <div className="flex flex-wrap gap-1.5">
                    {paper.relatedTerms.map((term, j) => (
                      <span key={j} className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-xs text-neutral-600">
                        {term}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {paper.followUpPapers.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-neutral-400 mb-1">Follow-up papers</p>
                  <ul className="flex flex-col gap-1">
                    {paper.followUpPapers.map((fp, j) => (
                      <li key={j} className="text-sm text-neutral-700">
                        <span className="font-medium">{fp.title}</span>
                        {' '}<span className="text-neutral-400">· {fp.authors}</span>
                        {' — '}<span className="text-neutral-500">{fp.why}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </section>
      )}

      {/* Phase 2: Input */}
      <section className="flex flex-col gap-3">
        <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">
          {papers.length === 0 ? 'Found a paper? Paste the title or abstract' : 'Add another paper'}
        </h3>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste a paper title, abstract, or both…"
          rows={4}
          className="w-full rounded-2xl border border-neutral-200 bg-white px-4 py-3 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300 resize-none"
        />
        {analyzeError && <p className="text-xs text-red-500">{analyzeError}</p>}
        <button
          onClick={handleAnalyze}
          disabled={!input.trim() || analyzing}
          className="self-start rounded-2xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
          style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
        >
          {analyzing ? 'Analyzing…' : 'Analyze paper'}
        </button>
      </section>

      {/* Phase 3: Topic suggestions */}
      {papers.length >= 2 && (
        <>
          <div className="border-t border-neutral-200" />
          <section className="flex flex-col gap-3">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-neutral-400">Step 3 · Find a Topic</h3>
              <p className="mt-1 text-sm text-neutral-500">Not sure what to write about? Let us match you with a thesis topic based on what you've read.</p>
            </div>
            {!suggestions && (
              <>
                {suggestError && <p className="text-xs text-red-500">{suggestError}</p>}
                <button
                  onClick={handleSuggestTopics}
                  disabled={loadingSuggestions}
                  className="self-start rounded-2xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40"
                  style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
                >
                  {loadingSuggestions ? 'Finding topics…' : 'Find me a topic'}
                </button>
              </>
            )}
            {suggestions && suggestions.length === 0 && (
              <p className="text-sm text-neutral-500">No matching topics found for your university. Try reviewing more papers first.</p>
            )}
            {suggestions && suggestions.length > 0 && (
              <div className="flex flex-col gap-3">
                {suggestions.map((topic) => (
                  <div key={topic.id} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
                    <p className="font-semibold text-neutral-900">{topic.title}</p>
                    {topic.field_names?.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1.5">
                        {topic.field_names.map((f, i) => (
                          <span key={i} className="rounded-full bg-neutral-100 px-2.5 py-0.5 text-xs text-neutral-500">{f}</span>
                        ))}
                      </div>
                    )}
                    <p className="mt-2 text-sm text-neutral-600">{topic.description}</p>
                    <p className="mt-2 text-xs text-neutral-400 italic">{topic.reason}</p>
                  </div>
                ))}
                <button
                  onClick={() => { setSuggestions(null); handleSuggestTopics(); }}
                  className="self-start text-xs text-neutral-400 hover:text-neutral-600 transition"
                >
                  Refresh suggestions
                </button>
              </div>
            )}
          </section>
        </>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
