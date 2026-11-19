/**
 * One canvas element this client cannot read never empties the surface (#669,
 * ADR 0053).
 *
 * What it would have caught: `_initElementModels` built every element with
 * `_createElementFromYMap`, which threw `Invalid element type: undefined` for a
 * map with no `type` (and the same for a type this client does not register)
 * inside the block's `created` subscriber. The elements after it were never
 * built, the ones before it never mounted, and the surface watchers were never
 * set up: one bad element and the canvas opened EMPTY. A remote update carrying
 * such an element threw from the Yjs observer the same way.
 *
 * Who writes such an element: a newer client (a type added after this one
 * shipped), or a writer outside the editor (an importer, the host's workspace
 * connector, an agent) that leaves a half-written map. The library's promise is
 * that documents render everywhere, forever.
 *
 * The contract held here:
 * - the element is skipped (no model) and every other element mounts;
 * - it is reported once, through `damagedElements` / `elementDamaged`, with
 *   `unknown-type` (a type present but not registered: a newer client) or
 *   `unreadable` (no type, not a map, or a model whose construction or mount
 *   threw — a mount that throws is undone, no observer left on the map);
 * - an element's identity is its KEY in the elements map: one stored with no
 *   `id`, or another `id`, loads under its key and is not skipped (#681);
 * - one console line per batch, bounded, never an unhandled error;
 * - NOTHING is written: its Y.Map stays exactly as it is, for a client that
 *   can read it; the load emits no Yjs update at all;
 * - the position of the bad element in the map does not matter.
 *
 * The bad maps are written on a bare Y.Doc — what any writer outside the
 * editor reaches — never through `addElement`, which refuses unknown types.
 * A missing `xywh` is NOT skipped: it keeps its own path
 * (`element-missing-xywh.unit.spec.ts`).
 */
import { BlockSchemaExtension } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import {
  applyUpdate,
  Doc as YDoc,
  encodeStateAsUpdate,
  encodeStateVector,
  Map as YMap,
} from 'yjs';

import { effects } from '../../effects.js';
import {
  field,
  observe,
  type SurfaceElementDamageReport,
} from '../../gfx/index.js';
import { TestShapeElement } from '../test-gfx-element.js';
import {
  RootBlockSchemaExtension,
  SurfaceBlockModel,
  SurfaceBlockSchema,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';

effects();

/** A registered type whose model cannot be built from what its map holds. */
class ExplodingElement extends TestShapeElement {
  override get type() {
    return 'testExplodes';
  }

  constructor(options: ConstructorParameters<typeof TestShapeElement>[0]) {
    super(options);
    throw new Error('this map cannot be read');
  }
}

/** How many times the observer of a mount-failing element ran. */
let mountFailsObserved = 0;

/**
 * A registered type whose model builds, but whose MOUNT throws, after an
 * observer has started on a nested map: the shape of a real mindmap whose
 * `children` hold a `null` node (`buildTree` throws from its observer).
 */
class MountFailsElement extends TestShapeElement {
  override get type() {
    return 'testMountFails';
  }

  @observe(() => {
    mountFailsObserved++;
  })
  @field()
  accessor nested: YMap<unknown> | undefined = undefined;

  override onCreated() {
    throw new Error('onCreated cannot read this map');
  }
}

/** The reader's surface: the test surface, plus the two failing types. */
class ReaderSurfaceModel extends SurfaceBlockModel {
  override _init() {
    this._extendElement({
      testExplodes: ExplodingElement,
      testMountFails: MountFailsElement,
    });
    super._init();
  }
}

const ReaderSurfaceExtension = BlockSchemaExtension({
  ...SurfaceBlockSchema,
  model: {
    ...SurfaceBlockSchema.model,
    toModel: () => new ReaderSurfaceModel(),
  },
});

const workspaceOptions = () => ({
  id: 'unreadable-element',
  idGenerator: createAutoIncrementIdGenerator(),
});

const VALID_A = 'valid-a';
const VALID_B = 'valid-b';
const UNTYPED = 'untyped';
const FUTURE = 'future';
const MOUNT_FAILS = 'mount-fails';

type Entries = Record<string, unknown>;

const shape = (id: string): Entries => ({
  type: 'testShape',
  id,
  xywh: '[0,0,10,10]',
  index: 'a0',
  seed: 1,
});

/** A half-written element: no `type`, which is what the issue's writer left. */
const untyped = (id: string): Entries => ({ id, xywh: '[0,0,5,5]' });

/** An element a newer client wrote, of a type this one does not register. */
const future = (id: string): Entries => ({
  type: 'futureShape',
  id,
  xywh: '[20,20,10,10]',
  index: 'a1',
  seed: 2,
  label: 'kept as written',
});

const FIXTURES: Record<string, Entries> = {
  [VALID_A]: shape(VALID_A),
  [VALID_B]: shape(VALID_B),
  [UNTYPED]: untyped(UNTYPED),
  [FUTURE]: future(FUTURE),
  [MOUNT_FAILS]: { ...shape(MOUNT_FAILS), type: 'testMountFails' },
};

const EXPECTED_DAMAGE = {
  [UNTYPED]: { type: '', reason: 'unreadable' },
  [FUTURE]: { type: 'futureShape', reason: 'unknown-type' },
};

const MOUNT_FAILS_DAMAGE = { type: 'testMountFails', reason: 'unreadable' };

/** The document the editor wrote: a page and an empty surface. */
function setupWriter() {
  const workspace = new TestWorkspace(workspaceOptions());
  workspace.meta.initialize();
  const doc = workspace.createDoc('home');
  const store = doc.getStore({
    extensions: [RootBlockSchemaExtension, SurfaceBlockSchemaExtension],
  });
  doc.load();

  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);

  // A bare copy of the same document, written to as any outside writer would.
  const raw = new YDoc();
  applyUpdate(raw, encodeStateAsUpdate(doc.spaceDoc));

  return { workspace, surfaceId, raw };
}

/** The surface's elements map, read through the stored block, not a model. */
function elementsOf(spaceDoc: YDoc, surfaceId: string) {
  const block = spaceDoc.getMap('blocks').get(surfaceId) as YMap<unknown>;
  const boxed = block.get('prop:elements') as YMap<unknown>;
  return boxed.get('value') as YMap<unknown>;
}

function writeElements(raw: YDoc, surfaceId: string, ids: string[]) {
  const elements = elementsOf(raw, surfaceId);
  raw.transact(() => {
    for (const id of ids) {
      const map = new YMap<unknown>();
      elements.set(id, map);
      for (const [key, value] of Object.entries(FIXTURES[id] ?? {})) {
        map.set(key, value);
      }
      // The nested map whose observer starts before `onCreated` throws.
      if (id === MOUNT_FAILS) map.set('nested', new YMap<unknown>());
    }
  });
}

/**
 * Opens the document the way a second tab does, and records every Yjs update
 * the open itself produces: there must be none.
 */
function open(
  workspace: TestWorkspace,
  raw: YDoc,
  surfaceId: string,
  surfaceExtension = ReaderSurfaceExtension
) {
  const reader = new TestWorkspace(workspaceOptions());
  applyUpdate(reader.doc, encodeStateAsUpdate(workspace.doc));
  const readerDoc = reader.getDoc('home')!;
  applyUpdate(readerDoc.spaceDoc, encodeStateAsUpdate(raw), 'remote-peer');

  const before = encodeStateVector(readerDoc.spaceDoc);
  const updates: Uint8Array[] = [];
  const record = (update: Uint8Array) => updates.push(update);
  readerDoc.spaceDoc.on('update', record);

  const store = readerDoc.getStore({
    extensions: [RootBlockSchemaExtension, surfaceExtension],
  });
  readerDoc.load();
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;

  readerDoc.spaceDoc.off('update', record);

  return {
    surface,
    spaceDoc: readerDoc.spaceDoc,
    updates,
    stateVectorUnchanged: () =>
      expect(encodeStateVector(readerDoc.spaceDoc)).toEqual(before),
  };
}

/** Delivers what `raw` wrote since `to` last heard from it, as a peer would. */
function sync(raw: YDoc, to: YDoc) {
  applyUpdate(
    to,
    encodeStateAsUpdate(raw, encodeStateVector(to)),
    'remote-peer'
  );
}

function skippedWarnings(warn: ReturnType<typeof vi.spyOn>) {
  return warn.mock.calls.filter(([message]) =>
    String(message).includes('cannot read')
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a surface holding elements it cannot read', () => {
  test.each([
    ['first', [UNTYPED, FUTURE, VALID_A, VALID_B]],
    ['in the middle', [VALID_A, UNTYPED, FUTURE, VALID_B]],
    ['last', [VALID_A, VALID_B, UNTYPED, FUTURE]],
  ])('loads the valid elements when the bad ones come %s', (_, order) => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeElements(raw, surfaceId, order);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { surface, spaceDoc } = open(workspace, raw, surfaceId);

    // The fixture is what the test claims: the stored order is `order`.
    expect([...elementsOf(spaceDoc, surfaceId).keys()]).toEqual(order);

    expect(surface.elementModels.map(model => model.id).sort()).toEqual([
      VALID_A,
      VALID_B,
    ]);
    expect(surface.getElementById(UNTYPED)).toBeNull();
    expect(surface.getElementById(FUTURE)).toBeNull();
    expect(Object.fromEntries(surface.damagedElements)).toEqual(
      EXPECTED_DAMAGE
    );

    expect(skippedWarnings(warn)).toHaveLength(1);
    expect(error).not.toHaveBeenCalled();
  });

  test('the valid elements are mounted and the watchers are set up', () => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeElements(raw, surfaceId, [UNTYPED, VALID_A, FUTURE]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { surface } = open(workspace, raw, surfaceId);

    // A mounted element reports its updates; an unmounted one stays silent.
    const updated: string[] = [];
    surface.elementUpdated.subscribe(({ id }) => updated.push(id));
    surface.updateElement(VALID_A, { xywh: '[5,5,10,10]' });
    expect(updated).toEqual([VALID_A]);
    expect(surface.getElementById(VALID_A)!.xywh).toBe('[5,5,10,10]');

    // The elements-map observer is what emits `elementAdded`.
    const added: string[] = [];
    surface.elementAdded.subscribe(({ id }) => added.push(id));
    const id = surface.addElement({ type: 'testShape' });
    expect(added).toEqual([id]);
  });

  test('nothing is written on load: the skipped maps are left as they are', () => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeElements(raw, surfaceId, [VALID_A, UNTYPED, FUTURE, VALID_B]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { surface, spaceDoc, updates, stateVectorUnchanged } = open(
      workspace,
      raw,
      surfaceId
    );

    expect(surface.elementModels).toHaveLength(2);
    expect(updates).toEqual([]);
    stateVectorUnchanged();

    const elements = elementsOf(spaceDoc, surfaceId);
    expect((elements.get(UNTYPED) as YMap<unknown>).toJSON()).toEqual(
      FIXTURES[UNTYPED]
    );
    expect((elements.get(FUTURE) as YMap<unknown>).toJSON()).toEqual(
      FIXTURES[FUTURE]
    );
  });

  test('a value that is not a map, or null, is unreadable', () => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeElements(raw, surfaceId, [VALID_A]);
    const elements = elementsOf(raw, surfaceId);
    raw.transact(() => {
      elements.set('not-a-map', 'a string' as unknown as YMap<unknown>);
      elements.set('null', null as unknown as YMap<unknown>);
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { surface, updates } = open(workspace, raw, surfaceId);

    expect(surface.elementModels.map(model => model.id)).toEqual([VALID_A]);
    expect(Object.fromEntries(surface.damagedElements)).toEqual({
      'not-a-map': { type: '', reason: 'unreadable' },
      null: { type: '', reason: 'unreadable' },
    });
    expect(skippedWarnings(warn)).toHaveLength(1);
    expect(updates).toEqual([]);
  });

  test('a model that throws while being built is skipped, and leaves no trace', () => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeElements(raw, surfaceId, [VALID_A]);
    const elements = elementsOf(raw, surfaceId);
    raw.transact(() => {
      const map = new YMap<unknown>();
      elements.set('explodes', map);
      map.set('type', 'testExplodes');
      map.set('id', 'explodes');
      map.set('xywh', '[0,0,1,1]');
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { surface, updates } = open(
      workspace,
      raw,
      surfaceId,
      ReaderSurfaceExtension
    );

    expect(surface.elementModels.map(model => model.id)).toEqual([VALID_A]);
    expect(surface.damagedElements.get('explodes')).toEqual({
      type: 'testExplodes',
      reason: 'unreadable',
    });
    expect(updates).toEqual([]);

    // The throw came LAST, so nothing rebuilt an element after it: a decorator
    // state left armed by the throw would swallow this write silently.
    surface.updateElement(VALID_A, { xywh: '[7,7,10,10]' });
    expect(surface.getElementById(VALID_A)!.yMap.get('xywh')).toBe(
      '[7,7,10,10]'
    );
  });

  test('a canvas holding only skipped elements is not empty', () => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeElements(raw, surfaceId, [FUTURE]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { surface } = open(workspace, raw, surfaceId);

    // Emptiness is recomputed on every add and remove.
    surface.deleteElement(surface.addElement({ type: 'testShape' }));
    expect(surface.isEmpty()).toBe(false);
  });
});

describe('unreadable elements arriving by a remote update', () => {
  function openHealthy() {
    const { workspace, surfaceId, raw } = setupWriter();
    const reader = open(workspace, raw, surfaceId);
    return { surfaceId, raw, ...reader };
  }

  test.each([
    ['first', [UNTYPED, FUTURE, VALID_A, VALID_B]],
    ['in the middle', [VALID_A, UNTYPED, FUTURE, VALID_B]],
    ['last', [VALID_A, VALID_B, UNTYPED, FUTURE]],
  ])('take the same path when the bad ones come %s', (_, order) => {
    const { surfaceId, raw, surface, spaceDoc } = openHealthy();
    const reports: SurfaceElementDamageReport[] = [];
    const added: string[] = [];
    surface.elementDamaged.subscribe(report => reports.push(report));
    surface.elementAdded.subscribe(({ id }) => added.push(id));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    writeElements(raw, surfaceId, order);
    expect(() => sync(raw, spaceDoc)).not.toThrow();

    expect(surface.elementModels.map(model => model.id).sort()).toEqual([
      VALID_A,
      VALID_B,
    ]);
    expect(added.sort()).toEqual([VALID_A, VALID_B]);
    expect(reports.sort((a, b) => a.id.localeCompare(b.id))).toEqual([
      { id: FUTURE, ...EXPECTED_DAMAGE[FUTURE] },
      { id: UNTYPED, ...EXPECTED_DAMAGE[UNTYPED] },
    ]);
    expect(skippedWarnings(warn)).toHaveLength(1);
  });

  test('a later key update on a skipped map neither throws nor reports again', () => {
    const { surfaceId, raw, surface, spaceDoc } = openHealthy();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeElements(raw, surfaceId, [FUTURE]);
    sync(raw, spaceDoc);

    const reports: SurfaceElementDamageReport[] = [];
    surface.elementDamaged.subscribe(report => reports.push(report));
    raw.transact(() => {
      (elementsOf(raw, surfaceId).get(FUTURE) as YMap<unknown>).set(
        'label',
        'edited by the newer client'
      );
    });
    expect(() => sync(raw, spaceDoc)).not.toThrow();

    expect(reports).toEqual([]);
    expect(surface.getElementById(FUTURE)).toBeNull();
    expect(surface.damagedElements.get(FUTURE)).toEqual(
      EXPECTED_DAMAGE[FUTURE]
    );
  });

  test('a remote delete of a skipped element takes its damage away', () => {
    const { surfaceId, raw, surface, spaceDoc } = openHealthy();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeElements(raw, surfaceId, [FUTURE]);
    sync(raw, spaceDoc);

    const removed: string[] = [];
    surface.elementRemoved.subscribe(({ id }) => removed.push(id));
    raw.transact(() => elementsOf(raw, surfaceId).delete(FUTURE));
    expect(() => sync(raw, spaceDoc)).not.toThrow();

    expect(surface.damagedElements.has(FUTURE)).toBe(false);
    // It never had a model, so nothing was "removed" from this client's view.
    expect(removed).toEqual([]);
  });

  test('a half-written element completed later stays skipped until reopened', () => {
    const { surfaceId, raw, surface, spaceDoc } = openHealthy();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeElements(raw, surfaceId, [UNTYPED]);
    sync(raw, spaceDoc);

    raw.transact(() => {
      (elementsOf(raw, surfaceId).get(UNTYPED) as YMap<unknown>).set(
        'type',
        'testShape'
      );
    });
    expect(() => sync(raw, spaceDoc)).not.toThrow();

    // The elements map observer is shallow: a key landing INSIDE an element
    // map is not an element added. No repair is attempted here (ADR 0053).
    expect(surface.getElementById(UNTYPED)).toBeNull();
    expect(surface.damagedElements.get(UNTYPED)).toEqual(
      EXPECTED_DAMAGE[UNTYPED]
    );
  });
});

describe('neighbours of a skipped element', () => {
  test('a group listing a skipped child loads, and deleting it keeps the child', () => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeElements(raw, surfaceId, [VALID_A, FUTURE]);
    const elements = elementsOf(raw, surfaceId);
    raw.transact(() => {
      const group = new YMap<unknown>();
      elements.set('group', group);
      const children = new YMap<unknown>();
      group.set('type', 'testGroup');
      group.set('id', 'group');
      group.set('index', 'a2');
      group.set('seed', 3);
      group.set('children', children);
      children.set(VALID_A, true);
      children.set(FUTURE, true);
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { surface, spaceDoc, updates } = open(workspace, raw, surfaceId);

    const group = surface.getElementById('group') as unknown as {
      childIds: string[];
      childElements: { id: string }[];
    };
    expect(group.childIds.sort()).toEqual([FUTURE, VALID_A].sort());
    expect(group.childElements.map(child => child.id)).toEqual([VALID_A]);
    expect(updates).toEqual([]);

    // A user deleting the group deletes what this client can read; the child
    // it cannot read is not its to delete, and stays in the document.
    surface.deleteElement('group');
    const stored = elementsOf(spaceDoc, surfaceId);
    expect(stored.has('group')).toBe(false);
    expect(stored.has(VALID_A)).toBe(false);
    expect((stored.get(FUTURE) as YMap<unknown>).toJSON()).toEqual(
      FIXTURES[FUTURE]
    );
  });
});

/** An empty canvas, opened; later elements arrive through {@link sync}. */
function openEmpty() {
  const { workspace, surfaceId, raw } = setupWriter();
  return { surfaceId, raw, ...open(workspace, raw, surfaceId) };
}

/** The proof a model is mounted: its updates leave the surface. */
function expectMounted(surface: SurfaceBlockModel, id: string) {
  const updated: string[] = [];
  const subscription = surface.elementUpdated.subscribe(payload =>
    updated.push(payload.id)
  );
  surface.updateElement(id, { xywh: '[3,3,10,10]' });
  subscription.unsubscribe();
  expect(updated).toEqual([id]);
}

/**
 * A model that BUILDS but whose mount throws (an observer or `onCreated`
 * choking on the map, as a real mindmap does on a `null` node) stopped the
 * load loop exactly as a bad type did: later models unmounted, watchers never
 * set up, an unhandled error.
 */
describe('an element whose mount throws', () => {
  test.each([
    ['first', [MOUNT_FAILS, VALID_A, VALID_B]],
    ['in the middle', [VALID_A, MOUNT_FAILS, VALID_B]],
    ['last', [VALID_A, VALID_B, MOUNT_FAILS]],
  ])('is skipped at load when it comes %s', (_, order) => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeElements(raw, surfaceId, order);
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { surface, updates } = open(workspace, raw, surfaceId);

    expect(surface.elementModels.map(model => model.id).sort()).toEqual([
      VALID_A,
      VALID_B,
    ]);
    expect(surface.getElementById(MOUNT_FAILS)).toBeNull();
    expect(surface.damagedElements.get(MOUNT_FAILS)).toEqual(
      MOUNT_FAILS_DAMAGE
    );
    expect(updates).toEqual([]);
    expectMounted(surface, VALID_A);
    expectMounted(surface, VALID_B);

    // The watchers are set up: the elements-map observer emits elementAdded.
    const added: string[] = [];
    surface.elementAdded.subscribe(({ id }) => added.push(id));
    const id = surface.addElement({ type: 'testShape' });
    expect(added).toEqual([id]);

    // One line, carrying what threw.
    const lines = skippedWarnings(warn);
    expect(lines).toHaveLength(1);
    expect(String(lines[0][1])).toContain('onCreated cannot read this map');
  });

  test('its partial mount is undone: no observer is left on its map', () => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeElements(raw, surfaceId, [MOUNT_FAILS, VALID_A]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { spaceDoc } = open(workspace, raw, surfaceId);
    const observedAtLoad = mountFailsObserved;

    raw.transact(() => {
      const element = elementsOf(raw, surfaceId).get(MOUNT_FAILS) as YMap<
        YMap<unknown>
      >;
      element.get('nested')!.set('probe', 1);
      (element as YMap<unknown>).set('label', 'touched');
    });
    sync(raw, spaceDoc);

    expect(mountFailsObserved).toBe(observedAtLoad);
  });

  test('is skipped the same way when it arrives by a remote update', () => {
    const { surfaceId, raw, surface, spaceDoc } = openEmpty();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const added: string[] = [];
    const reports: SurfaceElementDamageReport[] = [];
    surface.elementAdded.subscribe(({ id }) => added.push(id));
    surface.elementDamaged.subscribe(report => reports.push(report));

    writeElements(raw, surfaceId, [VALID_A, MOUNT_FAILS, VALID_B]);
    expect(() => sync(raw, spaceDoc)).not.toThrow();

    expect(added.sort()).toEqual([VALID_A, VALID_B]);
    expect(surface.getElementById(MOUNT_FAILS)).toBeNull();
    expect(reports).toEqual([{ id: MOUNT_FAILS, ...MOUNT_FAILS_DAMAGE }]);
    expectMounted(surface, VALID_B);
    expect(skippedWarnings(warn)).toHaveLength(1);
  });
});

/**
 * An element's identity is its KEY in the elements map (#681, ADR 0053):
 * every lookup is by key, but the model used to take its id from the stored
 * `id` prop, so an element stored without one got `model.id === undefined`
 * and its first update reached `getElementById(undefined)`. A stored `id`
 * that is absent or different is not a reason to skip either: such documents
 * render today, and must keep rendering.
 */
describe('identity is the key in the elements map', () => {
  function writeRaw(raw: YDoc, surfaceId: string, entries: Entries[]) {
    const elements = elementsOf(raw, surfaceId);
    raw.transact(() => {
      entries.forEach(({ key, ...props }) => {
        const map = new YMap<unknown>();
        elements.set(key as string, map);
        Object.entries(props).forEach(([k, v]) => map.set(k, v));
      });
    });
  }

  const noId = { key: 'no-id', type: 'testShape', xywh: '[0,0,10,10]' };
  const otherId = { ...shape('stored-id'), key: 'other-key' };

  test('an element with no id, or another id, loads under its key', () => {
    const { workspace, surfaceId, raw } = setupWriter();
    writeRaw(raw, surfaceId, [noId, otherId]);
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { surface, spaceDoc, updates } = open(workspace, raw, surfaceId);

    for (const key of ['no-id', 'other-key']) {
      expect(surface.getElementById(key)!.id).toBe(key);
      expectMounted(surface, key);
    }
    expect(surface.damagedElements.size).toBe(0);
    expect(updates).toEqual([]);
    // Nothing repaired: the stored ids stay as they were written.
    const stored = elementsOf(spaceDoc, surfaceId);
    expect((stored.get('no-id') as YMap<unknown>).has('id')).toBe(false);
    expect((stored.get('other-key') as YMap<unknown>).get('id')).toBe(
      'stored-id'
    );
  });

  test('the same when they arrive by a remote update', () => {
    const { surfaceId, raw, surface, spaceDoc } = openEmpty();
    const added: string[] = [];
    surface.elementAdded.subscribe(({ id }) => added.push(id));

    writeRaw(raw, surfaceId, [noId, otherId]);
    sync(raw, spaceDoc);

    expect(added.sort()).toEqual(['no-id', 'other-key']);
    expect(surface.getElementById('no-id')!.id).toBe('no-id');
    expectMounted(surface, 'other-key');
  });

  test('a missing xywh is recorded, and removed, under the key', () => {
    const { surfaceId, raw, surface, spaceDoc } = openEmpty();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    writeRaw(raw, surfaceId, [
      { key: 'key-x', id: 'stored-x', type: 'testShape', index: 'a0' },
    ]);
    sync(raw, spaceDoc);

    expect([...surface.damagedElements]).toEqual([
      ['key-x', { type: 'testShape', reason: 'missing-xywh' }],
    ]);

    raw.transact(() => elementsOf(raw, surfaceId).delete('key-x'));
    sync(raw, spaceDoc);
    expect(surface.damagedElements.size).toBe(0);
  });
});

describe('what a skipped element changes around it', () => {
  test('a null value arriving by a remote update is reported too', () => {
    const { surfaceId, raw, surface, spaceDoc } = openEmpty();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    raw.transact(() => {
      elementsOf(raw, surfaceId).set('null', null as unknown as YMap<unknown>);
    });
    expect(() => sync(raw, spaceDoc)).not.toThrow();

    expect(surface.damagedElements.get('null')).toEqual({
      type: '',
      reason: 'unreadable',
    });
  });

  test('an empty canvas receiving a skipped element is no longer empty', () => {
    const { surfaceId, raw, surface, spaceDoc } = openEmpty();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    expect(surface.isEmpty()).toBe(true);

    writeElements(raw, surfaceId, [FUTURE]);
    sync(raw, spaceDoc);
    expect(surface.isEmpty()).toBe(false);

    raw.transact(() => elementsOf(raw, surfaceId).delete(FUTURE));
    sync(raw, spaceDoc);
    expect(surface.isEmpty()).toBe(true);
  });

  test('the console line names five keys at most, and carries what threw', () => {
    const { workspace, surfaceId, raw } = setupWriter();
    const many = Array.from({ length: 7 }, (_, i) => ({
      ...future(`future-${i}`),
      key: `future-${i}`,
    }));
    const elements = elementsOf(raw, surfaceId);
    raw.transact(() => {
      // First, so its key is among the five shown.
      const explodes = new YMap<unknown>();
      elements.set('explodes', explodes);
      explodes.set('type', 'testExplodes');
      explodes.set('xywh', '[0,0,1,1]');
      many.forEach(({ key, ...props }) => {
        const map = new YMap<unknown>();
        elements.set(key, map);
        Object.entries(props).forEach(([k, v]) => map.set(k, v));
      });
    });
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { spaceDoc } = open(workspace, raw, surfaceId);
    expect([...elementsOf(spaceDoc, surfaceId).keys()][0]).toBe('explodes');

    const lines = skippedWarnings(warn);
    expect(lines).toHaveLength(1);
    const [message, ...extra] = lines[0];
    expect(String(message)).toContain('skipped 8 element(s)');
    expect(String(message)).toContain('and 3 more');
    expect(String(message)).not.toContain('future-6');
    // One "(reason)" per key shown: matches "(unknown-type)", not "unknown-type".
    expect(
      String(message).match(/\((unknown-type|unreadable)\)/g)
    ).toHaveLength(5);
    expect(extra.map(String)).toEqual(['Error: this map cannot be read']);
  });
});
