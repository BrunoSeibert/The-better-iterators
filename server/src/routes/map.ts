import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';

function parseArr(val: any): string[] {
  if (Array.isArray(val)) return val;
  if (typeof val === 'string') return val.replace(/^\{/, '').replace(/\}$/, '').split(',').filter(Boolean);
  return [];
}

const router = Router();
router.get('/matches', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;

  try {
    // Fetch all data in parallel
    const [userResult, supervisorResult, uniResult, expertResult, companyResult, cachedProfResult, cachedExpertResult] = await Promise.all([
      db.query(
        `SELECT u.name, u.degree_type, u.current_level, u.interests,
                array_agg(f.name) FILTER (WHERE f.name IS NOT NULL) as interest_names
         FROM "User" u
         LEFT JOIN fields f ON f.id = ANY(u.interests)
         WHERE u.id = $1
         GROUP BY u.id, u.name, u.degree_type, u.current_level, u.interests`,
        [userId]
      ),
      db.query(
        `SELECT s.id, s."firstName", s."lastName", s.email, s.title,
                s."universityId", s."researchInterests", s.about, s.objectives, s."fieldIds",
                u.name as university_name
         FROM supervisors s
         JOIN universities u ON u.id = s."universityId"`
      ),
      db.query(
        `SELECT id::text as id, name, lat, lng FROM universities WHERE lat IS NOT NULL AND lng IS NOT NULL`
      ),
      db.query(
        `SELECT e.id, e."firstName", e."lastName", e.email, e.title,
                e."companyId", e."offerInterviews", e.about, e.objectives, e."fieldIds",
                c.name as company_name, c.domains as company_domains
         FROM experts e
         JOIN companies c ON c.id = e."companyId"`
      ),
      db.query(
        `SELECT id, name, lat, lng, domains FROM companies WHERE lat IS NOT NULL AND lng IS NOT NULL`
      ),
      db.query(
        `SELECT professor_id, match FROM professor_matches WHERE user_id = $1`,
        [userId]
      ),
      db.query(
        `SELECT expert_id, match FROM expert_matches WHERE user_id = $1`,
        [userId]
      ),
    ]);

    const currentUser = userResult.rows[0];
    const allSupervisors = supervisorResult.rows;
    const allUniversities = uniResult.rows;
    const allExperts = expertResult.rows;
    const allCompanies = companyResult.rows;

    let professorScores: { id: string; match: number }[];
    let expertScores: { id: string; match: number }[];

    const hasCachedProfs = cachedProfResult.rows.length > 0;
    const hasCachedExperts = cachedExpertResult.rows.length > 0;

    if (hasCachedProfs && hasCachedExperts) {
      // Use cached scores — no AI call needed
      professorScores = cachedProfResult.rows.map(r => ({ id: r.professor_id, match: Number(r.match) }));
      expertScores = cachedExpertResult.rows.map(r => ({ id: r.expert_id, match: Number(r.match) }));
    } else {
      // Compute missing scores via AI
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

      const aiCalls: Promise<any>[] = [];

      if (!hasCachedProfs) {
        const professorPrompt = `You are a thesis advisor matching system. Score each professor's relevance to this student on a scale of 0.0 to 1.0.
Consider: alignment of research interests with student's interests, suitability of degree type, potential for collaboration.

Student profile:
- Degree: ${currentUser.degree_type}
- Interests: ${JSON.stringify(currentUser.interest_names ?? [])}
- Current level: ${currentUser.current_level}

Professors to score:
${JSON.stringify(allSupervisors.map(s => ({
  id: s.id,
  name: `${s.title} ${s.firstName} ${s.lastName}`,
  university: s.university_name,
  researchInterests: s.researchInterests,
  fieldIds: s.fieldIds,
  about: s.about?.slice(0, 200),
  objectives: s.objectives,
})), null, 2)}

Return ONLY a JSON array, no markdown, no extra text:
[{ "id": "<professor id>", "match": <0.0 to 1.0> }, ...]`;
        aiCalls.push(openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: professorPrompt }] }));
      } else {
        aiCalls.push(Promise.resolve(null));
      }

      if (!hasCachedExperts) {
        const expertPrompt = `You are a thesis advisor matching system. Score each industry expert's relevance to this student on a scale of 0.0 to 1.0.
Consider: alignment of the expert's domain with student's interests, potential for industry collaboration, suitability for thesis support.

Student profile:
- Degree: ${currentUser.degree_type}
- Interests: ${JSON.stringify(currentUser.interest_names ?? [])}
- Current level: ${currentUser.current_level}

Experts to score:
${JSON.stringify(allExperts.map(e => ({
  id: e.id,
  name: `${e.title} ${e.firstName} ${e.lastName}`,
  company: e.company_name,
  domains: e.company_domains,
  fieldIds: e.fieldIds,
  about: e.about?.slice(0, 200),
  objectives: e.objectives,
})), null, 2)}

Return ONLY a JSON array, no markdown, no extra text:
[{ "id": "<expert id>", "match": <0.0 to 1.0> }, ...]`;
        aiCalls.push(openai.chat.completions.create({ model: 'gpt-4o-mini', messages: [{ role: 'user', content: expertPrompt }] }));
      } else {
        aiCalls.push(Promise.resolve(null));
      }

      const [profCompletion, expertCompletion] = await Promise.all(aiCalls);

      // Parse and cache professor scores
      if (!hasCachedProfs && profCompletion) {
        try {
          const cleaned = (profCompletion.choices[0].message?.content ?? '[]').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          professorScores = JSON.parse(cleaned);
        } catch {
          professorScores = allSupervisors.map((s: any) => ({ id: s.id, match: 0.5 }));
        }
        // Store in DB
        if (professorScores.length > 0) {
          const values = professorScores.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
          const params: any[] = [userId];
          professorScores.forEach(p => { params.push(p.id, p.match); });
          await db.query(
            `INSERT INTO professor_matches (user_id, professor_id, match) VALUES ${values} ON CONFLICT (user_id, professor_id) DO NOTHING`,
            params
          );
        }
      } else {
        professorScores = cachedProfResult.rows.map(r => ({ id: r.professor_id, match: Number(r.match) }));
      }

      // Parse and cache expert scores
      if (!hasCachedExperts && expertCompletion) {
        try {
          const cleaned = (expertCompletion.choices[0].message?.content ?? '[]').replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
          expertScores = JSON.parse(cleaned);
        } catch {
          expertScores = allExperts.map((e: any) => ({ id: e.id, match: 0.5 }));
        }
        // Store in DB
        if (expertScores.length > 0) {
          const values = expertScores.map((_, i) => `($1, $${i * 2 + 2}, $${i * 2 + 3})`).join(', ');
          const params: any[] = [userId];
          expertScores.forEach(e => { params.push(e.id, e.match); });
          await db.query(
            `INSERT INTO expert_matches (user_id, expert_id, match) VALUES ${values} ON CONFLICT (user_id, expert_id) DO NOTHING`,
            params
          );
        }
      } else {
        expertScores = cachedExpertResult.rows.map(r => ({ id: r.expert_id, match: Number(r.match) }));
      }
    }

    // Merge scores into professors
    const professors = allSupervisors.map((s: any) => ({
      id: s.id,
      firstName: s.firstName,
      lastName: s.lastName,
      title: s.title,
      email: s.email,
      universityId: s.universityId,
      universityName: s.university_name,
      researchInterests: parseArr(s.researchInterests),
      fieldIds: parseArr(s.fieldIds),
      about: s.about ?? '',
      objectives: parseArr(s.objectives),
      match: professorScores.find(p => p.id === s.id)?.match ?? 0.5,
    }));

    // Merge scores into experts
    const experts = allExperts.map((e: any) => ({
      id: e.id,
      firstName: e.firstName,
      lastName: e.lastName,
      title: e.title,
      email: e.email,
      companyId: e.companyId,
      companyName: e.company_name,
      companyDomains: parseArr(e.company_domains),
      offerInterviews: e.offerInterviews ?? false,
      fieldIds: parseArr(e.fieldIds),
      about: e.about ?? '',
      objectives: parseArr(e.objectives),
      match: expertScores.find(x => x.id === e.id)?.match ?? 0.5,
    }));

    // University match = average of its professors' scores
    const uniScoreMap: Record<string, number[]> = {};
    professors.forEach(p => {
      if (!uniScoreMap[p.universityId]) uniScoreMap[p.universityId] = [];
      uniScoreMap[p.universityId].push(p.match);
    });
    const universities = allUniversities.map((u: any) => {
      const scores = uniScoreMap[u.id] ?? [];
      const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0.3;
      return { id: u.id, name: u.name, lat: u.lat, lng: u.lng, match: Math.round(avg * 100) / 100 };
    });

    // Company match = average of its experts' scores
    const coScoreMap: Record<string, number[]> = {};
    experts.forEach(e => {
      if (!coScoreMap[e.companyId]) coScoreMap[e.companyId] = [];
      coScoreMap[e.companyId].push(e.match);
    });
    const companies = allCompanies.map((c: any) => {
      const scores = coScoreMap[c.id] ?? [];
      const avg = scores.length > 0 ? scores.reduce((a: number, b: number) => a + b, 0) / scores.length : 0.3;
      return { id: c.id, name: c.name, lat: Number(c.lat), lng: Number(c.lng), domains: c.domains ?? [], match: Math.round(avg * 100) / 100 };
    });

    res.json({ universities, professors, companies, experts });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/map/professors/:id
router.get('/professors/:id', requireAuth, async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT s.id, s."firstName", s."lastName", s.email, s.title,
              s."universityId", s."researchInterests", s.about, s.objectives, s."fieldIds",
              u.name as university_name
       FROM supervisors s
       JOIN universities u ON u.id = s."universityId"
       WHERE s.id = $1`,
      [id]
    );
    if (!result.rows[0]) return res.status(404).json({ error: 'Professor not found' });
    const s = result.rows[0];
    res.json({
      id: s.id, firstName: s.firstName, lastName: s.lastName, title: s.title,
      email: s.email, universityId: s.universityId, universityName: s.university_name,
      researchInterests: parseArr(s.researchInterests), fieldIds: parseArr(s.fieldIds),
      about: s.about ?? '', objectives: parseArr(s.objectives),
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
