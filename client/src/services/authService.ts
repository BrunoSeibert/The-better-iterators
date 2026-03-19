import { api } from './api';

type AuthUser = {
  id: string;
  name: string;
  email: string;
  current_level: number;
  first_login_date?: string;
};

export async function register(name: string, email: string, password: string) {
  const res = await api.post('/auth/register', { name, email, password });
  return res.data as { user: AuthUser; token: string };
}

export async function login(email: string, password: string) {
  const res = await api.post('/auth/login', { email, password });
  return res.data as { user: AuthUser; token: string };
}

export async function me() {
  const res = await api.get('/auth/me');
  return res.data as { user: AuthUser };
}

export async function resetLevel() {
  const res = await api.post('/auth/level/reset');
  return res.data as { user: AuthUser };
}

export async function progressLevel() {
  const res = await api.post('/auth/level/progress');
  return res.data as { user: AuthUser };
}

export async function getTopicsByUniversity() {
  const res = await api.get('/topics/by-university');
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

export async function getStreakSummary() {
  const res = await api.get('/auth/streak');
  return res.data as {
    firstLoginDate: string;
    currentStreak: number;
    activeDates: string[];
    streakDates: string[];
    month: number;
    year: number;
  };
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
