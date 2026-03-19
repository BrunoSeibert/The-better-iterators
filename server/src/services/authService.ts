import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';

const LEVELS = [1, 2, 3, 4, 5, 6, 7] as const;
const UNLOCK_DEPS: Record<number, number[]> = {
  1: [],
  2: [],
  3: [1],
  4: [1, 2, 3],
  5: [4],
  6: [5],
  7: [6],
};

function getLocalDateKey(date = new Date()) {
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-');
}

export async function touchDailyLogin(userId: string) {
  await db.query(
    `INSERT INTO "UserDailyLogin" (id, user_id, login_date)
     VALUES (gen_random_uuid()::TEXT, $1, $2::date)
     ON CONFLICT (user_id, login_date) DO NOTHING`,
    [userId, getLocalDateKey()]
  );
}

function normalizeCompletedStages(completedStages: unknown): number[] {
  if (!Array.isArray(completedStages)) {
    return [];
  }

  return [...new Set(completedStages.filter((stage): stage is number => typeof stage === 'number'))].sort((a, b) => a - b);
}

function isLevelUnlocked(level: number, completedStages: number[]) {
  return UNLOCK_DEPS[level]?.every((dependency) => completedStages.includes(dependency)) ?? false;
}

function getFirstOpenLevel(completedStages: number[]) {
  return LEVELS.find((level) => isLevelUnlocked(level, completedStages) && !completedStages.includes(level)) ?? 1;
}

function signToken(user: { id: string; name: string; email: string; is_onboarded: boolean; current_level: number; completed_stages?: number[] }) {
  return jwt.sign(
    { userId: user.id, user: { id: user.id, name: user.name, email: user.email, isOnboarded: user.is_onboarded, currentLevel: user.current_level, completedStages: user.completed_stages ?? [] } },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

export async function register(name: string, email: string, password: string) {
  const existing = await db.query('SELECT id FROM "User" WHERE email = $1', [email]);
  if (existing.rows.length > 0) throw new Error('Email already in use');

  const hashed = await bcrypt.hash(password, 10);
  const result = await db.query(
    `INSERT INTO "User" (id, name, email, password, current_level, first_login_date)
     VALUES (gen_random_uuid()::TEXT, $1, $2, $3, 1, $4::date)
     RETURNING id, name, email, is_onboarded, current_level, completed_stages, first_login_date`,
    [name, email, hashed, getLocalDateKey()]
  );
  const user = result.rows[0];
  await touchDailyLogin(user.id);
  const token = signToken(user);
  return { user: { id: user.id, name: user.name, email: user.email, isOnboarded: user.is_onboarded, currentLevel: user.current_level, completedStages: user.completed_stages ?? [] }, token };
}

export async function login(email: string, password: string) {
  const result = await db.query('SELECT id, name, email, password, is_onboarded, current_level, completed_stages FROM "User" WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('Invalid credentials');

  await touchDailyLogin(user.id);
  const token = signToken(user);
  return { user: { id: user.id, name: user.name, email: user.email, isOnboarded: user.is_onboarded, currentLevel: user.current_level, completedStages: user.completed_stages ?? [] }, token };
}

export async function completeOnboarding(
  userId: string,
  currentLevel: number,
  completedStages: number[],
  universityId: string,
  studyProgramId: string,
  degreeType: string,
  fieldIds: string[]
) {
  const result = await db.query(
    `UPDATE "User"
     SET is_onboarded = TRUE, current_level = $1, completed_stages = $2::int[],
         university_id = $3, study_program_id = $4, degree_type = $5, field_ids = $6::text[]
     WHERE id = $7
     RETURNING id, name, email, is_onboarded, current_level, completed_stages`,
    [currentLevel, completedStages, universityId, studyProgramId, degreeType, fieldIds, userId]
  );
  return { token: signToken(result.rows[0]) };
}

export async function getUserById(userId: string) {
  const result = await db.query(
    'SELECT id, name, email, is_onboarded, current_level, completed_stages, first_login_date FROM "User" WHERE id = $1',
    [userId]
  );
  return result.rows[0] ?? null;
}

export async function resetLevel(userId: string) {
  const result = await db.query(
    'UPDATE "User" SET current_level = $1, completed_stages = $2 WHERE id = $3 RETURNING id, name, email, is_onboarded, current_level, completed_stages, first_login_date',
    [1, [], userId]
  );
  return result.rows[0] ?? null;
}

export async function progressLevel(userId: string) {
  const currentResult = await db.query(
    'SELECT current_level, completed_stages FROM "User" WHERE id = $1',
    [userId]
  );
  const currentUser = currentResult.rows[0];

  if (!currentUser) {
    return null;
  }

  const completedStages = normalizeCompletedStages(currentUser.completed_stages);
  const progressableLevel =
    (typeof currentUser.current_level === 'number'
      && isLevelUnlocked(currentUser.current_level, completedStages)
      && !completedStages.includes(currentUser.current_level)
      ? currentUser.current_level
      : getFirstOpenLevel(completedStages));
  const nextCompletedStages = completedStages.includes(progressableLevel)
    ? completedStages
    : [...completedStages, progressableLevel];
  const nextLevel = getFirstOpenLevel(nextCompletedStages);

  const result = await db.query(
    `UPDATE "User"
     SET current_level = $1,
         completed_stages = $2
     WHERE id = $3
     RETURNING id, name, email, is_onboarded, current_level, completed_stages, first_login_date`,
    [nextLevel, nextCompletedStages, userId]
  );
  return result.rows[0] ?? null;
}

export async function getStreakSummary(userId: string) {
  const userResult = await db.query(
    'SELECT first_login_date FROM "User" WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];

  if (!user) return null;

  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), 1));
  const nextMonthStart = new Date(Date.UTC(now.getFullYear(), now.getMonth() + 1, 1));
  const todayKey = getLocalDateKey(now);
  const yesterday = new Date(`${todayKey}T00:00:00.000Z`);
  yesterday.setUTCDate(yesterday.getUTCDate() - 1);
  const yesterdayKey = yesterday.toISOString().slice(0, 10);

  const activeDaysResult = await db.query(
    `SELECT TO_CHAR(login_date, 'YYYY-MM-DD') AS login_date
     FROM "UserDailyLogin"
     WHERE user_id = $1
       AND login_date >= $2::date
       AND login_date < $3::date
     ORDER BY login_date ASC`,
    [userId, monthStart.toISOString().slice(0, 10), nextMonthStart.toISOString().slice(0, 10)]
  );

  const allDaysResult = await db.query(
    `SELECT TO_CHAR(login_date, 'YYYY-MM-DD') AS login_date
     FROM "UserDailyLogin"
     WHERE user_id = $1
     ORDER BY login_date DESC`,
    [userId]
  );

  const allLoginKeys = allDaysResult.rows.map((row) => row.login_date as string);
  const loginDaySet = new Set(allLoginKeys);
  const latestLoginKey = allLoginKeys[0] ?? null;

  let currentStreak = 0;
  const streakDates: string[] = [];

  if (latestLoginKey === todayKey || latestLoginKey === yesterdayKey) {
    const cursor = new Date(`${latestLoginKey}T00:00:00.000Z`);
    while (loginDaySet.has(cursor.toISOString().slice(0, 10))) {
      streakDates.push(cursor.toISOString().slice(0, 10));
      currentStreak += 1;
      cursor.setUTCDate(cursor.getUTCDate() - 1);
    }
  }

  return {
    firstLoginDate: user.first_login_date,
    currentStreak,
    activeDates: activeDaysResult.rows.map((row) => row.login_date as string),
    streakDates,
    month: monthStart.getUTCMonth() + 1,
    year: monthStart.getUTCFullYear(),
  };
}
