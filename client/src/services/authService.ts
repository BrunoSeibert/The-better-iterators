import { api } from './api';

const STREAK_CACHE_KEY = 'studyon.streak-summary';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  isOnboarded: boolean;
  currentLevel: number;
  completedStages: number[];
  first_login_date?: string;
  firstLoginDate?: string;
};

type RawAuthUser = {
  id: string;
  name: string;
  email: string;
  isOnboarded?: boolean;
  is_onboarded?: boolean;
  currentLevel?: number;
  current_level?: number;
  completedStages?: number[];
  completed_stages?: number[];
  first_login_date?: string;
  firstLoginDate?: string;
};

export type StreakSummary = {
  firstLoginDate: string;
  currentStreak: number;
  activeDates: string[];
  streakDates: string[];
  month: number;
  year: number;
};

const normalizeUser = (user: RawAuthUser): AuthUser => ({
  id: user.id,
  name: user.name,
  email: user.email,
  isOnboarded: user.isOnboarded ?? user.is_onboarded ?? false,
  currentLevel: user.currentLevel ?? user.current_level ?? 1,
  completedStages: user.completedStages ?? user.completed_stages ?? [],
  first_login_date: user.first_login_date,
  firstLoginDate: user.firstLoginDate ?? user.first_login_date,
});

const readCachedStreakSummary = (): StreakSummary | null => {
  try {
    const rawValue = localStorage.getItem(STREAK_CACHE_KEY);
    if (!rawValue) {
      return null;
    }

    return JSON.parse(rawValue) as StreakSummary;
  } catch {
    return null;
  }
};

let streakSummaryCache: StreakSummary | null = readCachedStreakSummary();
let streakSummaryPromise: Promise<StreakSummary> | null = null;

const persistCachedStreakSummary = (summary: StreakSummary | null) => {
  streakSummaryCache = summary;

  try {
    if (summary) {
      localStorage.setItem(STREAK_CACHE_KEY, JSON.stringify(summary));
    } else {
      localStorage.removeItem(STREAK_CACHE_KEY);
    }
  } catch {
    // Ignore localStorage write failures and keep the in-memory cache.
  }
};

export function peekStreakSummary() {
  return streakSummaryCache;
}

export function clearStreakSummaryCache() {
  streakSummaryPromise = null;
  persistCachedStreakSummary(null);
}

export async function register(name: string, email: string, password: string) {
  const res = await api.post('/auth/register', { name, email, password });
  return { ...res.data, user: normalizeUser(res.data.user) } as { user: AuthUser; token: string };
}

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password });
  return { ...res.data, user: normalizeUser(res.data.user) } as { user: AuthUser; token: string };
}

export async function me() {
  const res = await api.get('/auth/me');
  return { ...res.data, user: normalizeUser(res.data.user) } as { user: AuthUser };
}

export async function resetLevel() {
  const res = await api.post('/auth/level/reset');
  return { ...res.data, user: normalizeUser(res.data.user) } as { user: AuthUser };
}

export async function progressLevel() {
  const res = await api.post('/auth/level/progress');
  return { ...res.data, user: normalizeUser(res.data.user) } as { user: AuthUser };
}

type TopicListItem = {
  id: string;
  title: string;
  description: string;
  employment: string;
  employmentType: string | null;
  workplaceType: string | null;
  degrees: string[];
  companyId: string;
  universityName: string | null;
};

export async function getTopicsAllUniversities() {
  const res = await api.get('/topics/by-university?alluniversities=true');
  return res.data as { topics: TopicListItem[] };
}

export async function getTopicsFromOtherUniversities() {
  const res = await api.get('/topics/by-university?other=true');
  return res.data as { topics: TopicListItem[] };
}

export async function getAllTopics() {
  const res = await api.get('/topics/by-university?all=true&global=true');
  return res.data as { topics: TopicListItem[] };
}

export async function getTopicsByUniversity(all = false) {
  const res = await api.get(all ? '/topics/by-university?all=true' : '/topics/by-university');
  return res.data as { topics: TopicListItem[] };
}

export async function getTopicById(id: string) {
  const res = await api.get(`/topics/${id}`);
  return res.data as {
    topic: {
      id: string;
      title: string;
      description: string;
      type: string;
      employment: string;
      employmentType: string | null;
      workplaceType: string | null;
      degrees: string[];
      fieldIds: string[];
      companyId: string;
      universityId: string | null;
      supervisorIds: string[];
      expertIds: string[];
    };
    company: { id: string; name: string; description: string; about: string; size: string; domains: string[] } | null;
    university: { id: string; name: string; country: string; about: string } | null;
    fields: { id: string; name: string }[];
    supervisors: { id: string; firstName: string; lastName: string; title: string; email: string; about: string; researchInterests: string[] }[];
    experts: { id: string; firstName: string; lastName: string; title: string; email: string; about: string }[];
  };
}

export async function getStreakSummary(options?: { force?: boolean }) {
  if (!options?.force && streakSummaryCache) {
    return streakSummaryCache;
  }

  if (streakSummaryPromise) {
    return streakSummaryPromise;
  }

  streakSummaryPromise = api.get('/auth/streak')
    .then((res) => {
      const summary = res.data as StreakSummary;
      persistCachedStreakSummary(summary);
      return summary;
    })
    .finally(() => {
      streakSummaryPromise = null;
    });

  return streakSummaryPromise;
}

export type StarterPaper = {
  title: string;
  authors: string;
  year?: string;
  why: string;
  isMethodology?: boolean;
};

export type Phase1Data = {
  searchTerms: string[];
  databases: { name: string; url?: string; description: string }[];
  starterPapers: StarterPaper[];
};

export type PaperAnalysis = {
  input: string;
  coreThemes: string[];
  thesisRelevance: string;
  relatedTerms: string[];
  followUpPapers: { title: string; authors: string; year?: string; why: string }[];
};

export async function literatureStart(): Promise<Phase1Data> {
  const res = await api.post('/literature', { phase: 1 });
  return res.data;
}

export type TopicSuggestion = {
  id: string;
  title: string;
  description: string;
  field_names: string[];
  universityName: string | null;
  reason: string;
};

export async function getTopicsSimilarFromOthers(topicIds: string[]) {
  const res = await api.get(`/topics/by-university?other=true&fromTopicIds=${topicIds.join(',')}`);
  return res.data as { topics: TopicListItem[] };
}

export async function literatureSuggestTopics(
  papers: PaperAnalysis[],
  feedback: Record<number, 'liked' | 'disliked'>
): Promise<TopicSuggestion[]> {
  const res = await api.post('/literature', { phase: 3, papers, feedback });
  return res.data.suggestions;
}

export async function literatureAnalyze(
  input: string,
  papers: PaperAnalysis[],
  feedback: Record<number, 'liked' | 'disliked'>
): Promise<PaperAnalysis> {
  const res = await api.post('/literature', { phase: 2, input, papers, feedback });
  return { ...res.data, input };
}

export type ProposalMessage = { role: 'user' | 'assistant'; content: string };

export async function proposalTopicFeedback(
  topicTitle: string,
  topicDescription: string,
  messages: ProposalMessage[]
): Promise<{ critique: string; suggestion: string; feasibility: 'high' | 'medium' | 'low' }> {
  const res = await api.post('/proposal', { phase: 'topic-feedback', topicTitle, topicDescription, messages });
  return res.data;
}

export async function proposalSectionFeedback(
  section: 'question' | 'motivation' | 'approach' | 'outcome',
  content: string,
  allSections: Record<string, string>,
  messages: ProposalMessage[]
): Promise<{ critique: string; suggestion: string }> {
  const res = await api.post('/proposal', { phase: 'section-feedback', section, content, allSections, messages });
  return res.data;
}

export async function proposalGenerateFinal(
  topic: { title: string; description?: string },
  sections: { question: string; motivation: string; approach: string; outcome: string }
): Promise<{ title: string; body: string }> {
  const res = await api.post('/proposal', { phase: 'generate-final', topic, sections });
  return res.data;
}

// ── Research Workspace ──────────────────────────────────────────────────────

export type ResearchPaper = {
  id: number;
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
  pdf_path?: string;
  pdf_name?: string;
  created_at: string;
};

export type FoundPaper = {
  title: string;
  authors: string;
  year: number;
  why: string;
  scholarUrl: string;
};

export type SourceCheckResult = {
  journalQuality: 'high' | 'medium' | 'low' | 'unknown';
  peerReviewed: boolean;
  citationContext: string;
  flags: string[];
  verdict: string;
};

export type ConceptMapResult = {
  clusters: { id: string; label: string; theme: string; paperIndices: number[]; color: string }[];
  connections: { from: string; to: string; label: string }[];
  summary: string;
  papers: { index: number; title: string; authors?: string }[];
};

export type GapAnalysisResult = {
  gaps: { title: string; description: string }[];
  contradictions: { title: string; description: string }[];
  methodologicalGaps: { title: string; description: string }[];
  suggestedDirections: string[];
};

export type SessionRecapResult = {
  addedCount: number;
  summary: string;
  patterns: string[];
  nextStep: string;
};

export async function getResearchLibrary(): Promise<ResearchPaper[]> {
  const res = await api.get('/research/library');
  return res.data.papers;
}

export async function addResearchPaper(paper: {
  title: string;
  authors?: string;
  year?: number;
  abstract?: string;
}): Promise<ResearchPaper> {
  const res = await api.post('/research/library', paper);
  return res.data.paper;
}

export async function deleteResearchPaper(id: number): Promise<void> {
  await api.delete(`/research/library/${id}`);
}

export async function researchFindPapers(topic: string): Promise<FoundPaper[]> {
  const res = await api.post('/research/find-papers', { topic });
  return res.data.papers;
}

export async function researchCheckSource(paperId: number): Promise<SourceCheckResult> {
  const res = await api.post('/research/check-source', { paperId });
  return res.data;
}

export async function researchFormatCitation(
  paperIds: number[],
  style: 'APA' | 'MLA' | 'Chicago'
): Promise<string[]> {
  const res = await api.post('/research/format-citation', { paperIds, style });
  return res.data.citations;
}

export async function researchConceptMap(): Promise<ConceptMapResult> {
  const res = await api.post('/research/concept-map');
  return res.data;
}

export async function researchFindGaps(): Promise<GapAnalysisResult> {
  const res = await api.post('/research/find-gaps');
  return res.data;
}

export async function researchSessionRecap(sessionPaperIds?: number[]): Promise<SessionRecapResult> {
  const res = await api.post('/research/session-recap', { sessionPaperIds });
  return res.data;
}

export async function uploadResearchPdf(paperId: number, file: File): Promise<ResearchPaper> {
  const form = new FormData();
  form.append('pdf', file);
  const res = await api.post(`/research/library/${paperId}/pdf`, form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data.paper;
}

export async function deleteResearchPdf(paperId: number): Promise<void> {
  await api.delete(`/research/library/${paperId}/pdf`);
}

export function getResearchPdfUrl(paperId: number): string {
  const base = (api.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${base}/research/library/${paperId}/pdf`;
}

export async function completeOnboarding(data: {
  currentLevel: number;
  completedStages: number[];
  universityId: string;
  studyProgramId: string;
  degreeType: string;
  fieldIds: string[];
  mainDeadline?: string;
}) {
  const res = await api.patch('/auth/complete-onboarding', data);
  return res.data;
}

export type Todo = { id: string; text: string; done: boolean; level_link: number | null; created_at: string };
export type ActivityEntry = { id: string; action: string; level: number | null; step_context: number | null; created_at: string };
export type DashboardDeadlines = { main: string | null; level1: string | null; level2: string | null; level3: string | null; level4: string | null; level5: string | null; level6: string | null };
export type DashboardData = {
  user: { name: string; completedStages: number[]; currentLevel: number };
  deadlines: DashboardDeadlines;
  todos: Todo[];
  recentActivity: ActivityEntry[];
};

export async function getDashboard(): Promise<DashboardData> {
  const res = await api.get('/dashboard');
  return res.data;
}
export async function updateMainDeadline(mainDeadline: string) {
  const res = await api.patch('/dashboard/deadline', { mainDeadline });
  return res.data as { mainDeadline: string; levels: Record<number, string> };
}
export async function createTodo(text: string, levelLink?: number) {
  const res = await api.post('/dashboard/todos', { text, levelLink });
  return res.data as Todo;
}
export async function toggleTodo(id: string, done: boolean) {
  const res = await api.patch(`/dashboard/todos/${id}`, { done });
  return res.data as Todo;
}
export async function deleteTodo(id: string) {
  await api.delete(`/dashboard/todos/${id}`);
}
export async function logActivity(action: string, level?: number, stepContext?: number) {
  await api.post('/dashboard/activity', { action, level, stepContext });
}
