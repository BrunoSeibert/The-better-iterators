import { Router, Request, Response } from 'express';
import { db } from '../config/db';

const router = Router();

router.get('/universities', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT id, name, country FROM universities ORDER BY name');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/study-programs', async (req: Request, res: Response) => {
  try {
    const { universityId, degree } = req.query;
    const result = await db.query(
      'SELECT id, name, degree FROM study_programs WHERE "universityId" = $1 AND degree = $2 ORDER BY name',
      [universityId, degree]
    );
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/fields', async (_req: Request, res: Response) => {
  try {
    const result = await db.query('SELECT id, name FROM fields ORDER BY name');
    res.json(result.rows);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
