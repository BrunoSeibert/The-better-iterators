import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';

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

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { messages, conversationId } = req.body;
  const userId = (req as AuthRequest).userId;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  try {
    const userResult = await db.query('SELECT * FROM "User" WHERE id = $1', [userId]);
    const currentUser = userResult.rows[0];

    let convId = conversationId;
    if (!convId) {
      const conv = await db.query(
        'INSERT INTO "Conversation" (user_id) VALUES ($1) RETURNING id',
        [userId]
      );
      convId = conv.rows[0].id;
    }

    const userMessage = messages[messages.length - 1];
    await db.query(
      'INSERT INTO "Message" (conversation_id, role, content) VALUES ($1, $2, $3)',
      [convId, 'USER', userMessage.content]
    );

    const prevResult = await db.query(
      `SELECT m.role, m.content
       FROM "Message" m
       JOIN "Conversation" c ON c.id = m.conversation_id
       WHERE c.user_id = $1 AND c.id != $2
       ORDER BY m.created_at DESC
       LIMIT 40`,
      [userId, convId]
    );

    const previousMessages = prevResult.rows.reverse().map((m: { role: string; content: string }) => ({
      role: m.role === 'USER' ? 'user' : 'assistant',
      content: m.content,
    }));

    const dbContext = await getDbContext();

    const previousContext = previousMessages.length > 0
      ? `\n\n## Previous Chat History\n${previousMessages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')}`
      : '';

    const userContext = `
## Current User
${JSON.stringify(currentUser, null, 2)}
`;

    const systemPrompt = `You are StudyOnd's AI thesis assistant. Help students find thesis topics, supervisors, companies and experts that match their interests and goals.

When making recommendations, always refer to specific names, titles and descriptions from the platform data below. Be specific and helpful.

When writing mathematical expressions, you MUST use these exact formats:
- Inline math: wrap in single dollar signs: $x^2 + y^2$
- Block math: wrap in double dollar signs: $$e^{i\\theta} = \\cos(\\theta) + i\\sin(\\theta)$$
- NEVER use \\[ ... \\] or \\( ... \\) formats — they will not render.

${userContext}
${dbContext}
${previousContext}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    const assistantMessage = completion.choices[0].message;

    await db.query(
      'INSERT INTO "Message" (conversation_id, role, content) VALUES ($1, $2, $3)',
      [convId, 'ASSISTANT', assistantMessage.content]
    );

    res.json({ message: assistantMessage, conversationId: convId });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as chatRouter };


