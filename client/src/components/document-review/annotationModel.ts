import type {
  AnnotationTone,
  AnnotationType,
  NormalizedWord,
  ReviewAnnotation,
} from './types';

const reviewWordPattern = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

const annotationComments: Record<AnnotationType, string> = {
  standout: 'Potential standout passage.',
  questionable: 'Potentially questionable wording.',
  likely_error: 'Potential likely error worth checking.',
};

export const annotationTones: Record<AnnotationType, AnnotationTone> = {
  standout: {
    background: 'rgba(134, 239, 172, 0.42)',
    outline: 'rgba(74, 222, 128, 0.45)',
  },
  questionable: {
    background: 'rgba(253, 186, 116, 0.42)',
    outline: 'rgba(251, 146, 60, 0.42)',
  },
  likely_error: {
    background: 'rgba(252, 165, 165, 0.42)',
    outline: 'rgba(248, 113, 113, 0.45)',
  },
};

type RandomGenerator = () => number;

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

export const createDeterministicAnnotations = (
  fileName: string,
  extractedText: string,
  words: NormalizedWord[]
): ReviewAnnotation[] => {
  if (words.length === 0) {
    return [];
  }

  const eligibleWords = words.filter((word) => word.text.length >= 4);
  const annotationCount = Math.min(
    18,
    Math.max(6, Math.floor(eligibleWords.length / 45))
  );

  if (eligibleWords.length === 0 || annotationCount === 0) {
    return [];
  }

  const random = createSeededRandom(`${fileName}:${extractedText.length}:${extractedText.slice(0, 512)}`);
  const annotations: ReviewAnnotation[] = [];
  const occupiedIndices = new Set<number>();
  const annotationTypes: AnnotationType[] = ['standout', 'questionable', 'likely_error'];

  let attempts = 0;

  while (annotations.length < annotationCount && attempts < annotationCount * 20) {
    attempts += 1;

    const candidate = eligibleWords[Math.floor(random() * eligibleWords.length)];
    const phraseLength = 1 + Math.floor(random() * 3);
    const wordStartIndex = candidate.index;
    const wordEndIndex = Math.min(words.length - 1, wordStartIndex + phraseLength - 1);

    let hasConflict = false;
    for (let currentIndex = wordStartIndex; currentIndex <= wordEndIndex; currentIndex += 1) {
      if (occupiedIndices.has(currentIndex)) {
        hasConflict = true;
        break;
      }
    }

    if (hasConflict) {
      continue;
    }

    const type = annotationTypes[Math.floor(random() * annotationTypes.length)];
    const start = words[wordStartIndex].start;
    const end = words[wordEndIndex].end;
    const quote = extractedText.slice(start, end);

    annotations.push({
      id: `annotation-${annotations.length}-${wordStartIndex}-${wordEndIndex}`,
      type,
      start,
      end,
      quote,
      comment: annotationComments[type],
      wordStartIndex,
      wordEndIndex,
    });

    for (let currentIndex = wordStartIndex; currentIndex <= wordEndIndex; currentIndex += 1) {
      occupiedIndices.add(currentIndex);
    }
  }

  return annotations.sort((left, right) => left.wordStartIndex - right.wordStartIndex);
};

export const buildAnnotationWordMap = (
  annotations: ReviewAnnotation[]
): Map<number, AnnotationType> => {
  const annotationWordMap = new Map<number, AnnotationType>();

  annotations.forEach((annotation) => {
    for (
      let wordIndex = annotation.wordStartIndex;
      wordIndex <= annotation.wordEndIndex;
      wordIndex += 1
    ) {
      annotationWordMap.set(wordIndex, annotation.type);
    }
  });

  return annotationWordMap;
};

const createSeededRandom = (seedInput: string): RandomGenerator => {
  let seed = 2166136261;

  for (let characterIndex = 0; characterIndex < seedInput.length; characterIndex += 1) {
    seed ^= seedInput.charCodeAt(characterIndex);
    seed = Math.imul(seed, 16777619);
  }

  return () => {
    seed += 0x6d2b79f5;
    let value = seed;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
};

