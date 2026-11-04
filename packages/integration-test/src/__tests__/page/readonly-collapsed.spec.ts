import { TextSelection } from '@labre/std';
import { Text } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/**
 * A READER must be able to open a heading (or a toggle list) the document
 * persists as collapsed, and then select and copy what it reveals — without the
 * document ever being written.
 *
 * The defect (#262): `_readonlyCollapsed` was realigned on the persisted value
 * UNCONDITIONALLY, inside the very effect that also reads the text selection in
 * order to purge it. The selection signal was therefore a dependency of that
 * realignment, so the reader's first drag-select re-ran the effect, slammed the
 * heading shut again and cleared the selection it was reacting to.
 *
 * Every test flips the store to readonly BEFORE touching the toggle, and every
 * one of them ends by checking that `model.props.collapsed` — the stored truth —
 * never moved.
 */

function blockElement(blockId: string) {
  const el = document.querySelector(`[data-block-id="${blockId}"]`);
  if (!el) throw new Error(`no element for block ${blockId}`);
  return el as HTMLElement;
}

/**
 * A heading hides its collapsed SIBLINGS through a marker attribute and a static
 * `display: none !important` rule; a list hides its CHILDREN by collapsing the
 * container around them. `checkVisibility` covers both, where a computed
 * `display` on the block itself only covers the first.
 */
function isVisible(blockId: string) {
  return blockElement(blockId).checkVisibility();
}

function toggleOf(blockId: string) {
  const button = blockElement(blockId).querySelector(
    'blocksuite-toggle-button'
  ) as (HTMLElement & { updateCollapsed: (value: boolean) => void }) | null;
  if (!button) throw new Error(`no toggle button on block ${blockId}`);
  return button;
}

/**
 * The private, reader-local collapse state — the field the bug corrupted. Read
 * defensively so that running this spec against the PRE-fix code (where it was
 * a plain Lit `@state()` boolean rather than a signal) fails on the behaviour
 * under test and not on the shape of the field.
 */
function localCollapsed(blockId: string) {
  const held = (blockElement(blockId) as unknown as Record<string, unknown>)
    ._readonlyCollapsed;
  if (held && typeof held === 'object' && 'value' in held) {
    return (held as { value: boolean }).value;
  }
  return held as boolean;
}

/** The STORED truth — the thing a readonly reader must never move. */
function persistedCollapsed(blockId: string) {
  const model = window.doc.getBlock(blockId)!.model as unknown as {
    props: { collapsed: boolean };
  };
  return model.props.collapsed;
}

function selectText(blockId: string, index = 0, length = 6) {
  const selection = window.editor.host!.selection;
  selection.set([
    selection.create(TextSelection, {
      from: { blockId, index, length },
      to: null,
    }),
  ]);
}

function currentTextSelection() {
  return window.editor.host!.selection.find(TextSelection);
}

describe('a readonly reader keeps what they expanded', () => {
  let noteId!: string;

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    const doc = window.doc;
    noteId = doc.addBlock('affine:note', {}, doc.root!.id);
    return cleanup;
  });

  afterEach(() => {
    window.doc.readonly = false;
  });

  describe('affine:paragraph heading', () => {
    let headingId!: string;
    let contentId!: string;

    beforeEach(async () => {
      const doc = window.doc;
      // Collapsing a heading hides its following SIBLINGS, not its children.
      headingId = doc.addBlock(
        'affine:paragraph',
        { type: 'h2', text: new Text('Heading'), collapsed: true },
        noteId
      );
      contentId = doc.addBlock(
        'affine:paragraph',
        { type: 'text', text: new Text('Shared content') },
        noteId
      );
      await wait();
    });

    test('stays expanded while the reader selects the content it revealed', async () => {
      window.doc.readonly = true;
      await wait();

      // The persisted state is what a reader lands on.
      expect(localCollapsed(headingId)).toBe(true);
      expect(isVisible(contentId)).toBe(false);

      // The reader opens it: their own expansion, no write.
      toggleOf(headingId).updateCollapsed(false);
      await wait();
      expect(localCollapsed(headingId)).toBe(false);
      expect(isVisible(contentId)).toBe(true);

      // …and then selects the revealed text. THIS is the gesture that used to
      // re-run the realignment effect and slam the heading shut.
      selectText(contentId);
      await wait();

      expect(localCollapsed(headingId)).toBe(false);
      expect(isVisible(contentId)).toBe(true);
      // The selection survives, so the reader can copy.
      expect(currentTextSelection()?.blockId).toBe(contentId);
      expect(persistedCollapsed(headingId)).toBe(true);
    });

    test('collapsing again still purges the selection it hides', async () => {
      window.doc.readonly = true;
      await wait();
      toggleOf(headingId).updateCollapsed(false);
      await wait();
      selectText(contentId);
      await wait();
      expect(currentTextSelection()).toBeTruthy();

      toggleOf(headingId).updateCollapsed(true);
      await wait();

      expect(localCollapsed(headingId)).toBe(true);
      expect(isVisible(contentId)).toBe(false);
      // The purge is the half of the old effect that must NOT be lost.
      expect(currentTextSelection()).toBeFalsy();
      expect(persistedCollapsed(headingId)).toBe(true);
    });

    test('re-entering readonly mode resyncs the local state on the persisted one', async () => {
      const doc = window.doc;
      doc.readonly = true;
      await wait();
      toggleOf(headingId).updateCollapsed(false);
      await wait();
      expect(localCollapsed(headingId)).toBe(false);

      doc.readonly = false;
      await wait();
      // Writable again: the persisted value drives the render.
      expect(isVisible(contentId)).toBe(false);

      doc.readonly = true;
      await wait();

      expect(localCollapsed(headingId)).toBe(true);
      expect(isVisible(contentId)).toBe(false);
      expect(persistedCollapsed(headingId)).toBe(true);
    });

    test('nothing the reader did reached the document', async () => {
      const doc = window.doc;
      doc.readonly = true;
      await wait();

      toggleOf(headingId).updateCollapsed(false);
      await wait();
      selectText(contentId);
      await wait();
      toggleOf(headingId).updateCollapsed(true);
      await wait();
      toggleOf(headingId).updateCollapsed(false);
      await wait();

      expect(persistedCollapsed(headingId)).toBe(true);
    });
  });

  describe('affine:list toggle', () => {
    let listId!: string;
    let childId!: string;

    beforeEach(async () => {
      const doc = window.doc;
      // A list hides its CHILDREN, and only shows a toggle when it has some.
      listId = doc.addBlock(
        'affine:list',
        { type: 'toggle', text: new Text('Toggle'), collapsed: true },
        noteId
      );
      childId = doc.addBlock(
        'affine:list',
        { type: 'bulleted', text: new Text('Shared content') },
        listId
      );
      await wait();
    });

    test('stays expanded while the reader selects the content it revealed', async () => {
      window.doc.readonly = true;
      await wait();
      expect(localCollapsed(listId)).toBe(true);

      toggleOf(listId).updateCollapsed(false);
      await wait();
      expect(localCollapsed(listId)).toBe(false);
      expect(isVisible(childId)).toBe(true);

      selectText(childId);
      await wait();

      expect(localCollapsed(listId)).toBe(false);
      expect(isVisible(childId)).toBe(true);
      expect(currentTextSelection()?.blockId).toBe(childId);
      expect(persistedCollapsed(listId)).toBe(true);
    });

    test('re-entering readonly mode resyncs the local state on the persisted one', async () => {
      const doc = window.doc;
      doc.readonly = true;
      await wait();
      toggleOf(listId).updateCollapsed(false);
      await wait();
      expect(localCollapsed(listId)).toBe(false);

      doc.readonly = false;
      await wait();
      doc.readonly = true;
      await wait();

      expect(localCollapsed(listId)).toBe(true);
      expect(isVisible(childId)).toBe(false);
      expect(persistedCollapsed(listId)).toBe(true);
    });
  });
});
