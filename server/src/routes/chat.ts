import { Router, Request, Response } from 'express';
import OpenAI from 'openai';

const router = Router();

router.post('/', async (req: Request, res: Response) => {
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { messages } = req.body;

  if (!messages || !Array.isArray(messages)) {
    res.status(400).json({ error: 'messages array is required' });
    return;
  }

  try {
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages,
    });

    res.json({ message: completion.choices[0].message });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export { router as chatRouter };