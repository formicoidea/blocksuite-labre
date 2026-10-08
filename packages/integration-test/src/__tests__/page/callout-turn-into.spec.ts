import type { PageRootBlockComponent } from '@labre/affine/blocks/root';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { BlockSelection } from '@labre/std';
import { type BlockModel, type Slice, Text } from '@labre/store';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **A block-selected callout opens a toolbar, and its "Turn into" turns it
 * back into text** (issue #468).
 *
 * The bug: clicking a callout's drag handle selected it and showed nothing,
 * because the toolbar widget only draws a row for a single block when a
 * module is registered for its flavour (or it is a paragraph, list, code or
 * image) — and `affine:callout` had none. So once made, a callout could not
 * become anything else. The unit specs pin the command and the registration;
 * this one pins that the widget really DRAWS the row for a callout, and that
 * picking an entry in it rewrites the document.
 *
 * The selection is set the way the drag handle sets it — one
 * `BlockSelection` through `selection.set` (`selection-helper.ts` in
 * `widgets/drag-handle`) — rather than by driving the handle with the mouse:
 * the handle only appears after a hover settles on the block, and what is
 * under test here is the row that selection opens, not the hover.
 *
 * Copy and Duplicate are pinned here too, because the first version of the
 * row took the selection in `highest` mode like the note's row does: only the
 * callout itself was drafted, `draftSelectedModelsCommand` keeps a drafted
 * block's children only when they are selected as well, and a callout's whole
 * content IS its children — so Duplicate made an EMPTY callout (found in the
 * browser recette). Hence a callout with two children, and a block after it
 * to prove the copy lands right after the callout.
 */
describe('turning a callout back into text from its toolbar', () => {
  let root!: PageRootBlockComponent;
  let noteId!: string;
  let calloutId!: string;
  let afterId!: string;

  const toolbar = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;

  /** The "Turn into" dropdown of the row, found by its accessible name. */
  const turnInto = () =>
    Array.from(
      toolbar()?.querySelectorAll<
        HTMLElement & { show(force?: boolean): void }
      >('editor-menu-button') ?? []
    ).find(menu =>
      menu.shadowRoot?.querySelector(
        'editor-icon-button[aria-label="Conversions"]'
      )
    ) ?? null;

  /** An entry of the row's "⋮" menu, with that menu opened. */
  const moreEntry = async (id: string) => {
    const entry = toolbar()?.querySelector<HTMLElement>(
      `editor-menu-action[data-toolbar-action-id="${id}"]`
    );
    const menu = entry?.closest<HTMLElement & { show(force?: boolean): void }>(
      'editor-menu-button'
    );
    if (!entry || !menu) throw new Error(`the row has no ${id} in its menu`);
    menu.show(true);
    await settle();
    return entry;
  };

  /** `flavour:text`, children nested, for a model or a drafted one. */
  const shape = (
    block: Pick<BlockModel, 'flavour' | 'text'> & {
      children: readonly unknown[];
    }
  ): unknown => {
    const self = `${block.flavour}:${block.text?.toString() ?? ''}`;
    return block.children.length > 0
      ? { [self]: block.children.map(child => shape(child as never)) }
      : self;
  };

  const CALLOUT = {
    'affine:callout:': [
      'affine:paragraph:dans la bulle',
      'affine:list:et la suite',
    ],
  };

  const settle = async () => {
    await wait(200);
    await root.updateComplete;
    for (let i = 0; i < 4; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    root = getDocRootBlock(window.doc, window.editor, 'page');

    const doc = window.doc;
    noteId = addNote(doc);
    calloutId = doc.addBlock('affine:callout', {}, noteId);
    doc.addBlock(
      'affine:paragraph',
      { text: new Text('dans la bulle') },
      calloutId
    );
    doc.addBlock(
      'affine:list',
      { type: 'bulleted', text: new Text('et la suite') },
      calloutId
    );
    afterId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('après') },
      noteId
    );
    await wait(100);

    // The editor takes the focus the way a click on the handle gives it: on
    // the host (`tabindex="0"`), with no caret in the callout's text — a
    // handle click places none. Clicking INTO the text instead left the next
    // spec file, `toggle-button-flavour-keymap`, failing in this shared page
    // (`toolbar-format-bar-width` does the same to it on its own).
    window.editor.host!.focus();

    const { selection } = window.editor.std;
    selection.set([selection.create(BlockSelection, { blockId: calloutId })]);
    await settle();

    return cleanup;
  });

  test('the selected callout shows a row with Turn into', () => {
    expect(toolbar()?.dataset.open).toBe('true');
    expect(turnInto()).not.toBeNull();
  });

  test('Text puts the paragraph where the callout was, in one undo step', async () => {
    const menu = turnInto();
    if (!menu) throw new Error('the row has no Turn into');
    menu.show(true);
    await settle();

    const text = menu.querySelector<HTMLElement>(
      'editor-menu-action[aria-label="Text"]'
    );
    if (!text) throw new Error('Turn into offers no Text entry');
    text.click();
    await settle();

    const doc = window.doc;
    const note = doc.getModelById(noteId)!;
    expect(doc.getModelById(calloutId)).toBeNull();
    expect(
      note.children.map(
        child => `${child.flavour}:${child.text?.toString() ?? ''}`
      )
    ).toContain('affine:paragraph:dans la bulle');

    doc.undo();
    await settle();
    expect(doc.getModelById(calloutId)?.flavour).toBe('affine:callout');
  });

  // The note row offers "Turn into" on a paragraph or a code block only once
  // it holds words; the callout's row does the same (PO recette of #468).
  test('an empty callout offers no Turn into, only its menu', async () => {
    const doc = window.doc;
    doc.getModelById(calloutId)!.children.forEach(child => {
      child.text?.delete(0, child.text.length);
    });
    const { selection } = window.editor.std;
    selection.clear();
    await settle();
    selection.set([selection.create(BlockSelection, { blockId: calloutId })]);
    await settle();

    expect(toolbar()?.dataset.open).toBe('true');
    expect(turnInto()).toBeNull();
    await moreEntry('duplicate');
  });

  test('Duplicate copies the callout WITH its children, right after it', async () => {
    (await moreEntry('duplicate')).click();
    await settle();

    const doc = window.doc;
    const note = doc.getModelById(noteId)!;
    // `addNote` opens the note with an empty paragraph of its own.
    expect(note.children.map(shape)).toEqual([
      'affine:paragraph:',
      CALLOUT,
      CALLOUT,
      'affine:paragraph:après',
    ]);
    expect(note.children[1].id).toBe(calloutId);
    expect(note.children[3].id).toBe(afterId);
  });

  test('Copy puts the callout WITH its children on the clipboard', async () => {
    const { clipboard } = window.editor.std;
    const copied: Slice[] = [];
    const copy = vi
      .spyOn(clipboard, 'copy')
      .mockImplementation(async (slice: Slice) => {
        copied.push(slice);
      });
    try {
      (await moreEntry('copy')).click();
      await settle();
    } finally {
      copy.mockRestore();
    }

    expect(copied).toHaveLength(1);
    expect(copied[0].content.map(shape)).toEqual([CALLOUT]);
  });
});
