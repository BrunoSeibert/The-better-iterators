import { useEffect, useMemo, useRef, useState } from 'react';
import { buildAnnotationWordMap } from './annotationModel';
import { applyHighlightsToContainer, clearReviewAnnotations } from './domHighlighter';
import type { ParsedDocxReview } from './types';

type DocxPreviewModule = {
  renderAsync: (
    data: Blob | ArrayBuffer | Uint8Array,
    bodyContainer: HTMLElement,
    styleContainer?: HTMLElement | null,
    options?: {
      className?: string;
      inWrapper?: boolean;
      ignoreWidth?: boolean;
      ignoreHeight?: boolean;
      breakPages?: boolean;
    }
  ) => Promise<unknown>;
};

type DocxReviewProps = {
  document: ParsedDocxReview;
};

export default function DocxReview({ document }: DocxReviewProps) {
  const [renderError, setRenderError] = useState<string | null>(null);
  const renderContainerRef = useRef<HTMLDivElement | null>(null);
  const styleContainerRef = useRef<HTMLDivElement | null>(null);
  const wordAnnotations = useMemo(
    () => buildAnnotationWordMap(document.annotations),
    [document.annotations]
  );

  useEffect(() => {
    let isMounted = true;

    const renderDocument = async () => {
      const renderContainer = renderContainerRef.current;
      const styleContainer = styleContainerRef.current;

      if (!renderContainer || !styleContainer) {
        return;
      }

      renderContainer.innerHTML = '';
      styleContainer.innerHTML = '';
      setRenderError(null);

      try {
        const docxPreview = (await import('docx-preview')) as DocxPreviewModule;

        await docxPreview.renderAsync(document.arrayBuffer, renderContainer, styleContainer, {
          className: 'docx',
          inWrapper: true,
          ignoreWidth: false,
          ignoreHeight: false,
          breakPages: true,
        });

        if (!isMounted) {
          return;
        }

        applyHighlightsToContainer(renderContainer, wordAnnotations, 0, document);
      } catch (error) {
        if (!isMounted) {
          return;
        }

        setRenderError(
          error instanceof Error
            ? error.message
            : 'Failed to render the DOCX document.'
        );
      }
    };

    renderDocument().catch(() => {
      if (isMounted) {
        setRenderError('Failed to render the DOCX document.');
      }
    });

    return () => {
      isMounted = false;
      const renderContainer = renderContainerRef.current;
      if (renderContainer) {
        clearReviewAnnotations(renderContainer);
      }
    };
  }, [document.arrayBuffer]);

  useEffect(() => {
    const renderContainer = renderContainerRef.current;
    if (!renderContainer || renderContainer.childElementCount === 0) {
      return;
    }

    applyHighlightsToContainer(renderContainer, wordAnnotations, 0, document);
  }, [document, wordAnnotations]);

  if (renderError) {
    return (
      <div className="document-review-error mx-6 my-6 rounded-[1.5rem] px-6 py-5 text-sm font-medium">
        Error: No readable text could be extracted from this file.
      </div>
    );
  }

  return (
    <div className="document-review-docx h-full overflow-y-auto bg-neutral-100 px-4 py-8 sm:px-6">
      <div ref={styleContainerRef} data-review-ignore="true" />
      <div ref={renderContainerRef} className="mx-auto w-full max-w-[920px]" />
    </div>
  );
}

