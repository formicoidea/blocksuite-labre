/**
 * ADR 0031 §8 — the per-editor local-visibility hook on `GfxController`.
 *
 * A viewer may hide elements on their own screen. `std` does not know why; it
 * only answers "does this viewer see that model?" where a viewer's eye and
 * hand reach the canvas. This spec pins where the answer is asked and, as
 * importantly, where it is NOT:
 *
 * - pointer picking (`getElementByPoint`) skips a hidden model;
 * - a member of a hidden GROUP is hidden with it; a frame is not walked;
 * - `grid.search` and `getElementsByBound` keep it — rules, legends and
 *   semantic exports read those, and one viewer's hide must never change what
 *   another viewer's rules say about the same document;
 * - with nothing registered, every answer is `false`.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { signal } from '@preact/signals-core';
import { afterEach, describe, expect, test } from 'vitest';

import { effects } from '../../effects.js';
import { GfxControllerIdentifier } from '../../gfx/identifiers.js';
import { TestEditorContainer } from '../test-editor.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
  TestGfxBlockSchemaExtension,
} from '../test-schema.js';
import { testSpecs } from '../test-spec.js';

effects();

const extensions = [
  RootBlockSchemaExtension,
  SurfaceBlockSchemaExtension,
  TestGfxBlockSchemaExtension,
];

async function setup() {
  const collection = new TestWorkspace({
    id: 'local-visibility',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const doc = collection.createDoc('home');
  const store = doc.getStore({ extensions });
  doc.load();
  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;

  const editor = new TestEditorContainer();
  editor.doc = store;
  editor.specs = testSpecs;
  document.body.append(editor);
  await editor.updateComplete;

  return { gfx: editor.std.get(GfxControllerIdentifier), surface };
}

afterEach(() => {
  document.body.innerHTML = '';
});

describe('gfx.localVisibility', () => {
  test('nothing registered: nothing is hidden', async () => {
    const { gfx, surface } = await setup();
    const id = surface.addElement({ type: 'testShape', xywh: '[0,0,10,10]' });

    expect(gfx.localVisibility.isHidden(gfx.getElementById(id)! as never)).toBe(
      false
    );
    expect(gfx.getElementByPoint(5, 5)?.id).toBe(id);
  });

  test('a hidden model is not picked, but still searched', async () => {
    const { gfx, surface } = await setup();
    const id = surface.addElement({ type: 'testShape', xywh: '[0,0,10,10]' });
    const hidden = signal<ReadonlySet<string>>(new Set([id]));
    gfx.localVisibility.register(hidden);

    expect(gfx.getElementByPoint(5, 5)).toBeNull();
    expect(gfx.getElementByPoint(5, 5, { all: true })).toEqual([]);
    // Logic keeps it: hiding is not deleting.
    expect(
      gfx.grid.search({ x: 0, y: 0, w: 10, h: 10 }).map(m => m.id)
    ).toContain(id);
    expect(
      gfx.getElementsByBound({ x: 0, y: 0, w: 10, h: 10 }).map(m => m.id)
    ).toContain(id);

    hidden.value = new Set();
    expect(gfx.getElementByPoint(5, 5)?.id).toBe(id);
  });

  test('a member of a hidden group is hidden with it', async () => {
    const { gfx, surface } = await setup();
    const a = surface.addElement({ type: 'testShape', xywh: '[0,0,10,10]' });
    const group = surface.addElement({
      type: 'testGroup',
      children: { [a]: true },
    });
    gfx.localVisibility.register(signal(new Set([group])));

    expect(gfx.localVisibility.isHidden(gfx.getElementById(a)! as never)).toBe(
      true
    );
    expect(gfx.getElementByPoint(5, 5)).toBeNull();
  });

  test('sources unite, and a disposed source stops counting', async () => {
    const { gfx, surface } = await setup();
    const a = surface.addElement({ type: 'testShape', xywh: '[0,0,10,10]' });
    const b = surface.addElement({ type: 'testShape', xywh: '[20,0,10,10]' });
    gfx.localVisibility.register(signal(new Set([a])));
    const dispose = gfx.localVisibility.register(signal(new Set([b])));

    expect([...gfx.localVisibility.hiddenIds$.value].sort()).toEqual(
      [a, b].sort()
    );
    dispose();
    expect([...gfx.localVisibility.hiddenIds$.value]).toEqual([a]);
  });
});
