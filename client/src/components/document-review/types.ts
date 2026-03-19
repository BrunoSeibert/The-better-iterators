export type ReviewFileKind = 'pdf' | 'docx';

export type AnnotationType =
  | 'good'
  | 'improve'
  | 'debug_green'
  | 'debug_orange'
  | 'debug_red'
  | 'debug_blue'
  | 'debug_purple';

export type AnnotationTone = {
  background: string;
  outline: string;
};

export type NormalizedWord = {
  index: number;
  text: string;
  normalized: string;
  start: number;
  end: number;
};

export type ReviewAnnotation = {
  id: string;
  type: AnnotationType;
  pageIndex: number;
  start: number;
  end: number;
  quote: string;
  comment: string;
  wordStartIndex: number;
  wordEndIndex: number;
  tokenIndexes: number[];
  chunkIndex: number;
  sentenceStartIndex: number;
  sentenceEndIndex: number;
};

export type ReviewSentence = {
  index: number;
  pageIndex: number;
  paragraphIndex: number;
  text: string;
  start: number;
  end: number;
  wordStartIndex: number;
  wordEndIndex: number;
  tokenIndexes: number[];
};

export type ReviewChunkPayload = {
  chunkIndex: number;
  text: string;
};

export type ReviewAiAnnotation = {
  chunkIndex: number;
  type: 'good' | 'improve';
  feedback: string;
};

export type ReviewAiResponse = {
  annotations: ReviewAiAnnotation[];
};

export type ReviewAnnotationRect = {
  top: number;
  left: number;
  width: number;
  height: number;
};

export type ReviewAnnotationGeometry = {
  sentenceText: string;
  sentenceId: string;
  pageIndex: number;
  charRange: {
    start: number;
    end: number;
  };
  tokenRange: {
    start: number;
    end: number;
  };
  rects: ReviewAnnotationRect[];
  unionBoundingRect: ReviewAnnotationRect;
  markerAnchor: {
    top: number;
    left: number;
  };
  highlightColor: AnnotationType;
};

export type ParsedPdfPage = {
  pageNumber: number;
  charStart: number;
  charEnd: number;
  wordStartIndex: number;
  wordEndIndex: number;
  extractedText: string;
};

export type ParsedReviewBase = {
  kind: ReviewFileKind;
  fileName: string;
  extractedText: string;
  words: NormalizedWord[];
  sentences: ReviewSentence[];
  annotations: ReviewAnnotation[];
};

export type ParsedPdfReview = ParsedReviewBase & {
  kind: 'pdf';
  sourceFile: File;
  pageCount: number;
  pages: ParsedPdfPage[];
};

export type ParsedDocxReview = ParsedReviewBase & {
  kind: 'docx';
  sourceFile: File;
  arrayBuffer: ArrayBuffer;
};

export type ParsedReviewSuccess = ParsedPdfReview | ParsedDocxReview;

export type ParsedReviewError = {
  kind: 'error';
  fileName: string;
  message: string;
  detail?: string;
};

export type ParsedReviewResult = ParsedReviewSuccess | ParsedReviewError;

