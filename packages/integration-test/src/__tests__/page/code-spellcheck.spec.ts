/**
 * The browser spellchecker is off inside a code block and still on in a
 * paragraph (GitHub issue #733; upstream toeverything/AFFiNE#15902, commit
 * 2ee701d).
 *
 * The code block sets `spellcheck="false"` on its `<rich-text>`, and the
 * `contenteditable` div that `<rich-text>` renders in its light DOM inherits
 * it. happy-dom does not implement the `spellcheck` IDL attribute, so the unit
 * spec (`affine/blocks/code/src/__tests__/code-spellcheck.unit.spec.ts`)
 * resolves the inheritance by hand; this one reads the state Chromium itself
 * computes on the real editable of each block.
 */
import { Text } from '@labre/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { setupEditor } from '../utils/setup.js';

/** Time for the added blocks to mount their rich text. */
const MOUNT_MS = 100;

describe('spellcheck in the page editor', () => {
  let codeId = '';
  let paragraphId = '';

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    const noteId = doc.addBlock('affine:note', {}, doc.root);
    paragraphId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('A sentense with a typo') },
      noteId
    );
    codeId = doc.addBlock(
      'affine:code',
      { text: new Text('const vlaue = 1;') },
      noteId
    );
    await wait(MOUNT_MS);
    return cleanup;
  });

  /** The `contenteditable` area of the block `blockId`. */
  const editableOf = (blockId: string) => {
    const editable = editor
      .host!.view.getBlock(blockId)
      ?.querySelector<HTMLElement>('rich-text [contenteditable="true"]');
    expect(editable, `block ${blockId} renders an editable`).toBeTruthy();
    return editable!;
  };

  test('is off in a code block', () => {
    expect(editableOf(codeId).spellcheck).toBe(false);
  });

  test('is left on in a paragraph', () => {
    expect(editableOf(paragraphId).spellcheck).toBe(true);
  });
});
