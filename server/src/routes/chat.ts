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

    // Call OpenAI
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
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
