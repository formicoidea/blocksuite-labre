/**
 * Why this spec exists: the clipboard writes `text/plain` with the
 * MixTextAdapter (`PlainTextClipboardConfig`, `affine/foundation`) from a
 * slice whose content holds the copied top-level blocks, one snapshot each
 * (`draftSelectedModelsCommand`). `fromSliceSnapshot` concatenated those
 * snapshots with no separator, so copying "aaa", "bbb" and "ccc" pasted
 * `aaabbb…` into any other application. What it would have caught: that
 * concatenation, and a fix that changes the text of a single copied block.
 *
 * The separator is the one the adapter already writes between two blocks of
 * one snapshot: a newline before every block but the first, none at the end.
 * So copying blocks side by side writes what copying their parent writes.
 */
import { MixTextAdapter } from '@labre/affine-shared/adapters';
import type { BlockSnapshot } from '@labre/store';
import { describe, expect, test } from 'vitest';

import { createJob } from '../utils/create-job.js';
import { getProvider } from '../utils/get-provider.js';

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

// Paragraphs only: how a list item writes itself in plain text is another
// spec's concern (list markers), which this one must not depend on.
const paragraph = (insert: string, children: BlockSnapshot[] = []) =>
  block('affine:paragraph', insert, { type: 'text' }, children);

async function copied(content: BlockSnapshot[]) {
  const adapter = new MixTextAdapter(createJob(), getProvider());
  const result = await adapter.fromSliceSnapshot({
    snapshot: { type: 'slice', workspaceId: 'w', pageId: 'p', content },
  });
  return result.file;
}

describe('text/plain copy of several blocks', () => {
  test('top-level blocks are separated by a newline', async () => {
    const text = await copied([
      paragraph('aaa'),
      paragraph('bbb'),
      paragraph('ccc', [paragraph('ddd')]),
    ]);
    expect(text).toBe('aaa\nbbb\nccc\nddd');
  });

  test('blocks side by side write what their parent writes', async () => {
    const children = [paragraph('aaa'), paragraph('bbb'), paragraph('ccc')];
    const parent = block('affine:note', '', {}, children);
    expect(await copied(children)).toBe(await copied([parent]));
  });

  test('a single block is written as before', async () => {
    expect(await copied([paragraph('aaa')])).toBe('aaa');
    expect(await copied([paragraph('aaa', [paragraph('bbb')])])).toBe(
      'aaa\nbbb'
    );
  });
});
