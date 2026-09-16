/**
 * An element whose `xywh` key is ABSENT from the document.
 *
 * It is not a hypothesis: a Yjs state with pending structs delivers an element
 * Y.Map before the update that carries some of its keys, and `xywh` can be one
 * of them. Nothing ever writes the initializer again — it is only run at
 * creation — so the element is left with no bound at all, for good.
 *
 * Before this spec, that cost two `console.error` per READ of
 * `deserializedXYWH` / `elementBound` (`JSON.parse(undefined)`), i.e. thousands
 * of lines a second on a canvas that repaints. The contract here is the
 * opposite: the element reads `[0,0,0,0]` — a bound that draws NOTHING, rather
 * than a phantom shape at the origin sitting over real content — the surface
 * says so exactly once, at mount, and the render path stays silent.
 *
 * The key is removed straight from the Y.Map, on purpose: `clearField` refuses
 * `xywh` (see `element-clear-field.unit.spec.ts`) and must keep refusing it —
 * a read fallback is damage control, not permission to erase a bound.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import { applyUpdate, encodeStateAsUpdate } from 'yjs';

import { effects } from '../../effects.js';
import type { GfxPrimitiveElementModel } from '../../gfx/index.js';
import type { TestShapeElement } from '../test-gfx-element.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';

effects();

const extensions = [RootBlockSchemaExtension, SurfaceBlockSchemaExtension];

const workspaceOptions = () => ({
  id: 'missing-xywh',
  idGenerator: createAutoIncrementIdGenerator(),
});

function setupSurface() {
  const workspace = new TestWorkspace(workspaceOptions());
  workspace.meta.initialize();
  const doc = workspace.createDoc('home');
  const store = doc.getStore({ extensions });
  doc.load();

  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);

  return {
    workspace,
    surfaceId,
    surface: store.getBlock(surfaceId)!.model as SurfaceBlockModel,
  };
}

/**
 * Re-reads the SAME document on a second peer, the way opening the file again
 * does: the element models there are built from the Y.Maps alone, with no
 * `_preserved` copy of what the initializers once wrote.
 */
function reopen(workspace: TestWorkspace, surfaceId: string) {
  const reader = new TestWorkspace(workspaceOptions());
  applyUpdate(reader.doc, encodeStateAsUpdate(workspace.doc));

  const readerDoc = reader.getDoc('home')!;
  applyUpdate(
    readerDoc.spaceDoc,
    encodeStateAsUpdate(workspace.getDoc('home')!.spaceDoc),
    'remote-peer'
  );

  const store = readerDoc.getStore({ extensions });
  readerDoc.load();

  return store.getBlock(surfaceId)!.model as SurfaceBlockModel;
}

/** Removes the key the way a never-delivered update leaves the document. */
function dropXYWH(
  surface: SurfaceBlockModel,
  element: GfxPrimitiveElementModel
) {
  surface.store.transact(() => {
    element.yMap.delete('xywh');
  });
  expect(element.yMap.has('xywh')).toBe(false);
}

describe('an element whose xywh is missing from the document', () => {
  let workspace!: TestWorkspace;
  let surfaceId!: string;
  let surface!: SurfaceBlockModel;
  let element!: TestShapeElement;

  beforeEach(() => {
    ({ workspace, surfaceId, surface } = setupSurface());
    const id = surface.addElement({ type: 'testShape' });
    element = surface.getElementById(id)! as TestShapeElement;
  });

  test('reads a zero-size bound instead of undefined', () => {
    dropXYWH(surface, element);

    expect(element.xywh).toBe('[0,0,0,0]');
    expect(element.deserializedXYWH).toEqual([0, 0, 0, 0]);
    expect(element.elementBound.w).toBe(0);
    expect(element.elementBound.h).toBe(0);
  });

  test('never floods the console on the render path', () => {
    dropXYWH(surface, element);

    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    // A hundred frames' worth of reads, the shape of the original defect.
    for (let i = 0; i < 100; i++) {
      expect(element.deserializedXYWH).toEqual([0, 0, 0, 0]);
      expect(element.elementBound.w).toBe(0);
    }

    expect(error).not.toHaveBeenCalled();
  });

  test('is reported exactly once when the document is opened', () => {
    dropXYWH(surface, element);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reopened = reopen(workspace, surfaceId);
    const reloaded = reopened.getElementById(element.id)!;

    const reports = warn.mock.calls.filter(([message]) =>
      String(message).includes(element.id)
    );
    expect(reports).toHaveLength(1);
    expect(String(reports[0][0])).toContain('testShape');
    expect(String(reports[0][0])).toContain('no xywh');

    // And the reloaded element — the one with no `_preserved` fallback at all —
    // still reads a usable, empty bound.
    expect(reloaded.xywh).toBe('[0,0,0,0]');
    expect(reloaded.deserializedXYWH).toEqual([0, 0, 0, 0]);
  });

  test('says nothing about a healthy document', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reopen(workspace, surfaceId);

    expect(warn).not.toHaveBeenCalled();
  });

  test('says nothing about a group, whose xywh is derived, not stored', () => {
    const groupId = surface.addElement({
      type: 'testGroup',
      children: { [element.id]: true },
    });
    const group = surface.getElementById(groupId)!;
    // A group stores no bound of its own: nothing to miss.
    expect(group.yMap.has('xywh')).toBe(false);

    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    reopen(workspace, surfaceId);

    const reports = warn.mock.calls.filter(([message]) =>
      String(message).includes(groupId)
    );
    expect(reports).toHaveLength(0);
  });
});
