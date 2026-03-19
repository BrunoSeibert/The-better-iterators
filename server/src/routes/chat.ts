import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { messages, conversationId } = req.body;
  const userId = (req as AuthRequest).userId;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  try {
    // Get or create conversation
    let convId = conversationId;
    if (!convId) {
      const conv = await db.query(
        'INSERT INTO "Conversation" (user_id) VALUES ($1) RETURNING id',
        [userId]
      );
      convId = conv.rows[0].id;
    }

    // Save user message
    const userMessage = messages[messages.length - 1];
    await db.query(
      'INSERT INTO "Message" (conversation_id, role, content) VALUES ($1, $2, $3)',
      [convId, 'USER', userMessage.content]
    );

    // Fetch previous messages for context
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

    // ---- Fetch all 9 tables ----
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

    const dbContext = `
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

    const previousContext = previousMessages.length > 0
      ? `\n\n## Previous Chat History\n${previousMessages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')}`
      : '';

    const systemPrompt = `You are StudyOnd's AI thesis assistant. Help students find thesis topics, supervisors, companies and experts that match their interests and goals.

When making recommendations, always refer to specific names, titles and descriptions from the platform data below. Be specific and helpful.
${dbContext}
${previousContext}`;

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        ...messages,
      ],
    });

    const assistantMessage = completion.choices[0].message;

    // Save assistant message
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
