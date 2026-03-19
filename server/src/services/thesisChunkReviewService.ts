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
  // Internal audit note:
  // - OpenAI API entry point for Mainframe 5 is this service
  // - it receives { documentType, estimatedPageCount, chunks }
  // - it sends json_schema output and parses back into chunk-index-only annotations
  console.info('[review] reviewThesisChunks entry', {
    model: REVIEW_MODEL,
    chunkCount: request.chunks.length,
    estimatedPageCount: request.estimatedPageCount,
    payloadShape: {
      documentType: typeof request.documentType,
      estimatedPageCount: typeof request.estimatedPageCount,
      chunks: 'Array<{ chunkIndex: number; text: string }>',
    },
  });

  if (!process.env.OPENAI_API_KEY) {
    console.warn('[review] OPENAI_API_KEY missing, returning empty annotations');
    return { annotations: [] };
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
  } catch (error) {
    console.warn('[review] openai request failed', {
      message: error instanceof Error ? error.message : 'unknown error',
    });
    return { annotations: [] };
  }

  const rawContent = completion.choices[0]?.message?.content;
  if (!rawContent) {
    console.warn('[review] missing message content from OpenAI, returning empty annotations');
    return { annotations: [] };
  }

  let parsed: unknown;

  try {
    parsed = JSON.parse(rawContent);
  } catch {
    console.warn('[review] invalid JSON returned from OpenAI, returning empty annotations');
    return { annotations: [] };
  }

  const result = parseThesisChunkReviewResponse(parsed, {
    maxChunkIndex: request.chunks.length - 1,
  });

  console.info('[review] parsed thesis review response', {
    annotationCount: result.annotations.length,
    types: result.annotations.reduce<Record<string, number>>((accumulator, annotation) => {
      accumulator[annotation.type] = (accumulator[annotation.type] ?? 0) + 1;
      return accumulator;
    }, {}),
  });

  return result;
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
