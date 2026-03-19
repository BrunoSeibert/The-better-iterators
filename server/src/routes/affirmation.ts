import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getThesisContext } from '../services/authService';
import { db } from '../config/db';

const router = Router();

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { checkinContext } = req.body;
  const userId = (req as AuthRequest).userId;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const userResult = await db.query(
      'SELECT current_level, completed_stages FROM "User" WHERE id = $1',
      [userId]
    );
    const currentUser = userResult.rows[0];

    const LEVEL_NAMES: Record<number, string> = {
      1: 'Literature Review', 2: 'Topic Selection', 3: 'Research Proposal',
      4: 'Research', 5: 'Writing', 6: 'Defense Prep',
    };

    const currentLevel = currentUser?.current_level ?? 1;
    const completedStages: number[] = currentUser?.completed_stages ?? [];

    const progressSection = [
      `Current stage: ${currentLevel} (${LEVEL_NAMES[currentLevel] ?? 'unknown'})`,
      `Completed: ${completedStages.length > 0 ? completedStages.map((l) => LEVEL_NAMES[l] ?? l).join(', ') : 'none yet'}`,
    ].join('\n');

    const checkinSection = checkinContext
      ? `\n\n## Today's Check-in\n${checkinContext}`
      : '';

    const thesisSection = await getThesisContext(userId!);

    const systemPrompt = `You are Noodle, a warm and encouraging thesis companion. The student is currently working and hasn't been chatting — you're sending them a spontaneous, friendly nudge.

Write ONE short affirmation or encouragement (2–3 sentences max). Make it specific to their thesis stage and check-in context if available. Keep it warm, genuine, and never generic. Do not ask a question. Do not introduce yourself.

## Student Progress\n${progressSection}${checkinSection}${thesisSection}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Send me an affirmation.' },
      ],
      max_tokens: 120,
    });

    const content = completion.choices[0].message.content ?? "You're doing great — keep going!";
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as affirmationRouter };
