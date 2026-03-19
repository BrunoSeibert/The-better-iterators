import mammoth from 'mammoth';
import { pdfjs } from 'react-pdf';
import { buildNormalizedWords, buildReviewSentencesWithDebug } from './annotationModel';
import type {
  ParsedDocxReview,
  ParsedPdfPage,
  ParsedPdfReview,
  ParsedReviewError,
  ParsedReviewResult,
} from './types';

export const parseReviewDocument = async (file: File): Promise<ParsedReviewResult> => {
  if (file.size === 0) {
    return createError(file.name, 'Error: No readable text could be extracted from this file.');
  }

  const fileType = detectReviewFileType(file);

  if (fileType === 'pdf') {
    return parsePdfReview(file);
  }

  if (fileType === 'docx') {
    return parseDocxReview(file);
  }

  return createError(file.name, 'Error: This file type is not supported for review yet.');
};

const parsePdfReview = async (file: File): Promise<ParsedReviewResult> => {
  try {
    const data = new Uint8Array(await file.arrayBuffer());
    const pdfDocument = await pdfjs.getDocument({ data }).promise;
    const pages: ParsedPdfPage[] = [];
    const extractedPageTexts: string[] = [];
    let runningWordIndex = 0;
    let runningCharIndex = 0;

    for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
      const page = await pdfDocument.getPage(pageIndex + 1);
      const textContent = await page.getTextContent();
      const pageText = buildPdfPageText(textContent.items);

      const pageWords = buildNormalizedWords(pageText);
      pages.push({
        pageNumber: pageIndex + 1,
        charStart: runningCharIndex,
        charEnd: runningCharIndex + pageText.length,
        wordStartIndex: runningWordIndex,
        wordEndIndex: runningWordIndex + Math.max(0, pageWords.length - 1),
        extractedText: pageText,
      });

      runningWordIndex += pageWords.length;
      extractedPageTexts.push(pageText);
      runningCharIndex += pageText.length + 2;
    }

    await pdfDocument.destroy();

    const extractedText = extractedPageTexts.join('\n\n').trim();
    if (!extractedText) {
      return createError(file.name, 'Error: No readable text could be extracted from this file.');
    }

    const words = buildNormalizedWords(extractedText);
    if (words.length === 0) {
      return createError(file.name, 'Error: No readable text could be extracted from this file.');
    }

    const sentenceResult = buildReviewSentencesWithDebug(
      pages.map((page, pageIndex) => ({
        pageIndex,
        text: page.extractedText,
        charStart: page.charStart,
        wordStartIndex: page.wordStartIndex,
        wordEndIndex: page.wordEndIndex,
      })),
      words,
      extractedText
    );

    console.groupCollapsed('[document-review] sentence extraction');
    console.log({
      fileName: file.name,
      extractedTextLength: extractedText.length,
      rawSentenceCount: sentenceResult.debug.rawSentenceCount,
      finalSentenceCount: sentenceResult.debug.finalSentenceCount,
      bodyStartSentenceIndex: sentenceResult.debug.bodyStartSentenceIndex,
      bodyStartWordIndex: sentenceResult.debug.bodyStartWordIndex,
    });
    console.groupEnd();

    const parsedReview: ParsedPdfReview = {
      kind: 'pdf',
      fileName: file.name,
      sourceFile: file,
      pageCount: pages.length,
      pages,
      extractedText,
      words,
      sentences: sentenceResult.sentences,
      annotations: [],
    };

    return parsedReview;
  } catch (error) {
    return createError(
      file.name,
      'Error: No readable text could be extracted from this file.',
      error instanceof Error ? error.message : 'Failed to parse PDF.'
    );
  }
};

const parseDocxReview = async (file: File): Promise<ParsedReviewResult> => {
  try {
    const arrayBuffer = await file.arrayBuffer();
    const mammothResult = await mammoth.extractRawText({ arrayBuffer });
    const extractedText = mammothResult.value.trim();

    if (!extractedText) {
      return createError(file.name, 'Error: No readable text could be extracted from this file.');
    }

    const words = buildNormalizedWords(extractedText);
    if (words.length === 0) {
      return createError(file.name, 'Error: No readable text could be extracted from this file.');
    }

    const sentenceResult = buildReviewSentencesWithDebug(
      [
        {
          pageIndex: 0,
          text: extractedText,
          charStart: 0,
          wordStartIndex: 0,
          wordEndIndex: Math.max(0, words.length - 1),
        },
      ],
      words,
      extractedText
    );

    console.groupCollapsed('[document-review] sentence extraction');
    console.log({
      fileName: file.name,
      extractedTextLength: extractedText.length,
      rawSentenceCount: sentenceResult.debug.rawSentenceCount,
      finalSentenceCount: sentenceResult.debug.finalSentenceCount,
      bodyStartSentenceIndex: sentenceResult.debug.bodyStartSentenceIndex,
      bodyStartWordIndex: sentenceResult.debug.bodyStartWordIndex,
    });
    console.groupEnd();

    const parsedReview: ParsedDocxReview = {
      kind: 'docx',
      fileName: file.name,
      sourceFile: file,
      arrayBuffer,
      extractedText,
      words,
      sentences: sentenceResult.sentences,
      annotations: [],
    };

    return parsedReview;
  } catch (error) {
    return createError(
      file.name,
      'Error: No readable text could be extracted from this file.',
      error instanceof Error ? error.message : 'Failed to parse DOCX.'
    );
  }
};

const detectReviewFileType = (file: File) => {
  const extension = file.name.split('.').pop()?.toLowerCase() ?? '';

  if (file.type === 'application/pdf' || extension === 'pdf') {
    return 'pdf';
  }

  if (
    file.type ===
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    extension === 'docx'
  ) {
    return 'docx';
  }

  return 'unsupported';
};

const createError = (
  fileName: string,
  message: string,
  detail?: string
): ParsedReviewError => ({
  kind: 'error',
  fileName,
  message,
  detail,
});

const buildPdfPageText = (items: Array<unknown>) => {
  let pageText = '';
  let previousItem: {
    str: string;
    y: number;
    height: number;
    hasEOL: boolean;
  } | null = null;

  items.forEach((item) => {
    if (!item || typeof item !== 'object' || !('str' in item)) {
      return;
    }

    const text = typeof item.str === 'string' ? item.str : '';
    if (!text.trim()) {
      return;
    }

    const transform = 'transform' in item && Array.isArray(item.transform) ? item.transform : null;
    const y = typeof transform?.[5] === 'number' ? transform[5] : 0;
    const height = typeof transform?.[3] === 'number' ? Math.abs(transform[3]) : 0;
    const hasEOL = 'hasEOL' in item && item.hasEOL === true;

    if (!previousItem) {
      pageText += text;
      previousItem = { str: text, y, height, hasEOL };
      return;
    }

    const separator = determinePdfSeparator(previousItem, { str: text, y, height, hasEOL });
    pageText += separator + text;
    previousItem = { str: text, y, height, hasEOL };
  });

  return pageText.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
};

const determinePdfSeparator = (
  previousItem: { str: string; y: number; height: number; hasEOL: boolean },
  nextItem: { str: string; y: number; height: number; hasEOL: boolean }
) => {
  const yGap = Math.abs(previousItem.y - nextItem.y);
  const baselineHeight = Math.max(previousItem.height, nextItem.height, 1);

  if (previousItem.hasEOL) {
    return yGap > baselineHeight * 1.4 ? '\n\n' : '\n';
  }

  if (yGap > baselineHeight * 1.4) {
    return '\n\n';
  }

  if (yGap > baselineHeight * 0.45) {
    return '\n';
  }

  if (/[([{"'“]$/.test(previousItem.str) || /^[)\]}"'”:;,.!?]/.test(nextItem.str)) {
    return '';
  }

  return ' ';
};

