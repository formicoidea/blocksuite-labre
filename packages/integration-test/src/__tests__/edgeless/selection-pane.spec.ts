/**
 * The selection pane (ADR 0031, stage 2) on a real editor, driven the way a
 * user drives it: every gesture on the pane goes through `userEvent`, i.e.
 * Playwright's real mouse and keyboard.
 *
 * The unit suite (`affine/all/.../selection-pane.unit.spec.ts`) owns the tree
 * and the writes on a bare document. This one owns what only a mounted editor
 * can answer: that the toolbar's button reaches the library's panel through
 * the seam; that the rows are the canvas' paint order; that a click selects on
 * the canvas and a hover highlights there; that a drag rewrites `index` in one
 * undo step; that a padlock locks that row alone; that a rename lands in the
 * group's stored title; that the frame filter narrows the list; that a
 * read-only document is listed and refuses every write; and that
 * `SelectionPaneExtension(null)` leaves no button behind.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import type { FramePanelHeader } from '@labre/affine/fragments/frame-panel';
import { type GroupElementModel, ShapeType } from '@labre/affine/model';
import {
  SelectionPaneExtension,
  SelectionPaneProvider,
  TelemetryExtension,
} from '@labre/affine/shared/services';
import { CommandDescriptorIdentifier } from '@labre/affine/std';
import type { GfxModel } from '@labre/affine/std/gfx';
import type { EdgelessSelectionPaneWidget } from '@labre/affine/widgets/edgeless-toolbar';
import type { ExtensionType } from '@labre/store';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const PANE_WIDGET = 'edgeless-selection-pane-widget';
const TOOL_BUTTON = 'edgeless-selection-pane-tool-button';
const ROW = '[data-testid="selection-pane-row"]';

/** The first element matching `selector`, through every open shadow root. */
function deepQuery(root: ParentNode, selector: string): HTMLElement | null {
  const direct = root.querySelector<HTMLElement>(selector);
  if (direct) return direct;
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot) {
      const found = deepQuery(element.shadowRoot, selector);
      if (found) return found;
    }
  }
  return null;
}

/** Every element matching `selector`, through every open shadow root. */
function deepQueryAll(root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot)
      found.push(...deepQueryAll(element.shadowRoot, selector));
  }
  return found;
}

describe('selection pane', () => {
  let edgeless!: EdgelessRootBlockComponent;
  let events: { name: string; props: Record<string, unknown> }[];

  const mount = async (extensions: ExtensionType[] = []) => {
    events = [];
    const cleanup = await setupEditor('edgeless', [
      TelemetryExtension({
        track: (name, props) =>
          events.push({ name, props: props as Record<string, unknown> }),
      }),
      ...extensions,
    ]);
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  };

  const service = () => edgeless.service;
  const gfx = () => edgeless.service.gfx;
  const widget = () =>
    edgeless.widgetComponents[PANE_WIDGET] as
      | EdgelessSelectionPaneWidget
      | undefined;
  const model = (id: string) => gfx().getElementById(id) as GfxModel;
  const rows = () =>
    Array.from(widget()?.shadowRoot?.querySelectorAll<HTMLElement>(ROW) ?? []);
  const rowOf = (id: string) => rows().find(row => row.dataset.id === id)!;
  const rowIds = () => rows().map(row => row.dataset.id);
  const inRow = (id: string, selector: string) =>
    rowOf(id).querySelector<HTMLElement>(selector)!;

  const settle = async () => {
    await edgeless.updateComplete;
    await widget()?.updateComplete;
    await wait(50);
  };

  const shape = (x: number) => {
    const id = service().crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: `[${x},0,100,100]`,
    });
    if (!id) throw new Error('failed to add shape');
    return id;
  };

  /** The quick tool lives in the toolbar widget's shadow tree. */
  const toolButton = () =>
    deepQuery(
      edgeless.widgetComponents['edgeless-toolbar-widget']!.shadowRoot!,
      TOOL_BUTTON
    );

  const openFromToolbar = async () => {
    const button = toolButton();
    expect(button, 'the toolbar shows the pane button').toBeTruthy();
    await userEvent.click(page.elementLocator(button!));
    await settle();
  };

  describe('on an editable canvas', () => {
    beforeEach(async () => mount());

    test('opens from the toolbar, lists the paint order, reports the opening', async () => {
      const a = shape(0);
      const b = shape(200);
      const c = shape(400);
      await settle();

      await openFromToolbar();

      expect(widget()!.paneOpen).toBe(true);
      // Created last is painted on top, and listed first.
      expect(rowIds()).toEqual([c, b, a]);
      expect(events.filter(e => e.name === 'SelectionPaneOpened')).toEqual([
        {
          name: 'SelectionPaneOpened',
          props: { page: 'whiteboard editor', source: 'toolbar' },
        },
      ]);

      // The button toggles it away again, and that reports nothing.
      await openFromToolbar();
      expect(widget()!.paneOpen).toBe(false);
      expect(events.filter(e => e.name === 'SelectionPaneOpened')).toHaveLength(
        1
      );
    });

    test('a click selects on the canvas, shift adds, a hover highlights', async () => {
      const a = shape(0);
      const b = shape(200);
      await settle();
      await openFromToolbar();

      await userEvent.click(page.elementLocator(rowOf(a)));
      await settle();
      expect(gfx().selection.selectedIds).toEqual([a]);
      expect(rowOf(a).hasAttribute('data-selected')).toBe(true);

      await userEvent.click(page.elementLocator(rowOf(b)), {
        modifiers: ['Shift'],
      });
      await settle();
      expect(new Set(gfx().selection.selectedIds)).toEqual(new Set([a, b]));

      // Canvas → pane: a selection made elsewhere shows on the rows.
      gfx().selection.set({ elements: [b], editing: false });
      await settle();
      expect(rowOf(b).hasAttribute('data-selected')).toBe(true);
      expect(rowOf(a).hasAttribute('data-selected')).toBe(false);

      await userEvent.hover(page.elementLocator(rowOf(a)));
      await settle();
      expect(gfx().highlight.highlighted$.value).toEqual([a]);
    });

    test('a drag rewrites the stacking, and one undo puts it back', async () => {
      const a = shape(0);
      const b = shape(200);
      const c = shape(400);
      await settle();
      await openFromToolbar();
      expect(rowIds()).toEqual([c, b, a]);

      // Drop the bottom row on the top half of the top row: above it.
      await userEvent.dragAndDrop(
        page.elementLocator(rowOf(a)),
        page.elementLocator(rowOf(c)),
        { targetPosition: { x: 40, y: 3 } }
      );
      await settle();

      expect(rowIds()).toEqual([a, c, b]);
      const indexOf = (id: string) => model(id).index;
      expect(indexOf(a) > indexOf(c)).toBe(true);

      edgeless.std.store.undo();
      await settle();
      expect(rowIds()).toEqual([c, b, a]);
    });

    test('a padlock locks that row alone, and never groups', async () => {
      const a = shape(0);
      const b = shape(200);
      await settle();
      await openFromToolbar();

      await userEvent.click(
        page.elementLocator(inRow(a, '[data-testid="selection-pane-lock"]'))
      );
      await settle();

      expect(model(a).lockedBySelf).toBe(true);
      expect(model(b).lockedBySelf).toBeFalsy();
      expect(service().surface.getElementsByType('group')).toHaveLength(0);
      expect(rowOf(a).hasAttribute('data-locked')).toBe(true);
      // The padlock acts on its row, it does not select it.
      expect(gfx().selection.selectedIds).toEqual([]);
    });

    test('a group is one collapsible row, renamed from the pane', async () => {
      const a = shape(0);
      const b = shape(200);
      const groupId = service().crud.addElement('group', {
        children: { [a]: true, [b]: true },
        title: 'Group 1',
      })!;
      await settle();
      await openFromToolbar();

      expect(rowIds()).toEqual([groupId, b, a]);
      await userEvent.click(
        page.elementLocator(
          inRow(groupId, '[data-testid="selection-pane-collapse"]')
        )
      );
      await settle();
      expect(rowIds()).toEqual([groupId]);

      await userEvent.dblClick(
        page.elementLocator(inRow(groupId, '.selection-pane-label'))
      );
      await settle();
      const input = inRow(groupId, '[data-testid="selection-pane-rename"]');
      expect(input).toBeTruthy();
      await userEvent.fill(page.elementLocator(input), 'Payments');
      await userEvent.keyboard('{Enter}');
      await settle();

      const group = gfx().getElementById(groupId) as GroupElementModel;
      expect(group.title.toString()).toBe('Payments');
      expect(inRow(groupId, '.selection-pane-label').textContent).toBe(
        'Payments'
      );
      // The two shapes typed nothing: the canvas never saw the keystrokes.
      expect(gfx().getElementById(a)).toBeTruthy();
      expect(gfx().getElementById(b)).toBeTruthy();
    });

    test('the frame filter narrows the list to the frame’s members', async () => {
      const inside = shape(0);
      const outside = shape(800);
      const board = service().crud.addElement('c4Board', {
        xywh: '[1200,0,400,300]',
      })!;
      const frameId = service().crud.addBlock(
        'affine:frame',
        {
          xywh: '[-50,-50,300,300]',
          childElementIds: { [inside]: true },
        },
        service().surface.id
      );
      await settle();
      await openFromToolbar();
      expect(rowIds()).toContain(outside);
      // A frame is the filter's scope, not a row; a framework board is a row.
      expect(rowIds()).not.toContain(frameId);
      expect(rowIds()).toContain(board);

      await userEvent.click(
        page.elementLocator(
          widget()!.shadowRoot!.querySelector<HTMLElement>(
            '[data-testid="selection-pane-filter"]'
          )!
        )
      );
      await wait(100);
      const entries = deepQueryAll(document, 'affine-menu-button').map(
        button => button.textContent?.trim() ?? ''
      );
      // "All elements" and the one frame — the board is not offered.
      expect(entries).toHaveLength(2);
      const item = deepQueryAll(document, 'affine-menu-button').find(button =>
        button.textContent?.includes('Frame:')
      );
      expect(item, 'the filter offers the frame').toBeTruthy();
      await userEvent.click(page.elementLocator(item!));
      await settle();

      expect(rowIds()).toEqual([inside]);
    });

    // The product owner asked for the frame panel's header, not a lookalike:
    // same row, same title type, same icon buttons, measured on the real
    // frame panel header mounted beside the pane.
    test('the header is drawn exactly like the frame panel’s', async () => {
      await openFromToolbar();
      const frameHeader = document.createElement(
        'affine-frame-panel-header'
      ) as FramePanelHeader;
      frameHeader.editorHost = window.editor.host!;
      document.body.append(frameHeader);
      try {
        await frameHeader.updateComplete;
        const reference = frameHeader.shadowRoot!;
        const ours = widget()!.shadowRoot!;
        const box = (root: ShadowRoot, selector: string) =>
          getComputedStyle(root.querySelector(selector)!);

        const theirRow = box(reference, '.frame-panel-header');
        const ourRow = box(ours, '[data-testid="selection-pane-header"]');
        for (const property of [
          'height',
          'padding-top',
          'padding-right',
          'padding-bottom',
          'padding-left',
          'border-bottom-width',
        ]) {
          expect(ourRow.getPropertyValue(property), property).toBe(
            theirRow.getPropertyValue(property)
          );
        }

        const theirTitle = box(reference, '.all-frames-setting-label');
        const ourTitle = box(ours, '[data-testid="selection-pane-title"]');
        for (const property of [
          'font-family',
          'font-size',
          'font-weight',
          'line-height',
          'color',
        ]) {
          expect(ourTitle.getPropertyValue(property), property).toBe(
            theirTitle.getPropertyValue(property)
          );
        }

        // The pane's own actions, in the frame panel's button.
        for (const id of ['new-layer', 'filter', 'close']) {
          const button = ours.querySelector(
            `[data-testid="selection-pane-${id}"]`
          );
          expect(button?.tagName.toLowerCase(), id).toBe(
            'edgeless-tool-icon-button'
          );
        }
      } finally {
        frameHeader.remove();
      }
    });

    // A narrow editor once dropped the pane's button outright: the toolbar
    // moves a quick tool it has no room for into its "more tools" menu only
    // when the tool declares a menu entry, and the pane's declared none.
    test('at a narrow width the button moves into the more-tools menu and still opens the pane', async () => {
      const container = window.editor.parentElement as HTMLElement;
      container.style.width = '520px';
      try {
        await wait(300);
        await settle();
        expect(toolButton(), 'no room left for the button').toBeNull();

        const toolbarRoot =
          edgeless.widgetComponents['edgeless-toolbar-widget']!.shadowRoot!;
        const more = deepQuery(toolbarRoot, '.quick-tool-more-button');
        expect(more, 'the toolbar shows its more-tools button').toBeTruthy();
        await userEvent.click(page.elementLocator(more!));
        await wait(100);

        const entry = deepQueryAll(document, 'affine-menu-button').find(
          button => button.textContent?.includes('Selection pane')
        );
        expect(entry, 'the more-tools menu offers the pane').toBeTruthy();
        await userEvent.click(page.elementLocator(entry!));
        await settle();

        expect(widget()!.paneOpen).toBe(true);
      } finally {
        container.style.width = '';
      }
    });
  });

  test('a read-only document is listed and refuses every write', async () => {
    const cleanup = await mount();
    try {
      const a = shape(0);
      const b = shape(200);
      await settle();
      edgeless.std.store.readonly = true;
      edgeless.std.get(SelectionPaneProvider).open();
      await settle();

      expect(rowIds()).toEqual([b, a]);
      const lock = inRow(a, '[data-testid="selection-pane-lock"]');
      expect(lock.hasAttribute('disabled')).toBe(true);

      await userEvent.dragAndDrop(
        page.elementLocator(rowOf(a)),
        page.elementLocator(rowOf(b)),
        { targetPosition: { x: 40, y: 3 } }
      );
      await settle();
      expect(rowIds()).toEqual([b, a]);
      expect(model(a).lockedBySelf).toBeFalsy();

      // Selecting is reading: it still works.
      await userEvent.click(page.elementLocator(rowOf(a)));
      await settle();
      expect(gfx().selection.selectedIds).toEqual([a]);
    } finally {
      cleanup();
    }
  });

  test('SelectionPaneExtension(null) removes the button and the command', async () => {
    const cleanup = await mount([SelectionPaneExtension(null)]);
    try {
      await settle();
      expect(edgeless.std.getOptional(SelectionPaneProvider)).toBeFalsy();
      expect(toolButton()).toBeNull();
      const command = [
        ...edgeless.std.provider.getAll(CommandDescriptorIdentifier).values(),
      ].find(c => c.id === 'canvas.selectionPane.toggle')!;
      expect(command).toBeTruthy();
      expect(command.when?.(edgeless.std)).toBe(false);
    } finally {
      cleanup();
    }
  });
});
