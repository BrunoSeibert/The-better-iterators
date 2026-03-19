import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getThesisContext } from '../services/authService';

const router = Router();

let dbCache: string | null = null;

async function getDbContext(): Promise<string> {
  if (dbCache) return dbCache;

  const [
    universities, studyPrograms, fields, companies,
    students, supervisors, experts, topics, projects
  ] = await Promise.all([
    db.query('SELECT * FROM universities'),
    db.query('SELECT * FROM study_programs'),
    db.query('SELECT * FROM fields'),
    db.query('SELECT * FROM companies'),
    db.query('SELECT * FROM students'),
    db.query('SELECT * FROM supervisors'),
    db.query('SELECT * FROM experts'),
    db.query('SELECT * FROM topics'),
    db.query('SELECT * FROM projects'),
  ]);

  dbCache = `
## Platform Data

### Universities
${JSON.stringify(universities.rows, null, 2)}

### Study Programs
${JSON.stringify(studyPrograms.rows, null, 2)}

### Fields
${JSON.stringify(fields.rows, null, 2)}

### Companies
${JSON.stringify(companies.rows, null, 2)}

### Students
${JSON.stringify(students.rows, null, 2)}

### Supervisors
${JSON.stringify(supervisors.rows, null, 2)}

### Experts
${JSON.stringify(experts.rows, null, 2)}

### Topics
${JSON.stringify(topics.rows, null, 2)}

### Projects
${JSON.stringify(projects.rows, null, 2)}
`;

  return dbCache;
}

router.get('/matches', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    // Fetch all companies and universities with description
    const [companies, unis] = await Promise.all([
      db.query(`
        SELECT 
          c.id::text as id,
          c.name,
          c.lat,
          c.lng,
          COALESCE(
            string_agg(
              DISTINCT trim(COALESCE(e.title || ' ', '') || e."firstName" || ' ' || e."lastName"),
              ', '
            ),
            'No experts available'
          ) as description,
          'company' as type
        FROM companies c
        LEFT JOIN experts e ON c.id = e."companyId"
        WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
        GROUP BY c.id, c.name, c.lat, c.lng
        ORDER BY c.name;
      `),
      db.query(`
        SELECT 
          u.id::text as id,
          u.name,
          u.lat,
          u.lng,
          COALESCE(
            string_agg(
              DISTINCT trim(COALESCE(s.title || ' ', '') || s."firstName" || ' ' || s."lastName"),
              ', '
            ),
            'No supervisors available'
          ) as description,
          'university'::text as type
        FROM universities u
        LEFT JOIN supervisors s ON u.id = s."universityId"
        WHERE u.lat IS NOT NULL AND u.lng IS NOT NULL
        GROUP BY u.id, u.name, u.lat, u.lng
        ORDER BY u.name;
      `)
    ]);

    const allItems = [...companies.rows, ...unis.rows];

    // Fetch user context + db context
    const [userResult, thesisCtx, dbContext] = await Promise.all([
      db.query('SELECT * FROM "User" WHERE id = $1', [userId]),
      getThesisContext(userId),
      getDbContext(),
    ]);
    const currentUser = userResult.rows[0];

    // Build system prompt for AI
    const systemPrompt = `
You are StudyOnd's AI assistant. You will rank a list of universities and companies for a student.
The student information is below. Rank each item from 0 (least relevant) to 1 (most relevant) for this student.

## Current User
${JSON.stringify(currentUser, null, 2)}
${thesisCtx}
${dbContext}

List items in the following JSON format only, including all IDs:

[
  {
    "id": "<item id>",
    "match": <number between 0 and 1>
  }
]
Do not include any extra text. Just JSON.
The items to rank are:
${JSON.stringify(allItems, null, 2)}
`;

    // Send to OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [{ role: 'system', content: systemPrompt }],
    });

    const aiText = completion.choices[0].message?.content || '[]';
    let aiScores: { id: string; match: number }[] = [];

    try {
      aiScores = JSON.parse(aiText);
    } catch (e) {
      console.warn('AI did not return valid JSON, sending default scores', e);
      aiScores = allItems.map(item => ({ id: item.id, match: 0.5 }));
    }

    // Merge AI scores into original data
    const result = allItems.map(item => {
      const scoreObj = aiScores.find(s => s.id === item.id);
      return {
        ...item,
        match: scoreObj ? scoreObj.match : 0
      };
    });

    res.json(result);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
