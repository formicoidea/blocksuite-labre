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
import { applyUpdate, encodeStateAsUpdate, Map as YMap } from 'yjs';

import { effects } from '../../effects.js';
import type {
  GfxPrimitiveElementModel,
  SurfaceElementDamageReport,
} from '../../gfx/index.js';
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

/**
 * The console line is for a developer looking at a browser. The map and the
 * subject below are the same fact made COUNTABLE: the host's telemetry adapter
 * reads them and reports how many documents open damaged (#318).
 *
 * The map is what makes it work at all. Element models are built when the
 * BLOCK MODEL is created, before any view or watcher exists, so the elements a
 * document opens with are damaged before anyone can be listening — a subject
 * alone would report nothing, forever. The subject covers only the other case:
 * an element that arrives later, through sync.
 */
describe('the surface publishes the damage it found', () => {
  let workspace!: TestWorkspace;
  let surfaceId!: string;
  let surface!: SurfaceBlockModel;
  let element!: TestShapeElement;

  beforeEach(() => {
    ({ workspace, surfaceId, surface } = setupSurface());
    const id = surface.addElement({ type: 'testShape' });
    element = surface.getElementById(id)! as TestShapeElement;
  });

  test('damagedElements holds what the document opened with', () => {
    dropXYWH(surface, element);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reopened = reopen(workspace, surfaceId);

    expect([...reopened.damagedElements]).toEqual([
      [element.id, { type: 'testShape', reason: 'missing-xywh' }],
    ]);
  });

  test('a healthy element and a group are absent from the map', () => {
    const groupId = surface.addElement({
      type: 'testGroup',
      children: { [element.id]: true },
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const reopened = reopen(workspace, surfaceId);

    expect(reopened.damagedElements.has(element.id)).toBe(false);
    expect(reopened.damagedElements.has(groupId)).toBe(false);
    expect(reopened.damagedElements.size).toBe(0);
  });

  test('elementDamaged fires once for an element that arrives later', () => {
    const reports: SurfaceElementDamageReport[] = [];
    surface.elementDamaged.subscribe(report => reports.push(report));
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // What a peer's update looks like on arrival: the element's Y.Map lands in
    // the surface without ever passing through `addElement`, and `xywh` is not
    // in it.
    const late = new YMap<unknown>();
    surface.store.transact(() => {
      late.set('type', 'testShape');
      late.set('id', 'late-1');
      surface.elements.getValue()!.set('late-1', late);
    });

    expect(reports).toEqual([
      { id: 'late-1', type: 'testShape', reason: 'missing-xywh' },
    ]);
    expect(surface.damagedElements.get('late-1')).toEqual({
      type: 'testShape',
      reason: 'missing-xywh',
    });

    // Deleting the element takes the damage with it: a document that no longer
    // carries a broken element is no longer damaged by it.
    surface.deleteElement('late-1');
    expect(surface.damagedElements.has('late-1')).toBe(false);
    expect(reports).toHaveLength(1);
  });
});
