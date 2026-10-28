import type { RichText } from '@labre/affine-rich-text';
import { signal } from '@preact/signals-core';
import { beforeAll, describe, expect, it, vi } from 'vitest';

import { RichTextCell } from '../properties/rich-text/cell-renderer.js';

const TAG = 'test-affine-database-rich-text-cell';

/**
 * Rendering the cell would pull a whole editor host in (inline manager, doc,
 * `<rich-text>`); these tests only drive its clipboard handlers, so the render
 * pass is switched off.
 */
class TestRichTextCell extends RichTextCell {
  protected override shouldUpdate(): boolean {
    return false;
  }
}

beforeAll(() => {
  if (!customElements.get(TAG)) {
    customElements.define(TAG, TestRichTextCell);
  }
});

type InlineRange = { index: number; length: number };

function createInlineEditorStub(inlineRange: InlineRange | null) {
  return {
    getInlineRange: vi.fn(() => inlineRange),
    insertText: vi.fn(),
    setInlineRange: vi.fn(),
    yTextString: 'hello',
    slots: {
      keydown: { subscribe: vi.fn(() => ({ unsubscribe: vi.fn() })) },
    },
  };
}

function createCell(inlineRange: InlineRange | null) {
  const inlineEditor = createInlineEditorStub(inlineRange);
  const richText = {
    inlineEditor,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  const cell = document.createElement(TAG) as TestRichTextCell;
  cell.cell = {
    view: { serviceGet: () => undefined },
    property: { readonly$: signal(false), type$: signal('rich-text') },
    value$: signal(undefined),
  } as never;
  // the `<rich-text>` is normally captured by a lit ref during render
  (cell as unknown as { richText$: { value: unknown } }).richText$.value =
    richText as unknown as RichText;
  return { cell, inlineEditor, richText };
}

function createPasteEvent(text: string) {
  return {
    clipboardData: { getData: vi.fn(() => text) },
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
  };
}

function paste(
  cell: TestRichTextCell,
  event: ReturnType<typeof createPasteEvent>
) {
  (cell as unknown as { _onPaste: (e: unknown) => void })._onPaste(event);
}

describe('database rich-text cell paste', () => {
  it('lets the default path act when there is no inline range', () => {
    // A selection spanning the whole rich text from its parent container makes
    // `getInlineRange()` return null: cancelling the event there would swallow
    // the clipboard with nothing inserted in its place.
    const { cell, inlineEditor } = createCell(null);
    const event = createPasteEvent('hello');

    paste(cell, event);

    expect(event.preventDefault).not.toHaveBeenCalled();
    expect(event.stopPropagation).not.toHaveBeenCalled();
    expect(inlineEditor.insertText).not.toHaveBeenCalled();
  });

  it('owns the paste and replaces the selection when a range is resolved', () => {
    const { cell, inlineEditor } = createCell({ index: 2, length: 3 });
    const event = createPasteEvent('hello');

    paste(cell, event);

    expect(event.preventDefault).toHaveBeenCalledTimes(1);
    expect(event.stopPropagation).toHaveBeenCalledTimes(1);
    expect(inlineEditor.insertText).toHaveBeenCalledWith(
      { index: 2, length: 3 },
      'hello',
      undefined
    );
  });

  it('removes its clipboard listeners with the capture flag they were added with', async () => {
    const { cell, richText } = createCell({ index: 0, length: 0 });

    document.body.append(cell);
    await cell.updateComplete;

    const added = richText.addEventListener.mock.calls.filter(
      ([type]) => type === 'paste'
    );
    expect(added).toHaveLength(1);
    const [, pasteHandler, addOptions] = added[0]!;
    expect(addOptions).toBe(true);

    cell.remove();

    expect(richText.removeEventListener).toHaveBeenCalledWith(
      'paste',
      pasteHandler,
      true
    );
    for (const type of ['copy', 'cut'] as const) {
      expect(richText.removeEventListener).toHaveBeenCalledWith(
        type,
        expect.any(Function),
        true
      );
    }
  });
});
