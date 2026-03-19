import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getThesisContext } from '../services/authService';

const router = Router();

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'research');
fs.mkdirSync(UPLOAD_DIR, { recursive: true });

const upload = multer({
  dest: UPLOAD_DIR,
  limits: { fileSize: 20 * 1024 * 1024 }, // 20 MB
  fileFilter: (_req, file, cb) => {
    cb(null, file.mimetype === 'application/pdf');
  },
});

// Auto-create table (with pdf columns)
db.query(`
  CREATE TABLE IF NOT EXISTS research_papers (
    id SERIAL PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    authors TEXT,
    year INTEGER,
    abstract TEXT,
    pdf_path TEXT,
    pdf_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  )
`).catch(console.error);

// Migrate existing tables that lack pdf columns
db.query(`
  ALTER TABLE research_papers
    ADD COLUMN IF NOT EXISTS pdf_path TEXT,
    ADD COLUMN IF NOT EXISTS pdf_name TEXT
`).catch(() => {});

// ── Library CRUD ────────────────────────────────────────────────────────────

// GET /api/research/library
router.get('/library', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  try {
    const result = await db.query(
      `SELECT * FROM research_papers WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    res.json({ papers: result.rows });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research/library
router.post('/library', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { title, authors, year, abstract } = req.body;
  if (!title) { res.status(400).json({ error: 'title is required' }); return; }
  try {
    const result = await db.query(
      `INSERT INTO research_papers (user_id, title, authors, year, abstract)
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [userId, title, authors ?? null, year ?? null, abstract ?? null]
    );
    res.json({ paper: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/research/library/:id
router.delete('/library/:id', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { id } = req.params;
  try {
    const result = await db.query(
      `DELETE FROM research_papers WHERE id = $1 AND user_id = $2 RETURNING pdf_path`,
      [id, userId]
    );
    const pdfPath = result.rows[0]?.pdf_path;
    if (pdfPath && fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research/library/:id/pdf — attach a PDF
router.post('/library/:id/pdf', requireAuth, upload.single('pdf'), async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { id } = req.params;
  if (!req.file) { res.status(400).json({ error: 'PDF file required' }); return; }
  try {
    // Remove old file if present
    const existing = await db.query(
      `SELECT pdf_path FROM research_papers WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    const oldPath = existing.rows[0]?.pdf_path;
    if (oldPath && fs.existsSync(oldPath)) fs.unlinkSync(oldPath);

    const result = await db.query(
      `UPDATE research_papers SET pdf_path = $1, pdf_name = $2 WHERE id = $3 AND user_id = $4 RETURNING *`,
      [req.file.path, req.file.originalname, id, userId]
    );
    res.json({ paper: result.rows[0] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/research/library/:id/pdf — stream the PDF
router.get('/library/:id/pdf', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT pdf_path, pdf_name FROM research_papers WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    const row = result.rows[0];
    if (!row?.pdf_path || !fs.existsSync(row.pdf_path)) {
      res.status(404).json({ error: 'No PDF attached' });
      return;
    }
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${row.pdf_name ?? 'paper.pdf'}"`);
    fs.createReadStream(row.pdf_path).pipe(res);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/research/library/:id/pdf — detach PDF
router.delete('/library/:id/pdf', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { id } = req.params;
  try {
    const result = await db.query(
      `SELECT pdf_path FROM research_papers WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    const pdfPath = result.rows[0]?.pdf_path;
    if (pdfPath && fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath);
    await db.query(
      `UPDATE research_papers SET pdf_path = NULL, pdf_name = NULL WHERE id = $1 AND user_id = $2`,
      [id, userId]
    );
    res.json({ ok: true });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// ── Helpers ─────────────────────────────────────────────────────────────────

type Paper = { id: number; title: string; authors?: string; year?: number; abstract?: string };

function libraryContext(papers: Paper[]): string {
  if (papers.length === 0) return 'The student has no papers in their library yet.';
  return papers.map((p, i) =>
    `${i + 1}. "${p.title}"${p.authors ? ` — ${p.authors}` : ''}${p.year ? ` (${p.year})` : ''}${p.abstract ? `\nAbstract: ${p.abstract.slice(0, 300)}` : ''}`
  ).join('\n\n');
}

// ── AI Tools ────────────────────────────────────────────────────────────────

// POST /api/research/find-papers
router.post('/find-papers', requireAuth, async (req: Request, res: Response) => {
  const { topic } = req.body;
  const userId = (req as AuthRequest).userId;
  if (!topic) { res.status(400).json({ error: 'topic is required' }); return; }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const thesisCtx = await getThesisContext(userId);
    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a research librarian. Given a topic or problem, suggest 5–8 highly relevant academic papers.${thesisCtx}

Respond ONLY with valid JSON:
{
  "papers": [
    {
      "title": "...",
      "authors": "...",
      "year": 2020,
      "why": "One sentence on why this paper is relevant.",
      "scholarUrl": "https://scholar.google.com/scholar?q=..."
    }
  ]
}

Rules:
- Papers must be real, published, peer-reviewed works
- Prefer seminal or highly cited papers
- scholarUrl must be a Google Scholar search URL with the title URL-encoded
- Vary the years — don't cluster everything in the same era
- If the topic is narrow, broaden slightly to include adjacent influential work`,
        },
        { role: 'user', content: `Find papers about: ${topic}` },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    res.json({ papers: parsed.papers ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research/check-source
router.post('/check-source', requireAuth, async (req: Request, res: Response) => {
  const { paperId } = req.body;
  const userId = (req as AuthRequest).userId;
  if (!paperId) { res.status(400).json({ error: 'paperId is required' }); return; }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const [paperResult, thesisCtx] = await Promise.all([
      db.query(`SELECT * FROM research_papers WHERE id = $1 AND user_id = $2`, [paperId, userId]),
      getThesisContext(userId),
    ]);
    const paper: Paper = paperResult.rows[0];
    if (!paper) { res.status(404).json({ error: 'Paper not found' }); return; }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are an academic source checker. Evaluate the credibility and quality of a given source.${thesisCtx}

First identify the source type: journal article, conference paper, textbook, book chapter, thesis, preprint, or other.

Respond ONLY with valid JSON:
{
  "sourceType": "journal article | conference paper | textbook | book chapter | thesis | preprint | other",
  "journalQuality": "high | medium | low | unknown | n/a",
  "peerReviewed": true,
  "citationContext": "Brief note on citation count and influence in the field.",
  "flags": ["only real concerns: predatory journal, retraction, serious methodological flaws, known fabrication"],
  "verdict": "A 1–2 sentence overall assessment of whether this is a trustworthy source."
}

Rules:
- Textbooks by established publishers (Silberschatz, Knuth, Tanenbaum, etc.) are credible even without journal peer review — do NOT flag them as untrustworthy
- "peerReviewed" for textbooks and standard reference books should be true (they go through editorial review)
- "journalQuality" should be "n/a" for textbooks, books, and theses
- Only add flags for genuine red flags (predatory journals, retractions, known fraud) — do not flag simply because a source is a book or lacks a journal
- If you don't have confident information about a specific detail, say so in citationContext rather than guessing negatively`,
        },
        {
          role: 'user',
          content: `Check this source:\nTitle: ${paper.title}\nAuthors: ${paper.authors ?? 'unknown'}\nYear: ${paper.year ?? 'unknown'}${paper.abstract ? `\nAbstract: ${paper.abstract.slice(0, 400)}` : ''}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research/format-citation
router.post('/format-citation', requireAuth, async (req: Request, res: Response) => {
  const { paperIds, style } = req.body as { paperIds: number[]; style: 'APA' | 'MLA' | 'Chicago' };
  const userId = (req as AuthRequest).userId;
  if (!paperIds?.length || !style) { res.status(400).json({ error: 'paperIds and style are required' }); return; }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const [result, thesisCtx] = await Promise.all([
      db.query(`SELECT * FROM research_papers WHERE id = ANY($1::int[]) AND user_id = $2`, [paperIds, userId]),
      getThesisContext(userId),
    ]);
    const papers: Paper[] = result.rows;
    if (papers.length === 0) { res.status(404).json({ error: 'No papers found' }); return; }

    const paperList = papers.map((p, i) =>
      `${i + 1}. Title: ${p.title} | Authors: ${p.authors ?? 'unknown'} | Year: ${p.year ?? 'unknown'}`
    ).join('\n');

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a citation formatter. Format the given papers in the requested citation style.${thesisCtx}

Respond ONLY with valid JSON:
{
  "citations": ["formatted citation 1", "formatted citation 2"]
}

Rules:
- Use correct ${style} formatting conventions exactly
- If information is missing (e.g. no publisher for a book), use a placeholder like [Publisher] and flag it
- Order citations to match the input order`,
        },
        { role: 'user', content: `Format these papers in ${style} style:\n${paperList}` },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    res.json({ citations: parsed.citations ?? [] });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research/concept-map
router.post('/concept-map', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const [result, thesisCtx] = await Promise.all([
      db.query(`SELECT * FROM research_papers WHERE user_id = $1 ORDER BY created_at ASC`, [userId]),
      getThesisContext(userId),
    ]);
    const papers: Paper[] = result.rows;
    if (papers.length < 2) { res.status(400).json({ error: 'Add at least 2 papers to generate a concept map' }); return; }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a research analyst. Analyze the given library of papers and produce a concept map showing how themes cluster and connect.${thesisCtx}

Respond ONLY with valid JSON:
{
  "clusters": [
    {
      "id": "cluster-1",
      "label": "Cluster name",
      "theme": "Brief description of what unites these papers",
      "paperIndices": [0, 2],
      "color": "#e8f4f8"
    }
  ],
  "connections": [
    {
      "from": "cluster-1",
      "to": "cluster-2",
      "label": "How they relate"
    }
  ],
  "summary": "2–3 sentences on the overall thematic landscape of this library."
}

Rules:
- Create 2–5 meaningful clusters based on shared themes, methods, or subject matter
- Each paper must appear in exactly one cluster
- Connections show conceptual bridges between clusters
- Use soft pastel hex colors for clusters`,
        },
        { role: 'user', content: `Analyze this paper library:\n\n${libraryContext(papers)}` },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    res.json({ ...parsed, papers: papers.map((p, i) => ({ index: i, title: p.title, authors: p.authors })) });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research/find-gaps
router.post('/find-gaps', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const [result, thesisCtx] = await Promise.all([
      db.query(`SELECT * FROM research_papers WHERE user_id = $1 ORDER BY created_at ASC`, [userId]),
      getThesisContext(userId),
    ]);
    const papers: Paper[] = result.rows;
    if (papers.length < 2) { res.status(400).json({ error: 'Add at least 2 papers to find gaps' }); return; }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a critical research analyst. Read this set of papers and identify what is missing, unexplored, or contested.${thesisCtx}

Respond ONLY with valid JSON:
{
  "gaps": [
    { "title": "Short label", "description": "What angle or population or context is missing from the literature." }
  ],
  "contradictions": [
    { "title": "Short label", "description": "Where two or more papers disagree or show conflicting findings." }
  ],
  "methodologicalGaps": [
    { "title": "Short label", "description": "Missing methods, data types, or research designs." }
  ],
  "suggestedDirections": [
    "One concrete research direction that would address a gap above."
  ]
}

Rules:
- 2–4 items per category (fewer if genuinely not present)
- Be specific — reference the actual themes in the papers, not generic advice
- suggestedDirections should be actionable thesis-level ideas`,
        },
        { role: 'user', content: `Find gaps in this library:\n\n${libraryContext(papers)}` },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    res.json(parsed);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/research/session-recap
router.post('/session-recap', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const { sessionPaperIds } = req.body as { sessionPaperIds?: number[] };
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const allResult = await db.query(
      `SELECT * FROM research_papers WHERE user_id = $1 ORDER BY created_at ASC`,
      [userId]
    );
    const allPapers: Paper[] = allResult.rows;

    const sessionPapers = sessionPaperIds?.length
      ? allPapers.filter((p) => sessionPaperIds.includes(p.id))
      : allPapers.slice(-3); // fallback: last 3 added

    const thesisCtx = await getThesisContext(userId);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: `You are a research coach. Summarize what the student did in this research session and suggest what to do next.

Respond ONLY with valid JSON:
{
  "addedCount": 2,
  "summary": "What was covered in this session (2–3 sentences).",
  "patterns": ["Key theme or insight that emerged from today's papers."],
  "nextStep": "One specific, concrete action for the next session."
}

Rules:
- patterns: 2–3 items max
- nextStep must be actionable and specific to the papers seen, not generic advice${thesisCtx}`,
        },
        {
          role: 'user',
          content: `Full library (${allPapers.length} papers):\n${libraryContext(allPapers)}\n\nAdded this session:\n${libraryContext(sessionPapers)}`,
        },
      ],
      response_format: { type: 'json_object' },
    });

    const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
    res.json({ ...parsed, addedCount: sessionPapers.length });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
