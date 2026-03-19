import { Router, Request, Response } from 'express';
import OpenAI from 'openai';
import { db } from '../config/db';
import { requireAuth, AuthRequest } from '../middleware/auth';
import { getThesisContext } from '../services/authService';

const router = Router();

type PresentationTestQuestionResponse = {
  questions: string[];
};

type PresentationTestEvaluationResponse = {
  deliveryFeedback: {
    summary: string;
    confidence: { rating: number; feedback: string };
    tonality: { rating: number; feedback: string };
    clarity: { rating: number; feedback: string };
    pacing: { rating: number; feedback: string };
    fillerWords: { rating: number; feedback: string };
  };
  defenseFeedback: {
    summary: string;
    questionHandling: { rating: number; feedback: string };
    argumentStrength: { rating: number; feedback: string };
    academicPrecision: { rating: number; feedback: string };
    defenseQuality: { rating: number; feedback: string };
  };
  overallSummary: string;
  improvements: string[];
  quotedEvidence: string[];
};

async function getUserPresentationContext(userId: string) {
  const userResult = await db.query(
    'SELECT interests, degree_type, current_level FROM "User" WHERE id = $1',
    [userId]
  );
  const user = userResult.rows[0];

  let fieldNames: string[] = [];
  if (user?.interests?.length > 0) {
    const fieldsResult = await db.query(
      'SELECT name FROM fields WHERE id = ANY($1::text[])',
      [user.interests]
    );
    fieldNames = fieldsResult.rows.map((row: { name: string }) => row.name);
  }

  return {
    degreeType: user?.degree_type ?? 'not specified',
    currentLevel: user?.current_level ?? null,
    interests: fieldNames,
  };
}

router.post('/questions', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const { questionCount = 8 } = req.body ?? {};

  try {
    const userContext = await getUserPresentationContext(userId);

    const thesisCtx = await getThesisContext(userId);

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are creating a mock thesis presentation / thesis defense practice session.

Generate concise, examiner-style oral-defense questions that are suitable for roughly one-minute spoken answers.
Questions should feel realistic, varied, and serious.
Cover a mix of:
- thesis motivation
- research question framing
- methodology
- findings / interpretation
- limitations
- practical relevance
- critical defense of choices

Return ONLY valid JSON in this exact shape:
{
  "questions": ["...", "..."]
}${thesisCtx}`,
        },
        {
          role: 'user',
          content: `Student context:
- Degree type: ${userContext.degreeType}
- Current level: ${userContext.currentLevel ?? 'unknown'}
- Interests: ${userContext.interests.length > 0 ? userContext.interests.join(', ') : 'not specified'}

Generate ${questionCount} concise thesis-defense questions in order.`,
        },
      ],
    });

    const parsed = JSON.parse(
      completion.choices[0].message.content ?? '{"questions":[]}'
    ) as PresentationTestQuestionResponse;

    const questions = Array.isArray(parsed.questions)
      ? parsed.questions.filter((question) => typeof question === 'string' && question.trim().length > 0)
      : [];

    res.json({
      questions: questions.slice(0, questionCount),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Question generation failed.';
    res.status(500).json({ error: message });
  }
});

router.post('/evaluate', requireAuth, async (req: Request, res: Response) => {
  const userId = (req as AuthRequest).userId;
  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const {
    questions = [],
    transcriptEntries = [],
    durationSeconds = 0,
  } = req.body ?? {};

  if (!Array.isArray(questions) || !Array.isArray(transcriptEntries)) {
    res.status(400).json({ error: 'questions and transcriptEntries arrays are required.' });
    return;
  }

  try {
    const [userContext, thesisCtx] = await Promise.all([
      getUserPresentationContext(userId),
      getThesisContext(userId),
    ]);

    const normalizedTranscript = transcriptEntries
      .filter((entry: any) => typeof entry?.text === 'string' && entry.text.trim().length > 0)
      .map((entry: any, index: number) => ({
        index,
        questionIndex: typeof entry.questionIndex === 'number' ? entry.questionIndex : null,
        startedAtMs: typeof entry.startedAtMs === 'number' ? entry.startedAtMs : null,
        endedAtMs: typeof entry.endedAtMs === 'number' ? entry.endedAtMs : null,
        text: entry.text.trim(),
      }));

    if (normalizedTranscript.length === 0) {
      const fallback: PresentationTestEvaluationResponse = {
        deliveryFeedback: {
          summary: 'Not enough spoken content was captured to evaluate delivery reliably.',
          confidence: { rating: 1, feedback: 'The session did not contain enough transcript data to judge confidence.' },
          tonality: { rating: 1, feedback: 'Tonality could not be inferred from the captured material.' },
          clarity: { rating: 1, feedback: 'There was not enough usable transcript data to assess clarity.' },
          pacing: { rating: 1, feedback: 'Pacing could not be estimated because the transcript was too sparse.' },
          fillerWords: { rating: 1, feedback: 'Filler-word usage could not be assessed from the limited transcript.' },
        },
        defenseFeedback: {
          summary: 'Not enough answer content was captured to evaluate defense quality.',
          questionHandling: { rating: 1, feedback: 'The transcript did not contain enough direct answers to score question handling.' },
          argumentStrength: { rating: 1, feedback: 'There was not enough material to judge reasoning strength.' },
          academicPrecision: { rating: 1, feedback: 'Academic precision could not be assessed from the limited response data.' },
          defenseQuality: { rating: 1, feedback: 'A reliable defense-quality review was not possible in this session.' },
        },
        overallSummary: 'The session ended without enough captured answer content for a meaningful mock-defense evaluation.',
        improvements: [
          'Ensure microphone capture is active before starting the session.',
          'Answer each displayed question out loud for longer than a few seconds.',
          'Run another test and verify that several transcript segments are captured.',
        ],
        quotedEvidence: [],
      };

      res.json(fallback);
      return;
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You are a serious mock thesis defense coach.${thesisCtx}

The student completed a timed oral-defense simulation. You are given:
- the ordered examiner-style questions
- transcript segments captured during the session
- rough timing metadata

Important limitation:
- You do NOT have raw audio prosody, only transcript content and timing metadata.
- For delivery topics like confidence, tonality, pacing, and filler words, make careful transcript-based inferences rather than pretending you heard the voice.

Be constructive, specific, and realistic.
Avoid generic praise.
Quote short snippets from the student's transcript when useful.
Use the thesis-defense questions to comment on whether the student actually addressed what was asked.
Where possible, comment on the research reasoning itself, not just presentation style.
Each rating must be an integer from 1 to 5.
Return ONLY valid JSON in this exact structure:
{
  "deliveryFeedback": {
    "summary": "...",
    "confidence": { "rating": 1, "feedback": "..." },
    "tonality": { "rating": 1, "feedback": "..." },
    "clarity": { "rating": 1, "feedback": "..." },
    "pacing": { "rating": 1, "feedback": "..." },
    "fillerWords": { "rating": 1, "feedback": "..." }
  },
  "defenseFeedback": {
    "summary": "...",
    "questionHandling": { "rating": 1, "feedback": "..." },
    "argumentStrength": { "rating": 1, "feedback": "..." },
    "academicPrecision": { "rating": 1, "feedback": "..." },
    "defenseQuality": { "rating": 1, "feedback": "..." }
  },
  "overallSummary": "...",
  "improvements": ["...", "...", "..."],
  "quotedEvidence": ["...", "...", "..."]
}`,
        },
        {
          role: 'user',
          content: `Student context:
- Degree type: ${userContext.degreeType}
- Interests: ${userContext.interests.length > 0 ? userContext.interests.join(', ') : 'not specified'}
- Session duration in seconds: ${durationSeconds}

Questions:
${questions.map((question: string, index: number) => `${index + 1}. ${question}`).join('\n')}

Transcript segments:
${normalizedTranscript.map((entry) => JSON.stringify(entry)).join('\n')}

Evaluate the student's performance across the full session.`,
        },
      ],
    });

    const parsed = JSON.parse(
      completion.choices[0].message.content ?? '{}'
    ) as PresentationTestEvaluationResponse;

    res.json(parsed);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Session evaluation failed.';
    res.status(500).json({ error: message });
  }
});

export default router;
