import { Router, Request, Response } from 'express';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

// Create table if it doesn't exist
db.query(`
  CREATE TABLE IF NOT EXISTS checkin_history (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    date TIMESTAMPTZ NOT NULL,
    energy INT NOT NULL,
    focus TEXT NOT NULL,
    last_progress TEXT,
    time_available TEXT,
    blocker TEXT,
    ai_response TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(console.error);

// GET /api/checkin — fetch last 14 entries for the user
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    const result = await db.query(
      `SELECT * FROM checkin_history WHERE user_id = $1 ORDER BY date DESC LIMIT 14`,
      [userId]
    );
    res.json({ history: result.rows.reverse() });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/checkin — save a new entry
router.post('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { date, energy, focus, lastProgress, timeAvailable, blocker } = req.body;
  try {
    const result = await db.query(
      `INSERT INTO checkin_history (user_id, date, energy, focus, last_progress, time_available, blocker)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING id`,
      [userId, date, energy, focus, lastProgress ?? null, timeAvailable ?? null, blocker ?? null]
    );
    res.json({ id: result.rows[0].id });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/checkin/:id — update ai_response once we have it
router.patch('/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { id } = req.params;
  const { aiResponse } = req.body;
  try {
    await db.query(
      `UPDATE checkin_history SET ai_response = $1 WHERE id = $2 AND user_id = $3`,
      [aiResponse, id, userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
