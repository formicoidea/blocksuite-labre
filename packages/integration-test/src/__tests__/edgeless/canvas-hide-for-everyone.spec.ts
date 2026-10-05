/**
 * "Hide for everyone" (ADR 0031, stage 5) on a real editor, through the
 * pane's row menu and a real mouse.
 *
 * Unlike the local hide, this one is written to the document and synced. What
 * only a mounted editor can answer, and this spec checks:
 *
 * - the row's "more" menu offers "Hide for everyone", painted with the theme
 *   warning token; choosing it stores `hiddenForEveryone`, the element is no
 *   longer picked, the row stays listed and marked, and one undo brings it
 *   back;
 * - the rules' view (`getElementsByBound`) and the board SVG export disagree on
 *   purpose: the first still counts it, the second leaves it out (§9);
 * - a second client receiving the update has the key; a peer's unhide reaching
 *   this client makes the element pickable again;
 * - mindmap collapse keeps its own `hidden`: collapsing and expanding a branch
 *   never unhides a node hidden for everyone;
 * - a read-only document offers no such entry.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { renderBoardSvg } from '@labre/affine/blocks/surface';
import {
  FrameworkBackgroundElementModel,
  type MindmapElementModel,
  ShapeType,
} from '@labre/affine/model';
import { SelectionPaneProvider } from '@labre/affine/shared/services';
import {
  type GfxModel,
  isStoredHiddenForEveryone,
} from '@labre/affine/std/gfx';
import { WARDLEY_BACKGROUND, WARDLEY_ROLE } from '@labre/affine-gfx-wardley';
import { Bound } from '@labre/global/gfx';
import { page, userEvent } from '@vitest/browser/context';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { wait } from '../utils/common.js';
import { addNote, getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const PANE_WIDGET = 'edgeless-selection-pane-widget';
const ROW = '[data-testid="selection-pane-row"]';
const ENTRY = '[data-testid="selection-pane-hide-for-everyone"]';

/** Every element matching `selector`, through every open shadow root. */
function deepQueryAll(root: ParentNode, selector: string): HTMLElement[] {
  const found = Array.from(root.querySelectorAll<HTMLElement>(selector));
  for (const element of root.querySelectorAll('*')) {
    if (element.shadowRoot)
      found.push(...deepQueryAll(element.shadowRoot, selector));
  }
  return found;
}

describe('hide for everyone', () => {
  let edgeless!: EdgelessRootBlockComponent;

  beforeEach(async () => {
    const cleanup = await setupEditor('edgeless');
    edgeless = getDocRootBlock(window.doc, window.editor, 'edgeless');
    edgeless.std.event.active = true;
    return cleanup;
  });

  const gfx = () => edgeless.service.gfx;
  const model = (id: string) => gfx().getElementById(id) as GfxModel;
  const widget = () => edgeless.widgetComponents[PANE_WIDGET];
  const rowOf = (id: string) =>
    Array.from(
      widget()?.shadowRoot?.querySelectorAll<HTMLElement>(ROW) ?? []
    ).find(row => row.dataset.id === id)!;
  const moreOf = (id: string) =>
    rowOf(id)?.querySelector<HTMLElement>(
      '[data-testid="selection-pane-more"]'
    );

  const settle = async () => {
    await edgeless.updateComplete;
    await widget()?.updateComplete;
    await wait(50);
  };

  const shape = (x: number) =>
    edgeless.service.crud.addElement('shape', {
      shapeType: ShapeType.Rect,
      xywh: `[${x},0,100,100]`,
    })!;

  const openPane = async () => {
    edgeless.std.get(SelectionPaneProvider).open();
    await settle();
  };

  /** Open the row's menu with the real mouse and pick the entry. */
  const hideFromPane = async (id: string) => {
    await userEvent.hover(page.elementLocator(rowOf(id)));
    await userEvent.click(page.elementLocator(moreOf(id)!));
    await wait(100);
    const entry = deepQueryAll(document, ENTRY)[0];
    expect(entry, 'the row menu offers the entry').toBeTruthy();
    // The theme warning token, not the default text colour.
    const text = entry.shadowRoot?.querySelector('.affine-menu-action-text');
    const warning = getComputedStyle(document.documentElement)
      .getPropertyValue('--affine-warning-color')
      .trim();
    expect(warning).not.toBe('');
    expect(
      getComputedStyle((text ?? entry) as Element).color.replace(/\s/g, '')
    ).toBe(colourOf(warning));
    await userEvent.click(page.elementLocator(entry));
    await settle();
  };

  /** A CSS colour as `getComputedStyle` writes it. */
  const colourOf = (value: string) => {
    const probe = document.createElement('span');
    probe.style.color = value;
    document.body.append(probe);
    const colour = getComputedStyle(probe).color.replace(/\s/g, '');
    probe.remove();
    return colour;
  };

  test('the row menu hides for everyone; one undo brings it back', async () => {
    const a = shape(0);
    const b = shape(200);
    await settle();
    await openPane();
    edgeless.std.store.captureSync();

    await hideFromPane(a);

    expect(
      (model(a) as unknown as { yMap: Y.Map<unknown> }).yMap.get(
        'hiddenForEveryone'
      )
    ).toBe(true);
    expect(gfx().getElementByPoint(50, 50)).toBeNull();
    expect(gfx().getElementByPoint(250, 50)?.id).toBe(b);
    expect(rowOf(a).hasAttribute('data-hidden-everyone')).toBe(true);
    // Hiding is not deleting: the rules' view still holds it.
    expect(
      gfx()
        .getElementsByBound(new Bound(0, 0, 100, 100))
        .map(m => m.id)
    ).toContain(a);

    edgeless.std.store.undo();
    await settle();
    expect(isStoredHiddenForEveryone(model(a))).toBe(false);
    expect(gfx().getElementByPoint(50, 50)?.id).toBe(a);
  });

  test('a note hidden for everyone is hidden by its own view', async () => {
    const noteId = addNote(window.doc, { xywh: '[0,300,400,100]' });
    await settle();
    await openPane();

    await hideFromPane(noteId);

    const view = edgeless.std.view.getBlock(noteId)!;
    expect(view.style.visibility).toBe('hidden');
    expect(view.style.pointerEvents).toBe('none');
    expect(
      window.doc.getBlock(noteId)!.model.yBlock.get('prop:hiddenForEveryone')
    ).toBe(true);
  });

  test('the board SVG export leaves it out', async () => {
    const surface = edgeless.service.surface;
    const map = surface.addElement({
      type: WARDLEY_BACKGROUND.type,
      role: WARDLEY_BACKGROUND.role,
      xywh: new Bound(0, 0, 1600, 900).serialize(),
    });
    const label = surface.addElement({
      type: 'text',
      text: 'Alpha',
      role: WARDLEY_ROLE.label,
      xywh: new Bound(400, 400, 120, 26).serialize(),
    });
    await settle();
    const board = surface.getElementById(
      map
    ) as FrameworkBackgroundElementModel;
    expect(board).toBeInstanceOf(FrameworkBackgroundElementModel);
    const texts = () =>
      [
        ...new DOMParser()
          .parseFromString(
            renderBoardSvg(edgeless.std, board).svg,
            'image/svg+xml'
          )
          .querySelectorAll('text'),
      ].map(node => node.textContent ?? '');
    expect(texts().some(text => text.includes('Alpha'))).toBe(true);

    await openPane();
    await hideFromPane(label);

    expect(texts().some(text => text.includes('Alpha'))).toBe(false);
  });

  test('a second client has it; a peer’s unhide reaches this one', async () => {
    const a = shape(0);
    await settle();
    const space = window.doc.doc.spaceDoc;
    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(space));
    space.on('update', (update: Uint8Array, origin: unknown) => {
      if (origin !== 'peer') Y.applyUpdate(peer, update, 'author');
    });
    // `prop:elements` is a boxed Y.Map: the elements live under `value`.
    const peerElement = () =>
      (
        (
          peer
            .getMap<Y.Map<unknown>>('blocks')
            .get(edgeless.service.surface.id)!
            .get('prop:elements') as Y.Map<unknown>
        ).get('value') as Y.Map<Y.Map<unknown>>
      ).get(a)!;

    await openPane();
    await hideFromPane(a);
    expect(peerElement().get('hiddenForEveryone')).toBe(true);

    const before = Y.encodeStateVector(peer);
    peerElement().delete('hiddenForEveryone');
    Y.applyUpdate(space, Y.encodeStateAsUpdate(peer, before), 'peer');
    await settle();

    expect(isStoredHiddenForEveryone(model(a))).toBe(false);
    expect(gfx().getElementByPoint(50, 50)?.id).toBe(a);
    expect(rowOf(a).hasAttribute('data-hidden-everyone')).toBe(false);
  });

  test('collapsing and expanding a mindmap branch never unhides it', async () => {
    const mindmapId = edgeless.service.surface.addElement({
      type: 'mindmap',
      children: {
        text: 'root',
        children: [{ text: 'branch', children: [{ text: 'leaf' }] }],
      },
    });
    await settle();
    const mindmap = () =>
      gfx().getElementById(mindmapId) as unknown as MindmapElementModel;
    // Read afresh each time: the tree is rebuilt when a node's detail changes.
    const branch = () => mindmap().tree.children[0];
    const leaf = branch().children[0].element;

    await openPane();
    // The pane nests mindmap nodes under the mindmap row.
    await hideFromPane(leaf.id);
    expect(leaf.hiddenForEveryone).toBe(true);

    mindmap().toggleCollapse(branch());
    await settle();
    expect(leaf.hidden).toBe(true);
    mindmap().toggleCollapse(branch());
    await settle();

    // Collapse owns `hidden` and gave it back; the shared hide is untouched.
    expect(leaf.hidden).toBe(false);
    expect(leaf.hiddenForEveryone).toBe(true);
    expect(gfx().localVisibility.isHidden(leaf)).toBe(true);
  });

  test('a read-only document offers no such entry', async () => {
    const a = shape(0);
    await settle();
    edgeless.std.store.readonly = true;
    await openPane();

    expect(moreOf(a)).toBeNull();
    rowOf(a).dispatchEvent(
      new MouseEvent('contextmenu', { bubbles: true, cancelable: true })
    );
    await wait(100);
    expect(deepQueryAll(document, ENTRY)).toHaveLength(0);
  });
});
