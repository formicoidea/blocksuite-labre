import { BlockSelection, TextSelection } from '@labre/std';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * A host may restore the focus onto the collapse chevron without the text
 * selection being purged first (a mouse click does purge it, which is why no
 * real gesture reaches this state). The keystroke then belongs to the button,
 * not to the caret: the flavour keymaps must leave Tab and Enter alone, the
 * way the root fallback already does.
 */

const host = () => {
  const element = window.editor.host;
  if (!element) throw new Error('the editor host is missing');
  return element;
};

const blockOf = (blockId: string) => {
  const block = host().querySelector(`[data-block-id="${blockId}"]`);
  if (!block) throw new Error(`no block rendered for ${blockId}`);
  return block;
};

const toggleOf = (blockId: string) => {
  const button = blockOf(blockId).querySelector<HTMLButtonElement>(
    'blocksuite-toggle-button button.toggle-icon'
  );
  if (!button) throw new Error(`no toggle button rendered for ${blockId}`);
  return button;
};

const caretIn = (blockId: string) => {
  const { std } = window.editor;
  std.selection.setGroup('note', [
    std.selection.create(TextSelection, {
      from: { blockId, index: 0, length: 0 },
      to: null,
    }),
  ]);
};

describe('the flavour keymaps leave the collapse toggle alone', () => {
  let noteId!: string;
  let headingId!: string;
  let siblingId!: string;

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    const doc = window.doc;
    noteId = addNote(doc);

    headingId = doc.addBlock(
      'affine:paragraph',
      { type: 'h1', text: new Text('A heading') },
      noteId
    );
    doc.addBlock(
      'affine:paragraph',
      { text: new Text('A child of the heading') },
      headingId
    );
    // The heading toggle only renders when it has collapsible siblings, and
    // this sibling is also the block Tab would indent under the heading.
    siblingId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('A sibling') },
      noteId
    );

    await wait(100);

    return cleanup;
  });

  // The editor host carries `tabindex="0"` so that it can receive the
  // keystrokes of a block selection: the guard must not mistake it for one of
  // the controls the editor renders. This one comes first on purpose — the
  // tests below leave the browser focus on a chevron, and the host then never
  // takes it back in this harness.
  test('Tab still indents the blocks of a block selection', async () => {
    const { std } = window.editor;
    const doc = window.doc;
    host().focus();
    std.selection.setGroup('note', [
      std.selection.create(BlockSelection, { blockId: siblingId }),
    ]);
    await wait();

    await userEvent.keyboard('{Tab}');
    await wait();

    expect(doc.getParent(siblingId)?.id).toBe(headingId);
  });

  test('Tab pressed on the toggle does not indent the block holding the caret', async () => {
    const doc = window.doc;
    caretIn(siblingId);
    toggleOf(headingId).focus();
    await wait();

    await userEvent.keyboard('{Tab}');
    await wait();

    expect(doc.getParent(siblingId)?.id).toBe(noteId);
  });

  test('Shift-Tab pressed on the toggle does not dedent the block holding the caret', async () => {
    const doc = window.doc;
    const childId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('A nested sibling') },
      siblingId
    );
    await wait(100);

    caretIn(childId);
    toggleOf(headingId).focus();
    await wait();

    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await wait();

    expect(doc.getParent(childId)?.id).toBe(siblingId);
  });

  test('Enter pressed on the toggle does not insert a paragraph', async () => {
    const doc = window.doc;
    const before = doc.getParent(siblingId)!.children.length;

    caretIn(siblingId);
    toggleOf(headingId).focus();
    await wait();

    await userEvent.keyboard('{Enter}');
    await wait();

    expect(doc.getParent(siblingId)?.children.length).toBe(before);
    // The keystroke did reach the button it was aimed at.
    expect(toggleOf(headingId).getAttribute('aria-expanded')).toBe('false');
  });
});
