import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import { Pool } from 'pg';
import axios from 'axios';

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

  // Seed tables
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
        `INSERT INTO ${table.name} (${cols}) VALUES (${placeholders})
        ON CONFLICT (id) DO UPDATE SET ${keys.map(k => `"${k}" = EXCLUDED."${k}"`).join(', ')}`,
        vals
      );
    }
    console.log(`✅ ${table.name} done (${(table.data as any[]).length} records)`);
  }

  // Geocode organizations
  console.log('\n🗺️  Geocoding organizations...');

  const orgsToGeocode = [
    { table: 'universities', nameCol: 'name' },
    { table: 'companies', nameCol: 'name' },
  ];

  for (const orgType of orgsToGeocode) {
    const { rows } = await db.query(`
      SELECT id, ${orgType.nameCol} as name 
      FROM ${orgType.table} 
      WHERE lat IS NULL OR lng IS NULL
    `);

    console.log(`${orgType.table}: ${rows.length} to geocode`);

    for (const row of rows) {
      try {
        const { data } = await axios.get('https://nominatim.openstreetmap.org/search', {
          params: {
            q: `${row.name}, Switzerland`,
            format: 'json',
            limit: 1,
            countrycodes: 'ch',
          },
          headers: {
            'User-Agent': 'Hackathon-StudyOn/1.0 (gioele.zucchelli@gmail.com)'
          }
        });

        if (data[0]) {
          const lat = parseFloat(data[0].lat);
          const lng = parseFloat(data[0].lon);
          
          await db.query(
            `UPDATE ${orgType.table} SET lat = $1, lng = $2 WHERE id = $3`,
            [lat, lng, row.id]
          );
          
          console.log(`✅ ${row.name}: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } else {
          console.log(`❌ ${row.name}: No coordinates found`);
        }
      } catch (error: any) {
        console.log(`❌ ${row.name}: ${error.message}`);
      }
      
      // Rate limit (1 per second)
      await new Promise(r => setTimeout(r, 1000));
    }
  }

  console.log('\n🎉 Seed + geocoding complete!');
  await db.end();
}

seed().catch(e => {
  console.error('❌ Seed failed:', e.message);
  process.exit(1);
});


