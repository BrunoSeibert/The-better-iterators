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
        minItems: 0,
        maxItems: 32,
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
              enum: ['green', 'orange', 'red'],
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
  const chunkCount = chunks.length;
  const targetRatio = chunkCount <= 12 ? 0.4 : chunkCount <= 24 ? 0.33 : 0.25;
  const targetSelectionCount = Math.max(3, Math.min(32, Math.round(chunkCount * targetRatio)));
  const perBandTarget = targetSelectionCount >= 9 ? 3 : targetSelectionCount >= 6 ? 2 : 1;

  // Internal audit note:
  // - API entry point: POST /api/review/thesis
  // - request payload shape: { documentType, estimatedPageCount, chunks: [{ chunkIndex, text }] }
  // - chunk selection decisions happen in this prompt via targetSelectionCount/perBandTarget
  // - response parsing happens in thesisChunkReviewParser.ts using chunkIndex as the only reference
  // - annotations are later created in client annotationMatcher.ts by chunkIndex only
  console.info('[review] building thesis chunk prompt', {
    documentType,
    estimatedPageCount: pageGuideline,
    chunkCount,
    targetSelectionCount,
    perBandTarget,
    payloadShape: {
      documentType: 'string',
      estimatedPageCount: 'number',
      chunks: 'Array<{ chunkIndex: number; text: string }>',
    },
  });

  return [
    {
      role: 'system' as const,
      content: [
        `You are a strict university-level thesis reviewer evaluating a ${documentType}.`,
        `Assume this is academic work that should meet a serious university standard for argumentation quality, clarity of reasoning, structure, precision of language, academic tone, and the balance between claims and evidence.`,
        `Your tone must be serious, constructive, and exacting. Do not be overly nice, and do not be theatrical or cruel.`,
        `Review the document holistically across the entire chunk list before deciding which chunks deserve annotations.`,
        `You may ONLY reference the provided chunkIndex values. Do not invent new chunk boundaries, sentence ranges, excerpts, or substring matches.`,
        `Select about ${targetSelectionCount} chunks total, which is roughly ${Math.round(targetRatio * 100)}% of the chunk list. Increase coverage compared with a sparse review, but do not saturate the whole document.`,
        `The document is about ${pageGuideline} A4 page(s) long and contains ${chunkCount} chunks, so aim for approximately ${targetSelectionCount} reviewed chunks.`,
        `Always include a mix of strong, average, and weak writing. Target at least ${perBandTarget} green chunk(s), ${perBandTarget} orange chunk(s), and ${perBandTarget} red chunk(s) whenever the text gives you enough evidence.`,
        `Use type "green" for standout strong writing, "orange" for writing that is adequate but should be improved, and "red" for clearly weak, problematic, imprecise, or academically unsafe writing.`,
        `Red should be reserved for genuinely problematic passages, not merely imperfect ones.`,
        `For every selected chunk, write detailed feedback of 4 to 6 full sentences.`,
        `Every annotation must stay very close to the actual chunk text by quoting or closely paraphrasing specific ideas, claims, transitions, or wording from that chunk.`,
        `Do not write generic comments such as "this could be clearer" or "good explanation" without explaining exactly why, how it affects thesis quality, and how the student should revise it.`,
        `When criticizing a chunk, explain the academic consequence: for example weak reasoning, vague causal logic, unsupported claims, imprecise terminology, weak structure, or an unconvincing thesis-defense standard.`,
        `When praising a chunk, explain what makes it academically strong and why it works at university thesis level.`,
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
