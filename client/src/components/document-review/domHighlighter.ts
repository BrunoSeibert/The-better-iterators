import { annotationTones } from './annotationModel';
import type { AnnotationType } from './types';

const reviewWordPattern = /[\p{L}\p{N}][\p{L}\p{N}'’-]*/gu;

export const applyHighlightsToContainer = (
  root: HTMLElement,
  wordAnnotations: Map<number, AnnotationType>,
  startingWordIndex = 0
) => {
  clearHighlights(root);

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

  let globalWordIndex = startingWordIndex;

  textNodes.forEach((textNode) => {
    const nodeText = textNode.nodeValue ?? '';
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let foundMatch = false;
    const fragment = document.createDocumentFragment();

    reviewWordPattern.lastIndex = 0;

    while ((match = reviewWordPattern.exec(nodeText)) !== null) {
      const wordStart = match.index;
      const wordEnd = wordStart + match[0].length;

      if (wordStart > lastIndex) {
        fragment.append(document.createTextNode(nodeText.slice(lastIndex, wordStart)));
      }

      const annotationType = wordAnnotations.get(globalWordIndex);
      if (annotationType) {
        fragment.append(createHighlightSpan(match[0], annotationType));
      } else {
        fragment.append(document.createTextNode(match[0]));
      }

      globalWordIndex += 1;
      lastIndex = wordEnd;
      foundMatch = true;
    }

    if (!foundMatch) {
      return;
    }

    if (lastIndex < nodeText.length) {
      fragment.append(document.createTextNode(nodeText.slice(lastIndex)));
    }

    textNode.replaceWith(fragment);
  });
};

const clearHighlights = (root: HTMLElement) => {
  root.querySelectorAll<HTMLElement>('[data-review-highlight="true"]').forEach((element) => {
    element.replaceWith(document.createTextNode(element.textContent ?? ''));
  });
};

const createHighlightSpan = (text: string, annotationType: AnnotationType) => {
  const highlightSpan = document.createElement('span');
  const tone = annotationTones[annotationType];

  highlightSpan.dataset.reviewHighlight = 'true';
  highlightSpan.style.background = tone.background;
  highlightSpan.style.borderRadius = '0.22rem';
  highlightSpan.style.padding = '0.02em 0.12em';
  highlightSpan.style.margin = '0 0.01em';
  highlightSpan.textContent = text;

  return highlightSpan;
};
