import type { RootContentMap } from 'hast';

type HastUnionType<
  K extends keyof RootContentMap,
  V extends RootContentMap[K],
> = V;

/**
 * Escapes the characters that would break out of an HTML text node.
 * Used to embed plain text in the clipboard snapshot wrapper.
 */
export function escapeHTML(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function onlyContainImgElement(
  ast: HastUnionType<keyof RootContentMap, RootContentMap[keyof RootContentMap]>
): 'yes' | 'no' | 'maybe' {
  if (ast.type === 'element') {
    switch (ast.tagName) {
      case 'html':
      case 'body':
        return ast.children.map(onlyContainImgElement).reduce((a, b) => {
          if (a === 'no' || b === 'no') {
            return 'no';
          }
          if (a === 'maybe' && b === 'maybe') {
            return 'maybe';
          }
          return 'yes';
        }, 'maybe');
      case 'img':
        return 'yes';
      case 'head':
        return 'maybe';
      default:
        return 'no';
    }
  }
  return 'maybe';
}
