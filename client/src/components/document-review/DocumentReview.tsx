import { useEffect, useMemo, useState } from 'react';
import './documentReview.css';
import { parseReviewDocument } from './parser';
import PdfReview from './PdfReview';
import DocxReview from './DocxReview';
import {
  applyAiSelectionToChunks,
  buildChunkAnnotations,
  buildChunkPayload,
} from './annotationMatcher';
import { reviewDocumentChunks } from '@/services/documentReviewService';
import type { ParsedReviewResult, ParsedReviewSuccess } from './types';

type DocumentReviewProps = {
  file: File;
  onChangeDocument: () => void;
  assistantOpen: boolean;
};

export default function DocumentReview({
  file,
  onChangeDocument,
  assistantOpen,
}: DocumentReviewProps) {
  const [reviewResult, setReviewResult] = useState<ParsedReviewResult | null>(null);
  const [reviewPhase, setReviewPhase] = useState<
    'uploading' | 'extracting' | 'chunking' | 'sending' | 'receiving' | 'rendering' | 'complete'
  >('uploading');
  const [reviewError, setReviewError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    setReviewPhase('extracting');
    setReviewResult(null);
    setReviewError(null);

    const runReview = async () => {
      let parsedSuccess: ParsedReviewSuccess | null = null;

      try {
        const parsedResult = await parseReviewDocument(file);

        if (!isMounted) {
          return;
        }

        if (parsedResult.kind === 'error') {
          setReviewResult(parsedResult);
          setReviewPhase('complete');
          return;
        }

        parsedSuccess = parsedResult;
        setReviewPhase('chunking');
        const chunkAnnotations = buildChunkAnnotations(parsedResult);
        const chunkPayload = buildChunkPayload(chunkAnnotations);
        const estimatedPageCount = parsedResult.kind === 'pdf'
          ? parsedResult.pageCount
          : Math.max(1, Math.ceil(chunkPayload.length / 4));

        setReviewPhase('sending');
        const reviewResponse = await reviewDocumentChunks(chunkPayload, estimatedPageCount);

        if (!isMounted) {
          return;
        }

        setReviewPhase('receiving');
        const annotations = applyAiSelectionToChunks(chunkAnnotations, reviewResponse.annotations);
        setReviewPhase('rendering');
        setReviewResult({
          ...parsedResult,
          annotations,
        });
        setReviewError(
          annotations.length === 0
            ? 'AI review completed, but no chunk selections could be rendered.'
            : null
        );
        setReviewPhase('complete');
      } catch (error) {
        if (!isMounted) {
          return;
        }

        const message = error instanceof Error ? error.message : 'Unexpected review failure.';

        setReviewError(message);
        setReviewResult(
          parsedSuccess
              ? { ...parsedSuccess, annotations: [] }
            : {
                kind: 'error',
                fileName: file.name,
                message: 'Error: Local chunk visualization could not be completed.',
                detail: message,
              }
        );
        setReviewPhase('complete');
      }
    };

    runReview();

    return () => {
      isMounted = false;
    };
  }, [file]);

  const availableWidth = useMemo(() => {
    const viewportWidth = typeof window === 'undefined' ? 1440 : window.innerWidth;
    const assistantPixels = assistantOpen
      ? Math.min(380, Math.max(320, viewportWidth * 0.32))
      : 0;

    return Math.max(220, viewportWidth - assistantPixels - 224);
  }, [assistantOpen]);

  const loadingMessage = useMemo(() => {
    switch (reviewPhase) {
      case 'uploading':
        return 'Uploading document...';
      case 'extracting':
        return 'Extracting text from document...';
      case 'chunking':
        return 'Grouping sentences into local chunks...';
      case 'sending':
        return 'Sending chunk list for thesis review...';
      case 'receiving':
        return 'Receiving selected chunk feedback...';
      case 'rendering':
        return 'Rendering chunk highlights...';
      default:
        return 'Preparing review...';
    }
  }, [reviewPhase]);

  return (
    <div className="document-review-shell flex h-full w-full flex-col rounded-md bg-neutral-100 px-5 py-5 text-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
            Review
          </p>
          <p className="mt-2 text-lg font-medium text-neutral-700">{file.name}</p>
        </div>
        {reviewPhase === 'complete' && (
          <button
            type="button"
            onClick={onChangeDocument}
            className="document-review-action-button px-5 py-2 text-sm font-medium transition"
          >
            Change Document
          </button>
        )}
      </div>

      <div className="mt-5 min-h-0 flex-1 rounded-md bg-white">
        {reviewPhase !== 'complete' ? (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-sm text-neutral-500">
            <div className="document-review-loading-spinner" aria-hidden="true" />
            <span>{loadingMessage}</span>
            <span className="text-xs uppercase tracking-[0.22em] text-neutral-400">{reviewPhase}</span>
          </div>
        ) : reviewResult?.kind === 'error' ? (
          <ErrorState message={reviewResult.message} detail={reviewResult.detail} />
        ) : reviewResult ? (
          <>
            {reviewError && (
              <div className="mx-5 mt-5 whitespace-pre-wrap rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
                {reviewError}
              </div>
            )}
            <ReviewRenderer
              document={reviewResult}
              availableWidth={availableWidth}
            />
          </>
        ) : null}
      </div>
    </div>
  );
}

function ReviewRenderer({
  document,
  availableWidth,
}: {
  document: ParsedReviewSuccess;
  availableWidth: number;
}) {
  if (document.kind === 'pdf') {
    return <PdfReview document={document} availableWidth={availableWidth} />;
  }

  return <DocxReview document={document} />;
}

function ErrorState({ message, detail }: { message: string; detail?: string }) {
  return (
    <div className="document-review-error m-6 rounded-[1.5rem] px-6 py-5">
      <p className="text-base font-semibold">{message}</p>
      {detail && <p className="mt-2 whitespace-pre-wrap text-sm opacity-80">{detail}</p>}
    </div>
  );
}
