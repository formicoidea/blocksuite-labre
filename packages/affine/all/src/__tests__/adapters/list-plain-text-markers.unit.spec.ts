/**
 * Why this spec exists: plain text (the plain-text export and the
 * `text/plain` copy) wrote a list as bare lines, so a numbered list, a to-do
 * list and its nesting came out as undistinguishable paragraphs. Product
 * decision (3.5.0): a list item now writes the marker the Markdown export
 * writes, and a sub-list is indented the way the Markdown export indents it.
 *
 * - bulleted `- `, toggle `- ` (Markdown has no toggle: its export writes a
 *   bullet), to-do `[ ] ` / `[x] `, numbered `N. `;
 * - a numbered list counts from its first item's stored `order` (a list
 *   continuing after a paragraph), unless its last number would pass nine
 *   digits, where the Markdown export writes no start (#658);
 * - a sub-list is indented by the width of the parent's Markdown marker:
 *   2 under a bullet, a toggle or a to-do, 3 under `1. `.
 *
 * Both paths share one helper (`listPlainTextPrefix`); this spec drives each
 * through its adapter, and asserts that non-list blocks are untouched.
 */
import {
  MixTextAdapter,
  PlainTextAdapter,
} from '@labre/affine-shared/adapters';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

const provider = getProvider();

function block(
  flavour: string,
  insert: string,
  props: Record<string, unknown> = {},
  children: BlockSnapshot[] = []
): BlockSnapshot {
  return {
    type: 'block',
    id: `block:${insert}`,
    flavour,
    props: {
      text: { '$blocksuite:internal:text$': true, delta: [{ insert }] },
      ...props,
    },
    children,
  };
}

const item = (
  type: string,
  insert: string,
  props: Record<string, unknown> = {},
  children: BlockSnapshot[] = []
) =>
  block(
    'affine:list',
    insert,
    { type, checked: false, collapsed: false, order: null, ...props },
    children
  );

const paragraph = (insert: string) =>
  block('affine:paragraph', insert, { type: 'text' });

async function plainText(children: BlockSnapshot[]) {
  const note: BlockSnapshot = {
    type: 'block',
    id: 'block:note',
    flavour: 'affine:note',
    props: {},
    children,
  };
  const adapter = new PlainTextAdapter(createJob(), provider);
  return (await adapter.fromBlockSnapshot({ snapshot: note })).file;
}

describe('plain-text export of a list', () => {
  test('each list type writes its marker', async () => {
    const text = await plainText([
      item('bulleted', 'bullet'),
      paragraph('between'),
      item('numbered', 'one', { order: 1 }),
      item('numbered', 'two', { order: 2 }),
      paragraph('between'),
      item('todo', 'open'),
      item('todo', 'done', { checked: true }),
      paragraph('between'),
      item('toggle', 'toggle'),
    ]);
    expect(text).toBe(
      [
        '- bullet',
        'between',
        '1. one',
        '2. two',
        'between',
        '[ ] open',
        '[x] done',
        'between',
        '- toggle',
        '',
      ].join('\n')
    );
  });

  test('a numbered list starting at 3 keeps its start', async () => {
    const text = await plainText([
      item('numbered', 'c', { order: 3 }),
      item('numbered', 'd', { order: 4 }),
      item('numbered', 'e', { order: 5 }),
    ]);
    expect(text).toBe('3. c\n4. d\n5. e\n');
  });

  test('a start whose last number passes nine digits counts from 1, as in Markdown', async () => {
    const text = await plainText([
      item('numbered', 'a', { order: 999_999_999 }),
      item('numbered', 'b', { order: 1_000_000_000 }),
    ]);
    expect(text).toBe('1. a\n2. b\n');
  });

  test('a sub-list is indented by its parent marker width', async () => {
    const text = await plainText([
      item('bulleted', 'a', {}, [
        item('numbered', 'b', { order: 1 }, [item('todo', 'c')]),
        item('numbered', 'd', { order: 2 }),
      ]),
      item('numbered', 'e', { order: 1 }, [item('bulleted', 'f')]),
    ]);
    expect(text).toBe(
      ['- a', '  1. b', '     [ ] c', '  2. d', '1. e', '   - f', ''].join('\n')
    );
  });

  test('blocks other than lists are written as before', async () => {
    const text = await plainText([paragraph('aaa'), paragraph('bbb')]);
    expect(text).toBe('aaa\nbbb\n');
  });
});

describe('text/plain copy of a list', () => {
  // The clipboard writes `text/plain` with the MixTextAdapter
  // (`PlainTextClipboardConfig`, `affine/foundation`), from a slice whose
  // content holds the copied blocks.
  async function copied(content: BlockSnapshot[]) {
    const adapter = new MixTextAdapter(createJob(), provider);
    const result = await adapter.fromSliceSnapshot({
      snapshot: { type: 'slice', workspaceId: 'w', pageId: 'p', content },
    });
    return result.file;
  }

  test('a copied list writes its markers and nesting', async () => {
    const text = await copied([
      item('numbered', 'c', { order: 3 }, [
        item('bulleted', 'x'),
        item('todo', 'y', { checked: true }),
      ]),
    ]);
    expect(text).toBe('3. c\n   - x\n   [x] y');
  });

  test('a copied toggle writes a bullet', async () => {
    const text = await copied([item('toggle', 't', {}, [item('todo', 'u')])]);
    expect(text).toBe('- t\n  [ ] u');
  });
});
