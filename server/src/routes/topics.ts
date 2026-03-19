import { Router } from 'express';
import { db } from '../config/db';
import { requireAuth } from '../middleware/auth';
import { AuthRequest } from '../middleware/auth';

const router = Router();

router.get('/by-university', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const userId = (req as AuthRequest).userId;

    const userResult = await db.query(
      'SELECT university_id, interests FROM "User" WHERE id = $1',
      [userId]
    );

    const universityId = userResult.rows[0]?.university_id ?? null;
    const fieldIds: string[] = userResult.rows[0]?.interests ?? [];
    const ignoreInterests = req.query.all === 'true';

    if (!universityId) {
      return res.json({ topics: [] });
    }

    const result = await db.query(
      ignoreInterests
        ? `SELECT * FROM topics WHERE "universityId" = $1 ORDER BY id`
        : `SELECT * FROM topics WHERE "universityId" = $1 AND (cardinality($2::text[]) = 0 OR "fieldIds" && $2::text[]) ORDER BY id`,
      ignoreInterests ? [universityId] : [universityId, fieldIds]
    );

    const parseArr = (v: unknown): string[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') return v.replace(/^\{|\}$/g, '').split(',').filter(Boolean).map(s => s.replace(/^"|"$/g, ''));
      return [];
    };

    const topics = result.rows.map((row) => ({
      ...row,
      degrees: parseArr(row.degrees),
      fieldIds: parseArr(row.fieldIds),
      supervisorIds: parseArr(row.supervisorIds),
      expertIds: parseArr(row.expertIds),
    }));

    res.json({ topics });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
