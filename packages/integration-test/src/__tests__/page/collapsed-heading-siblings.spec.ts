/**
 * What a collapsed heading folds, on a real editor, in both views.
 *
 * What it would have caught: the fold written as a stylesheet built from the
 * siblings' block ids. An id is whatever the document says (`sys:id` is not
 * limited to what the id generator mints), so a block's id must never become
 * markup or a selector: the sheet was one parser away from the reader's origin,
 * and an ordinary quote in an id already dropped the rule and showed the block.
 */
import { Text } from '@labre/store';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

function viewOf(id: string) {
  const view = document.querySelector<HTMLElement>(
    `[data-block-id="${CSS.escape(id)}"]`
  );
  if (!view) throw new Error(`no view for block ${id}`);
  return view;
}

const isVisible = (id: string) => viewOf(id).checkVisibility();

describe.each(['page', 'edgeless'] as const)('in the %s view', mode => {
  let noteId!: string;

  function add(
    type: string,
    options: { id?: string; collapsed?: boolean } = {}
  ) {
    return window.doc.addBlock(
      'affine:paragraph',
      { type, text: new Text(type), ...options },
      noteId
    );
  }

  function setCollapsed(id: string, collapsed: boolean) {
    window.doc.updateBlock(window.doc.getModelById(id)!, { collapsed });
  }

  beforeEach(async () => {
    const cleanup = await setupEditor(mode);
    noteId = addNote(window.doc);
    // `addNote` seeds a paragraph; the fold is read among known siblings.
    const seeded = window.doc.getModelById(noteId)!.children;
    seeded.forEach(child => window.doc.deleteBlock(child));
    return cleanup;
  });

  afterEach(() => {
    window.doc.readonly = false;
  });

  test('a block id reaches no stylesheet', async () => {
    add('h1', { collapsed: true });
    const sibling = add('text', { id: 'an-id-to-look-for' });
    await wait();

    expect(isVisible(sibling)).toBe(false);
    const sheets = [...document.querySelectorAll('style')];
    expect(sheets.filter(s => s.textContent?.includes(sibling))).toEqual([]);
  });

  test('an id with a quote in it folds like any other', async () => {
    const heading = add('h1', { collapsed: true });
    const sibling = add('text', { id: 'an"odd]id' });
    await wait();

    expect(isVisible(sibling)).toBe(false);

    setCollapsed(heading, false);
    await wait();
    expect(isVisible(sibling)).toBe(true);
  });

  test.each(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'])(
    '%s folds up to the next heading of its level or above',
    async type => {
      const level = Number(type.slice(1));
      const heading = add(type, { collapsed: true });
      const text = add('text');
      const deeper = add(level < 6 ? `h${level + 1}` : 'text');
      const end = add(type);
      const after = add('text');
      await wait();

      expect([text, deeper].map(isVisible)).toEqual([false, false]);
      expect([heading, end, after].map(isVisible)).toEqual([true, true, true]);

      setCollapsed(heading, false);
      await wait();
      expect([text, deeper].map(isVisible)).toEqual([true, true]);

      setCollapsed(heading, true);
      await wait();
      expect([text, deeper].map(isVisible)).toEqual([false, false]);
    }
  );

  test('opening one of two folds leaves the other in place', async () => {
    const outer = add('h1', { collapsed: true });
    const inner = add('h2', { collapsed: true });
    const shared = add('text');
    await wait();
    expect([inner, shared].map(isVisible)).toEqual([false, false]);

    setCollapsed(outer, false);
    await wait();
    expect([inner, shared].map(isVisible)).toEqual([true, false]);

    setCollapsed(inner, false);
    await wait();
    expect(isVisible(shared)).toBe(true);
  });

  test('follows the siblings as they change', async () => {
    const heading = add('h1', { collapsed: true });
    add('text');
    await wait();

    // Mounted after the heading's own update, as a peer's block would be.
    const late = add('text');
    await wait();
    expect(isVisible(late)).toBe(false);

    // A sibling turned into a heading of the same level ends the fold…
    const ending = add('text');
    const beyond = add('text');
    window.doc.updateBlock(window.doc.getModelById(ending)!, { type: 'h1' });
    await wait();
    expect([ending, beyond].map(isVisible)).toEqual([true, true]);

    // …and the heading going away gives back what it folded.
    window.doc.deleteBlock(window.doc.getModelById(heading)!);
    await wait();
    expect(isVisible(late)).toBe(true);
  });

  test('a block writing its own inline display stays folded', async () => {
    const heading = add('h1', { collapsed: true });
    const sibling = add('text');
    await wait();

    // What `EmbedBlockComponent` and the synced doc do on their host.
    viewOf(sibling).style.display = 'block';
    expect(isVisible(sibling)).toBe(false);

    setCollapsed(heading, false);
    await wait();
    expect(isVisible(sibling)).toBe(true);
    expect(viewOf(sibling).style.display).toBe('block');
  });

  test('a reader folds and unfolds without writing', async () => {
    const heading = add('h2', { collapsed: true });
    const sibling = add('text');
    await wait();
    window.doc.readonly = true;
    await wait();
    expect(isVisible(sibling)).toBe(false);

    const toggle = viewOf(heading).querySelector(
      'blocksuite-toggle-button'
    ) as HTMLElement & { updateCollapsed: (value: boolean) => void };
    toggle.updateCollapsed(false);
    await wait();
    expect(isVisible(sibling)).toBe(true);

    toggle.updateCollapsed(true);
    await wait();
    expect(isVisible(sibling)).toBe(false);
    const model = window.doc.getModelById(heading)!;
    expect((model.props as { collapsed: boolean }).collapsed).toBe(true);
  });
});
