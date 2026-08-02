import {
  coreCommands,
  type EdgelessRootBlockComponent,
} from '@labre/affine/blocks/root';
import {
  DefaultTheme,
  type MindmapElementModel,
  type ShapeElementModel,
  ShapeType,
} from '@labre/affine/model';
import { type BlockStdScope, isCommandAvailable } from '@labre/std';
import type { GfxController } from '@labre/std/gfx';
import { afterEach, beforeEach, describe, expect, test } from 'vitest';
import type * as Y from 'yjs';

import { click, drag, wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * Surface-element writes go through `store.transact`. `SurfaceBlockModel`
 * itself throws on readonly, but that is a last-ditch exception raised deep in
 * a gesture — several call sites never reach it (they write `xywh` through
 * `@field()` accessors on the element models, or add blocks instead of
 * elements) and the ones that do reach it surface an uncaught error on
 * `window` rather than a clean refusal.
 *
 * One test per plugged site. Each builds its scene while writable, flips the
 * store to readonly, fires the real gesture, and asserts the DOCUMENT did not
 * move — the drag test reads the raw yMap rather than the model, because the
 * model is exactly the layer a stale cache could lie about.
 *
 * Every test here is meant to go red when its guard is removed; the ones whose
 * assertion covers a different guard than their neighbourhood suggests say so
 * in their own comment.
 */

const press = (
  key: string,
  modifiers: { ctrl?: boolean; shift?: boolean } = {}
) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: modifiers.ctrl ?? false,
      shiftKey: modifiers.shift ?? false,
      bubbles: true,
      cancelable: true,
    })
  );

describe('a readonly document refuses surface writes', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let std!: BlockStdScope;
  let gfx!: GfxController;

  beforeEach(async () => {
    sessionStorage.removeItem('blocksuite:prop:record');
    const cleanup = await setupEditor('edgeless');
    const edgelessRoot = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgelessRoot.service;
    std = edgelessRoot.std;
    gfx = edgelessRoot.gfx;
    // The dispatcher only runs keyDown handlers while active.
    std.event.active = true;
    return cleanup;
  });

  function addShape(shapeType: ShapeType, xywh?: string) {
    const id = gfx.surface!.addElement({ type: 'shape', shapeType, xywh });
    return gfx.getElementById(id) as ShapeElementModel;
  }

  function addMindmap() {
    const id = gfx.surface!.addElement({
      type: 'mindmap',
      children: { text: 'root', children: [{ text: 'leaf' }] },
    });
    return gfx.getElementById(id) as MindmapElementModel;
  }

  /**
   * The stored truth, not the model: `element.xywh` is served by a `@field()`
   * accessor that could in principle be reading a local cache. This reads the
   * Yjs map the document actually round-trips.
   */
  function storedXYWH(id: string) {
    const elements = gfx.surface!.elements.getValue() as Y.Map<
      Y.Map<unknown>
    >;
    return elements.get(id)?.get('xywh') as string | undefined;
  }

  /** Model coordinates → a point the host's pointer helpers understand. */
  function hostPoint(modelX: number, modelY: number) {
    const host = window.editor.host!;
    const rect = host.getBoundingClientRect();
    const [viewX, viewY] = gfx.viewport.toViewCoord(modelX, modelY);
    return {
      x: viewX + gfx.viewport.left - rect.x,
      y: viewY + gfx.viewport.top - rect.y,
    };
  }

  function dragOnCanvas(
    from: [number, number],
    to: [number, number],
    steps = 5
  ) {
    drag(window.editor.host!, hostPoint(...from), hostPoint(...to), steps);
  }

  // ---------------------------------------------------------------- mouse

  test('dragging an element moves nothing — read from the yMap', async () => {
    const rect = addShape(ShapeType.Rect, '[0,0,100,100]');
    await wait();
    expect(storedXYWH(rect.id)).toBe('[0,0,100,100]');

    std.store.readonly = true;
    await wait();

    // Straight through the middle of the shape, 120px down: on an editable
    // board this is the single most common whiteboard write there is.
    dragOnCanvas([50, 50], [50, 170]);
    await wait();

    expect(storedXYWH(rect.id)).toBe('[0,0,100,100]');
    expect(rect.xywh).toBe('[0,0,100,100]');
  });

  test('a drag on a readonly board still rubber-band selects', async () => {
    const rect = addShape(ShapeType.Rect, '[100,100,100,100]');
    await wait();

    std.store.readonly = true;
    await wait();

    // From empty canvas, enclosing the shape: navigation, not mutation.
    dragOnCanvas([-40, -40], [400, 400]);
    await wait();

    expect(gfx.selection.selectedIds).toContain(rect.id);
    expect(storedXYWH(rect.id)).toBe('[100,100,100,100]');
  });

  test('the selected rect drops its resize handles when the board turns readonly', async () => {
    const rect = addShape(ShapeType.Rect, '[0,0,100,100]');
    gfx.selection.set({ elements: [rect.id], editing: false });
    await wait();

    const widget = document.querySelector('edgeless-selected-rect');
    const countHandles = () =>
      (widget?.shadowRoot ?? widget)?.querySelectorAll('.handle').length ?? 0;

    // Selected while writable: the 8 handles are there, which is what makes
    // the assertion below meaningful.
    expect(countHandles()).toBe(8);

    std.store.readonly = true;
    await wait();

    expect(countHandles()).toBe(0);
  });

  // ------------------------------------------------------------- keyboard

  /**
   * Every creation tool a keystroke can arm, with the tool name it arms.
   * `s` is the important one: it is NOT bound by
   * `EdgelessPageKeyboardManager`. `shape-draggable.ts` binds it globally onto
   * the toolbar mixin, which exposes `ToolController.setTool` directly — which
   * is why the guard sits on the controller and not on any keyboard manager.
   *
   * `Shift-p` (highlighter) is absent on purpose: with a synthetic
   * `KeyboardEvent` the keymap's no-shift fallback re-runs the plain `p`
   * handler and arms the brush instead, so the control below could not hold.
   * A harness limitation, not a gap in the guard — `HighlighterTool` goes
   * through the same `setTool` bottleneck as every other tool here.
   */
  const CREATION_SHORTCUTS = [
    ['p', {}, 'brush'],
    ['c', {}, 'connector'],
    ['t', {}, 'text'],
    ['n', {}, 'affine:note'],
    ['f', {}, 'frame'],
    ['e', {}, 'eraser'],
    ['s', {}, 'shape'],
  ] as const;

  test('creation-tool shortcuts arm nothing and raise nothing on window', async () => {
    // Control first, on a writable board — and it doubles as the proof that
    // every key below is really wired in this harness. Without it, a shortcut
    // that simply never fires would make the readonly assertions vacuous.
    for (const [key, modifiers, toolName] of CREATION_SHORTCUTS) {
      press(key, modifiers);
      await wait();
      expect(gfx.tool.currentToolName$.peek()).toBe(toolName);
      press('v');
      await wait();
    }

    const errors: string[] = [];
    const onError = (e: ErrorEvent) => errors.push(String(e.message));
    const onRejection = (e: PromiseRejectionEvent) =>
      errors.push(String(e.reason));
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    const before = gfx.surface!.elementModels.length;
    std.store.readonly = true;
    await wait();

    for (const [key, modifiers] of CREATION_SHORTCUTS) {
      press(key, modifiers);
      await wait();
      // Each of these tools writes on its FIRST drag, straight through
      // `surface.addElement` / `store.addBlock` — outside the crud layer.
      dragOnCanvas([10, 10], [200, 200]);
      await wait();
      expect(gfx.tool.currentToolName$.peek()).toBe('default');
    }

    window.removeEventListener('error', onError);
    window.removeEventListener('unhandledrejection', onRejection);

    expect(errors).toEqual([]);
    expect(gfx.surface!.elementModels.length).toBe(before);
  });

  test('navigation-tool shortcuts still switch tools on a readonly board', async () => {
    std.store.readonly = true;
    await wait();

    press('h');
    await wait();
    expect(gfx.tool.currentToolName$.peek()).toBe('pan');

    press('v');
    await wait();
    expect(gfx.tool.currentToolName$.peek()).toBe('default');
  });

  test('mod+y (apply last style) repaints nothing — and falls through', async () => {
    const rect = addShape(ShapeType.Rect);
    const ellipse = addShape(ShapeType.Ellipse);
    service.crud.updateElement(rect.id, {
      fillColor: DefaultTheme.FillColorShortMap.Orange,
    });
    const before = ellipse.fillColor;
    expect(before).not.toBe(DefaultTheme.FillColorShortMap.Orange);

    gfx.selection.set({ elements: [ellipse.id], editing: false });
    const applyLastStyle = coreCommands.find(c => c.id === 'applyLastStyle')!;
    // Writable: the gesture has work to do, so the shortcut CONSUMES Mod+Y.
    // Without this control the assertion below would hold for a scene where
    // there was simply nothing to repaint.
    expect(
      isCommandAvailable(std, applyLastStyle) &&
        applyLastStyle.when!(std) === true
    ).toBe(true);

    std.store.readonly = true;
    press('y', { ctrl: true });
    await wait();

    expect(ellipse.fillColor).toBe(before);
    // The distinct guarantee of the `lastStyleTargets` guard, which the "no
    // repaint" assertion above cannot see (crud would refuse anyway): `when`
    // goes false, so the keystroke is NOT consumed and stays available to the
    // `redo-windows` alias that shares Mod+Y on Windows.
    expect(applyLastStyle.when!(std)).toBe(false);
  });

  test('arrow keys move nothing', async () => {
    const rect = addShape(ShapeType.Rect);
    const before = rect.xywh;

    gfx.selection.set({ elements: [rect.id], editing: false });
    std.store.readonly = true;
    press('ArrowRight');
    press('ArrowDown', { shift: true });
    await wait();

    expect(rect.xywh).toBe(before);
  });

  test('backspace deletes nothing', async () => {
    const rect = addShape(ShapeType.Rect);

    gfx.selection.set({ elements: [rect.id], editing: false });
    std.store.readonly = true;
    press('Backspace');
    await wait();

    expect(gfx.getElementById(rect.id)).not.toBeNull();
  });

  test('typing on a mindmap node rewrites nothing', async () => {
    const mindmap = addMindmap();
    await wait();
    const node = mindmap.tree.element as ShapeElementModel;
    const before = node.text!.toString();

    gfx.selection.set({ elements: [node.id], editing: false });
    std.store.readonly = true;
    // 'a' goes through the generic keyDown listener, 'v' through the wrapped
    // single-letter hotkeys — two distinct write sites, both plugged.
    press('a');
    press('v');
    await wait();

    expect(node.text!.toString()).toBe(before);
  });

  test('enter and tab on a mindmap node add no node', async () => {
    const mindmap = addMindmap();
    await wait();
    const count = gfx.surface!.elementModels.length;

    gfx.selection.set({ elements: [mindmap.tree.element.id], editing: false });
    std.store.readonly = true;
    press('Enter');
    press('Tab');
    await wait();

    expect(gfx.surface!.elementModels.length).toBe(count);
  });

  test('mod+g groups nothing — and orphans nothing out of a parent group', async () => {
    // The elements MUST already live in a parent group, otherwise
    // `createGroupFromSelectedCommand` takes the `parent === null` branch and
    // the `removeChild` calls this test exists for never run.
    const a = addShape(ShapeType.Rect);
    const b = addShape(ShapeType.Ellipse);
    const parentId = gfx.surface!.addElement({
      type: 'group',
      children: { [a.id]: true, [b.id]: true },
    });
    await wait();
    expect(a.group?.id).toBe(parentId);

    gfx.selection.set({ elements: [a.id, b.id], editing: false });
    std.store.readonly = true;
    press('g', { ctrl: true });
    await wait();

    // No new group…
    expect(service.surface.getElementsByType('group').length).toBe(1);
    // …and, more importantly, the two children are still in the old one.
    // Without the guard, `parent.removeChild` runs, `crud.addElement` then
    // refuses, and both elements come out orphaned.
    expect(a.group?.id).toBe(parentId);
    expect(b.group?.id).toBe(parentId);
  });

  test('shift+mod+g ungroups nothing', async () => {
    const a = addShape(ShapeType.Rect);
    const b = addShape(ShapeType.Ellipse);
    const groupId = gfx.surface!.addElement({
      type: 'group',
      children: { [a.id]: true, [b.id]: true },
    });
    await wait();

    gfx.selection.set({ elements: [groupId], editing: false });
    std.store.readonly = true;
    press('g', { ctrl: true, shift: true });
    await wait();

    expect(gfx.getElementById(groupId)).not.toBeNull();
    expect(a.group?.id).toBe(groupId);
  });

  // ------------------------------------------------------------------ API

  test('the crud layer itself refuses every write', async () => {
    const rect = addShape(ShapeType.Rect);
    const before = rect.fillColor;
    std.store.readonly = true;

    service.crud.updateElement(rect.id, {
      fillColor: DefaultTheme.FillColorShortMap.Orange,
    });
    expect(rect.fillColor).toBe(before);

    expect(service.crud.addElement('shape', {})).toBeUndefined();

    service.crud.deleteElements([rect]);
    service.crud.removeElement(rect.id);
    expect(gfx.getElementById(rect.id)).not.toBeNull();
  });

  test('the service exposes a parallel element API, guarded the same way', async () => {
    const rect = addShape(ShapeType.Rect);
    const index = rect.index;
    std.store.readonly = true;

    service.removeElement(rect.id);
    service.reorderElement(rect, 'front');

    expect(gfx.getElementById(rect.id)).not.toBeNull();
    expect(rect.index).toBe(index);
  });

  test('a drag attempted DURING readonly leaves nothing broken behind', async () => {
    // The case the plain on → off cycle below misses: the refusal must not
    // leave the tool holding half-initialized drag state. A short-circuit in
    // `DefaultTool.dragStart` did exactly that — once readonly was lifted the
    // board no longer selected on click, and no longer moved on drag.
    const rect = addShape(ShapeType.Rect, '[0,0,100,100]');
    await wait();

    std.store.readonly = true;
    await wait();
    dragOnCanvas([50, 50], [50, 170]);
    await wait();
    expect(storedXYWH(rect.id)).toBe('[0,0,100,100]');

    std.store.readonly = false;
    await wait();

    // The FIRST click must select — the reported symptom was that it took two.
    click(window.editor.host!, hostPoint(50, 50));
    await wait();
    expect(gfx.selection.selectedIds).toContain(rect.id);

    // …and the same gesture that was refused a moment ago must now move it.
    dragOnCanvas([50, 50], [50, 170]);
    await wait();
    expect(storedXYWH(rect.id)).toBe('[0,120,100,100]');
  });

  test('readonly on → off gives the whole document back', async () => {
    const rect = addShape(ShapeType.Rect, '[0,0,100,100]');
    gfx.selection.set({ elements: [rect.id], editing: false });
    await wait();

    std.store.readonly = true;
    await wait();
    service.crud.updateElement(rect.id, {
      fillColor: DefaultTheme.FillColorShortMap.Orange,
    });
    expect(rect.fillColor).not.toBe(DefaultTheme.FillColorShortMap.Orange);

    std.store.readonly = false;
    await wait();

    // crud writes again…
    service.crud.updateElement(rect.id, {
      fillColor: DefaultTheme.FillColorShortMap.Orange,
    });
    expect(rect.fillColor).toBe(DefaultTheme.FillColorShortMap.Orange);

    // …the handles are back…
    const widget = document.querySelector('edgeless-selected-rect');
    expect(
      (widget?.shadowRoot ?? widget)?.querySelectorAll('.handle').length
    ).toBe(8);

    // …tools arm again…
    press('p');
    await wait();
    expect(gfx.tool.currentToolName$.peek()).toBe('brush');
    press('v');
    await wait();

    // …and the mouse moves elements again.
    gfx.selection.set({ elements: [rect.id], editing: false });
    await wait();
    dragOnCanvas([50, 50], [50, 170]);
    await wait();
    expect(storedXYWH(rect.id)).not.toBe('[0,0,100,100]');

    // Adding elements works too.
    expect(service.crud.addElement('shape', {})).toBeTypeOf('string');
  });

  afterEach(() => {
    std.store.readonly = false;
  });
});
