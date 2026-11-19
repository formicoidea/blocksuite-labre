import type {
  EdgelessRootBlockComponent,
  PageRootBlockComponent,
} from '@labre/affine/blocks/root';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import type { RichText } from '@labre/affine-rich-text';
import { TextSelection } from '@labre/std';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { describe, expect, test, vi } from 'vitest';

import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * #679 (design audit P2-20): the element toolbar measured 37px — a 36px
 * content box plus its 0.5px border on each side, which this suite's Chromium
 * rounds to 38px — a height on none of the shell's control steps (28, 32, 40).
 * It is 40px OUTSIDE, border included, still one row (DESIGN.md "Editor
 * Toolbar").
 *
 * Measured by the browser, the only place a border is laid out: happy-dom
 * computes no box. Both toolbars the component draws are measured where they
 * open: the canvas's over a selected shape, and the page view's formatting
 * toolbar over a text selection. Each test mounts its own editor and waits
 * for its toolbar to open, so it holds alone as well as after another spec
 * (review of #679: a bare `editor-toolbar` measured before any editor had
 * defined the element read 18px when the spec ran alone).
 */

const EXPECTED_HEIGHT = 40;

type ToolbarHost = { toolbar?: HTMLElement } | undefined;

/** The toolbar a root block's toolbar widget draws, once it is open. */
async function openToolbar(
  root: EdgelessRootBlockComponent | PageRootBlockComponent
) {
  const toolbar = () =>
    (root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as ToolbarHost)?.toolbar ??
    null;
  await vi.waitFor(() =>
    expect(toolbar()?.hasAttribute('data-open')).toBe(true)
  );
  return toolbar()!;
}

describe('the element toolbar is one 40px row, border included', () => {
  test('on the canvas, over a selected shape', async () => {
    const cleanup = await setupEditor('edgeless');
    try {
      const edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
      const id = edgeless.service.crud.addElement('shape', {
        shapeType: 'rect',
        xywh: '[0,0,100,100]',
      })!;
      edgeless.service.selection.set({ elements: [id], editing: false });
      const bar = await openToolbar(edgeless);
      expect(bar.getBoundingClientRect().height).toBe(EXPECTED_HEIGHT);
    } finally {
      cleanup();
    }
  });

  test('in the page view, the formatting toolbar over a text selection', async () => {
    const cleanup = await setupEditor('page');
    try {
      const root = getDocRootBlock(window.doc, window.editor, 'page');
      const noteId = addNote(window.doc);
      const paragraphId = window.doc.addBlock(
        'affine:paragraph',
        { text: new Text('A sentence to format.') },
        noteId
      );
      const richText = await vi.waitFor(() => {
        const found = window.editor.host!.querySelector<RichText>(
          `[data-block-id="${paragraphId}"] rich-text`
        );
        if (!found) throw new Error('the paragraph is not drawn yet');
        return found;
      });
      await userEvent.click(richText);
      const std = window.editor.std;
      std.selection.setGroup('note', [
        std.selection.create(TextSelection, {
          from: { blockId: paragraphId, index: 2, length: 8 },
          to: null,
        }),
      ]);
      const bar = await openToolbar(root);
      expect(bar.getBoundingClientRect().height).toBe(EXPECTED_HEIGHT);
    } finally {
      cleanup();
    }
  });
});
