import { z } from 'zod';

const annotationSchema = z.object({
  chunkIndex: z.number().int().min(0),
  type: z.enum(['good', 'improve']),
  feedback: z
    .string()
    .min(40)
    .refine(
      (feedback) => (feedback.match(/[.!?](?:\s|$)/g) ?? []).length >= 4,
      'feedback must contain at least 4 full sentences'
    ),
});

export const thesisChunkReviewSchema = z.object({
  annotations: z.array(annotationSchema).min(2).max(15),
});

export type ParsedThesisChunkReviewResponse = z.infer<typeof thesisChunkReviewSchema>;

export const parseThesisChunkReviewResponse = (payload: unknown) => {
  try {
    return thesisChunkReviewSchema.parse(payload);
  } catch {
    throw new Error('schema parse failed');
  }
};
