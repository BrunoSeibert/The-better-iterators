import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getThesisContext } from '../services/authService';

const router = Router();

type PaperAnalysis = {
  input: string;
  coreThemes: string[];
  thesisRelevance: string;
  relatedTerms: string[];
  followUpPapers: { title: string; authors: string; year?: number; why: string }[];
};

router.post('/', requireAuth, async (req: Request, res: Response) => {
  const { phase } = req.body;
  const userId = (req as AuthRequest).userId;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

  try {
    const userResult = await db.query(
      'SELECT interests, degree_type FROM "User" WHERE id = $1',
      [userId]
    );
    const user = userResult.rows[0];

    let fieldNames: string[] = [];
    if (user?.interests?.length > 0) {
      const fieldsResult = await db.query(
        'SELECT name FROM fields WHERE id = ANY($1::text[])',
        [user.interests]
      );
      fieldNames = fieldsResult.rows.map((r: { name: string }) => r.name);
    }

    const userContext = `Student profile:
- Degree: ${user?.degree_type ?? 'not specified'}
- Research interests: ${fieldNames.length > 0 ? fieldNames.join(', ') : 'not specified'}`;

    const thesisCtx = await getThesisContext(userId);

    if (phase === 1) {
      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a thesis research assistant. Based on the student's profile, generate search guidance to kick off their literature review.${thesisCtx}

Respond ONLY with valid JSON in this exact format:
{
  "searchTerms": ["term (EN)", "Begriff (DE)", "..."],
  "databases": [{"name": "...", "url": "https://...", "description": "..."}],
  "methodologyPaper": {"title": "...", "authors": "...", "year": "...", "why": "..."},
  "fieldPapers": [{"title": "...", "authors": "...", "year": "...", "why": "..."}]
}

Rules:
- 6–8 search terms, mix of English and German
- 3–4 databases relevant to the student's field with real homepage URLs
- 1 well-known paper specifically about HOW TO DO a literature review or research methodology (e.g. Booth et al., Fink, Webster & Watson)
- 2–3 broad, well-known PRIMARY RESEARCH papers or foundational works in the student's specific field of interest`,
          },
          { role: 'user', content: userContext },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
      res.json({
        searchTerms: parsed.searchTerms ?? [],
        databases: parsed.databases ?? [],
        starterPapers: [
          ...(parsed.methodologyPaper ? [{ ...parsed.methodologyPaper, isMethodology: true }] : []),
          ...(parsed.fieldPapers ?? []),
        ],
      });
      return;
    }

    if (phase === 2) {
      const { input, papers, feedback } = req.body as {
        input: string;
        papers: PaperAnalysis[];
        feedback?: Record<number, 'liked' | 'disliked'>;
      };

      const prevContext = papers?.length > 0
        ? `\n\nPreviously analyzed papers:\n${papers.map((p, i) => {
            const rating = feedback?.[i];
            const ratingStr = rating === 'liked' ? ' [liked]' : rating === 'disliked' ? ' [disliked]' : '';
            return `${i + 1}.${ratingStr} "${p.input.slice(0, 120)}..." → themes: ${p.coreThemes.join(', ')}`;
          }).join('\n')}`
        : '';

      const feedbackContext = (() => {
        if (!feedback || Object.keys(feedback).length === 0) return '';
        const liked = Object.entries(feedback).filter(([, v]) => v === 'liked').flatMap(([k]) => papers[+k]?.coreThemes ?? []);
        const disliked = Object.entries(feedback).filter(([, v]) => v === 'disliked').flatMap(([k]) => papers[+k]?.coreThemes ?? []);
        const parts: string[] = [];
        if (liked.length > 0) parts.push(`Student liked papers with themes: ${liked.join(', ')} — prioritize similar directions.`);
        if (disliked.length > 0) parts.push(`Student disliked papers with themes: ${disliked.join(', ')} — avoid these directions.`);
        return parts.length > 0 ? '\n\n' + parts.join(' ') : '';
      })();

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a thesis research assistant helping analyze academic papers. The student's research interests and degree type are provided — always stay grounded in that domain.${thesisCtx}

Respond ONLY with valid JSON in this exact format:
{
  "coreThemes": ["theme1", "theme2", "..."],
  "thesisRelevance": "...",
  "relatedTerms": ["term1", "..."],
  "followUpPapers": [{"title": "...", "authors": "...", "year": "...", "why": "..."}]
}

Rules:
- 3–5 core themes extracted from the paper
- 1–2 sentences on thesis relevance for the student's profile
- 3–4 related search terms to explore next
- 2–3 follow-up papers that are PRIMARY RESEARCH papers firmly within the student's field of study and interests — or aligned with papers the student previously liked
- Follow-up papers must explore NEW adjacent topics or sub-fields related to the student's interests, not just more of the same topic as the paper just analyzed. Each analyzed paper should open up a different direction.
- Follow-up papers must be about the actual subject matter (e.g. specific technologies, phenomena, theories in the student's domain), NOT about research process, epistemology, philosophy of science, or how knowledge is structured. Papers like "The Structure of Scientific Revolutions" or anything by Kuhn, Popper, or similar science philosophers are NEVER appropriate unless the student's field is philosophy of science.
- If the student has liked previous papers, bias follow-up recommendations toward similar topics and themes. If they disliked papers, steer away from those directions entirely.`,
          },
          { role: 'user', content: `${userContext}${prevContext}${feedbackContext}\n\nAnalyze this paper/abstract:\n"${input}"` },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
      res.json(parsed);
      return;
    }

    if (phase === 3) {
      const { papers, feedback } = req.body as {
        papers: PaperAnalysis[];
        feedback?: Record<number, 'liked' | 'disliked'>;
      };

      // Fetch all topics for the user's university
      const topicsResult = await db.query(
        `SELECT t.id, t.title, t.description, t."fieldIds", u.name as "universityName", array_agg(f.name) FILTER (WHERE f.name IS NOT NULL) AS field_names
         FROM topics t
         LEFT JOIN fields f ON f.id = ANY(t."fieldIds"::text[])
         LEFT JOIN universities u ON u.id = t."universityId"
         WHERE t."universityId" = (SELECT university_id FROM "User" WHERE id = $1)
         GROUP BY t.id, u.name`,
        [userId]
      );
      const topics = topicsResult.rows;

      if (topics.length === 0) {
        res.json({ suggestions: [] });
        return;
      }

      const topicList = topics.map((t, i) =>
        `${i}. [ID: ${t.id}] "${t.title}" — ${t.description ?? ''} (fields: ${(t.field_names ?? []).join(', ')})`
      ).join('\n');

      const papersSummary = papers.map((p, i) => {
        const rating = feedback?.[i];
        const ratingStr = rating === 'liked' ? ' [liked]' : rating === 'disliked' ? ' [disliked]' : '';
        return `${i + 1}.${ratingStr} themes: ${p.coreThemes.join(', ')}`;
      }).join('\n');

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a thesis advisor. Based on the student's literature review so far, pick the best matching thesis topics from the provided list.${thesisCtx}

Respond ONLY with valid JSON in this exact format:
{
  "suggestions": [
    {"id": "...", "reason": "..."},
    {"id": "...", "reason": "..."}
  ]
}

Rules:
- Return 3–5 topic IDs from the list that best match the student's explored themes and liked papers
- Avoid topics whose themes overlap with papers the student disliked
- "reason" should be 1 sentence explaining why this topic fits their reading so far
- Only use IDs exactly as given in the list`,
          },
          {
            role: 'user',
            content: `${userContext}\n\nPapers the student has reviewed:\n${papersSummary}\n\nAvailable thesis topics:\n${topicList}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
      const suggestionIds: string[] = (parsed.suggestions ?? []).map((s: any) => s.id);
      const reasonMap: Record<string, string> = Object.fromEntries(
        (parsed.suggestions ?? []).map((s: any) => [s.id, s.reason])
      );

      const parseArr = (v: unknown): string[] => {
        if (Array.isArray(v)) return v;
        if (typeof v === 'string') return v.replace(/^\{|\}$/g, '').split(',').filter(Boolean).map(s => s.replace(/^"|"$/g, ''));
        return [];
      };

      const matched = topics
        .filter((t) => suggestionIds.includes(t.id))
        .sort((a, b) => suggestionIds.indexOf(a.id) - suggestionIds.indexOf(b.id))
        .map((t) => ({ ...t, fieldIds: parseArr(t.fieldIds), reason: reasonMap[t.id] ?? '' }));

      res.json({ suggestions: matched });
      return;
    }

    res.status(400).json({ error: 'Invalid phase' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
