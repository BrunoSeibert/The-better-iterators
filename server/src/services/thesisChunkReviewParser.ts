import { z } from 'zod';

const normalizedTypeSchema = z.enum(['green', 'orange', 'red']);

const sentenceCount = (feedback: string) => (feedback.match(/[.!?](?:\s|$)/g) ?? []).length;

const normalizeAnnotationType = (value: unknown) => {
  if (value === 'green' || value === 'orange' || value === 'red') {
    return value;
  }

  if (value === 'good') {
    return 'green';
  }

  if (value === 'improve') {
    return 'orange';
  }

  return null;
};

const annotationSchema = z.object({
  chunkIndex: z.number().int().min(0),
  type: normalizedTypeSchema,
  feedback: z.string().min(40),
});

export const thesisChunkReviewSchema = z.object({
  annotations: z.array(annotationSchema).max(32),
});

export type ParsedThesisChunkReviewResponse = z.infer<typeof thesisChunkReviewSchema>;

export const parseThesisChunkReviewResponse = (
  payload: unknown,
  options?: { maxChunkIndex?: number }
) => {
  const maxChunkIndex = options?.maxChunkIndex;
  const seen = new Set<number>();
  const rawAnnotations = (
    payload && typeof payload === 'object' && Array.isArray((payload as { annotations?: unknown }).annotations)
      ? (payload as { annotations: unknown[] }).annotations
      : []
  );

  // Internal audit note:
  // - response parsing logic lives here
  // - invalid or missing fields are filtered instead of crashing the pipeline
  // - legacy "good"/"improve" values are normalized to green/orange
  const annotations = rawAnnotations.flatMap((annotation) => {
    if (!annotation || typeof annotation !== 'object') {
      return [];
    }

    const candidate = annotation as {
      chunkIndex?: unknown;
      type?: unknown;
      feedback?: unknown;
    };

    if (!Number.isInteger(candidate.chunkIndex)) {
      return [];
    }

    const chunkIndex = candidate.chunkIndex as number;

    if (typeof maxChunkIndex === 'number' && chunkIndex > maxChunkIndex) {
      return [];
    }

    if (seen.has(chunkIndex)) {
      return [];
    }

    const normalizedType = normalizeAnnotationType(candidate.type);
    if (!normalizedType || typeof candidate.feedback !== 'string') {
      return [];
    }

    const feedback = candidate.feedback.trim();
    if (feedback.length < 40 || sentenceCount(feedback) < 4) {
      return [];
    }

    seen.add(chunkIndex);
    return [{
      chunkIndex,
      type: normalizedType,
      feedback,
    }];
  });

  return thesisChunkReviewSchema.parse({ annotations });
};
