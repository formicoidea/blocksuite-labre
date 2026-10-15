import type { PageRootBlockComponent } from '@labre/affine/blocks/root';
import { ToolbarRegistryIdentifier } from '@labre/affine/shared/services';
import { AFFINE_TOOLBAR_WIDGET } from '@labre/affine/widgets/toolbar';
import type { RichText } from '@labre/affine-rich-text';
import { IS_MAC } from '@labre/global/env';
import type { BlockModel } from '@labre/store';
import { commands, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Pasting in a page, through the real clipboard and the real `Mod+V` (labre
 * P4, REQ-IM-1 and REQ-IM-2).
 *
 * - **A lone URL** pastes as a plain link, as before, and the link's own
 *   toolbar opens on it so its view switcher offers the card and the embed.
 *   Nothing is converted unless the viewer picks: the next key closes the
 *   proposal and the link stays. Would have caught: the proposal never
 *   opening (the paste left no link at the caret), or a paste that applied a
 *   view by itself. Choosing a view is the toolbar's existing conversion; it
 *   is not driven here because both targets ask the link-preview service,
 *   whose default endpoint is a public worker.
 * - **A GFM table** becomes the inline table block, never a database, and
 *   every cell keeps its whole text, escapes resolved. Would have caught: the
 *   database's Markdown matcher reading tables again, or a cell that lost what
 *   the parser handed it.
 *
 * Read with `isolate: false` in mind: the clipboard permission is handed back
 * in a `finally`, and the proposal is closed before the editor unmounts.
 */
describe('pasting in a page', () => {
  const MOD = IS_MAC ? 'Meta' : 'Control';
  let root!: PageRootBlockComponent;
  let paragraphId!: string;

  const toolbar = () =>
    (
      root.widgetComponents[AFFINE_TOOLBAR_WIDGET] as
        | { toolbar?: HTMLElement }
        | undefined
    )?.toolbar ?? null;

  const isOpen = () => !!toolbar()?.dataset.open;

  /** Every element matching `selector`, through every open shadow root. */
  const deepQueryAll = (scope: ParentNode, selector: string): HTMLElement[] => {
    const found = Array.from(scope.querySelectorAll<HTMLElement>(selector));
    for (const element of scope.querySelectorAll('*')) {
      if (element.shadowRoot)
        found.push(...deepQueryAll(element.shadowRoot, selector));
    }
    return found;
  };

  const settle = async () => {
    await wait(150);
    await root.updateComplete;
  };

  const paste = async (text: string) => {
    await commands.systemClipboard(true);
    try {
      await navigator.clipboard.writeText(text);
      await userEvent.keyboard(`{${MOD}>}v{/${MOD}}`);
      await settle();
    } finally {
      await commands.systemClipboard(false);
    }
  };

  const noteChildren = () =>
    (window.doc.getBlock(paragraphId)?.model.parent?.children ??
      []) as BlockModel[];

  const deltaOf = (model: BlockModel | undefined) =>
    (model?.text?.toDelta() ?? []) as {
      insert: string;
      attributes?: Record<string, unknown>;
    }[];

  beforeEach(async () => {
    const unmount = await setupEditor('page');
    root = getDocRootBlock(window.doc, window.editor, 'page');
    root.std.event.active = true;
    const noteId = addNote(window.doc);
    paragraphId = window.doc.getBlock(noteId)!.model.children[0]!.id;
    await wait(100);

    const richText = window.editor.host!.querySelector<RichText>(
      `[data-block-id="${paragraphId}"] rich-text`
    );
    if (!richText) throw new Error('the paragraph rich text is missing');
    await userEvent.click(richText);

    return () => {
      root.std.get(ToolbarRegistryIdentifier).message$.value = null;
      unmount();
    };
  });

  describe('a lone URL', () => {
    test('pastes as a link and offers its views', async () => {
      const url = 'https://labre.invalid/some/page?x=1';
      await paste(url);

      expect(deltaOf(window.doc.getBlock(paragraphId)?.model)).toEqual([
        { insert: url, attributes: { link: url } },
      ]);
      expect(isOpen(), 'the link toolbar opened on the pasted link').toBe(true);

      // The switcher lives in the dropdown's shadow root, its entries too.
      const dropdown = deepQueryAll(toolbar()!, 'affine-view-dropdown-menu')[0];
      expect(dropdown, 'the view switcher is in the toolbar').toBeTruthy();
      const scope = dropdown!.shadowRoot!;
      deepQueryAll(scope, 'editor-icon-button')[0]!.click();
      await settle();

      const offered = deepQueryAll(scope, '[data-testid^="link-to-"]').map(
        entry => entry.dataset.testid
      );
      expect(offered).toEqual([
        'link-to-inline',
        'link-to-card',
        'link-to-embed',
      ]);
    });

    test('stays a link when the viewer picks nothing', async () => {
      const url = 'https://labre.invalid/page';
      await paste(url);
      expect(isOpen()).toBe(true);

      await userEvent.keyboard('{End}');
      await settle();

      expect(isOpen(), 'the next key closes the proposal').toBe(false);
      expect(noteChildren().map(model => model.flavour)).toEqual([
        'affine:paragraph',
      ]);
      expect(deltaOf(window.doc.getBlock(paragraphId)?.model)).toEqual([
        { insert: url, attributes: { link: url } },
      ]);
    });

    test('a URL inside a sentence opens nothing', async () => {
      await paste('see https://labre.invalid/page for more');

      expect(isOpen()).toBe(false);
      expect(
        deltaOf(window.doc.getBlock(paragraphId)?.model)
          .map(op => op.insert)
          .join('')
      ).toBe('see https://labre.invalid/page for more');
    });
  });

  test('a GFM table becomes an inline table, every cell whole', async () => {
    await paste(
      [
        '| Name | Note | Code |',
        '| :--- | ---: | :-: |',
        '| a \\| b | **bold** \\*not\\* | `x \\| y` |',
        '| 1 | 2 | 3 | extra |',
      ].join('\n')
    );

    const flavours = window.doc
      .getAllModels()
      .map(model => model.flavour)
      .filter(flavour => flavour !== 'affine:paragraph');
    expect(flavours).toContain('affine:table');
    expect(flavours).not.toContain('affine:database');

    const table = window.doc
      .getAllModels()
      .find(model => model.flavour === 'affine:table')!;
    const props = table.props as unknown as {
      columns: Record<string, { columnId: string; order: string }>;
      rows: Record<string, { rowId: string; order: string }>;
      cells: Record<string, { text: { toString(): string } }>;
    };
    const byOrder = <T extends { order: string }>(items: T[]) =>
      items.sort((a, b) =>
        a.order < b.order ? -1 : a.order > b.order ? 1 : 0
      );
    const columns = byOrder(Object.values(props.columns));
    const grid = byOrder(Object.values(props.rows)).map(row =>
      columns.map(column =>
        props.cells[`${row.rowId}:${column.columnId}`]!.text.toString()
      )
    );
    expect(grid).toEqual([
      ['Name', 'Note', 'Code', ''],
      ['a | b', 'bold *not*', 'x | y', ''],
      ['1', '2', '3', 'extra'],
    ]);
  });
});
