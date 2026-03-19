import { db } from './config/db';

export async function runMigrations() {
  await db.query(`
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS main_deadline DATE;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS level1_deadline DATE;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS level2_deadline DATE;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS level3_deadline DATE;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS level4_deadline DATE;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS level5_deadline DATE;
    ALTER TABLE "User" ADD COLUMN IF NOT EXISTS level6_deadline DATE;

    CREATE TABLE IF NOT EXISTS todos (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      user_id TEXT NOT NULL,
      text TEXT NOT NULL,
      done BOOLEAN DEFAULT false,
      level_link INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS activity_log (
      id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
      user_id TEXT NOT NULL,
      action TEXT NOT NULL,
      level INTEGER,
      created_at TIMESTAMP DEFAULT NOW()
    );

    ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS step_context INTEGER;
  `);
}
