import { useEffect, useRef, useState, type ReactNode } from 'react';
import { useAuthStore } from '@/store/authStore';
import {
  getResearchLibrary,
  addResearchPaper,
  deleteResearchPaper,
  uploadResearchPdf,
  researchFindPapers,
  researchCheckSource,
  researchFormatCitation,
  researchConceptMap,
  researchFindGaps,
  researchSessionRecap,
  type ResearchPaper,
  type FoundPaper,
  type SourceCheckResult,
  type ConceptMapResult,
  type GapAnalysisResult,
  type SessionRecapResult,
} from '@/services/authService';

// ── Types ────────────────────────────────────────────────────────────────────

type TabType = 'find-papers' | 'check-source' | 'format-citation' | 'concept-map' | 'find-gaps' | 'session-recap' | 'pdf-viewer';

type Tab = {
  id: string;
  type: TabType;
  label: string;
  data: FoundPaper[] | SourceCheckResult | { citations: string[]; style: string } | ConceptMapResult | GapAnalysisResult | SessionRecapResult | ResearchPaper;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function loadSession<T>(key: string): T | null {
  try { const v = sessionStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
}
function saveSession(key: string, value: unknown) {
  try { sessionStorage.setItem(key, JSON.stringify(value)); } catch {}
}

let tabCounter = (() => {
  try {
    const saved = sessionStorage.getItem('research_tabs');
    if (!saved) return 0;
    const tabs: { id: string }[] = JSON.parse(saved);
    return tabs.reduce((max, t) => {
      const n = parseInt(t.id.replace('tab-', ''), 10);
      return isNaN(n) ? max : Math.max(max, n);
    }, 0);
  } catch { return 0; }
})();
function newTabId() { return `tab-${++tabCounter}`; }

function tabLabel(type: TabType, extra?: string): string {
  const base: Record<TabType, string> = {
    'find-papers': 'Found Papers',
    'check-source': 'Source Check',
    'format-citation': 'Citations',
    'concept-map': 'Concept Map',
    'find-gaps': 'Gap Analysis',
    'session-recap': 'Session Recap',
    'pdf-viewer': 'PDF',
  };
  return extra ? `${base[type]} · ${extra}` : base[type];
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="h-4 w-4 animate-spin rounded-full border-2 border-neutral-300 border-t-neutral-700" />
  );
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">{children}</p>
  );
}

// ── Zone 1: Paper Library ─────────────────────────────────────────────────────

function PaperLibrary({
  papers,
  loading,
  selectedId,
  onSelect,
  onDelete,
  onAdd,
  onViewPdf,
  onUploadPdf,
}: {
  papers: ResearchPaper[];
  loading: boolean;
  selectedId: number | null;
  onSelect: (id: number) => void;
  onDelete: (id: number) => void;
  onAdd: () => void;
  onViewPdf: (id: number) => void;
  onUploadPdf: (id: number, file: File) => void;
}) {
  const fileInputRefs = useRef<Record<number, HTMLInputElement | null>>({});

  return (
    <div className="flex w-64 shrink-0 flex-col border-r border-neutral-200 bg-white">
      {/* Header */}
      <div className="border-b border-neutral-200 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Paper Library</p>
        <p className="mt-0.5 text-base font-semibold text-neutral-800">
          {papers.length} {papers.length === 1 ? 'paper' : 'papers'}
        </p>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center p-6">
            <Spinner />
          </div>
        ) : papers.length === 0 ? (
          <div className="p-4 text-center text-xs text-neutral-400">
            No papers yet. Add your first one below.
          </div>
        ) : (
          <ul className="divide-y divide-neutral-100">
            {papers.map((p) => (
              <li
                key={p.id}
                onClick={() => onSelect(p.id)}
                className={`group relative cursor-pointer px-4 py-3 transition hover:bg-neutral-50 ${
                  selectedId === p.id ? 'bg-neutral-100' : ''
                }`}
              >
                <div className="flex items-start gap-1.5 pr-6">
                  <p className="flex-1 text-sm font-medium leading-snug text-neutral-800 line-clamp-2">{p.title}</p>
                  {p.pdf_name && (
                    <span className="mt-0.5 shrink-0 text-xs text-red-400" title={p.pdf_name}>📄</span>
                  )}
                </div>
                {(p.authors || p.year) && (
                  <p className="mt-0.5 text-xs text-neutral-400">
                    {p.authors}{p.authors && p.year ? ' · ' : ''}{p.year}
                  </p>
                )}

                {/* PDF actions — visible on hover */}
                <div className="mt-1.5 hidden gap-1 group-hover:flex">
                  {p.pdf_name ? (
                    <button
                      onClick={(e) => { e.stopPropagation(); onViewPdf(p.id); }}
                      className="rounded-lg border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 transition hover:bg-neutral-100"
                    >
                      View PDF
                    </button>
                  ) : (
                    <>
                      <button
                        onClick={(e) => { e.stopPropagation(); fileInputRefs.current[p.id]?.click(); }}
                        className="rounded-lg border border-neutral-200 px-2 py-0.5 text-[10px] font-semibold text-neutral-600 transition hover:bg-neutral-100"
                      >
                        Attach PDF
                      </button>
                      <input
                        ref={(el) => { fileInputRefs.current[p.id] = el; }}
                        type="file"
                        accept="application/pdf"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) onUploadPdf(p.id, file);
                          e.target.value = '';
                        }}
                      />
                    </>
                  )}
                </div>

                <button
                  onClick={(e) => { e.stopPropagation(); onDelete(p.id); }}
                  className="absolute right-2 top-2.5 rounded p-1 text-neutral-300 opacity-0 transition hover:bg-red-50 hover:text-red-400 group-hover:opacity-100"
                  aria-label="Remove paper"
                >
                  <svg viewBox="0 0 24 24" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Add button */}
      <div className="border-t border-neutral-200 p-3">
        <button
          onClick={onAdd}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-200 px-3 py-2 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50"
        >
          <span className="text-base leading-none">+</span> Add paper
        </button>
      </div>
    </div>
  );
}

// ── Add Paper Modal ───────────────────────────────────────────────────────────

function AddPaperModal({
  onClose,
  onSave,
}: {
  onClose: () => void;
  onSave: (paper: { title: string; authors?: string; year?: number; abstract?: string }, pdfFile?: File) => Promise<void>;
}) {
  const [title, setTitle] = useState('');
  const [authors, setAuthors] = useState('');
  const [year, setYear] = useState(String(new Date().getFullYear()));
  const [abstract, setAbstract] = useState('');
  const [pdfFile, setPdfFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave(
        { title: title.trim(), authors: authors.trim() || undefined, year: year ? parseInt(year, 10) : undefined, abstract: abstract.trim() || undefined },
        pdfFile ?? undefined,
      );
      onClose();
    } finally {
      setSaving(false);
    }
  }

  const inputCls = 'w-full rounded-xl border border-neutral-200 bg-neutral-50 px-3 py-2.5 text-sm text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Add to Library</p>
          <h3 className="mt-1 text-lg font-semibold text-neutral-900">New Paper</h3>
        </div>

        <div className="flex flex-col gap-3">
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-500">Title *</label>
            <input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Paper title" className={inputCls} autoFocus />
          </div>
          <div className="flex gap-3">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-semibold text-neutral-500">Authors</label>
              <input value={authors} onChange={(e) => setAuthors(e.target.value)} placeholder="e.g. Vaswani et al." className={inputCls} />
            </div>
            <div className="w-24">
              <label className="mb-1 block text-xs font-semibold text-neutral-500">Year</label>
              <input value={year} onChange={(e) => setYear(e.target.value)} placeholder="2024" type="number" className={inputCls} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-500">Abstract (optional)</label>
            <textarea value={abstract} onChange={(e) => setAbstract(e.target.value)} placeholder="Paste the abstract here for richer AI analysis…" rows={4} className={`${inputCls} resize-none`} />
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-neutral-500">PDF (optional)</label>
            <input ref={fileRef} type="file" accept="application/pdf" className="hidden" onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)} />
            <div
              role="button"
              tabIndex={0}
              onClick={() => fileRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  fileRef.current?.click();
                }
              }}
              className="flex items-center gap-2 rounded-xl border border-dashed border-neutral-300 px-4 py-2.5 text-sm text-neutral-500 transition hover:border-neutral-400 hover:bg-neutral-50"
            >
              <span>📄</span>
              {pdfFile ? <span className="font-medium text-neutral-800">{pdfFile.name}</span> : 'Attach PDF…'}
              {pdfFile && <button type="button" onClick={(e) => { e.stopPropagation(); setPdfFile(null); }} className="ml-auto text-neutral-400 hover:text-red-400">✕</button>}
            </div>
          </div>
        </div>

        <div className="flex gap-3">
          <button onClick={handleSave} disabled={!title.trim() || saving} className="rounded-xl px-5 py-2.5 text-sm font-semibold transition hover:opacity-90 disabled:opacity-40" style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}>
            {saving ? 'Saving…' : 'Add to library'}
          </button>
          <button onClick={onClose} className="rounded-xl border border-neutral-200 px-5 py-2.5 text-sm font-semibold text-neutral-600 transition hover:bg-neutral-50">Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ── PDF Viewer ────────────────────────────────────────────────────────────────


// ── Zone 2: Workspace Canvas ──────────────────────────────────────────────────

function WorkspaceCanvas({ tabs, activeTabId, onSelectTab, onCloseTab, onAddToLibrary }: {
  tabs: Tab[];
  activeTabId: string | null;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onAddToLibrary: (paper: { title: string; authors?: string; year?: number }) => Promise<void>;
}) {
  const active = tabs.find((t) => t.id === activeTabId);

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Tab bar */}
      {tabs.length > 0 && (
        <div className="flex items-center gap-1 border-b border-neutral-200 bg-white px-3 pt-2 overflow-x-auto">
          {tabs.map((tab) => (
            <div
              key={tab.id}
              className={`group flex shrink-0 items-center gap-1.5 rounded-t-lg border px-3 py-1.5 text-xs font-medium transition cursor-pointer ${
                tab.id === activeTabId
                  ? 'border-neutral-200 border-b-white bg-white text-neutral-800'
                  : 'border-transparent bg-neutral-100 text-neutral-500 hover:bg-neutral-200'
              }`}
              onClick={() => onSelectTab(tab.id)}
            >
              <span>{tab.label}</span>
              <button
                onClick={(e) => { e.stopPropagation(); onCloseTab(tab.id); }}
                className="rounded p-0.5 text-neutral-400 opacity-0 transition hover:text-neutral-700 group-hover:opacity-100"
              >
                <svg viewBox="0 0 24 24" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M6 6L18 18M18 6L6 18" />
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Canvas content */}
      <div className="flex-1 overflow-y-auto p-4">
        {!active ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-2xl">🔬</div>
            <p className="text-sm font-semibold text-neutral-700">Run a tool to see results here</p>
            <p className="max-w-xs text-xs text-neutral-400">Pick a tool from the right panel. Results appear as tabs you can switch between without re-running.</p>
          </div>
        ) : (
          <TabContent tab={active} onAddToLibrary={onAddToLibrary} />
        )}
      </div>
    </div>
  );
}

// ── Tab content renderers ─────────────────────────────────────────────────────

function PdfTabContent({ paper }: { paper: ResearchPaper }) {
  const token = useAuthStore((s) => s.token);
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let url: string;
    fetch(`/api/research/library/${paper.id}/pdf`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => { if (!r.ok) throw new Error(); return r.blob(); })
      .then((blob) => { url = URL.createObjectURL(blob); setBlobUrl(url); })
      .catch(() => setError(true));
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [paper.id, token]);

  if (error) return <div className="flex h-full items-center justify-center text-sm text-red-500">Failed to load PDF.</div>;
  if (!blobUrl) return <div className="flex h-full items-center justify-center gap-3 text-neutral-400"><Spinner /><span className="text-sm">Loading PDF…</span></div>;
  return <iframe src={blobUrl} className="-m-4 block rounded-none" style={{ width: 'calc(100% + 2rem)', height: 'calc(100% + 2rem)' }} title={paper.title} />;
}

function TabContent({ tab, onAddToLibrary }: { tab: Tab; onAddToLibrary: (paper: { title: string; authors?: string; year?: number }) => Promise<void> }) {
  if (tab.type === 'find-papers') return <FindPapersResult papers={tab.data as FoundPaper[]} onAddToLibrary={onAddToLibrary} />;
  if (tab.type === 'check-source') return <CheckSourceResult result={tab.data as SourceCheckResult} />;
  if (tab.type === 'format-citation') return <CitationResult result={tab.data as { citations: string[]; style: string }} />;
  if (tab.type === 'concept-map') return <ConceptMapResultView result={tab.data as ConceptMapResult} />;
  if (tab.type === 'find-gaps') return <FindGapsResult result={tab.data as GapAnalysisResult} />;
  if (tab.type === 'session-recap') return <SessionRecapResultView result={tab.data as SessionRecapResult} />;
  if (tab.type === 'pdf-viewer') return <PdfTabContent paper={tab.data as ResearchPaper} />;
  return null;
}

function FindPapersResult({ papers, onAddToLibrary }: { papers: FoundPaper[]; onAddToLibrary: (paper: { title: string; authors?: string; year?: number }) => Promise<void> }) {
  const [added, setAdded] = useState<Set<number>>(new Set());
  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>Suggested Papers</SectionLabel>
      {papers.map((p, i) => (
        <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1">
              <p className="font-semibold text-neutral-900 leading-snug">{p.title}</p>
              <p className="mt-0.5 text-xs text-neutral-400">{p.authors}{p.year ? ` · ${p.year}` : ''}</p>
            </div>
            <a
              href={p.scholarUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
            >
              Scholar ↗
            </a>
          </div>
          <p className="mt-2 text-sm text-neutral-600">{p.why}</p>
          <button
            onClick={async () => { await onAddToLibrary({ title: p.title, authors: p.authors, year: p.year }); setAdded((s) => new Set(s).add(i)); }}
            disabled={added.has(i)}
            className="mt-3 rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50 disabled:opacity-40"
          >
            {added.has(i) ? '✓ In library' : '+ Add to library'}
          </button>
        </div>
      ))}
    </div>
  );
}

const QUALITY_STYLE: Record<string, string> = {
  high: 'bg-green-50 text-green-700 border-green-200',
  medium: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  low: 'bg-red-50 text-red-700 border-red-200',
  unknown: 'bg-neutral-100 text-neutral-500 border-neutral-200',
};

function CheckSourceResult({ result }: { result: SourceCheckResult }) {
  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <SectionLabel>Source Quality Check</SectionLabel>

      <div className="flex gap-2 flex-wrap">
        {result.sourceType && (
          <span className="rounded-full border border-neutral-200 bg-neutral-100 px-3 py-1 text-xs font-semibold text-neutral-600">
            {result.sourceType}
          </span>
        )}
        {result.journalQuality !== 'n/a' && (
          <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${QUALITY_STYLE[result.journalQuality]}`}>
            Journal quality: {result.journalQuality}
          </span>
        )}
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${result.peerReviewed ? 'bg-green-50 text-green-700 border-green-200' : 'bg-neutral-100 text-neutral-500 border-neutral-200'}`}>
          {result.peerReviewed ? 'Peer reviewed' : 'Not peer reviewed'}
        </span>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-neutral-400 mb-1">Verdict</p>
        <p className="text-sm text-neutral-800">{result.verdict}</p>
      </div>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-neutral-400 mb-1">Citation Context</p>
        <p className="text-sm text-neutral-700">{result.citationContext}</p>
      </div>

      {result.flags.length > 0 && (
        <div className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
          <p className="text-xs font-semibold text-orange-600 mb-2">Flags</p>
          <ul className="flex flex-col gap-1">
            {result.flags.map((f, i) => (
              <li key={i} className="text-sm text-orange-800">⚠ {f}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function CitationResult({ result }: { result: { citations: string[]; style: string } }) {
  const [copied, setCopied] = useState<number | null>(null);

  function copy(text: string, i: number) {
    navigator.clipboard.writeText(text);
    setCopied(i);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div className="flex flex-col gap-3">
      <SectionLabel>{result.style} Citations</SectionLabel>
      {result.citations.map((c, i) => (
        <div key={i} className="relative rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
          <p className="pr-20 text-sm text-neutral-800 leading-relaxed font-mono">{c}</p>
          <button
            onClick={() => copy(c, i)}
            className="absolute right-3 top-3 rounded-lg border border-neutral-200 px-3 py-1 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
          >
            {copied === i ? '✓ Copied' : 'Copy'}
          </button>
        </div>
      ))}
      <button
        onClick={() => navigator.clipboard.writeText(result.citations.join('\n\n'))}
        className="self-start rounded-xl border border-neutral-200 px-4 py-2 text-xs font-semibold text-neutral-600 transition hover:bg-neutral-50"
      >
        Copy all
      </button>
    </div>
  );
}

function ConceptMapResultView({ result }: { result: ConceptMapResult }) {
  return (
    <div className="flex flex-col gap-4">
      <SectionLabel>Concept Map</SectionLabel>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-sm text-neutral-700 leading-relaxed">{result.summary}</p>
      </div>

      {/* Clusters */}
      <div className="grid gap-3 sm:grid-cols-2">
        {result.clusters.map((cluster) => (
          <div
            key={cluster.id}
            className="rounded-2xl border p-4 shadow-sm"
            style={{ backgroundColor: cluster.color, borderColor: 'rgba(0,0,0,0.08)' }}
          >
            <p className="font-semibold text-neutral-900">{cluster.label}</p>
            <p className="mt-1 text-xs text-neutral-600">{cluster.theme}</p>
            <div className="mt-3 flex flex-col gap-1">
              {cluster.paperIndices.map((idx) => {
                const paper = result.papers.find((p) => p.index === idx);
                return paper ? (
                  <div key={idx} className="flex items-start gap-1.5">
                    <span className="mt-0.5 shrink-0 h-1.5 w-1.5 rounded-full bg-neutral-500" />
                    <p className="text-xs text-neutral-700 leading-snug">{paper.title}</p>
                  </div>
                ) : null;
              })}
            </div>
          </div>
        ))}
      </div>

      {/* Connections */}
      {result.connections.length > 0 && (
        <div className="flex flex-col gap-2">
          <SectionLabel>Connections</SectionLabel>
          {result.connections.map((c, i) => {
            const from = result.clusters.find((cl) => cl.id === c.from);
            const to = result.clusters.find((cl) => cl.id === c.to);
            return (
              <div key={i} className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-2.5 text-sm shadow-sm">
                <span className="font-medium text-neutral-800">{from?.label}</span>
                <span className="text-neutral-400">→</span>
                <span className="text-neutral-500 flex-1">{c.label}</span>
                <span className="text-neutral-400">→</span>
                <span className="font-medium text-neutral-800">{to?.label}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function FindGapsResult({ result }: { result: GapAnalysisResult }) {
  return (
    <div className="flex flex-col gap-5">
      <SectionLabel>Gap Analysis</SectionLabel>

      {result.gaps.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-neutral-500">Research Gaps</p>
          {result.gaps.map((g, i) => (
            <div key={i} className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <p className="font-medium text-neutral-900">{g.title}</p>
              <p className="mt-1 text-sm text-neutral-600">{g.description}</p>
            </div>
          ))}
        </div>
      )}

      {result.contradictions.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-neutral-500">Contradictions</p>
          {result.contradictions.map((g, i) => (
            <div key={i} className="rounded-2xl border border-orange-100 bg-orange-50 p-4">
              <p className="font-medium text-orange-900">{g.title}</p>
              <p className="mt-1 text-sm text-orange-800">{g.description}</p>
            </div>
          ))}
        </div>
      )}

      {result.methodologicalGaps.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-neutral-500">Methodological Gaps</p>
          {result.methodologicalGaps.map((g, i) => (
            <div key={i} className="rounded-2xl border border-blue-100 bg-blue-50 p-4">
              <p className="font-medium text-blue-900">{g.title}</p>
              <p className="mt-1 text-sm text-blue-800">{g.description}</p>
            </div>
          ))}
        </div>
      )}

      {result.suggestedDirections.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-neutral-500">Suggested Directions</p>
          {result.suggestedDirections.map((d, i) => (
            <div key={i} className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
              <span className="mt-0.5 text-base">→</span>
              <p className="text-sm text-neutral-800">{d}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SessionRecapResultView({ result }: { result: SessionRecapResult }) {
  return (
    <div className="flex flex-col gap-4 max-w-xl">
      <SectionLabel>Session Recap</SectionLabel>

      <div className="rounded-2xl border border-neutral-200 bg-white p-4 shadow-sm">
        <p className="text-xs font-semibold text-neutral-400 mb-1">
          {result.addedCount} {result.addedCount === 1 ? 'paper' : 'papers'} added this session
        </p>
        <p className="text-sm text-neutral-800 leading-relaxed">{result.summary}</p>
      </div>

      {result.patterns.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold text-neutral-500">Patterns Emerging</p>
          {result.patterns.map((p, i) => (
            <div key={i} className="flex items-start gap-3 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm">
              <span className="shrink-0 mt-0.5 text-xs text-neutral-400">#{i + 1}</span>
              <p className="text-sm text-neutral-700">{p}</p>
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-neutral-900 bg-neutral-900 p-4">
        <p className="text-xs font-semibold text-neutral-400 mb-1">Next session</p>
        <p className="text-sm font-medium text-white leading-relaxed">{result.nextStep}</p>
      </div>
    </div>
  );
}

// ── Zone 3: Tool Panel ────────────────────────────────────────────────────────

type ActivatedTool = 'find-papers' | 'check-source' | 'format-citation' | null;

function ToolPanel({
  library,
  selectedPaperId,
  loadingTool,
  onRunFindPapers,
  onRunCheckSource,
  onRunFormatCitation,
  onRunConceptMap,
  onRunFindGaps,
  onRunSessionRecap,
}: {
  library: ResearchPaper[];
  selectedPaperId: number | null;
  loadingTool: string | null;
  onRunFindPapers: (topic: string) => Promise<void>;
  onRunCheckSource: (paperId: number) => Promise<void>;
  onRunFormatCitation: (paperIds: number[], style: 'APA' | 'MLA' | 'Chicago') => Promise<void>;
  onRunConceptMap: () => Promise<void>;
  onRunFindGaps: () => Promise<void>;
  onRunSessionRecap: () => Promise<void>;
}) {
  const [activatedTool, setActivatedTool] = useState<ActivatedTool>(null);
  const [findTopic, setFindTopic] = useState('');
  const [citationStyle, setCitationStyle] = useState<'APA' | 'MLA' | 'Chicago'>('APA');
  const [selectedCitationIds, setSelectedCitationIds] = useState<number[]>([]);

  const hasLibrary = library.length >= 2;
  const isLoading = (tool: string) => loadingTool === tool;

  function toggleCitationPaper(id: number) {
    setSelectedCitationIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleFindPapers() {
    if (!findTopic.trim()) return;
    await onRunFindPapers(findTopic.trim());
    setFindTopic('');
    setActivatedTool(null);
  }

  async function handleFormatCitation() {
    const ids = selectedCitationIds.length > 0 ? selectedCitationIds : library.map((p) => p.id);
    await onRunFormatCitation(ids, citationStyle);
    setActivatedTool(null);
  }

  const btnCls = (disabled = false) =>
    `flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-sm font-medium transition ${
      disabled
        ? 'cursor-not-allowed text-neutral-300'
        : 'text-neutral-700 hover:bg-neutral-50 hover:text-neutral-900'
    }`;

  const iconBox = (emoji: string) => (
    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-neutral-100 text-sm">{emoji}</span>
  );

  return (
    <div className="flex w-60 shrink-0 flex-col gap-1 border-l border-neutral-200 bg-white px-2 py-3">
      <p className="mb-1 px-2 text-[10px] font-bold uppercase tracking-widest text-neutral-400">AI Tools</p>

      {/* Find Papers */}
      <button
        className={btnCls(isLoading('find-papers'))}
        onClick={() => setActivatedTool(activatedTool === 'find-papers' ? null : 'find-papers')}
        disabled={isLoading('find-papers')}
      >
        {isLoading('find-papers') ? <span className="flex h-7 w-7 shrink-0 items-center justify-center"><Spinner /></span> : iconBox('🔍')}
        Find papers
      </button>
      {activatedTool === 'find-papers' && (
        <div className="mb-1 ml-10 flex flex-col gap-1.5">
          <input
            autoFocus
            value={findTopic}
            onChange={(e) => setFindTopic(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleFindPapers()}
            placeholder="What are you stuck on?"
            className="w-full rounded-lg border border-neutral-200 bg-neutral-50 px-2.5 py-1.5 text-xs text-neutral-800 placeholder-neutral-400 focus:outline-none focus:ring-1 focus:ring-neutral-300"
          />
          <button
            onClick={handleFindPapers}
            disabled={!findTopic.trim()}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90 disabled:opacity-40"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Search
          </button>
        </div>
      )}

      {/* Check Source */}
      <button
        className={btnCls(!selectedPaperId || isLoading('check-source'))}
        onClick={() => selectedPaperId && onRunCheckSource(selectedPaperId)}
        disabled={!selectedPaperId || isLoading('check-source')}
        title={!selectedPaperId ? 'Select a paper from the library first' : undefined}
      >
        {isLoading('check-source') ? <span className="flex h-7 w-7 shrink-0 items-center justify-center"><Spinner /></span> : iconBox('✅')}
        Check source
      </button>
      {!selectedPaperId && (
        <p className="ml-10 text-[10px] text-neutral-400">Select a paper from the library first</p>
      )}

      {/* Format Citation */}
      <button
        className={btnCls(library.length === 0 || isLoading('format-citation'))}
        onClick={() => library.length > 0 && setActivatedTool(activatedTool === 'format-citation' ? null : 'format-citation')}
        disabled={library.length === 0 || isLoading('format-citation')}
      >
        {isLoading('format-citation') ? <span className="flex h-7 w-7 shrink-0 items-center justify-center"><Spinner /></span> : iconBox('📋')}
        Format citation
      </button>
      {activatedTool === 'format-citation' && (
        <div className="mb-1 ml-10 flex flex-col gap-2">
          {/* Style */}
          <div className="flex overflow-hidden rounded-lg border border-neutral-200 text-xs">
            {(['APA', 'MLA', 'Chicago'] as const).map((s, i) => (
              <button
                key={s}
                onClick={() => setCitationStyle(s)}
                className={`flex-1 py-1.5 font-semibold transition ${
                  citationStyle === s ? 'bg-neutral-900 text-white' : 'text-neutral-500 hover:bg-neutral-50'
                } ${i > 0 ? 'border-l border-neutral-200' : ''}`}
              >
                {s}
              </button>
            ))}
          </div>
          {/* Paper selector */}
          <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
            {library.map((p) => (
              <label key={p.id} className="flex cursor-pointer items-start gap-1.5">
                <input
                  type="checkbox"
                  checked={selectedCitationIds.includes(p.id)}
                  onChange={() => toggleCitationPaper(p.id)}
                  className="mt-0.5 shrink-0"
                />
                <span className="text-[11px] text-neutral-700 leading-snug line-clamp-1">{p.title}</span>
              </label>
            ))}
          </div>
          <p className="text-[10px] text-neutral-400">
            {selectedCitationIds.length === 0 ? 'All papers will be cited' : `${selectedCitationIds.length} selected`}
          </p>
          <button
            onClick={handleFormatCitation}
            className="rounded-lg px-3 py-1.5 text-xs font-semibold transition hover:opacity-90"
            style={{ backgroundColor: 'var(--primary)', color: 'var(--primary-foreground)' }}
          >
            Generate
          </button>
        </div>
      )}

      <div className="my-1 h-px bg-neutral-100" />

      {/* Concept Map */}
      <button
        className={btnCls(!hasLibrary || isLoading('concept-map'))}
        onClick={() => hasLibrary && onRunConceptMap()}
        disabled={!hasLibrary || isLoading('concept-map')}
        title={!hasLibrary ? 'Add at least 2 papers first' : undefined}
      >
        {isLoading('concept-map') ? <span className="flex h-7 w-7 shrink-0 items-center justify-center"><Spinner /></span> : iconBox('🗺')}
        Concept map
      </button>
      {!hasLibrary && <p className="ml-10 text-[10px] text-neutral-400">Add at least 2 papers first</p>}

      {/* Find Gaps */}
      <button
        className={btnCls(!hasLibrary || isLoading('find-gaps'))}
        onClick={() => hasLibrary && onRunFindGaps()}
        disabled={!hasLibrary || isLoading('find-gaps')}
        title={!hasLibrary ? 'Add at least 2 papers first' : undefined}
      >
        {isLoading('find-gaps') ? <span className="flex h-7 w-7 shrink-0 items-center justify-center"><Spinner /></span> : iconBox('🕳')}
        Find gaps
      </button>

      {/* Session Recap */}
      <button
        className={btnCls(library.length === 0 || isLoading('session-recap'))}
        onClick={() => library.length > 0 && onRunSessionRecap()}
        disabled={library.length === 0 || isLoading('session-recap')}
      >
        {isLoading('session-recap') ? <span className="flex h-7 w-7 shrink-0 items-center justify-center"><Spinner /></span> : iconBox('📝')}
        Session recap
      </button>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

export default function ResearchWorkspace() {
  const [library, setLibrary] = useState<ResearchPaper[]>([]);
  const [libraryLoading, setLibraryLoading] = useState(true);
  const [selectedPaperId, setSelectedPaperId] = useState<number | null>(null);
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [sessionPaperIds, setSessionPaperIds] = useState<number[]>([]);

  const [tabs, setTabs] = useState<Tab[]>(() => loadSession<Tab[]>('research_tabs') ?? []);
  const [activeTabId, setActiveTabId] = useState<string | null>(() => loadSession<string>('research_active_tab'));
  const [loadingTool, setLoadingTool] = useState<string | null>(null);
  const [toolError, setToolError] = useState<string | null>(null);

  // Fetch library on mount
  useEffect(() => {
    getResearchLibrary()
      .then(setLibrary)
      .catch(() => {})
      .finally(() => setLibraryLoading(false));
  }, []);

  useEffect(() => { saveSession('research_tabs', tabs); }, [tabs]);
  useEffect(() => { saveSession('research_active_tab', activeTabId); }, [activeTabId]);

  // ── Library actions ──────────────────────────────────────────────────────

  async function handleAddPaper(paper: { title: string; authors?: string; year?: number; abstract?: string }, pdfFile?: File) {
    const saved = await addResearchPaper(paper);
    let finalPaper = saved;
    if (pdfFile) {
      try { finalPaper = await uploadResearchPdf(saved.id, pdfFile); } catch {}
    }
    setLibrary((prev) => [...prev, finalPaper]);
    setSessionPaperIds((prev) => [...prev, finalPaper.id]);
    setSelectedPaperId(finalPaper.id);
  }

  async function handleUploadPdf(id: number, file: File) {
    try {
      const updated = await uploadResearchPdf(id, file);
      setLibrary((prev) => prev.map((p) => (p.id === id ? updated : p)));
    } catch {}
  }

  function handleViewPdf(id: number) {
    const paper = library.find((p) => p.id === id);
    if (paper) pushTab('pdf-viewer', paper, paper.title.slice(0, 20));
  }

  async function handleDeletePaper(id: number) {
    await deleteResearchPaper(id);
    setLibrary((prev) => prev.filter((p) => p.id !== id));
    setSessionPaperIds((prev) => prev.filter((x) => x !== id));
    if (selectedPaperId === id) setSelectedPaperId(null);
  }

  // ── Tab helpers ──────────────────────────────────────────────────────────

  function pushTab(type: TabType, data: Tab['data'], labelExtra?: string) {
    const id = newTabId();
    const tab: Tab = { id, type, label: tabLabel(type, labelExtra), data };
    setTabs((prev) => [...prev, tab]);
    setActiveTabId(id);
  }

  function closeTab(id: string) {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (activeTabId === id) setActiveTabId(next.length > 0 ? next[next.length - 1].id : null);
      return next;
    });
  }

  // ── Tool runners ─────────────────────────────────────────────────────────

  async function runFindPapers(topic: string) {
    setLoadingTool('find-papers');
    setToolError(null);
    try {
      const papers = await researchFindPapers(topic);
      pushTab('find-papers', papers, topic.slice(0, 20));
    } catch (e: any) { setToolError(e.message); }
    finally { setLoadingTool(null); }
  }

  async function runCheckSource(paperId: number) {
    setLoadingTool('check-source');
    setToolError(null);
    try {
      const result = await researchCheckSource(paperId);
      const paper = library.find((p) => p.id === paperId);
      pushTab('check-source', result, paper?.title.slice(0, 20));
    } catch (e: any) { setToolError(e.message); }
    finally { setLoadingTool(null); }
  }

  async function runFormatCitation(paperIds: number[], style: 'APA' | 'MLA' | 'Chicago') {
    setLoadingTool('format-citation');
    setToolError(null);
    try {
      const citations = await researchFormatCitation(paperIds, style);
      pushTab('format-citation', { citations, style }, style);
    } catch (e: any) { setToolError(e.message); }
    finally { setLoadingTool(null); }
  }

  async function runConceptMap() {
    setLoadingTool('concept-map');
    setToolError(null);
    try {
      const result = await researchConceptMap();
      pushTab('concept-map', result);
    } catch (e: any) { setToolError(e.message); }
    finally { setLoadingTool(null); }
  }

  async function runFindGaps() {
    setLoadingTool('find-gaps');
    setToolError(null);
    try {
      const result = await researchFindGaps();
      pushTab('find-gaps', result);
    } catch (e: any) { setToolError(e.message); }
    finally { setLoadingTool(null); }
  }

  async function runSessionRecap() {
    setLoadingTool('session-recap');
    setToolError(null);
    try {
      const result = await researchSessionRecap(sessionPaperIds.length > 0 ? sessionPaperIds : undefined);
      pushTab('session-recap', result);
    } catch (e: any) { setToolError(e.message); }
    finally { setLoadingTool(null); }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="flex h-full w-full overflow-hidden rounded-xl bg-white">
      {/* Zone 1 — Paper Library */}
      <PaperLibrary
        papers={library}
        loading={libraryLoading}
        selectedId={selectedPaperId}
        onSelect={setSelectedPaperId}
        onDelete={handleDeletePaper}
        onAdd={() => setAddModalOpen(true)}
        onViewPdf={handleViewPdf}
        onUploadPdf={handleUploadPdf}
      />

      {/* Zone 2 — Workspace Canvas */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Header */}
        <div className="border-b border-neutral-200 px-5 py-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-neutral-400">Step 4 · Actual Research</p>
          <h2 className="mt-0.5 text-base font-semibold text-neutral-900">Research Workspace</h2>
        </div>

        {toolError && (
          <div className="mx-4 mt-3 rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-600">
            {toolError}
            <button onClick={() => setToolError(null)} className="ml-2 font-semibold">✕</button>
          </div>
        )}

        <WorkspaceCanvas
          tabs={tabs}
          activeTabId={activeTabId}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
          onAddToLibrary={(paper) => handleAddPaper(paper)}
        />
      </div>

      {/* Zone 3 — Tool Panel */}
      <ToolPanel
        library={library}
        selectedPaperId={selectedPaperId}
        loadingTool={loadingTool}
        onRunFindPapers={runFindPapers}
        onRunCheckSource={runCheckSource}
        onRunFormatCitation={runFormatCitation}
        onRunConceptMap={runConceptMap}
        onRunFindGaps={runFindGaps}
        onRunSessionRecap={runSessionRecap}
      />

      {/* Add Paper Modal */}
      {addModalOpen && (
        <AddPaperModal
          onClose={() => setAddModalOpen(false)}
          onSave={handleAddPaper}
        />
      )}


    </div>
  );
}
