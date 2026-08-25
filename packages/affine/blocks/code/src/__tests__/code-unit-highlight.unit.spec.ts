/**
 * Rendering a code line the highlighter has not caught up with — upstream fix.
 *
 * `highlightTokens$` is filled asynchronously by shiki. While the user types a
 * new line, the inline editor already renders it but the token table still
 * describes the previous, shorter text: the line index points past the end of
 * the array. Reading `tokens[lineIndex].length` on that hole threw and took
 * the whole render down. An unknown line now falls back to plain text.
 */
import { signal } from '@preact/signals-core';
import { render } from 'lit';
import type { ThemedToken } from 'shiki';
import { describe, expect, it } from 'vitest';

import { AffineCodeUnit } from '../highlight/affine-code-unit.js';

function aToken(content: string, offset: number, color: string): ThemedToken {
  return { content, offset, color } as ThemedToken;
}

/**
 * The slice of the component `render()` reads: the code block and the virgo
 * element it normally reaches through `closest()`, plus its own delta.
 */
function aCodeUnit(options: {
  insert: string;
  tokens: ThemedToken[][];
  lineIndex: number;
  startOffset: number;
  endOffset: number;
}) {
  return {
    codeBlock: { highlightTokens$: signal(options.tokens), std: {} },
    vElement: {
      lineIndex: options.lineIndex,
      startOffset: options.startOffset,
      endOffset: options.endOffset,
    },
    delta: { insert: options.insert },
  };
}

function renderUnit(unit: ReturnType<typeof aCodeUnit>) {
  const container = document.createElement('div');
  render(AffineCodeUnit.prototype.render.call(unit as never), container);
  return container;
}

describe('affine-code-unit highlighting', () => {
  it('falls back to plain text when the token table is shorter than the lines', () => {
    const unit = aCodeUnit({
      insert: 'const b = 2;',
      // One line of tokens, but the second line is already on screen.
      tokens: [[aToken('const a = 1;', 0, '#111111')]],
      lineIndex: 1,
      startOffset: 0,
      endOffset: 12,
    });

    const container = renderUnit(unit);

    const text = container.querySelector('v-text') as { str?: string } | null;
    expect(text?.str).toBe('const b = 2;');
    expect(container.querySelector('span')?.getAttribute('style')).toBeFalsy();
  });

  it('still colours a line the token table knows about', () => {
    const unit = aCodeUnit({
      insert: 'const a = 1;',
      tokens: [[aToken('const a = 1;', 0, '#ff0000')]],
      lineIndex: 0,
      startOffset: 0,
      endOffset: 12,
    });

    const container = renderUnit(unit);

    expect(container.querySelector('span')?.getAttribute('style')).toContain(
      '#ff0000'
    );
  });
});
