import mammoth from 'mammoth';
import { pdfjs } from 'react-pdf';
import {
  buildNormalizedWords,
  createDeterministicAnnotations,
} from './annotationModel';
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

    for (let pageIndex = 0; pageIndex < pdfDocument.numPages; pageIndex += 1) {
      const page = await pdfDocument.getPage(pageIndex + 1);
      const textContent = await page.getTextContent();
      const pageText = textContent.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();

      const pageWords = buildNormalizedWords(pageText);
      pages.push({
        pageNumber: pageIndex + 1,
        wordStartIndex: runningWordIndex,
        wordEndIndex: runningWordIndex + Math.max(0, pageWords.length - 1),
        extractedText: pageText,
      });

      runningWordIndex += pageWords.length;
      extractedPageTexts.push(pageText);
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

    const parsedReview: ParsedPdfReview = {
      kind: 'pdf',
      fileName: file.name,
      sourceFile: file,
      pageCount: pages.length,
      pages,
      extractedText,
      words,
      annotations: createDeterministicAnnotations(file.name, extractedText, words),
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

    const parsedReview: ParsedDocxReview = {
      kind: 'docx',
      fileName: file.name,
      sourceFile: file,
      arrayBuffer,
      extractedText,
      words,
      annotations: createDeterministicAnnotations(file.name, extractedText, words),
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

