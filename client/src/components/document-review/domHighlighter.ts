import { annotationTones } from './annotationModel';
import { buildBodyTokenOwnership, buildChunkRectDebug } from './annotationMatcher';
import type { ParsedReviewSuccess, ReviewAnnotation } from './types';

const reviewWordPattern = /[\p{L}\p{N}][\p{L}\p{N}'Ã¢â‚¬â„¢-]*/gu;
const cleanupRegistry = new WeakMap<HTMLElement, () => void>();
const activeAnnotationRegistry = new WeakMap<HTMLElement, string | null>();

type HighlightController = {
  cleanup: () => void;
  rerender: (config: {
    wordAnnotations: Map<number, ReviewAnnotation>;
    startingWordIndex: number;
    documentModel?: ParsedReviewSuccess;
  }) => void;
};

const controllerRegistry = new WeakMap<HTMLElement, HighlightController>();

type Rect = {
  top: number;
  left: number;
  width: number;
  height: number;
  right: number;
  bottom: number;
};

type TokenRect = Rect & {
  tokenIndex: number;
};

type AnnotationGeometry = {
  annotation: ReviewAnnotation;
  rects: TokenRect[];
  unionRect: Rect;
  markerAnchor: { top: number; left: number };
};

export const applyHighlightsToContainer = (
  root: HTMLElement,
  wordAnnotations: Map<number, ReviewAnnotation>,
  startingWordIndex = 0,
  documentModel?: ParsedReviewSuccess
) => {
  const existingController = controllerRegistry.get(root);
  if (existingController) {
    existingController.rerender({
      wordAnnotations,
      startingWordIndex,
      documentModel,
    });
    return existingController.cleanup;
  }

  const rootPosition = window.getComputedStyle(root).position;
  if (rootPosition === 'static') {
    root.style.position = 'relative';
  }

  const highlightLayer = document.createElement('div');
  highlightLayer.className = 'document-review-highlight-layer';
  highlightLayer.dataset.reviewHighlightLayer = 'true';
  root.append(highlightLayer);

  const markerLayer = document.createElement('div');
  markerLayer.className = 'document-review-marker-layer';
  document.body.append(markerLayer);

  const tooltipLayer = document.createElement('div');
  tooltipLayer.className = 'document-review-tooltip-layer';
  document.body.append(tooltipLayer);

  const annotationsById = new Map<string, ReviewAnnotation>();
  let currentWordAnnotations = wordAnnotations;
  let currentStartingWordIndex = startingWordIndex;
  let currentDocumentModel = documentModel;
  let activeAnnotationId: string | null = activeAnnotationRegistry.get(root) ?? null;
  const setActiveAnnotationId = (nextAnnotationId: string | null) => {
    activeAnnotationId = nextAnnotationId;
    activeAnnotationRegistry.set(root, activeAnnotationId);
    rerender();
  };

  const rerender = () => {
    if (!highlightLayer.isConnected || highlightLayer.parentElement !== root) {
      root.append(highlightLayer);
    }
    if (!markerLayer.isConnected) {
      document.body.append(markerLayer);
    }
    if (!tooltipLayer.isConnected) {
      document.body.append(tooltipLayer);
    }

    annotationsById.clear();
    currentWordAnnotations.forEach((annotation) => {
      annotationsById.set(annotation.id, annotation);
    });

    if (activeAnnotationId && !annotationsById.has(activeAnnotationId)) {
      activeAnnotationId = null;
      activeAnnotationRegistry.set(root, null);
    }

    const renderedTokenRects = collectRenderedTokenRects(root, currentWordAnnotations, currentStartingWordIndex);
    const geometries = buildAnnotationGeometries(root, annotationsById, renderedTokenRects);
    drawTokenRects(highlightLayer, geometries);
    drawMarkers(markerLayer, tooltipLayer, geometries, activeAnnotationId, setActiveAnnotationId);

    if (currentDocumentModel) {
      logBodyTokenValidation(currentDocumentModel, annotationsById, renderedTokenRects);
    }
  };

  rerender();

  const handleWindowChange = () => {
    rerender();
  };

  window.addEventListener('scroll', handleWindowChange, true);
  window.addEventListener('resize', handleWindowChange);

  const resizeObserver = new ResizeObserver(() => {
    rerender();
  });
  resizeObserver.observe(root);

  const cleanup = () => {
    window.removeEventListener('scroll', handleWindowChange, true);
    window.removeEventListener('resize', handleWindowChange);
    resizeObserver.disconnect();
    activeAnnotationRegistry.set(root, activeAnnotationId);
    markerLayer.remove();
    tooltipLayer.remove();
    highlightLayer.remove();
    cleanupRegistry.delete(root);
    controllerRegistry.delete(root);
  };

  cleanupRegistry.set(root, cleanup);
  controllerRegistry.set(root, {
    cleanup,
    rerender: (config) => {
      currentWordAnnotations = config.wordAnnotations;
      currentStartingWordIndex = config.startingWordIndex;
      currentDocumentModel = config.documentModel;
      rerender();
    },
  });

  return cleanup;
};

export const clearReviewAnnotations = (root: HTMLElement) => {
  cleanupRegistry.get(root)?.();
  root.querySelectorAll('[data-review-highlight-layer="true"]').forEach((node) => node.remove());
};

const collectRenderedTokenRects = (
  root: HTMLElement,
  wordAnnotations: Map<number, ReviewAnnotation>,
  startingWordIndex: number
) => {
  const rootRect = root.getBoundingClientRect();
  const textNodes = collectReviewTextNodes(root);
  const renderedTokenRects = new Map<number, TokenRect[]>();
  let globalWordIndex = startingWordIndex;

  textNodes.forEach((textNode) => {
    const nodeText = textNode.nodeValue ?? '';
    let match: RegExpExecArray | null;

    reviewWordPattern.lastIndex = 0;

    while ((match = reviewWordPattern.exec(nodeText)) !== null) {
      const tokenIndex = globalWordIndex;
      const annotation = wordAnnotations.get(tokenIndex);

      if (annotation) {
        const range = document.createRange();
        range.setStart(textNode, match.index);
        range.setEnd(textNode, match.index + match[0].length);

        const tokenRects = Array.from(range.getClientRects())
          .filter((rect) => rect.width > 0 && rect.height > 0)
          .map((rect) => ({
            ...toRelativeRect(rect, rootRect),
            tokenIndex,
          }));

        if (tokenRects.length > 0) {
          renderedTokenRects.set(tokenIndex, tokenRects);
        }

        range.detach?.();
      }

      globalWordIndex += 1;
    }
  });

  return renderedTokenRects;
};

const collectReviewTextNodes = (root: HTMLElement) => {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      if (!node.nodeValue || !node.nodeValue.trim()) {
        return NodeFilter.FILTER_REJECT;
      }

      const parentElement = node.parentElement;
      if (!parentElement) {
        return NodeFilter.FILTER_REJECT;
      }

      if (parentElement.closest('[data-review-ignore="true"]')) {
        return NodeFilter.FILTER_REJECT;
      }

      return NodeFilter.FILTER_ACCEPT;
    },
  });

  const textNodes: Text[] = [];
  let currentNode = walker.nextNode();

  while (currentNode) {
    textNodes.push(currentNode as Text);
    currentNode = walker.nextNode();
  }

  return textNodes;
};

const buildAnnotationGeometries = (
  root: HTMLElement,
  annotationsById: Map<string, ReviewAnnotation>,
  renderedTokenRects: Map<number, TokenRect[]>
) => {
  const geometries: AnnotationGeometry[] = [];

  annotationsById.forEach((annotation) => {
    const rects = annotation.tokenIndexes.flatMap((tokenIndex) => renderedTokenRects.get(tokenIndex) ?? []);
    const uniqueRects = dedupeRects(rects);
    const mergedRects = mergeLineRects(uniqueRects);

    buildChunkRectDebug(annotation, mergedRects.length, annotation.tokenIndexes.length);

    if (mergedRects.length === 0) {
      return;
    }

    geometries.push({
      annotation,
      rects: mergedRects,
      unionRect: computeUnionRect(mergedRects),
      markerAnchor: getMarkerAnchor(root, computeUnionRect(mergedRects)),
    });
  });

  return geometries;
};

const drawTokenRects = (
  highlightLayer: HTMLElement,
  geometries: AnnotationGeometry[]
) => {
  highlightLayer.innerHTML = '';

  geometries.forEach((geometry) => {
    const tone = annotationTones[geometry.annotation.type];

    geometry.rects.forEach((rect, rectIndex) => {
      const highlight = document.createElement('div');
      highlight.className = 'document-review-highlight-rect';
      highlight.dataset.reviewHighlight = 'true';
      highlight.dataset.annotationId = geometry.annotation.id;
      highlight.dataset.rectIndex = String(rectIndex);
      highlight.style.left = `${rect.left}px`;
      highlight.style.top = `${rect.top}px`;
      highlight.style.width = `${rect.width}px`;
      highlight.style.height = `${rect.height}px`;
      highlight.style.background = tone.background;
      highlightLayer.append(highlight);
    });
  });
};

const drawMarkers = (
  markerLayer: HTMLElement,
  tooltipLayer: HTMLElement,
  geometries: AnnotationGeometry[],
  activeAnnotationId: string | null,
  setActiveAnnotationId: (annotationId: string | null) => void
) => {
  markerLayer.innerHTML = '';
  tooltipLayer.innerHTML = '';

  geometries.forEach((geometry) => {
    if (!geometry.annotation.comment.trim()) {
      return;
    }

    const marker = document.createElement('div');
    marker.className = 'document-review-marker';
    marker.style.left = `${geometry.markerAnchor.left}px`;
    marker.style.top = `${geometry.markerAnchor.top}px`;

    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'document-review-marker-button';
    button.setAttribute('aria-label', 'Open chunk feedback');
    button.setAttribute('aria-expanded', activeAnnotationId === geometry.annotation.id ? 'true' : 'false');
    button.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" class="document-review-marker-icon">
        <circle cx="12" cy="12" r="8.15" fill="none" stroke="currentColor" stroke-width="1.9" />
        <circle cx="12" cy="7.75" r="1.05" fill="currentColor" />
        <path fill="currentColor" d="M10.95 10.2h2.1v6.4h-2.1z" />
      </svg>
    `;

    const tooltip = document.createElement('div');
    tooltip.className = 'document-review-marker-tooltip';
    tooltip.dataset.open = activeAnnotationId === geometry.annotation.id ? 'true' : 'false';
    tooltip.setAttribute('role', 'dialog');

    const header = document.createElement('div');
    header.className = 'document-review-marker-tooltip-header';

    const closeButton = document.createElement('button');
    closeButton.type = 'button';
    closeButton.className = 'document-review-marker-tooltip-close';
    closeButton.setAttribute('aria-label', 'Close feedback');
    closeButton.textContent = '×';

    const body = document.createElement('p');
    body.className = 'document-review-marker-tooltip-body';
    body.textContent = geometry.annotation.comment;

    const preferredLeft = geometry.markerAnchor.left + 12;
    const tooltipMaxWidth = Math.min(448, window.innerWidth * 0.48);
    const clampedLeft = Math.min(
      preferredLeft,
      Math.max(30, window.innerWidth - tooltipMaxWidth - 30)
    );

    tooltip.style.left = `${clampedLeft}px`;
    tooltip.style.top = `${geometry.markerAnchor.top + 20}px`;
    header.append(closeButton);
    tooltip.append(header);
    tooltip.append(body);

    marker.dataset.open = activeAnnotationId === geometry.annotation.id ? 'true' : 'false';

    button.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveAnnotationId(
        activeAnnotationId === geometry.annotation.id ? null : geometry.annotation.id
      );
    });

    closeButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveAnnotationId(null);
    });

    marker.append(button);
    markerLayer.append(marker);
    tooltipLayer.append(tooltip);
  });
};

const logBodyTokenValidation = (
  documentModel: ParsedReviewSuccess,
  annotationsById: Map<string, ReviewAnnotation>,
  renderedTokenRects: Map<number, TokenRect[]>
) => {
  const ownership = buildBodyTokenOwnership(documentModel, Array.from(annotationsById.values()));
  let renderedTokenRectsCount = 0;

  console.groupCollapsed('[document-review] token ownership validation');
  ownership.forEach((token) => {
    const rects = renderedTokenRects.get(token.tokenIndex) ?? [];
    const hasRect = rects.length > 0;
    renderedTokenRectsCount += rects.length;

    console.log({
      tokenText: token.tokenText,
      tokenIndex: token.tokenIndex,
      sentenceIndex: token.sentenceIndex,
      chunkIndex: token.chunkIndex,
      hasRect,
    });
  });
  console.log({
    totalBodyTokens: ownership.size,
    assignedSentenceTokens: ownership.size,
    assignedChunkTokens: ownership.size,
    renderedTokenRects: renderedTokenRectsCount,
  });
  console.groupEnd();
};

const dedupeRects = (rects: TokenRect[]) => {
  const seen = new Set<string>();

  return rects.filter((rect) => {
    const key = `${rect.tokenIndex}:${rect.left}:${rect.top}:${rect.width}:${rect.height}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
};

const mergeLineRects = (rects: TokenRect[]) => {
  const sortedRects = [...rects].sort((left, right) => {
    if (Math.abs(left.top - right.top) > 3) {
      return left.top - right.top;
    }

    return left.left - right.left;
  });

  const merged: TokenRect[] = [];

  sortedRects.forEach((rect) => {
    const lastRect = merged[merged.length - 1];

    if (
      lastRect
      && Math.abs(lastRect.top - rect.top) <= 4
      && Math.abs(lastRect.height - rect.height) <= 6
      && rect.left <= lastRect.right + 18
    ) {
      lastRect.top = Math.min(lastRect.top, rect.top);
      lastRect.left = Math.min(lastRect.left, rect.left);
      lastRect.right = Math.max(lastRect.right, rect.right);
      lastRect.bottom = Math.max(lastRect.bottom, rect.bottom);
      lastRect.width = lastRect.right - lastRect.left;
      lastRect.height = lastRect.bottom - lastRect.top;
      return;
    }

    merged.push({ ...rect });
  });

  return merged;
};

const computeUnionRect = (rects: TokenRect[]): Rect => {
  const top = Math.min(...rects.map((rect) => rect.top));
  const left = Math.min(...rects.map((rect) => rect.left));
  const right = Math.max(...rects.map((rect) => rect.right));
  const bottom = Math.max(...rects.map((rect) => rect.bottom));

  return {
    top,
    left,
    width: right - left,
    height: bottom - top,
    right,
    bottom,
  };
};

const getMarkerAnchor = (root: HTMLElement, unionRect: Rect) => {
  const rootRect = root.getBoundingClientRect();

  return {
    left: rootRect.left + unionRect.right + 6,
    top: rootRect.top + unionRect.top - 10,
  };
};

const toRelativeRect = (rect: DOMRect, rootRect: DOMRect): Rect => {
  const top = rect.top - rootRect.top;
  const left = rect.left - rootRect.left;
  const width = rect.width;
  const height = rect.height;

  return {
    top,
    left,
    width,
    height,
    right: left + width,
    bottom: top + height,
  };
};
