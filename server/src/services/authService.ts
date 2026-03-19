import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from '../config/db';

function signToken(user: { id: string; name: string; email: string; is_onboarded: boolean; current_level: number }) {
  return jwt.sign(
    { userId: user.id, user: { id: user.id, name: user.name, email: user.email, isOnboarded: user.is_onboarded, currentLevel: user.current_level } },
    process.env.JWT_SECRET!,
    { expiresIn: '7d' }
  );
}

export async function register(name: string, email: string, password: string) {
  const existing = await db.query('SELECT id FROM "User" WHERE email = $1', [email]);
  if (existing.rows.length > 0) throw new Error('Email already in use');

  const hashed = await bcrypt.hash(password, 10);
  const result = await db.query(
    'INSERT INTO "User" (id, name, email, password) VALUES (gen_random_uuid()::TEXT, $1, $2, $3) RETURNING id, name, email, is_onboarded, current_level',
    [name, email, hashed]
  );
  const user = result.rows[0];
  const token = signToken(user);
  return { user: { id: user.id, name: user.name, email: user.email, isOnboarded: user.is_onboarded, currentLevel: user.current_level }, token };
}

export async function login(email: string, password: string) {
  const result = await db.query('SELECT * FROM "User" WHERE email = $1', [email]);
  const user = result.rows[0];
  if (!user) throw new Error('Invalid credentials');

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) throw new Error('Invalid credentials');

  const token = signToken(user);
  return { user: { id: user.id, name: user.name, email: user.email, isOnboarded: user.is_onboarded, currentLevel: user.current_level }, token };
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
  await db.query(
    `UPDATE "User"
     SET is_onboarded = TRUE, current_level = $1, completed_stages = $2,
         university_id = $3, study_program_id = $4, degree_type = $5, field_ids = $6
     WHERE id = $7`,
    [currentLevel, completedStages, universityId, studyProgramId, degreeType, fieldIds, userId]
  );
}
