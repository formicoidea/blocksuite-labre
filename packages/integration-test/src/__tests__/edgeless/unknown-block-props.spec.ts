/**
 * ADR 0031, stage 1 — the clipboard half of the layer-format guards (the
 * snapshot half is `packages/affine/all/src/__tests__/canvas-layers-format-guards.unit.spec.ts`).
 *
 * User layers store `layer` / `hiddenForEveryone` as optional `prop:` keys on
 * every gfx block, and the layer list as a `prop:` on `affine:surface`. A
 * client that predates those fields must not lose them when the user copies
 * what they are attached to. Driven through the REAL edgeless duplicate
 * (`mod+d`: `prepareCloneData` → block snapshot → `createElementsFromClipboardData`),
 * because that is the path a user takes and the one a unit stub would skip.
 *
 * - a gfx block created with a key no schema declares (exactly what a newer
 *   client's document looks like once loaded) hands that key to its duplicate;
 * - the surface's own unknown key is untouched by a paste onto it: the
 *   clipboard writes elements INTO the surface and never rewrites its props.
 *
 * Same probe-naming rule as `unknown-element-props.spec.ts`.
 */
import type { EdgelessRootBlockComponent } from '@labre/affine/blocks/root';
import { ShapeType } from '@labre/affine/model';
import type { BlockStdScope } from '@labre/std';
import { beforeEach, describe, expect, test } from 'vitest';

import { wait } from '../utils/common.js';
import { getDocRootBlock } from '../utils/edgeless.js';
import { setupEditor } from '../utils/setup.js';

const PROBE_KEY = 'x-labre-unknown-probe';
const PROBE_VALUE = 'from-a-newer-client';

const pressModD = () =>
  document.dispatchEvent(
    new KeyboardEvent('keydown', {
      key: 'd',
      ctrlKey: true,
      bubbles: true,
      cancelable: true,
    })
  );

describe('edgeless clipboard preserves undeclared block props', () => {
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

  test('mod+d carries a note’s undeclared prop into the duplicate', async () => {
    const store = std.store;
    const noteId = store.addBlock(
      'affine:note',
      { xywh: '[0,0,400,100]', [PROBE_KEY]: PROBE_VALUE },
      store.root!.id
    );
    expect(store.getBlock(noteId)!.model.yBlock.get(`prop:${PROBE_KEY}`)).toBe(
      PROBE_VALUE
    );

    service.gfx.selection.set({ elements: [noteId], editing: false });
    pressModD();
    await wait(100);

    const notes = store.getModelsByFlavour('affine:note');
    const clone = notes.find(
      note =>
        note.id !== noteId &&
        (note as unknown as { xywh: string }).xywh !== undefined &&
        note.yBlock.has(`prop:${PROBE_KEY}`)
    );
    expect(clone).toBeDefined();
    expect(clone!.yBlock.get(`prop:${PROBE_KEY}`)).toBe(PROBE_VALUE);
  });

  test('a paste leaves the surface’s undeclared prop untouched', async () => {
    const surface = service.surface;
    std.store.transact(() => {
      surface.yBlock.set(`prop:${PROBE_KEY}`, PROBE_VALUE);
    });

    const id = service.crud.addElement('shape', { shapeType: ShapeType.Rect });
    if (!id) throw new Error('failed to add shape');
    service.gfx.selection.set({ elements: [id], editing: false });
    pressModD();
    await wait(100);

    expect(surface.getElementsByType('shape')).toHaveLength(2);
    expect(surface.yBlock.get(`prop:${PROBE_KEY}`)).toBe(PROBE_VALUE);
  });
});
