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

    // Fetch previous messages from other conversations for context
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

    const systemContext = previousMessages.length > 0
      ? `You are a helpful thesis journey assistant. Here is the user's previous chat history for context:\n\n${previousMessages.map((m: { role: string; content: string }) => `${m.role}: ${m.content}`).join('\n')}`
      : 'You are a helpful thesis journey assistant.';

    // Call OpenAI with previous context + current messages
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemContext },
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
