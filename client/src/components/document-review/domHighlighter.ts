import { annotationTones } from './annotationModel';
import { buildBodyTokenOwnership, buildChunkRectDebug } from './annotationMatcher';
import type { ParsedReviewSuccess, ReviewAnnotation } from './types';

const reviewWordPattern = /[\p{L}\p{N}][\p{L}\p{N}'Ã¢â‚¬â„¢-]*/gu;
const cleanupRegistry = new WeakMap<HTMLElement, () => void>();

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
  clearReviewAnnotations(root);

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
  wordAnnotations.forEach((annotation) => {
    annotationsById.set(annotation.id, annotation);
  });

  const rerender = () => {
    const renderedTokenRects = collectRenderedTokenRects(root, wordAnnotations, startingWordIndex);
    const geometries = buildAnnotationGeometries(root, annotationsById, renderedTokenRects);
    drawTokenRects(highlightLayer, geometries);
    drawMarkers(markerLayer, tooltipLayer, geometries);

    if (documentModel) {
      logBodyTokenValidation(documentModel, annotationsById, renderedTokenRects);
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
    markerLayer.remove();
    tooltipLayer.remove();
    highlightLayer.remove();
    cleanupRegistry.delete(root);
  };

  cleanupRegistry.set(root, cleanup);

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
  geometries: AnnotationGeometry[]
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
    button.innerHTML = `
      <svg aria-hidden="true" viewBox="0 0 24 24" class="document-review-marker-icon">
        <circle cx="12" cy="12" r="8.15" fill="none" stroke="currentColor" stroke-width="1.9" />
        <circle cx="12" cy="7.75" r="1.05" fill="currentColor" />
        <path fill="currentColor" d="M10.95 10.2h2.1v6.4h-2.1z" />
      </svg>
    `;

    const tooltip = document.createElement('div');
    tooltip.className = 'document-review-marker-tooltip';

    const body = document.createElement('p');
    body.className = 'document-review-marker-tooltip-body';
    body.textContent = geometry.annotation.comment;

    tooltip.style.left = `${geometry.markerAnchor.left}px`;
    tooltip.style.top = `${geometry.markerAnchor.top}px`;
    tooltip.append(body);

    let isButtonHovered = false;
    let isTooltipHovered = false;
    let hideTimeout: number | null = null;

    const syncOpenState = () => {
      const isOpen = isButtonHovered || isTooltipHovered;
      marker.dataset.open = isOpen ? 'true' : 'false';
      tooltip.dataset.open = isOpen ? 'true' : 'false';
    };

    const clearHideTimeout = () => {
      if (hideTimeout !== null) {
        window.clearTimeout(hideTimeout);
        hideTimeout = null;
      }
    };

    const scheduleClose = () => {
      clearHideTimeout();
      hideTimeout = window.setTimeout(() => {
        syncOpenState();
      }, 24);
    };

    button.addEventListener('mouseenter', () => {
      clearHideTimeout();
      isButtonHovered = true;
      syncOpenState();
    });
    button.addEventListener('mouseleave', () => {
      isButtonHovered = false;
      scheduleClose();
    });
    button.addEventListener('focus', () => {
      clearHideTimeout();
      isButtonHovered = true;
      syncOpenState();
    });
    button.addEventListener('blur', () => {
      isButtonHovered = false;
      scheduleClose();
    });

    tooltip.addEventListener('mouseenter', () => {
      clearHideTimeout();
      isTooltipHovered = true;
      syncOpenState();
    });
    tooltip.addEventListener('mouseleave', () => {
      isTooltipHovered = false;
      scheduleClose();
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
