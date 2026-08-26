/**
 * Inserting an inline equation — upstream #14924.
 *
 * The command used to accept a collapsed caret only: with text selected it
 * bailed out, so "select a formula, make it an equation" was impossible. It
 * also always inserted an empty equation and always popped the editor open.
 *
 * It now takes the selected text as the equation source, refuses a selection
 * spanning several blocks (an inline range only means something inside one),
 * and opens the editor only when there was nothing to seed the equation with.
 */
import type { TextSelection } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { insertInlineLatex } from '../command.js';

function createTextSelection({
  index,
  length,
  crossBlock = false,
}: {
  index: number;
  length: number;
  crossBlock?: boolean;
}) {
  return {
    from: { blockId: 'block-0', index, length },
    to: crossBlock ? { blockId: 'block-1', index: 0, length: 3 } : null,
    isCollapsed: () => !crossBlock && length === 0,
  } as unknown as TextSelection;
}

function createContext(text: string, textSelection: TextSelection) {
  const inlineEditor = {
    yTextString: text,
    insertText: vi.fn(),
    setInlineRange: vi.fn(),
    waitForUpdate: vi.fn(() => Promise.resolve()),
    getTextPoint: vi.fn(() => null),
  };

  const blockComponent = {
    querySelector: (selector: string) =>
      selector === 'rich-text' ? { inlineEditor } : null,
    closest: () => null,
  };

  const std = {
    view: { getBlock: () => blockComponent },
    get: () => ({ getEditorMode: () => 'page' }),
    getOptional: () => null,
  };

  return { ctx: { std, textSelection } as never, inlineEditor };
}

describe('insertInlineLatex', () => {
  it('seeds an empty equation and opens the editor on a collapsed caret', () => {
    const { ctx, inlineEditor } = createContext(
      'sum of a and b',
      createTextSelection({ index: 7, length: 0 })
    );
    const next = vi.fn();

    insertInlineLatex(ctx, next);

    expect(inlineEditor.insertText).toHaveBeenCalledWith(
      { index: 7, length: 0 },
      ' ',
      { latex: '' }
    );
    expect(inlineEditor.setInlineRange).toHaveBeenCalledWith({
      index: 7,
      length: 1,
    });
    expect(inlineEditor.waitForUpdate).toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('turns the selected text into the equation without opening the editor', () => {
    const { ctx, inlineEditor } = createContext(
      'a + \\frac{1}{2} = b',
      createTextSelection({ index: 4, length: 11 })
    );
    const next = vi.fn();

    insertInlineLatex(ctx, next);

    expect(inlineEditor.insertText).toHaveBeenCalledWith(
      { index: 4, length: 11 },
      ' ',
      { latex: '\\frac{1}{2}' }
    );
    expect(inlineEditor.setInlineRange).toHaveBeenCalledWith({
      index: 4,
      length: 1,
    });
    expect(inlineEditor.waitForUpdate).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('refuses a selection spanning several blocks', () => {
    const { ctx, inlineEditor } = createContext(
      'a + b',
      createTextSelection({ index: 0, length: 5, crossBlock: true })
    );
    const next = vi.fn();

    insertInlineLatex(ctx, next);

    expect(inlineEditor.insertText).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });
});
