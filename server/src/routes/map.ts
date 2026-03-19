import { Router, Request, Response } from 'express';
import { db } from '../config/db';

const router = Router();

router.get('/matches', async (_req: Request, res: Response) => {
  try {
    const companiesQuery = `
  SELECT 
    c.id::text as id,
    c.name,
    c.lat,
    c.lng,

    COALESCE(
      string_agg(
        DISTINCT trim(
          COALESCE(e.title || ' ', '') || 
          e."firstName" || ' ' || 
          e."lastName"
        ),
        ', '
      ),
      'No experts available'
    ) as description,

    'company' as type

  FROM companies c

  LEFT JOIN experts e 
    ON c.id = e."companyId"

  WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL

  GROUP BY c.id, c.name, c.lat, c.lng

  ORDER BY c.name;
`;
    
    const unisQuery = `
      SELECT 
    u.id::text as id,
    u.name,
    u.lat,
    u.lng,
    COALESCE(
      string_agg(
        DISTINCT trim(
          COALESCE(s.title || ' ', '') || 
          s."firstName" || ' ' || 
          s."lastName"
        ),
        ', '
      ),
      'No supervisors available'
    ) as description,
    'university'::text as type
  FROM universities u
  LEFT JOIN supervisors s ON u.id = s."universityId"
  WHERE u.lat IS NOT NULL AND u.lng IS NOT NULL
  GROUP BY u.id, u.name, u.lat, u.lng
  ORDER BY u.name;
    `;
    
    const [companies, unis] = await Promise.all([
      db.query(companiesQuery),
      db.query(unisQuery),
    ]);
    
    const matches = [...companies.rows, ...unis.rows];
    res.json(matches);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
