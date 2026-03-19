import { useEffect, useMemo, useState } from 'react';
import './documentReview.css';
import { parseReviewDocument } from './parser';
import PdfReview from './PdfReview';
import DocxReview from './DocxReview';
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
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    setIsLoading(true);
    setReviewResult(null);

    parseReviewDocument(file)
      .then((result) => {
        if (!isMounted) {
          return;
        }

        setReviewResult(result);
      })
      .catch((error) => {
        if (!isMounted) {
          return;
        }

        setReviewResult({
          kind: 'error',
          fileName: file.name,
          message: 'Error: No readable text could be extracted from this file.',
          detail: error instanceof Error ? error.message : 'Unexpected parsing failure.',
        });
      })
      .finally(() => {
        if (isMounted) {
          setIsLoading(false);
        }
      });

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

  return (
    <div className="document-review-shell flex h-full w-full flex-col rounded-md bg-neutral-100 px-5 py-5 text-neutral-900">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-neutral-400">
            Review
          </p>
          <p className="mt-2 text-lg font-medium text-neutral-700">{file.name}</p>
        </div>
        <button
          type="button"
          onClick={onChangeDocument}
          className="rounded-full border border-neutral-300 bg-white px-5 py-2 text-sm font-medium text-neutral-700 transition hover:border-neutral-400 hover:bg-neutral-50"
        >
          Change Document
        </button>
      </div>

      <div className="mt-5 min-h-0 flex-1 rounded-md bg-white">
        {isLoading ? (
          <div className="flex h-full items-center justify-center px-6 text-sm text-neutral-500">
            Reading document...
          </div>
        ) : reviewResult?.kind === 'error' ? (
          <ErrorState message={reviewResult.message} detail={reviewResult.detail} />
        ) : reviewResult ? (
          <ReviewRenderer
            document={reviewResult}
            availableWidth={availableWidth}
          />
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
      {detail && <p className="mt-2 text-sm opacity-80">{detail}</p>}
    </div>
  );
}
