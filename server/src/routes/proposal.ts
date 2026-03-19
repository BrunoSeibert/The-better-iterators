import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getThesisContext } from '../services/authService';

const router = Router();

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

    // Phase: topic-feedback — validate and critique the chosen topic
    if (phase === 'topic-feedback') {
      const { topicTitle, topicDescription, messages = [] } = req.body as {
        topicTitle: string;
        topicDescription?: string;
        messages?: { role: 'user' | 'assistant'; content: string }[];
      };

      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      const systemPrompt = `You are a thesis advisor helping a student evaluate their research topic. Be honest, constructive, and specific.

${userContext}${thesisCtx}

The student's chosen topic:
Title: "${topicTitle}"${topicDescription ? `\nDescription: "${topicDescription}"` : ''}

Evaluate:
1. Is the scope right for a thesis (not too broad or narrow)?
2. Is it researchable with available methods?
3. Does it align with their interests/degree?

Respond ONLY with valid JSON:
{
  "critique": "2-3 sentences of honest, specific feedback",
  "suggestion": "A refined topic title only — no intro text, no 'Consider...', just the title itself",
  "feasibility": "high" | "medium" | "low"
}`;

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          ...(history.length === 0 ? [{ role: 'user' as const, content: 'Please give me feedback on my topic.' }] : []),
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
      res.json(parsed);
      return;
    }

    // Phase: section-feedback — critique a proposal section
    if (phase === 'section-feedback') {
      const { section, content, allSections = {}, messages = [] } = req.body as {
        section: 'question' | 'motivation' | 'approach' | 'outcome';
        content: string;
        allSections: Record<string, string>;
        messages?: { role: 'user' | 'assistant'; content: string }[];
      };

      const sectionGuides: Record<string, string> = {
        question: `Evaluate the research question:
- Is it specific and focused (not just a topic)?
- Is it answerable through research?
- Is it neither too broad nor too trivial?
- Does it start with "How", "What", "To what extent", "Why" or similar?`,
        motivation: `Evaluate the motivation:
- Is there a clear gap in knowledge this fills?
- Is there real-world or academic relevance?
- Is it compelling to an expert/company partner?
- Is it grounded in the student's field?`,
        approach: `Evaluate the research approach:
- Is the methodology realistic for a thesis?
- Does it match the research question?
- Is it specific enough (not just "I will research...")?
- Are potential limitations acknowledged?`,
        outcome: `Evaluate the expected outcome:
- Is it specific and achievable?
- Does it clearly state the contribution?
- Is it relevant to the research question?
- Would it be valuable to the partner company/supervisor?`,
      };

      const sectionContext = Object.entries(allSections)
        .filter(([k, v]) => k !== section && v)
        .map(([k, v]) => `${k}: "${v}"`)
        .join('\n');

      const systemPrompt = `You are a thesis advisor reviewing a student's research proposal section by section. Be specific and actionable.

${userContext}${thesisCtx}
${sectionContext ? `\nOther sections already written:\n${sectionContext}` : ''}

Now reviewing the "${section}" section.
Student wrote: "${content}"

${sectionGuides[section]}

Respond ONLY with valid JSON:
{
  "critique": "2-3 sentences of specific, honest feedback on what works and what to improve",
  "suggestion": "A concrete rewritten or improved version of this section"
}`;

      const history = messages.map((m) => ({ role: m.role, content: m.content }));

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          ...history,
          ...(history.length === 0 ? [{ role: 'user' as const, content: 'Please critique this section.' }] : []),
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
      res.json(parsed);
      return;
    }

    // Phase: generate-final — assemble the full proposal
    if (phase === 'generate-final') {
      const { topic, sections } = req.body as {
        topic: { title: string; description?: string };
        sections: { question: string; motivation: string; approach: string; outcome: string };
      };

      const completion = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [
          {
            role: 'system',
            content: `You are a professional academic writing assistant. Assemble a clean, concise research proposal from the student's inputs. Write it in formal academic language, in first person. Make it read as a coherent document — not just joined paragraphs. Keep it to ~400 words.${thesisCtx}

Respond ONLY with valid JSON:
{
  "title": "A polished proposal title",
  "body": "The full formatted proposal as a single markdown string with sections: ## Research Topic, ## Research Question, ## Motivation, ## Methodology, ## Expected Outcome"
}`,
          },
          {
            role: 'user',
            content: `${userContext}

Topic: ${topic.title}
${topic.description ? `Topic description: ${topic.description}` : ''}
Research question: ${sections.question}
Motivation: ${sections.motivation}
Approach: ${sections.approach}
Expected outcome: ${sections.outcome}`,
          },
        ],
        response_format: { type: 'json_object' },
      });

      const parsed = JSON.parse(completion.choices[0].message.content ?? '{}');
      res.json(parsed);
      return;
    }

    res.status(400).json({ error: 'Invalid phase' });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
