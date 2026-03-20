import { useEffect, useMemo, useRef, useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import pdfWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import 'react-pdf/dist/Page/TextLayer.css';
import { buildAnnotationWordMap } from './annotationModel';
import { applyHighlightsToContainer, clearReviewAnnotations } from './domHighlighter';
import type { ParsedPdfPage, ParsedPdfReview, ReviewAnnotation } from './types';

pdfjs.GlobalWorkerOptions.workerSrc = pdfWorker;

type PdfReviewProps = {
  document: ParsedPdfReview;
  availableWidth: number;
};

const PAGE_FRAME_PADDING = 10;

const applyPageHighlights = (
  pageRoot: HTMLDivElement | null,
  pageModel: ParsedPdfPage | undefined,
  wordAnnotations: Map<number, ReviewAnnotation>,
  documentModel: ParsedPdfReview
) => {
  const textLayer = pageRoot?.querySelector<HTMLElement>('.react-pdf__Page__textContent');

  if (!pageRoot || !textLayer || !pageModel) {
    return;
  }

  applyHighlightsToContainer(pageRoot, wordAnnotations, pageModel.wordStartIndex, documentModel);
};

export default function PdfReview({ document, availableWidth }: PdfReviewProps) {
  const [pageCount, setPageCount] = useState(document.pageCount);
  const renderWidth = Math.max(
    220,
    Math.min(760, Math.floor(availableWidth - 48 - PAGE_FRAME_PADDING * 2 - 8))
  );
  const wordAnnotations = useMemo(
    () => buildAnnotationWordMap(document.annotations),
    [document.annotations]
  );

  return (
    <div className="document-review-pdf h-full overflow-y-auto bg-neutral-100 px-4 py-8 sm:px-6">
      <div className="flex w-full flex-col items-center gap-[10px]">
        <Document
          file={document.sourceFile}
          loading={
            <div className="flex min-h-[16rem] w-full items-center justify-center rounded-[1.5rem] bg-white text-sm text-neutral-500">
              Loading document...
            </div>
          }
          error={
            <div className="document-review-error flex min-h-[16rem] w-full items-center justify-center rounded-[1.5rem] px-6 text-center text-sm font-medium">
              Error: No readable text could be extracted from this file.
            </div>
          }
          onLoadSuccess={({ numPages }) => setPageCount(numPages)}
        >
          {Array.from({ length: pageCount }, (_, index) => {
            const pageNumber = index + 1;
            const pageModel = document.pages[index];

            return (
              <PdfReviewPage
                key={`pdf-page-${pageNumber}`}
                documentModel={document}
                pageModel={pageModel}
                pageNumber={pageNumber}
                renderWidth={renderWidth}
                wordAnnotations={wordAnnotations}
              />
            );
          })}
        </Document>
      </div>
    </div>
  );
}

type PdfReviewPageProps = {
  documentModel: ParsedPdfReview;
  pageModel: ParsedPdfPage | undefined;
  pageNumber: number;
  renderWidth: number;
  wordAnnotations: Map<number, ReviewAnnotation>;
};

function PdfReviewPage({
  documentModel,
  pageModel,
  pageNumber,
  renderWidth,
  wordAnnotations,
}: PdfReviewPageProps) {
  const pageRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyPageHighlights(pageRootRef.current, pageModel, wordAnnotations, documentModel);
  }, [documentModel, pageModel, wordAnnotations]);

  useEffect(() => {
    return () => {
      if (pageRootRef.current) {
        clearReviewAnnotations(pageRootRef.current);
      }
    };
  }, []);

  return (
    <div
      className="w-full max-w-full overflow-hidden rounded-[1.5rem] bg-transparent shadow-none"
    >
      <div className="flex justify-center p-[10px]">
        <Page
          inputRef={pageRootRef}
          pageNumber={pageNumber}
          width={renderWidth}
          renderAnnotationLayer={false}
          renderTextLayer
          className="document-review-pdf-page"
          onRenderTextLayerSuccess={() => {
            applyPageHighlights(pageRootRef.current, pageModel, wordAnnotations, documentModel);
          }}
        />
      </div>
    </div>
  );
}
