import type {
  AnnotationType,
  ParsedReviewSuccess,
  ReviewAiAnnotation,
  ReviewAnnotation,
  ReviewChunkPayload,
} from './types';

const CHUNK_SIZE = 6;
const MIN_RENDERABLE_CHUNK_WORDS = 5;
const DEBUG_TYPE_CYCLE: AnnotationType[] = [
  'debug_green',
  'debug_orange',
  'debug_red',
  'debug_blue',
  'debug_purple',
];

export const buildChunkAnnotations = (document: ParsedReviewSuccess): ReviewAnnotation[] => {
  const annotations: ReviewAnnotation[] = [];
  let sentenceIndex = 0;

  while (sentenceIndex < document.sentences.length) {
    const chunkSentences = collectParagraphBoundChunk(document.sentences, sentenceIndex);
    if (chunkSentences.length === 0) {
      sentenceIndex += 1;
      continue;
    }

    const firstSentence = chunkSentences[0];
    const lastSentence = chunkSentences[chunkSentences.length - 1];
    const chunkIndex = annotations.length;

    annotations.push({
      id: `chunk-annotation-${chunkIndex}`,
      type: DEBUG_TYPE_CYCLE[chunkIndex % DEBUG_TYPE_CYCLE.length],
      pageIndex: firstSentence.pageIndex,
      start: firstSentence.start,
      end: lastSentence.end,
      quote: chunkSentences.map((sentence) => sentence.text).join(' ').trim(),
      comment: '',
      wordStartIndex: firstSentence.wordStartIndex,
      wordEndIndex: lastSentence.wordEndIndex,
      tokenIndexes: chunkSentences.flatMap((sentence) => sentence.tokenIndexes),
      chunkIndex,
      sentenceStartIndex: firstSentence.index,
      sentenceEndIndex: lastSentence.index,
    });

    sentenceIndex = lastSentence.index + 1;
  }

  const finalizedAnnotations = filterNonRenderableChunks(annotations);
  logChunkDebug(document, finalizedAnnotations, calculateCoverage(document, finalizedAnnotations));
  return finalizedAnnotations;
};

export const buildChunkPayload = (annotations: ReviewAnnotation[]): ReviewChunkPayload[] =>
  annotations.map((annotation) => ({
    chunkIndex: annotation.chunkIndex,
    text: annotation.quote,
  }));

export const applyAiSelectionToChunks = (
  chunkAnnotations: ReviewAnnotation[],
  aiAnnotations: ReviewAiAnnotation[]
) => {
  const chunkMap = new Map(chunkAnnotations.map((annotation) => [annotation.chunkIndex, annotation]));
  const selected: ReviewAnnotation[] = [];
  const seen = new Set<number>();

  aiAnnotations.forEach((aiAnnotation) => {
    const normalizedType = normalizeAiAnnotationType(aiAnnotation.type);

    if (seen.has(aiAnnotation.chunkIndex)) {
      return;
    }

    if (!normalizedType || typeof aiAnnotation.feedback !== 'string') {
      return;
    }

    const chunk = chunkMap.get(aiAnnotation.chunkIndex);
    if (!chunk) {
      return;
    }

    seen.add(aiAnnotation.chunkIndex);
    selected.push({
      ...chunk,
      type: normalizedType,
      comment: aiAnnotation.feedback.trim(),
    });
  });

  return selected;
};

const normalizeAiAnnotationType = (value: string): AnnotationType | null => {
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

const collectParagraphBoundChunk = (
  sentences: ParsedReviewSuccess['sentences'],
  startIndex: number
) => {
  const firstSentence = sentences[startIndex];
  if (!firstSentence) {
    return [];
  }

  const chunkSentences = [firstSentence];
  const paragraphIndex = firstSentence.paragraphIndex;

  for (let offset = 1; offset < CHUNK_SIZE; offset += 1) {
    const candidate = sentences[startIndex + offset];
    if (!candidate || candidate.paragraphIndex !== paragraphIndex) {
      break;
    }

    chunkSentences.push(candidate);
  }

  return chunkSentences;
};

const filterNonRenderableChunks = (annotations: ReviewAnnotation[]) =>
  annotations.filter((annotation) => getChunkWordCount(annotation) >= MIN_RENDERABLE_CHUNK_WORDS);

const logChunkDebug = (
  document: ParsedReviewSuccess,
  annotations: ReviewAnnotation[],
  coverage: ReturnType<typeof calculateCoverage>
) => {
  console.groupCollapsed('[document-review] chunk visualization');
  console.log({
    extractedTextLength: document.extractedText.length,
    sentenceCount: document.sentences.length,
    chunkCount: annotations.length,
    proseTokenCount: coverage.proseTokenCount,
    coloredTokenCount: coverage.coloredTokenCount,
    coveragePercent: coverage.coveragePercent,
  });

  annotations.forEach((annotation) => {
    const chunkSentences = document.sentences.filter(
      (sentence) =>
        sentence.index >= annotation.sentenceStartIndex && sentence.index <= annotation.sentenceEndIndex
    );

    console.log({
      chunkIndex: annotation.chunkIndex,
      sentenceIndexes: chunkSentences.map((sentence) => sentence.index),
      chunkTextPreview: annotation.quote.slice(0, 220),
      tokenCount: annotation.wordEndIndex - annotation.wordStartIndex + 1,
      rectCount: 'pending-render',
    });
  });

  console.groupEnd();
};

export const buildChunkRectDebug = (
  annotation: ReviewAnnotation,
  rectCount: number,
  tokenCount: number
) => {
  console.log({
    chunkIndex: annotation.chunkIndex,
    sentenceIndexes: buildSentenceIndexes(annotation.sentenceStartIndex, annotation.sentenceEndIndex),
    chunkTextPreview: annotation.quote.slice(0, 220),
    tokenCount,
    rectCount,
  });
};

const getChunkWordCount = (annotation: ReviewAnnotation) =>
  annotation.quote.split(/\s+/).filter(Boolean).length;

export const buildBodyTokenOwnership = (
  document: ParsedReviewSuccess,
  annotations: ReviewAnnotation[]
) => {
  const ownership = new Map<
    number,
    {
      tokenText: string;
      tokenIndex: number;
      sentenceIndex: number;
      chunkIndex: number;
    }
  >();

  const tokenToSentence = new Map<number, number>();
  document.sentences.forEach((sentence) => {
    sentence.tokenIndexes.forEach((tokenIndex) => {
      tokenToSentence.set(tokenIndex, sentence.index);
    });
  });

  annotations.forEach((annotation) => {
    annotation.tokenIndexes.forEach((tokenIndex) => {
      ownership.set(tokenIndex, {
        tokenText: document.words[tokenIndex]?.text ?? '',
        tokenIndex,
        sentenceIndex: tokenToSentence.get(tokenIndex) ?? -1,
        chunkIndex: annotation.chunkIndex,
      });
    });
  });

  return ownership;
};

const buildSentenceIndexes = (start: number, end: number) => {
  const indexes: number[] = [];

  for (let index = start; index <= end; index += 1) {
    indexes.push(index);
  }

  return indexes;
};

const calculateCoverage = (document: ParsedReviewSuccess, annotations: ReviewAnnotation[]) => {
  if (document.sentences.length === 0) {
    return {
      proseTokenCount: 0,
      coloredTokenCount: 0,
      coveragePercent: 0,
    };
  }

  const proseTokenIndexes = document.sentences.flatMap((sentence) => sentence.tokenIndexes);
  const proseTokenSet = new Set(proseTokenIndexes);
  const proseTokenCount = proseTokenIndexes.length;
  const coloredWords = new Set<number>();

  annotations.forEach((annotation) => {
    annotation.tokenIndexes.forEach((wordIndex) => coloredWords.add(wordIndex));
  });

  const coloredTokenCount = Array.from(coloredWords).filter(
    (wordIndex) => proseTokenSet.has(wordIndex)
  ).length;

  return {
    proseTokenCount,
    coloredTokenCount,
    coveragePercent: proseTokenCount === 0
      ? 0
      : Number(((coloredTokenCount / proseTokenCount) * 100).toFixed(2)),
  };
};
