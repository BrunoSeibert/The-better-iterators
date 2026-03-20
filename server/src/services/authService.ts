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

const LEVEL_WEIGHTS = [0.15, 0.25, 0.40, 0.55, 0.80, 1.0];

function computeLevelDeadlines(mainDeadline: string): Record<number, string> {
  const today = new Date();
  const d = new Date(mainDeadline);
  const totalMs = d.getTime() - today.getTime();
  const result: Record<number, string> = {};
  LEVEL_WEIGHTS.forEach((w, i) => {
    result[i + 1] = new Date(today.getTime() + totalMs * w).toISOString().slice(0, 10);
  });
  result[6] = d.toISOString().slice(0, 10);
  return result;
}

export async function completeOnboarding(
  userId: string,
  currentLevel: number,
  completedStages: number[],
  universityId: string,
  studyProgramId: string,
  degreeType: string,
  fieldIds: string[],
  mainDeadline?: string
) {
  const levels = mainDeadline ? computeLevelDeadlines(mainDeadline) : null;
  const result = await db.query(
    `UPDATE "User"
     SET is_onboarded = TRUE, current_level = $1, completed_stages = $2::int[],
         university_id = $3, study_program_id = $4, degree_type = $5, interests = $6::text[],
         main_deadline = $7, level1_deadline = $8, level2_deadline = $9, level3_deadline = $10,
         level4_deadline = $11, level5_deadline = $12, level6_deadline = $13
     WHERE id = $14
     RETURNING id, name, email, is_onboarded, current_level, completed_stages`,
    [
      currentLevel, completedStages, universityId, studyProgramId, degreeType, fieldIds,
      mainDeadline ?? null,
      levels?.[1] ?? null, levels?.[2] ?? null, levels?.[3] ?? null,
      levels?.[4] ?? null, levels?.[5] ?? null, levels?.[6] ?? null,
      userId,
    ]
  );
  const FIXED_TODOS = [
    { text: 'Find at least 5 relevant papers for your literature review', level: 1 },
    { text: 'Analyze and annotate your key papers', level: 1 },
    { text: 'Define your core research question', level: 3 },
    { text: 'Complete all research proposal sections', level: 3 },
    { text: 'Get supervisor feedback on your proposal', level: 3 },
    { text: 'Outline your thesis chapter structure', level: 5 },
    { text: 'Write your thesis introduction', level: 5 },
  ];
  const todoValues = FIXED_TODOS.map((_, i) => `(gen_random_uuid()::TEXT, $1, $${i * 2 + 2}, false, $${i * 2 + 3})`).join(', ');
  const todoParams = FIXED_TODOS.flatMap((t) => [t.text, t.level]);
  await db.query(
    `INSERT INTO todos (id, user_id, text, done, level_link) VALUES ${todoValues}`,
    [userId, ...todoParams]
  );

  return { token: signToken(result.rows[0]) };
}

export async function updateProfile(
  userId: string,
  universityId: string,
  studyProgramId: string,
  degreeType: string,
  fieldIds: string[],
  advisorName: string | null,
) {
  await db.query(
    `UPDATE "User" SET university_id = $1, study_program_id = $2, degree_type = $3, interests = $4::text[] WHERE id = $5`,
    [universityId || null, studyProgramId || null, degreeType || null, fieldIds, userId]
  );
  if (advisorName !== null) {
    const meta = await getLevelMetadata(userId);
    await db.query(
      `UPDATE "User" SET level_metadata = $1 WHERE id = $2`,
      [JSON.stringify({ ...meta, 2: advisorName }), userId]
    );
  }
}

export async function getUserById(userId: string) {
  const result = await db.query(
    `SELECT u.id, u.name, u.email, u.is_onboarded, u.current_level, u.completed_stages, u.first_login_date,
            u.degree_type, u.interests,
            univ.name AS university_name,
            sp.name AS study_program_name
     FROM "User" u
     LEFT JOIN universities univ ON univ.id = u.university_id
     LEFT JOIN study_programs sp ON sp.id = u.study_program_id
     WHERE u.id = $1`,
    [userId]
  );
  const user = result.rows[0] ?? null;
  if (!user) return null;

  const interests: string[] = user.interests ?? [];
  let interestNames: string[] = [];
  if (interests.length > 0) {
    const fieldsResult = await db.query(
      'SELECT name FROM fields WHERE id = ANY($1::text[]) ORDER BY name',
      [interests]
    );
    interestNames = fieldsResult.rows.map((r: { name: string }) => r.name);
  }

  return { ...user, interest_names: interestNames };
}

export async function completeLevelById(userId: string, level: number) {
  const currentResult = await db.query(
    'SELECT current_level, completed_stages FROM "User" WHERE id = $1',
    [userId]
  );
  const currentUser = currentResult.rows[0];
  if (!currentUser) return null;

  const completedStages = normalizeCompletedStages(currentUser.completed_stages);
  if (!isLevelUnlocked(level, completedStages) || completedStages.includes(level)) {
    return currentUser;
  }

  const nextCompletedStages = [...completedStages, level];
  const nextLevel = getFirstOpenLevel(nextCompletedStages);

  const result = await db.query(
    `UPDATE "User" SET current_level = $1, completed_stages = $2 WHERE id = $3
     RETURNING id, name, email, is_onboarded, current_level, completed_stages, first_login_date`,
    [nextLevel, nextCompletedStages, userId]
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

export async function getThesisContext(userId: string): Promise<string> {
  try {
    const result = await db.query('SELECT level_metadata FROM "User" WHERE id = $1', [userId]);
    const meta = (result.rows[0]?.level_metadata as Record<string, string>) ?? {};
    const parts: string[] = [];
    if (meta['1']) parts.push(`Thesis topic: ${meta['1']}`);
    if (meta['2']) parts.push(`Advisor: ${meta['2']}`);
    if (meta['3']) parts.push(
      `RESEARCH QUESTION (most important — all advice must directly relate to this):\n"${meta['3']}"`
    );
    return parts.length > 0 ? `\n\n## Student's Thesis Context\n${parts.join('\n')}` : '';
  } catch { return ''; }
}

export async function getLevelMetadata(userId: string): Promise<Record<string, string>> {
  const result = await db.query('SELECT level_metadata FROM "User" WHERE id = $1', [userId]);
  return (result.rows[0]?.level_metadata as Record<string, string>) ?? {};
}

export async function setLevelMetadata(userId: string, level: number, value: string): Promise<Record<string, string>> {
  const result = await db.query(
    `UPDATE "User"
     SET level_metadata = COALESCE(level_metadata, '{}') || jsonb_build_object($2::text, $3::text)
     WHERE id = $1
     RETURNING level_metadata`,
    [userId, String(level), value]
  );
  return (result.rows[0]?.level_metadata as Record<string, string>) ?? {};
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
