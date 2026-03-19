import OpenAI from 'openai';
import {
  buildThesisChunkReviewMessages,
  thesisChunkReviewResponseSchema,
  type ThesisChunkReviewRequest,
} from './thesisChunkReviewPrompt';
import {
  parseThesisChunkReviewResponse,
  type ParsedThesisChunkReviewResponse,
} from './thesisChunkReviewParser';

const REVIEW_MODEL = process.env.OPENAI_REVIEW_MODEL || 'gpt-4o-mini';
const REVIEW_TIMEOUT_MS = 45000;

export async function reviewThesisChunks(
  request: ThesisChunkReviewRequest
): Promise<ParsedThesisChunkReviewResponse> {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('OPENAI_API_KEY is not configured.');
  }

  const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  const messages = buildThesisChunkReviewMessages(request);

  let completion;

  try {
    completion = await withTimeout(
      openai.chat.completions.create({
        model: REVIEW_MODEL,
        messages,
        response_format: {
          type: 'json_schema',
          json_schema: thesisChunkReviewResponseSchema,
        },
        temperature: 0.3,
      }),
      REVIEW_TIMEOUT_MS,
      'OpenAI review timed out.'
    );
  } catch {
    throw new Error('openai request failed');
  }

  const rawContent = completion.choices[0]?.message?.content;
  if (!rawContent) {
    throw new Error('schema parse failed');
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    throw new Error('schema parse failed');
  }

  return parseThesisChunkReviewResponse(parsed);
}

async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  errorMessage: string
) {
  let timeoutHandle: NodeJS.Timeout | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timeoutHandle = setTimeout(() => {
          reject(new Error(errorMessage));
        }, timeoutMs);
      }),
    ]);
  } finally {
    if (timeoutHandle) {
      clearTimeout(timeoutHandle);
    }
  }
}
