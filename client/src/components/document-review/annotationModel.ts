import type {
  AnnotationTone,
  AnnotationType,
  NormalizedWord,
  ReviewAnnotation,
  ReviewSentence,
} from './types';

const reviewWordPattern = /[\p{L}\p{N}][\p{L}\p{N}'Ã¢â‚¬â„¢-]*/gu;

export const annotationTones: Record<AnnotationType, AnnotationTone> = {
  green: {
    background: 'rgba(187, 247, 208, 0.42)',
    outline: 'rgba(0, 0, 0, 0)',
  },
  orange: {
    background: 'rgba(254, 215, 170, 0.42)',
    outline: 'rgba(0, 0, 0, 0)',
  },
  red: {
    background: 'rgba(254, 202, 202, 0.42)',
    outline: 'rgba(0, 0, 0, 0)',
  },
  debug_green: {
    background: 'rgba(187, 247, 208, 0.34)',
    outline: 'rgba(0, 0, 0, 0)',
  },
  debug_orange: {
    background: 'rgba(254, 215, 170, 0.34)',
    outline: 'rgba(0, 0, 0, 0)',
  },
  debug_red: {
    background: 'rgba(254, 202, 202, 0.34)',
    outline: 'rgba(0, 0, 0, 0)',
  },
  debug_blue: {
    background: 'rgba(191, 219, 254, 0.34)',
    outline: 'rgba(0, 0, 0, 0)',
  },
  debug_purple: {
    background: 'rgba(233, 213, 255, 0.34)',
    outline: 'rgba(0, 0, 0, 0)',
  },
};

export type AnnotationSourceScope = {
  pageIndex: number;
  text: string;
  charStart: number;
  wordStartIndex: number;
  wordEndIndex: number;
};

export type ReviewSentenceDebug = {
  rawSentenceCount: number;
  finalSentenceCount: number;
  bodyStartSentenceIndex: number | null;
  bodyStartWordIndex: number | null;
};

export const buildNormalizedWords = (text: string): NormalizedWord[] => {
  const words: NormalizedWord[] = [];
  const sanitizedText = text.replace(/\r\n/g, '\n');
  let match: RegExpExecArray | null;
  let index = 0;

  reviewWordPattern.lastIndex = 0;

  while ((match = reviewWordPattern.exec(sanitizedText)) !== null) {
    const word = match[0];
    words.push({
      index,
      text: word,
      normalized: word.toLowerCase(),
      start: match.index,
      end: match.index + word.length,
    });
    index += 1;
  }

  return words;
};

export const buildReviewSentences = (
  scopes: AnnotationSourceScope[],
  words: NormalizedWord[],
  extractedText: string
): ReviewSentence[] => buildReviewSentencesWithDebug(scopes, words, extractedText).sentences;

export const buildReviewSentencesWithDebug = (
  scopes: AnnotationSourceScope[],
  words: NormalizedWord[],
  extractedText: string
): { sentences: ReviewSentence[]; debug: ReviewSentenceDebug } => {
  const pageRanges = scopes.map((scope) => ({
    pageIndex: scope.pageIndex,
    wordStartIndex: scope.wordStartIndex,
    wordEndIndex: scope.wordEndIndex,
  }));
  const candidates = assignParagraphIndexes(
    buildTokenOwnedSentences(words, extractedText, pageRanges),
    extractedText
  );
  const bodyStartOffset = findBodyStartOffset(candidates);
  const sentences = candidates.slice(bodyStartOffset).map((sentence, index) => ({
    ...sentence,
    index,
  }));

  return {
    sentences,
    debug: {
      rawSentenceCount: candidates.length,
      finalSentenceCount: sentences.length,
      bodyStartSentenceIndex: candidates[bodyStartOffset]?.index ?? null,
      bodyStartWordIndex: candidates[bodyStartOffset]?.wordStartIndex ?? null,
    },
  };
};

export const buildAnnotationWordMap = (
  annotations: ReviewAnnotation[]
): Map<number, ReviewAnnotation> => {
  const annotationWordMap = new Map<number, ReviewAnnotation>();

  annotations.forEach((annotation) => {
    annotation.tokenIndexes.forEach((wordIndex) => {
      annotationWordMap.set(wordIndex, annotation);
    });
  });

  return annotationWordMap;
};

export const rangesOverlap = (
  startA: number,
  endA: number,
  startB: number,
  endB: number
) => startA <= endB && startB <= endA;

const buildTokenOwnedSentences = (
  words: NormalizedWord[],
  extractedText: string,
  pageRanges: Array<{ pageIndex: number; wordStartIndex: number; wordEndIndex: number }>
) => {
  const sentences: ReviewSentence[] = [];
  let currentTokenIndexes: number[] = [];
  let currentSentenceStart = 0;

  words.forEach((word, index) => {
    if (currentTokenIndexes.length === 0) {
      currentSentenceStart = word.start;
    }

    currentTokenIndexes.push(word.index);
    const nextWord = words[index + 1];
    const gapText = extractedText.slice(word.end, nextWord?.start ?? extractedText.length);
    const sentenceEndsHere =
      nextWord === undefined
      || hasStrongLineBreak(gapText)
      || /[.!?]+/.test(gapText);

    if (!sentenceEndsHere) {
      return;
    }

    const sentenceEnd = nextWord === undefined
      ? extractedText.length
      : trimSentenceBoundary(extractedText, word.end, nextWord.start);
    const sentenceText = normalizeSentenceText(extractedText.slice(currentSentenceStart, sentenceEnd));

    if (isRenderableChunkUnit(sentenceText)) {
      const firstTokenIndex = currentTokenIndexes[0];
      const lastTokenIndex = currentTokenIndexes[currentTokenIndexes.length - 1];

      sentences.push({
        index: sentences.length,
        pageIndex: findPageIndexForWord(firstTokenIndex, pageRanges),
        paragraphIndex: 0,
        text: sentenceText,
        start: currentSentenceStart,
        end: sentenceEnd,
        wordStartIndex: firstTokenIndex,
        wordEndIndex: lastTokenIndex,
        tokenIndexes: [...currentTokenIndexes],
      });
    }

    currentTokenIndexes = [];
  });

  if (currentTokenIndexes.length > 0) {
    const firstTokenIndex = currentTokenIndexes[0];
    const lastTokenIndex = currentTokenIndexes[currentTokenIndexes.length - 1];
    const trailingSentenceText = normalizeSentenceText(
      extractedText.slice(words[firstTokenIndex].start, words[lastTokenIndex].end)
    );

    if (isRenderableChunkUnit(trailingSentenceText)) {
      sentences.push({
        index: sentences.length,
        pageIndex: findPageIndexForWord(firstTokenIndex, pageRanges),
        paragraphIndex: 0,
        text: trailingSentenceText,
        start: words[firstTokenIndex].start,
        end: words[lastTokenIndex].end,
        wordStartIndex: firstTokenIndex,
        wordEndIndex: lastTokenIndex,
        tokenIndexes: [...currentTokenIndexes],
      });
    }
  }

  return sentences.filter((sentence) => sentence.tokenIndexes.length > 0 && /[A-Za-z0-9]/.test(sentence.text));
};

const assignParagraphIndexes = (sentences: ReviewSentence[], extractedText: string) => {
  let paragraphIndex = 0;

  return sentences.map((sentence, index) => {
    if (index > 0) {
      const previousSentence = sentences[index - 1];
      const boundaryText = extractedText.slice(previousSentence.end, sentence.start);

      if (
        sentence.pageIndex !== previousSentence.pageIndex
        || hasParagraphBreak(boundaryText)
      ) {
        paragraphIndex += 1;
      }
    }

    return {
      ...sentence,
      paragraphIndex,
    };
  });
};

const trimSentenceBoundary = (text: string, start: number, end: number) => {
  let boundary = end;

  while (boundary > start && /\s/.test(text[boundary - 1] ?? '')) {
    boundary -= 1;
  }

  return boundary;
};

const normalizeSentenceText = (sentence: string) => sentence.replace(/\s+/g, ' ').trim();

const hasParagraphBreak = (boundaryText: string) => {
  if (!boundaryText) {
    return false;
  }

  return /\n\s*\n/.test(boundaryText) || /\t/.test(boundaryText);
};

const hasStrongLineBreak = (boundaryText: string) => {
  if (!boundaryText) {
    return false;
  }

  return /\n/.test(boundaryText) || /\t/.test(boundaryText);
};

const findPageIndexForWord = (
  wordIndex: number,
  pageRanges: Array<{ pageIndex: number; wordStartIndex: number; wordEndIndex: number }>
) => {
  return pageRanges.find(
    (range) => wordIndex >= range.wordStartIndex && wordIndex <= range.wordEndIndex
  )?.pageIndex ?? 0;
};

const findBodyStartOffset = (sentences: ReviewSentence[]) => {
  for (let index = 0; index < sentences.length; index += 1) {
    if (looksLikeBodySentence(sentences[index].text)) {
      return index;
    }
  }

  return 0;
};

const looksLikeBodySentence = (sentence: string) => {
  const condensed = normalizeSentenceText(sentence);
  const words = condensed.split(' ').filter(Boolean);

  if (!isRenderableChunkUnit(condensed)) {
    return false;
  }

  if (words.length < 5) {
    return false;
  }

  const alphaMatches = condensed.match(/[A-Za-z]/g) ?? [];
  return condensed.length > 0 && alphaMatches.length / condensed.length >= 0.35;
};

const isRenderableChunkUnit = (sentence: string) => {
  const condensed = normalizeSentenceText(sentence);

  if (!condensed) {
    return false;
  }

  if (!/[A-Za-z0-9]/.test(condensed)) {
    return false;
  }

  const words = condensed.split(' ').filter(Boolean);
  if (words.length < 1) {
    return false;
  }

  if (/^\d+$/.test(condensed)) {
    return false;
  }

  return true;
};
