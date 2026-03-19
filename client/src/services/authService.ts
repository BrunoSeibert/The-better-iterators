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

export async function getTopicsAllUniversities() {
  const res = await api.get('/topics/by-university?alluniversities=true');
  return res.data as {
    topics: {
      id: string;
      title: string;
      description: string;
      employment: string;
      employmentType: string | null;
      workplaceType: string | null;
      degrees: string[];
      companyId: string;
    }[];
  };
}

export async function getTopicsFromOtherUniversities() {
  const res = await api.get('/topics/by-university?other=true');
  return res.data as {
    topics: {
      id: string;
      title: string;
      description: string;
      employment: string;
      employmentType: string | null;
      workplaceType: string | null;
      degrees: string[];
      companyId: string;
    }[];
  };
}

export async function getAllTopics() {
  const res = await api.get('/topics/by-university?all=true&global=true');
  return res.data as {
    topics: {
      id: string;
      title: string;
      description: string;
      employment: string;
      employmentType: string | null;
      workplaceType: string | null;
      degrees: string[];
      companyId: string;
    }[];
  };
}

export async function getTopicsByUniversity(all = false) {
  const res = await api.get(all ? '/topics/by-university?all=true' : '/topics/by-university');
  return res.data as {
    topics: {
      id: string;
      title: string;
      description: string;
      employment: string;
      employmentType: string | null;
      workplaceType: string | null;
      degrees: string[];
      companyId: string;
    }[];
  };
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
  reason: string;
};

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

export async function completeOnboarding(data: {
  currentLevel: number;
  completedStages: number[];
  universityId: string;
  studyProgramId: string;
  degreeType: string;
  fieldIds: string[];
}) {
  const res = await api.patch('/auth/complete-onboarding', data);
  return res.data;
}
