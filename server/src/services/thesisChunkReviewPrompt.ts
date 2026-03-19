export type ThesisReviewChunkInput = {
  chunkIndex: number;
  text: string;
};

export type ThesisChunkReviewRequest = {
  documentType?: string;
  estimatedPageCount?: number;
  chunks: ThesisReviewChunkInput[];
};

export const thesisChunkReviewResponseSchema = {
  name: 'thesis_chunk_review',
  strict: true,
  schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      annotations: {
        type: 'array',
        minItems: 2,
        maxItems: 15,
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            chunkIndex: {
              type: 'integer',
              minimum: 0,
            },
            type: {
              type: 'string',
              enum: ['good', 'improve'],
            },
            feedback: {
              type: 'string',
            },
          },
          required: ['chunkIndex', 'type', 'feedback'],
        },
      },
    },
    required: ['annotations'],
  },
} as const;

export const buildThesisChunkReviewMessages = ({
  documentType = 'Master Thesis',
  estimatedPageCount,
  chunks,
}: ThesisChunkReviewRequest) => {
  const chunkJson = JSON.stringify(chunks, null, 2);
  const pageGuideline = Math.max(1, estimatedPageCount ?? Math.max(1, Math.ceil(chunks.length / 4)));

  return [
    {
      role: 'system' as const,
      content: [
        `You are reviewing a ${documentType} as an academic writing reviewer.`,
        `Evaluate academic clarity, structure, argumentation, precision, coherence, style, and analytical quality.`,
        `Be constructive, serious, and specific.`,
        `You must review the thesis holistically across the full chunk list before choosing only the most important chunks.`,
        `You may ONLY select from the provided chunk indexes. Do not invent new chunk boundaries, text matches, snippets, or ranges.`,
        `Choose between 2 and 15 chunks total depending on document size. Do not over-annotate.`,
        `Use a rough guideline of about 1 compliment chunk and 1 improvement chunk per A4 page, so about 2 selected chunks per page in total.`,
        `The estimated document length is about ${pageGuideline} A4 page(s), so stay near that density unless the text clearly deserves fewer annotations.`,
        `If many chunks are merely acceptable, leave them unannotated and only select the highest-value ones.`,
        `Use type "good" for standout strong writing and "improve" for chunks that should be improved.`,
        `For every selected chunk, write detailed feedback of at least 4 full sentences.`,
        `Feedback must be specific to that chunk and useful for thesis-writing improvement.`,
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: [
        `Review this ${documentType}.`,
        `Here is the full ordered chunk list:`,
        chunkJson,
        `Return strict JSON only.`,
      ].join('\n\n'),
    },
  ];
};
