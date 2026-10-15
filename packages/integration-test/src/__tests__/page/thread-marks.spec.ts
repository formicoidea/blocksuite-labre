import type {
  EdgelessRootBlockComponent,
  PageRootBlockComponent,
} from '@labre/affine/blocks/root';
import {
  type ThreadMark,
  ThreadMarksExtension,
  type ThreadOpenRequest,
} from '@labre/affine/shared/services';
import { BlockSelection, TextSelection } from '@labre/affine/std';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import type { RichText } from '@labre/affine-rich-text';
import { Bound } from '@labre/global/gfx';
import { Text } from '@labre/store';
import { signal } from '@preact/signals-core';
import { userEvent } from '@vitest/browser/context';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock, getSurface } from '../utils/edgeless.js';
import { pointerDown, pointerMoveTo, pointerUp } from '../utils/pointer.js';
import { setupEditor } from '../utils/setup.js';

/**
 * The "has a thread" seam in a real editor (ADR 0038). The unit specs hold
 * the rules over stubs (absent seam, absent ids, the excerpt); this one proves
 * the widget is mounted in both views, draws where a reader looks, and that
 * the mark and "Discuss" reach the host.
 *
 * What it would have caught:
 * - no mark beside a marked paragraph, or a mark for an id the document does
 *   not hold;
 * - a mark drawn with no seam registered;
 * - no mark on a canvas element, or one far from its corner;
 * - "Discuss" missing from a selected block's or element's toolbar, or
 *   handing the host the wrong target or no excerpt.
 * - "Discuss" on a text selection handing no range, or a quote that is not
 *   the selected text; a returned range not highlighted over its words, a
 *   click on it not reaching the host, or a deleted run still drawn or
 *   taking the block's mark with it (ADR 0038, amendment of 2026-10-15).
 */

const WIDGET = 'affine-thread-marks-widget';

const settle = async () => {
  await wait(150);
  for (let i = 0; i < 3; i++) {
    await new Promise(resolve => requestAnimationFrame(resolve));
  }
};

let cleanup: (() => void) | undefined;
afterEach(() => {
  cleanup?.();
  cleanup = undefined;
});

function host(marks: ThreadMark[]) {
  const marks$ = signal<readonly ThreadMark[]>(marks);
  const openThread = vi.fn<(request: ThreadOpenRequest) => void>();
  return {
    marks$,
    openThread,
    extension: ThreadMarksExtension({ marks$, openThread }),
  };
}

const drawnOf = (
  root: { widgetComponents: Record<string, unknown> },
  testId: string
) =>
  Array.from(
    (
      root.widgetComponents[WIDGET] as HTMLElement | undefined
    )?.shadowRoot?.querySelectorAll<HTMLElement>(`[data-testid="${testId}"]`) ??
      []
  );

const marksOf = (root: { widgetComponents: Record<string, unknown> }) =>
  drawnOf(root, 'thread-mark');

const toolbarEntry = (
  root: { widgetComponents: Record<string, unknown> },
  id: string
) =>
  (
    root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
      | { toolbar?: HTMLElement }
      | undefined
  )?.toolbar?.querySelector<HTMLElement>(`[data-toolbar-action-id="${id}"]`) ??
  null;

const mark = (
  targetId: string,
  targetType: ThreadMark['targetType'] = 'block'
): ThreadMark => ({ targetType, targetId, count: 2, unread: true });

function writeParagraph(text: string) {
  const noteId = addNote(window.doc);
  return window.doc.addBlock(
    'affine:paragraph',
    { text: new Text(text) },
    noteId
  );
}

describe('thread marks in the page view', () => {
  test('a marked paragraph carries a mark beside it; an absent id none', async () => {
    const seam = host([]);
    cleanup = await setupEditor('page', [seam.extension]);
    const paragraphId = writeParagraph('Pick a vendor before Q3');
    seam.marks$.value = [mark(paragraphId), mark('not-in-this-doc')];
    await settle();

    const root = getDocRootBlock(
      window.doc,
      window.editor,
      'page'
    ) as PageRootBlockComponent;
    const drawn = marksOf(root);
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.dataset.targetId).toBe(paragraphId);

    const block = window.editor.std.view.getBlock(paragraphId)!;
    const blockRect = block.getBoundingClientRect();
    const markRect = drawn[0]!.getBoundingClientRect();
    expect(markRect.left).toBeGreaterThanOrEqual(blockRect.right);
    expect(Math.abs(markRect.top - blockRect.top)).toBeLessThan(4);

    drawn[0]!.click();
    expect(seam.openThread).toHaveBeenCalledWith({
      docId: window.doc.id,
      targetType: 'block',
      targetId: paragraphId,
      excerpt: 'Pick a vendor before Q3',
    });
  });

  test('without the seam, no mark is drawn and no Discuss is offered', async () => {
    cleanup = await setupEditor('page');
    const paragraphId = writeParagraph('Alone');
    const std = window.editor.std;
    window.editor.host!.focus();
    std.selection.setGroup('note', [
      std.selection.create(BlockSelection, { blockId: paragraphId }),
    ]);
    await settle();

    const root = getDocRootBlock(
      window.doc,
      window.editor,
      'page'
    ) as PageRootBlockComponent;
    expect(marksOf(root)).toHaveLength(0);
    expect(toolbarEntry(root, 'g.thread-discuss')).toBeNull();
  });

  test('Discuss on a selected block opens its thread', async () => {
    const seam = host([]);
    cleanup = await setupEditor('page', [seam.extension]);
    const paragraphId = writeParagraph('Budget');
    const std = window.editor.std;
    window.editor.host!.focus();
    std.selection.setGroup('note', [
      std.selection.create(BlockSelection, { blockId: paragraphId }),
    ]);
    await settle();

    const root = getDocRootBlock(
      window.doc,
      window.editor,
      'page'
    ) as PageRootBlockComponent;
    const entry = toolbarEntry(root, 'g.thread-discuss');
    expect(entry).not.toBeNull();
    entry!.click();
    expect(seam.openThread).toHaveBeenCalledWith(
      expect.objectContaining({
        targetType: 'block',
        targetId: paragraphId,
        excerpt: 'Budget',
      })
    );
  });
});

describe('a discussion on a text selection', () => {
  test('select, Discuss, the run is highlighted, a click opens it', async () => {
    const seam = host([]);
    cleanup = await setupEditor('page', [seam.extension]);
    const paragraphId = writeParagraph('Pick a vendor before Q3');
    await wait(100);
    const richText = window.editor.host!.querySelector<RichText>(
      `[data-block-id="${paragraphId}"] rich-text`
    )!;
    await userEvent.click(richText);

    const std = window.editor.std;
    std.selection.setGroup('note', [
      std.selection.create(TextSelection, {
        from: { blockId: paragraphId, index: 5, length: 8 },
        to: null,
      }),
    ]);
    await settle();

    const root = getDocRootBlock(
      window.doc,
      window.editor,
      'page'
    ) as PageRootBlockComponent;
    const entry = toolbarEntry(root, 'g.thread-discuss');
    expect(entry).not.toBeNull();
    entry!.click();
    expect(seam.openThread).toHaveBeenCalledTimes(1);
    const request = seam.openThread.mock.calls[0]![0];
    expect(request).toMatchObject({
      docId: window.doc.id,
      targetType: 'block',
      targetId: paragraphId,
      excerpt: 'a vendor',
    });
    const range = request.range!;
    expect(typeof range.start).toBe('string');
    expect(typeof range.end).toBe('string');

    // The host hands the range back on its mark: the run is highlighted over
    // "a vendor", and the block keeps its mark.
    seam.marks$.value = [{ ...mark(paragraphId), range }];
    std.selection.clear();
    await settle();
    const runs = drawnOf(root, 'thread-range');
    expect(runs.length).toBeGreaterThan(0);
    expect(marksOf(root)).toHaveLength(1);
    const words = std.range.textSelectionToRange(
      std.selection.create(TextSelection, {
        from: { blockId: paragraphId, index: 5, length: 8 },
        to: null,
      })
    )!;
    const expected = words.getBoundingClientRect();
    const drawn = runs[0]!.getBoundingClientRect();
    expect(Math.abs(drawn.left - expected.left)).toBeLessThan(2);
    expect(Math.abs(drawn.top - expected.top)).toBeLessThan(2);
    expect(Math.abs(drawn.width - expected.width)).toBeLessThan(2);

    // A real click on the words opens the discussion again, with the range.
    await pointerMoveTo(`${WIDGET} [data-testid="thread-range"]`, 0.5, 0.5);
    await pointerDown();
    await pointerUp();
    await settle();
    expect(seam.openThread).toHaveBeenCalledTimes(2);
    expect(seam.openThread.mock.calls[1]![0]).toEqual({
      docId: window.doc.id,
      targetType: 'block',
      targetId: paragraphId,
      excerpt: 'a vendor',
      range,
    });

    // The words deleted, the run cannot resolve: no highlight, the block's
    // mark stays.
    window.doc.getModelById(paragraphId)!.text!.delete(5, 8);
    await settle();
    expect(drawnOf(root, 'thread-range')).toHaveLength(0);
    expect(marksOf(root)).toHaveLength(1);
  });
});

describe('thread marks on the canvas', () => {
  test('a marked shape carries a mark on its corner, and Discuss', async () => {
    const seam = host([]);
    cleanup = await setupEditor('edgeless', [seam.extension]);
    const edgeless = getDocRootBlock(
      window.doc,
      window.editor,
      'edgeless'
    ) as EdgelessRootBlockComponent;
    const surface = getSurface(window.doc, window.editor).model;
    const shapeId = surface.addElement({
      type: 'shape',
      xywh: new Bound(0, 0, 200, 100).serialize(),
      text: new Y.Text('Vendor A'),
    });
    seam.marks$.value = [mark(shapeId, 'element')];
    edgeless.gfx.viewport.setCenter(100, 50);
    await settle();

    const drawn = marksOf(edgeless);
    expect(drawn).toHaveLength(1);
    const rect = drawn[0]!.getBoundingClientRect();
    const viewport = edgeless.gfx.viewport;
    const [x, y] = viewport.toViewCoord(200, 0);
    expect(
      Math.abs(rect.left + rect.width / 2 - (x + viewport.left))
    ).toBeLessThan(2);
    expect(
      Math.abs(rect.top + rect.height / 2 - (y + viewport.top))
    ).toBeLessThan(2);

    edgeless.gfx.selection.set({ elements: [shapeId], editing: false });
    await settle();
    const entry = toolbarEntry(edgeless, 'g.thread-discuss');
    expect(entry).not.toBeNull();
    entry!.click();
    expect(seam.openThread).toHaveBeenCalledWith({
      docId: window.doc.id,
      targetType: 'element',
      targetId: shapeId,
      excerpt: 'Vendor A',
    });
  });
});
