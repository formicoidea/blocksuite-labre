import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import {
  DefaultTheme,
  type MindmapElementModel,
  type ShapeElementModel,
  ShapeType,
} from '@labre/affine/model';
import type { BlockStdScope } from '@labre/std';
import type { GfxController } from '@labre/std/gfx';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

/**
 * `store.transact` has no readonly guard, so every keyboard gesture that
 * writes surface elements has to refuse on its own. One test per plugged
 * site; each builds its scene while writable, flips the store to readonly,
 * fires the gesture, and asserts the document did not move.
 */

const press = (key: string, modifiers: { ctrl?: boolean; shift?: boolean } = {}) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: modifiers.ctrl ?? false,
      shiftKey: modifiers.shift ?? false,
      bubbles: true,
      cancelable: true,
    })
  );

describe('a readonly document refuses surface writes from the keyboard', () => {
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

  function addShape(shapeType: ShapeType) {
    const id = gfx.surface!.addElement({ type: 'shape', shapeType });
    return gfx.getElementById(id) as ShapeElementModel;
  }

  function addMindmap() {
    const id = gfx.surface!.addElement({
      type: 'mindmap',
      children: { text: 'root', children: [{ text: 'leaf' }] },
    });
    return gfx.getElementById(id) as MindmapElementModel;
  }

  test('mod+y (apply last style) repaints nothing', async () => {
    const rect = addShape(ShapeType.Rect);
    const ellipse = addShape(ShapeType.Ellipse);
    service.crud.updateElement(rect.id, {
      fillColor: DefaultTheme.FillColorShortMap.Orange,
    });
    const before = ellipse.fillColor;
    expect(before).not.toBe(DefaultTheme.FillColorShortMap.Orange);

    gfx.selection.set({ elements: [ellipse.id], editing: false });
    std.store.readonly = true;
    press('y', { ctrl: true });
    await wait();

    expect(ellipse.fillColor).toBe(before);
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

  test('mod+g groups nothing — and orphans nothing', async () => {
    const a = addShape(ShapeType.Rect);
    const b = addShape(ShapeType.Ellipse);

    gfx.selection.set({ elements: [a.id, b.id], editing: false });
    std.store.readonly = true;
    press('g', { ctrl: true });
    await wait();

    expect(service.surface.getElementsByType('group').length).toBe(0);
    expect(a.group).toBeNull();
    expect(b.group).toBeNull();
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
});
