/**
 * End-to-end counterpart to
 * `packages/framework/std/src/__tests__/gfx/element-unknown-props.unit.spec.ts`.
 *
 * The unit spec drives `SurfaceBlockModel` directly. This one drives the REAL
 * edgeless clipboard path — `duplicate()` → `prepareCloneData` →
 * `createElementsFromClipboardDataCommand` → `createCanvasElement` →
 * `EdgelessCRUDIdentifier.addElement` (which also runs `applyLastProps`) —
 * which is the gap the US-1.8 spike flagged as untested.
 *
 * `role` stands for any prop written by a newer version of the library: no
 * element class declares it, so the running client must carry it through the
 * copy verbatim rather than silently dropping it.
 *
 * See `docs/spikes/us-1-8-unknown-props-preservation.md`.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { type ShapeElementModel, ShapeType } from '@labre/affine/model';
import type { BlockStdScope } from '@labre/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const ROLE_KEY = 'role';
const ROLE_VALUE = 'wardley:component';

const press = (key: string) =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key,
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );

describe('edgeless clipboard preserves undeclared element props', () => {
  let service!: EdgelessRootBlockComponent['service'];
  let std!: BlockStdScope;

  beforeEach(async () => {
    sessionStorage.removeItem('blocksuite:prop:record');
    const cleanup = await setupEditor('edgeless');
    const edgelessRoot = getDocRootBlock(window.doc, window.editor, 'edgeless');
    service = edgelessRoot.service;
    std = edgelessRoot.std;
    std.event.active = true;
    return cleanup;
  });

  /**
   * A shape carrying a key no element class declares — i.e. the document a
   * newer client would have written.
   */
  function addAnnotatedShape() {
    const id = service.crud.addElement('shape', { shapeType: ShapeType.Rect });
    if (!id) throw new Error('failed to add shape');
    const shape = service.crud.getElementById(id) as ShapeElementModel;

    std.store.transact(() => {
      shape.yMap.set(ROLE_KEY, ROLE_VALUE);
    });

    return shape;
  }

  test('mod+d carries an undeclared prop into the duplicate', async () => {
    const shape = addAnnotatedShape();
    expect(service.surface.getElementsByType('shape').length).toBe(1);

    service.gfx.selection.set({ elements: [shape.id], editing: false });
    press('d');
    await wait(100);

    const shapes = service.surface.getElementsByType('shape');
    expect(shapes.length).toBe(2);

    const clone = shapes.find(el => el.id !== shape.id)!;
    expect(clone.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
    // the original is untouched
    expect(shape.yMap.get(ROLE_KEY)).toBe(ROLE_VALUE);
  });

  test('a duplicate of a plain shape gains no stray keys', async () => {
    const id = service.crud.addElement('shape', { shapeType: ShapeType.Rect });
    if (!id) throw new Error('failed to add shape');
    const shape = service.crud.getElementById(id) as ShapeElementModel;

    service.gfx.selection.set({ elements: [shape.id], editing: false });
    press('d');
    await wait(100);

    const clone = service.surface
      .getElementsByType('shape')
      .find(el => el.id !== shape.id)!;

    // `lockedBySelf` is stamped by the paste path itself
    // (`edgeless/clipboard/canvas.ts`) and is a declared field. Nothing else
    // may appear that the source element did not already carry — in
    // particular no meta key leaking through the new unknown-key passthrough.
    const sourceKeys = Object.keys(shape.yMap.toJSON());
    const extras = Object.keys(clone.yMap.toJSON()).filter(
      key => !sourceKeys.includes(key)
    );
    expect(extras).toEqual(['lockedBySelf']);
  });
});
