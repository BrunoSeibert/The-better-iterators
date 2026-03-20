import { Router, Request, Response } from 'express';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';

const router = Router();

const LEVEL_WEIGHTS = [0.15, 0.25, 0.40, 0.55, 0.80, 1.0];

function computeLevelDeadlines(mainDeadline: Date): Record<number, string> {
  const today = new Date();
  const totalMs = mainDeadline.getTime() - today.getTime();
  const result: Record<number, string> = {};
  LEVEL_WEIGHTS.forEach((w, i) => {
    const d = new Date(today.getTime() + totalMs * w);
    result[i + 1] = d.toISOString().slice(0, 10);
  });
  result[6] = mainDeadline.toISOString().slice(0, 10);
  return result;
}

// GET /api/dashboard — full dashboard data
router.get('/', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    const userResult = await db.query(
      `SELECT name, completed_stages, current_level,
              main_deadline, level1_deadline, level2_deadline, level3_deadline,
              level4_deadline, level5_deadline, level6_deadline
       FROM "User" WHERE id = $1`,
      [userId]
    );
    const user = userResult.rows[0];

    const [todosResult, activityResult] = await Promise.all([
      db.query('SELECT * FROM todos WHERE user_id = $1 ORDER BY created_at ASC', [userId]),
      db.query('SELECT * FROM activity_log WHERE user_id = $1 ORDER BY created_at DESC LIMIT 10', [userId]),
    ]);

    res.json({
      user: {
        name: user.name,
        completedStages: user.completed_stages ?? [],
        currentLevel: user.current_level,
      },
      deadlines: {
        main: user.main_deadline,
        level1: user.level1_deadline,
        level2: user.level2_deadline,
        level3: user.level3_deadline,
        level4: user.level4_deadline,
        level5: user.level5_deadline,
        level6: user.level6_deadline,
      },
      todos: todosResult.rows,
      recentActivity: activityResult.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/dashboard/deadline — update main deadline + recompute level deadlines
router.patch('/deadline', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { mainDeadline } = req.body as { mainDeadline: string };
  try {
    const d = new Date(mainDeadline);
    const levels = computeLevelDeadlines(d);
    await db.query(
      `UPDATE "User" SET main_deadline=$1, level1_deadline=$2, level2_deadline=$3,
       level3_deadline=$4, level4_deadline=$5, level5_deadline=$6, level6_deadline=$7
       WHERE id = $8`,
      [mainDeadline, levels[1], levels[2], levels[3], levels[4], levels[5], levels[6], userId]
    );
    res.json({ mainDeadline, levels });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/dashboard/deadline/level/:level — update a single level deadline, cascade forward
router.patch('/deadline/level/:level', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const level = parseInt(req.params.level, 10);
  const { deadline } = req.body as { deadline: string };
  if (isNaN(level) || level < 1 || level > 6) return res.status(400).json({ error: 'Invalid level' });
  try {
    // Fetch current level deadlines
    const result = await db.query(
      `SELECT level1_deadline, level2_deadline, level3_deadline, level4_deadline, level5_deadline, level6_deadline FROM "User" WHERE id = $1`,
      [userId]
    );
    const row = result.rows[0];
    const newDate = deadline ? new Date(deadline) : null;

    // Build updated deadlines: cascade new date to later levels if their current deadline is earlier
    const updated: Record<number, string | null> = {};
    for (let l = 1; l <= 6; l++) {
      const col = `level${l}_deadline`;
      const current: string | null = row[col] ?? null;
      if (l === level) {
        updated[l] = deadline || null;
      } else if (l > level && newDate && current && new Date(current) < newDate) {
        updated[l] = deadline;
      } else {
        updated[l] = current;
      }
    }

    await db.query(
      `UPDATE "User" SET level1_deadline=$1, level2_deadline=$2, level3_deadline=$3, level4_deadline=$4, level5_deadline=$5, level6_deadline=$6 WHERE id=$7`,
      [updated[1], updated[2], updated[3], updated[4], updated[5], updated[6], userId]
    );
    res.json({ levels: updated });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/todos
router.post('/todos', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { text, levelLink } = req.body as { text: string; levelLink?: number };
  try {
    const result = await db.query(
      'INSERT INTO todos (id, user_id, text, done, level_link) VALUES (gen_random_uuid()::TEXT, $1, $2, false, $3) RETURNING *',
      [userId, text, levelLink ?? null]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/dashboard/todos/:id
router.patch('/todos/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { id } = req.params;
  const { done } = req.body as { done: boolean };
  try {
    const result = await db.query(
      'UPDATE todos SET done=$1 WHERE id=$2 AND user_id=$3 RETURNING *',
      [done, id, userId]
    );
    res.json(result.rows[0]);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/dashboard/todos/:id
router.delete('/todos/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { id } = req.params;
  try {
    await db.query('DELETE FROM todos WHERE id=$1 AND user_id=$2', [id, userId]);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dashboard/activity
router.post('/activity', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { action, level, stepContext } = req.body as { action: string; level?: number; stepContext?: number };
  try {
    await db.query(
      'INSERT INTO activity_log (id, user_id, action, level, step_context) VALUES (gen_random_uuid()::TEXT, $1, $2, $3, $4)',
      [userId, action, level ?? null, stepContext ?? null]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
