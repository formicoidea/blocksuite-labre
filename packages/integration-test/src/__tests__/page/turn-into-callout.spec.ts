import type { PageRootBlockComponent } from '@labre/affine/blocks/root';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import { BlockSelection, TextSelection } from '@labre/std';
import { type BlockModel, Text } from '@labre/store';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * **"Turn into → Callout" from the toolbar rewrites the document** (#418) —
 * the way in, where `callout-turn-into.spec.ts` is the way out.
 *
 * The unit specs of `@labre/affine-block-callout` pin the command against a
 * real store, and the gating specs of `@labre/affine` pin that the entry is
 * registered. Neither proves the toolbar DRAWS the entry the callout package
 * contributes beside the static conversions, nor that clicking it reaches the
 * command with the selection the row holds. That is what this one pins, on
 * the two rows that offer it: the format bar over a text selection, and the
 * note row of a block-selected code block.
 *
 * The conversion replaces the block: a new callout takes its place and a new
 * paragraph inside it receives the text, so a code block comes back as a
 * paragraph (the callout schema accepts only paragraphs and lists).
 *
 * The editor is focused on the host and the selection is set through
 * `std.selection`, never by clicking into the text: a click into a paragraph
 * leaves the next spec file of this shared page (`isolate: false`) in a state
 * it does not expect (see `callout-turn-into.spec.ts`).
 */
describe('turning a block into a callout from the toolbar', () => {
  let root!: PageRootBlockComponent;
  let noteId!: string;

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

  /** `flavour:text`, children nested. */
  const shape = (block: BlockModel): unknown => {
    const self = `${block.flavour}:${block.text?.toString() ?? ''}`;
    return block.children.length > 0
      ? { [self]: block.children.map(shape) }
      : self;
  };

  const noteShape = () => window.doc.getModelById(noteId)!.children.map(shape);

  const settle = async () => {
    await wait(200);
    await root.updateComplete;
    for (let i = 0; i < 4; i++) {
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
  };

  /** Opens the row's "Turn into" and clicks its Callout entry. */
  const pickCallout = async () => {
    const menu = turnInto();
    if (!menu) throw new Error('the row has no Turn into');
    menu.show(true);
    await settle();
    const entry = menu.querySelector<HTMLElement>(
      'editor-menu-action[aria-label="Callout"]'
    );
    if (!entry) throw new Error('Turn into offers no Callout entry');
    entry.click();
    await settle();
  };

  beforeEach(async () => {
    const cleanup = await setupEditor('page');
    root = getDocRootBlock(window.doc, window.editor, 'page');
    noteId = addNote(window.doc);
    await wait(100);
    window.editor.host!.focus();
    return cleanup;
  });

  test('a paragraph becomes a callout holding its text, caret inside', async () => {
    const doc = window.doc;
    const paragraphId = doc.addBlock(
      'affine:paragraph',
      { text: new Text('mot à mot') },
      noteId
    );
    await settle();

    const { selection } = window.editor.std;
    selection.setGroup('note', [
      selection.create(TextSelection, {
        from: { blockId: paragraphId, index: 0, length: 3 },
        to: null,
      }),
    ]);
    await settle();
    expect(toolbar()?.dataset.open).toBe('true');

    await pickCallout();

    // `addNote` opens the note with an empty paragraph of its own.
    expect(noteShape()).toEqual([
      'affine:paragraph:',
      { 'affine:callout:': ['affine:paragraph:mot à mot'] },
    ]);
    expect(doc.getModelById(paragraphId)).toBeNull();
    const callout = doc.getModelById(noteId)!.children[1];
    const caret = selection.find(TextSelection);
    expect(caret?.from.blockId).toBe(callout.children[0].id);

    // One gesture, one undo step: the paragraph comes back whole.
    doc.undo();
    await settle();
    expect(noteShape()).toEqual([
      'affine:paragraph:',
      'affine:paragraph:mot à mot',
    ]);
    expect(doc.getModelById(paragraphId)?.flavour).toBe('affine:paragraph');
  });

  test('a code block becomes a callout whose paragraph holds the code', async () => {
    const doc = window.doc;
    const codeId = doc.addBlock(
      'affine:code',
      { text: new Text('const a = 1;') },
      noteId
    );
    await settle();

    const { selection } = window.editor.std;
    selection.set([selection.create(BlockSelection, { blockId: codeId })]);
    await settle();
    expect(toolbar()?.dataset.open).toBe('true');

    await pickCallout();

    expect(noteShape()).toEqual([
      'affine:paragraph:',
      { 'affine:callout:': ['affine:paragraph:const a = 1;'] },
    ]);
    expect(doc.getModelById(codeId)).toBeNull();
  });
});
