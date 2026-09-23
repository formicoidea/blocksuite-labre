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

/**
 * The deepest focused element, walking into shadow roots the way the event
 * dispatcher does.
 */
const deepActiveElement = () => {
  let active = document.activeElement;
  while (active?.shadowRoot?.activeElement) {
    active = active.shadowRoot.activeElement;
  }
  return active;
};

/**
 * Put the browser focus on the chevron and WAIT for it to land there.
 *
 * `element.focus()` is synchronous in the DOM, but the keystroke below is not
 * a DOM event: it is dispatched through the driver, to whatever the BROWSER
 * considers focused, and that view of the focus settles a tick or two behind.
 * A fixed `await wait()` was enough only as long as nothing else was competing
 * for the scheduler — so the outcome of these tests depended on how much work
 * the previously-run spec FILE had left the page doing, which is exactly the
 * kind of accidental ordering a suite must not encode (`isolate: false` puts
 * every spec of this package in ONE browser page).
 *
 * Polling the premise instead of counting ticks makes each test state what it
 * needs: the keystroke is aimed at the chevron, so the chevron must hold the
 * focus before it is sent.
 */
const focusAndSettle = async (element: HTMLElement) => {
  element.focus();
  for (let attempt = 0; attempt < 50; attempt++) {
    if (deepActiveElement() === element) return;
    await wait();
  }
  throw new Error(
    `${element.tagName} never took the focus ` +
      `(it is on ${deepActiveElement()?.tagName})`
  );
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
  // the controls the editor renders.
  test('Tab still indents the blocks of a block selection', async () => {
    const { std } = window.editor;
    const doc = window.doc;
    await focusAndSettle(host());
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
    await focusAndSettle(toggleOf(headingId));

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
    await focusAndSettle(toggleOf(headingId));

    await userEvent.keyboard('{Shift>}{Tab}{/Shift}');
    await wait();

    expect(doc.getParent(childId)?.id).toBe(siblingId);
  });

  test('Enter pressed on the toggle does not insert a paragraph', async () => {
    const doc = window.doc;
    const before = doc.getParent(siblingId)!.children.length;

    caretIn(siblingId);
    await focusAndSettle(toggleOf(headingId));

    await userEvent.keyboard('{Enter}');
    await wait();

    expect(doc.getParent(siblingId)?.children.length).toBe(before);
    // The keystroke did reach the button it was aimed at.
    expect(toggleOf(headingId).getAttribute('aria-expanded')).toBe('false');
  });
});
