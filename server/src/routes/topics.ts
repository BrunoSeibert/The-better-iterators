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
    const global = req.query.global === 'true';
    const other = req.query.other === 'true';
    const allUniversities = req.query.alluniversities === 'true';

    const parseArr = (v: unknown): string[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') return v.replace(/^\{|\}$/g, '').split(',').filter(Boolean).map(s => s.replace(/^"|"$/g, ''));
      return [];
    };
    const mapRows = (rows: any[]) => rows.map((row) => ({
      ...row,
      degrees: parseArr(row.degrees),
      fieldIds: parseArr(row.fieldIds),
      supervisorIds: parseArr(row.supervisorIds),
      expertIds: parseArr(row.expertIds),
    }));

    if (global) {
      const result = await db.query(`SELECT * FROM topics ORDER BY id`);
      return res.json({ topics: mapRows(result.rows) });
    }

    if (allUniversities) {
      const result = await db.query(
        `SELECT * FROM topics WHERE (cardinality($1::text[]) = 0 OR "fieldIds"::text[] && $1::text[]) ORDER BY id`,
        [fieldIds]
      );
      return res.json({ topics: mapRows(result.rows) });
    }

    if (other) {
      const result = await db.query(
        `SELECT * FROM topics WHERE "universityId" IS DISTINCT FROM $1 AND (cardinality($2::text[]) = 0 OR "fieldIds"::text[] && $2::text[]) ORDER BY id`,
        [universityId, fieldIds]
      );
      return res.json({ topics: mapRows(result.rows) });
    }

    if (!universityId) {
      return res.json({ topics: [] });
    }

    const result = await db.query(
      ignoreInterests
        ? `SELECT * FROM topics WHERE "universityId" = $1 ORDER BY id`
        : `SELECT * FROM topics WHERE "universityId" = $1 AND (cardinality($2::text[]) = 0 OR "fieldIds"::text[] && $2::text[]) ORDER BY id`,
      ignoreInterests ? [universityId] : [universityId, fieldIds]
    );

    res.json({ topics: mapRows(result.rows) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get('/:id', requireAuth, async (req, res) => {
  res.set('Cache-Control', 'no-store');
  try {
    const { id } = req.params;

    const topicResult = await db.query('SELECT * FROM topics WHERE id = $1', [id]);
    if (topicResult.rows.length === 0) {
      return res.status(404).json({ error: 'Topic not found' });
    }

    const parseArr = (v: unknown): string[] => {
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') return v.replace(/^\{|\}$/g, '').split(',').filter(Boolean).map(s => s.replace(/^"|"$/g, ''));
      return [];
    };

    const raw = topicResult.rows[0];
    const topic = {
      ...raw,
      degrees: parseArr(raw.degrees),
      fieldIds: parseArr(raw.fieldIds),
      supervisorIds: parseArr(raw.supervisorIds),
      expertIds: parseArr(raw.expertIds),
    };

    const [companyResult, universityResult, fieldsResult, supervisorsResult, expertsResult] = await Promise.all([
      topic.companyId ? db.query('SELECT id, name, description, about, size, domains FROM companies WHERE id = $1', [topic.companyId]) : Promise.resolve({ rows: [] }),
      topic.universityId ? db.query('SELECT id, name, country, about FROM universities WHERE id = $1', [topic.universityId]) : Promise.resolve({ rows: [] }),
      topic.fieldIds.length > 0 ? db.query('SELECT id, name FROM fields WHERE id = ANY($1::text[])', [topic.fieldIds]) : Promise.resolve({ rows: [] }),
      topic.supervisorIds.length > 0 ? db.query('SELECT id, "firstName", "lastName", title, email, about, "researchInterests" FROM supervisors WHERE id = ANY($1::text[])', [topic.supervisorIds]) : Promise.resolve({ rows: [] }),
      topic.expertIds.length > 0 ? db.query('SELECT id, "firstName", "lastName", title, email, about FROM experts WHERE id = ANY($1::text[])', [topic.expertIds]) : Promise.resolve({ rows: [] }),
    ]);

    res.json({
      topic,
      company: companyResult.rows[0] ?? null,
      university: universityResult.rows[0] ?? null,
      fields: fieldsResult.rows,
      supervisors: supervisorsResult.rows,
      experts: expertsResult.rows,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
