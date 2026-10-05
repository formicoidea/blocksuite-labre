/**
 * Inline overline from the format bar, end to end (ADR 0030 §5).
 *
 * The assembly suite pins the declarations; only a real editor answers the
 * user's path: a REAL click on the format bar's Overline button writes
 * `overline: true` on the selected run — through the editor schema, which is
 * the intersection of the store's base attributes (which do not know it) and
 * every inline spec — the run is painted with an overline, and a second click
 * takes it off.
 */
import type { PageRootBlockComponent } from '@labre/affine/blocks/root';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import type { RichText } from '@labre/affine-rich-text';
import { TextSelection } from '@labre/std';
import { Text } from '@labre/store';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

describe('inline overline', () => {
  let root!: PageRootBlockComponent;
  let paragraphId!: string;
  let text!: Text;

  const overlineButton = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar?.querySelector<HTMLElement & { active: boolean }>(
      '[data-toolbar-action-id="overline"]'
    ) ?? null;

  const select = async (index: number, length: number) => {
    const std = window.editor.std;
    std.selection.setGroup('note', [
      std.selection.create(TextSelection, {
        from: { blockId: paragraphId, index, length },
        to: null,
      }),
    ]);
    await wait(250);
    await root.updateComplete;
  };

  beforeEach(async () => {
    const unmount = await setupEditor('page');
    root = getDocRootBlock(window.doc, window.editor, 'page');
    const noteId = addNote(window.doc);
    text = new Text('Order line');
    paragraphId = window.doc.addBlock('affine:paragraph', { text }, noteId);
    await wait(100);

    const richText = window.editor.host!.querySelector<RichText>(
      `[data-block-id="${paragraphId}"] rich-text`
    );
    if (!richText) throw new Error('the paragraph rich text is missing');
    await userEvent.click(richText);
    return unmount;
  });

  test('a real click overlines the selection, a second one takes it off', async () => {
    await select(0, 5);
    const button = overlineButton();
    expect(button, 'the format bar has no overline button').toBeTruthy();
    expect(button!.active).toBe(false);

    await userEvent.click(page.elementLocator(button!));
    await wait(100);

    expect(text.toDelta()).toEqual([
      { insert: 'Order', attributes: { overline: true } },
      { insert: ' line' },
    ]);

    const painted = window.editor.host!.querySelector<HTMLElement>(
      `[data-block-id="${paragraphId}"] affine-text span`
    );
    expect(painted).toBeTruthy();
    expect(getComputedStyle(painted!).textDecorationLine).toContain('overline');

    await select(0, 5);
    expect(overlineButton()!.active).toBe(true);
    await userEvent.click(page.elementLocator(overlineButton()!));
    await wait(100);

    expect(text.toDelta()).toEqual([{ insert: 'Order line' }]);
  });
});
