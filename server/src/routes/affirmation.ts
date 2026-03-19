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
      1: 'Topic Selection', 2: 'Advisor Selection', 3: 'Research Proposal',
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

    const systemPrompt = `You are Noodle, a warm thesis companion sending a brief spontaneous nudge.

Write ONE very short message (1–2 sentences max). Include a relevant famous quote woven naturally into your message or as a brief attribution (e.g. "As Einstein said, '...'"). Make it specific to their stage. Never generic. No questions. No self-introduction.

## Student Progress\n${progressSection}${checkinSection}${thesisSection}`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: 'Send me an affirmation.' },
      ],
      max_tokens: 80,
    });

    const content = completion.choices[0].message.content ?? "You're doing great — keep going!";
    res.json({ content });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as affirmationRouter };
