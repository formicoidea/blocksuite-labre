import type { RichText } from '@labre/affine-rich-text';
import { TextSelection } from '@labre/std';
import { Text } from '@labre/store';
import { userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Typing `--` then a space turns the two hyphens into an em dash, like the
 * other inline markdown shortcuts: the rule only fires on the space, so the
 * `---` divider shortcut and `--flag` style words are left alone.
 */

describe('double hyphen to em dash', () => {
  let noteId!: string;
  let paragraphId!: string;

  const setup = async (text: Text) => {
    const doc = window.doc;
    noteId = addNote(doc);
    paragraphId = doc.addBlock('affine:paragraph', { text }, noteId);
    await wait(100);

    const richText = window.editor.host!.querySelector<RichText>(
      `[data-block-id="${paragraphId}"] rich-text`
    );
    if (!richText) throw new Error('the paragraph rich text is missing');
    await userEvent.click(richText);
    const std = window.editor.std;
    std.selection.setGroup('note', [
      std.selection.create(TextSelection, {
        from: { blockId: paragraphId, index: text.length, length: 0 },
        to: null,
      }),
    ]);
    await wait();
  };

  const textOf = () =>
    window.doc.getBlock(paragraphId)?.model.text?.toString() ?? null;

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    return cleanup;
  });

  test('word -- space becomes word — space', async () => {
    await setup(new Text());
    await userEvent.keyboard('la stratégie -- et la carte');
    await wait();

    expect(textOf()).toBe('la stratégie — et la carte');
  });

  test('a leading -- space becomes an em dash too', async () => {
    await setup(new Text());
    await userEvent.keyboard('-- Bonjour');
    await wait();

    expect(textOf()).toBe('— Bonjour');
  });

  test('undo brings the two hyphens back', async () => {
    await setup(new Text());
    await userEvent.keyboard('a -- ');
    await wait();
    expect(textOf()).toBe('a — ');

    window.doc.undo();
    await wait();
    expect(textOf()).toBe('a -- ');
  });

  test('--flag and a single hyphen are left alone', async () => {
    await setup(new Text());
    await userEvent.keyboard('npm i --save a - b');
    await wait();

    expect(textOf()).toBe('npm i --save a - b');
  });

  test('--- space still makes a divider', async () => {
    await setup(new Text());
    await userEvent.keyboard('--- ');
    await wait();

    const note = window.doc.getBlock(noteId)?.model;
    expect(note?.children.map(child => child.flavour)).toContain(
      'affine:divider'
    );
  });

  test('inline code keeps its hyphens', async () => {
    await setup(new Text([{ insert: 'x --', attributes: { code: true } }]));
    await userEvent.keyboard(' ');
    await wait();

    expect(textOf()).toBe('x -- ');
  });

  test('a code span still open keeps its hyphens', async () => {
    await setup(new Text());
    await userEvent.keyboard('`e -- ');
    await wait();

    expect(textOf()).toBe('`e -- ');
  });

  // the code rule consumes the space that closed the span, hence `e— f`
  test('a closed code span does not stop the next em dash', async () => {
    await setup(new Text());
    await userEvent.keyboard('`e` -- f');
    await wait();

    expect(textOf()).toBe('e— f');
  });
});
