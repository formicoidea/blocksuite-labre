/**
 * Whether `text` is a placeholder rather than text of the model: the
 * zero-width character an empty line or an embed gap renders (`v-text`'s
 * `empty`, rendered as `data-v-empty`). Decided by the attribute, never by
 * the content: a zero-width space the user stored, alone in its run (or in
 * its own span when special characters are shown), is one character long.
 */
export function isPlaceholderText(text: Text): boolean {
  return text.parentElement?.dataset.vEmpty === 'true';
}

export function calculateTextLength(text: Text): number {
  if (isPlaceholderText(text)) {
    return 0;
  } else {
    return text.wholeText.length;
  }
}

export function getTextNodesFromElement(element: Element): Text[] {
  const textSpanElements = Array.from(
    element.querySelectorAll('[data-v-text="true"]')
  );
  const textNodes = textSpanElements.flatMap(textSpanElement => {
    const textNode = Array.from(textSpanElement.childNodes).find(
      (node): node is Text => node instanceof Text
    );
    if (!textNode) return [];

    return textNode;
  });

  return textNodes;
}
