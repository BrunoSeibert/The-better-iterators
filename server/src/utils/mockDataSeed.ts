import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Pool } from 'pg';

const db = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: false,
});

import universities from '../../../mock-data/universities.json';
import studyPrograms from '../../../mock-data/study-programs.json';
import fields from '../../../mock-data/fields.json';
import companies from '../../../mock-data/companies.json';
import students from '../../../mock-data/students.json';
import supervisors from '../../../mock-data/supervisors.json';
import experts from '../../../mock-data/experts.json';
import topics from '../../../mock-data/topics.json';
import projects from '../../../mock-data/projects.json';

const tables = [
  { name: 'universities',   data: universities },
  { name: 'study_programs', data: studyPrograms },
  { name: 'fields',         data: fields },
  { name: 'companies',      data: companies },
  { name: 'students',       data: students },
  { name: 'supervisors',    data: supervisors },
  { name: 'experts',        data: experts },
  { name: 'topics',         data: topics },
  { name: 'projects',       data: projects },
];

async function seed() {
  console.log('🌱 Starting seed...');
  console.log('DB URL:', process.env.DATABASE_URL ? '✅ found' : '❌ missing');

  for (const table of tables) {
    const keys = Object.keys(table.data[0]);
    const cols = keys.map(k => `"${k}"`).join(', ');

    for (const row of table.data as any[]) {
      const vals = keys.map(k => {
        const v = row[k];
        if (Array.isArray(v)) {
          return `{${v.map((s: string) => `"${s}"`).join(',')}}`;
        }
        return v;
      });
      const placeholders = vals.map((_, i) => `$${i + 1}`).join(', ');

      await db.query(
        `INSERT INTO ${table.name} (${cols}) VALUES (${placeholders}) ON CONFLICT (id) DO NOTHING`,
        vals
      );
    }
    console.log(`✅ ${table.name} done (${(table.data as any[]).length} records)`);
  }

  console.log('\n🎉 Seed complete!');
  await db.end();
}

seed().catch(e => {
  console.error('❌ Seed failed:', e.message);
  process.exit(1);
});

