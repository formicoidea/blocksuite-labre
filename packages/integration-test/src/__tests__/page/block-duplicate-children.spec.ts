import type { PageRootBlockComponent } from '@labre/affine/blocks/root';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { BlockSelection, TextSelection } from '@labre/std';
import { type BlockModel, Text } from '@labre/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **The page toolbar's Duplicate copies a block WITH its nested children,
 * right after it.**
 *
 * The bug: the note row's Duplicate took the selection in `highest` mode, so
 * only the selected paragraph was drafted, and `draftSelectedModelsCommand`
 * keeps a drafted block's children only when they are selected as well — the
 * copy of "parent" (with an indented "child") came out with no child. The
 * callout row hit the same trap (#468) and the fix is the same: select in
 * `flat` mode, and say where the copy goes, because the command's default
 * anchors on the last selected model, which in `flat` mode is a descendant.
 *
 * Both entry paths are pinned: a block selection (the drag handle's, set the
 * way `widgets/drag-handle` sets it) and a text selection, which the action
 * converts to a block selection of the highest blocks first. A block after
 * the parent proves the copy lands right after it, not after the child.
 */
describe('duplicating a block with nested children from the page toolbar', () => {
  let root!: PageRootBlockComponent;
  let noteId!: string;
  let parentId!: string;
  let afterId!: string;

  const toolbar = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;

  const settle = async () => {
    await wait(200);
    await root.updateComplete;
    for (let i = 0; i < 4; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  };

  const clickDuplicate = async () => {
    const entry = toolbar()?.querySelector<HTMLElement>(
      'editor-menu-action[data-toolbar-action-id="duplicate"]'
    );
    const menu = entry?.closest<HTMLElement & { show(force?: boolean): void }>(
      'editor-menu-button'
    );
    if (!entry || !menu)
      throw new Error('the row has no duplicate in its menu');
    menu.show(true);
    await settle();
    entry.click();
    await settle();
  };

  /** `text`, children nested. */
  const shape = (block: BlockModel): unknown => {
    const self = block.text?.toString() ?? '';
    return block.children.length > 0
      ? { [self]: block.children.map(shape) }
      : self;
  };

  const expectDuplicated = () => {
    const note = window.doc.getModelById(noteId)!;
    // `addNote` opens the note with an empty paragraph of its own.
    expect(note.children.map(shape)).toEqual([
      '',
      { parent: ['child'] },
      { parent: ['child'] },
      'après',
    ]);
    expect(note.children[1].id).toBe(parentId);
    expect(note.children[3].id).toBe(afterId);
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    root = getDocRootBlock(window.doc, window.editor, 'page');

    const doc = window.doc;
    noteId = addNote(doc);
    parentId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('parent') },
      noteId
    );
    doc.addBlock('affine:paragraph', { text: new Text('child') }, parentId);
    afterId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('après') },
      noteId
    );
    await wait(100);

    // Focus on the host, no caret in the text: see `callout-turn-into.spec.ts`
    // for what a caret left in the shared page does to the next spec file.
    window.editor.host!.focus();
    return cleanup;
  });

  test('from a block selection', async () => {
    const { selection } = window.editor.std;
    selection.set([selection.create(BlockSelection, { blockId: parentId })]);
    await settle();

    await clickDuplicate();
    expectDuplicated();
  });

  // Parent AND child block-selected (a drag over both, Shift+click): the
  // child is copied once, inside the parent's copy, and the copy still lands
  // after the parent — `highest` keeps the child, which made it the anchor.
  test('from a block selection holding the parent and its child', async () => {
    const { selection } = window.editor.std;
    const childId = window.doc.getModelById(parentId)!.children[0].id;
    selection.set(
      [parentId, childId].map(blockId =>
        selection.create(BlockSelection, { blockId })
      )
    );
    await settle();

    await clickDuplicate();
    expectDuplicated();
  });

  test('from a text selection in the parent', async () => {
    const { selection } = window.editor.std;
    selection.set([
      selection.create(TextSelection, {
        from: { blockId: parentId, index: 0, length: 6 },
        to: null,
      }),
    ]);
    await settle();

    await clickDuplicate();
    expectDuplicated();
  });
});
