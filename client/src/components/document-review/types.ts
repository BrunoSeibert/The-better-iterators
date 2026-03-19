export type ReviewFileKind = 'pdf' | 'docx';

export type AnnotationType = 'standout' | 'questionable' | 'likely_error';

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
  start: number;
  end: number;
  quote: string;
  comment: string;
  wordStartIndex: number;
  wordEndIndex: number;
};

export type ParsedPdfPage = {
  pageNumber: number;
  wordStartIndex: number;
  wordEndIndex: number;
  extractedText: string;
};

export type ParsedReviewBase = {
  kind: ReviewFileKind;
  fileName: string;
  extractedText: string;
  words: NormalizedWord[];
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

