import { Router } from 'express';
import { db } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/by-university', requireAuth, async (req, res) => {
  try {
    const userId = (req as AuthRequest).userId;

    const userResult = await db.query(
      'SELECT university_id FROM "User" WHERE id = $1',
      [userId]
    );

    const universityId = userResult.rows[0]?.university_id ?? null;

    const result = await db.query(
      `SELECT * FROM topics WHERE "universityId" = $1 ORDER BY id`,
      [universityId]
    );

    res.json({ topics: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
