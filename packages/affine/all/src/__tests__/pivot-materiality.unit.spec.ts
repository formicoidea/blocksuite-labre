/**
 * `PivotMaterialityPublisher` — reflecting a bound occurrence's level-3
 * qualification onto its pivot record (MF3 / ADR 0006 § 4), against a REAL
 * store and a real surface.
 *
 * Real, because every interesting property of this watcher lives in the Yjs
 * layer rather than in its own code:
 *
 * - **Undo publishes.** The whole reason the trigger is a local Yjs transaction
 *   and not the `@field()` setter, and not the command layer: undo goes through
 *   neither, so a setter-driven design desyncs the record on the very first
 *   Ctrl+Z and never recovers.
 * - **A remote peer is silent.** `local` partitions the fleet into exactly one
 *   publisher and N−1 observers, with no leader election and no lock.
 * - **Deletion RETRACTS.** Deleting a bound element changes no tag, so a
 *   change-driven design would publish nothing and the record would keep
 *   materialities attributed to an occurrence that no longer exists — "the
 *   library never deletes host data" quietly becoming "the library leaks host
 *   data".
 */
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import {
  PivotMaterialityPublisher,
  PivotPropertiesProvider,
  type OccurrenceMaterialityPatch,
  type PivotPropertiesService,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier, setElementTag } from '@labre/std/gfx';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { computed, signal } from '@preact/signals-core';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from '../extensions/store.js';

const RECORD = 'pivot-payments';
const OTHER_RECORD = 'pivot-onboarding';
const NATURE = 'wardley:nature';
const DATA = 'wardley:nature/data';
const PRACTICE = 'wardley:nature/practice';

/** The publisher coalesces per element within one microtask. */
const settle = () => new Promise<void>(resolve => queueMicrotask(resolve));

function setup({ withProvider = true }: { withProvider?: boolean } = {}) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id: 'materiality' });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const store = collection.createDoc('home').getStore({ id: 'home' });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('MF3') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;

  const patches: OccurrenceMaterialityPatch[] = [];
  const provider: PivotPropertiesService = {
    properties$: () => computed(() => ({ status: 'loading' }) as const),
    publishOccurrenceMaterialities: patch => patches.push(patch),
  };
  /** A provider that registers but implements no write-back at all. */
  const readOnlyProvider: PivotPropertiesService = {
    properties$: () => computed(() => ({ status: 'loading' }) as const),
  };

  const surface$ = signal<SurfaceBlockModel | null>(surface);
  const gfx = { surface, surface$ };

  const std = {
    store,
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : undefined,
    getOptional: (identifier: unknown) =>
      identifier === PivotPropertiesProvider
        ? withProvider
          ? provider
          : readOnlyProvider
        : undefined,
  } as unknown as BlockStdScope;

  const publisher = new PivotMaterialityPublisher(std);
  publisher.mounted();

  const addShape = (props: Record<string, unknown> = {}) => {
    const id = surface.addElement({
      type: 'shape',
      xywh: '[0,0,100,100]',
      shapeType: 'rect',
      ...props,
    });
    return surface.getElementById(id)!;
  };

  return { store, surface, surface$, std, patches, publisher, addShape };
}

describe('a bound, qualified element', () => {
  let ctx!: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  test('qualifying it publishes ONE full-state patch', async () => {
    const shape = ctx.addShape({
      pivotDocId: RECORD,
      role: 'wardley:component',
    });
    await settle();
    ctx.patches.length = 0;

    setElementTag(shape, NATURE, [DATA]);
    await settle();

    expect(ctx.patches).toEqual([
      {
        pivotDocId: RECORD,
        elementId: shape.id,
        framework: 'wardley',
        role: 'wardley:component',
        // A flattened snapshot produced from the nested map: a transport DTO,
        // not the persisted shape.
        tags: { [NATURE]: [DATA] },
        present: true,
      },
    ]);
  });

  test('one gesture is one patch, however many payloads Yjs emits', async () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    await settle();
    ctx.patches.length = 0;

    // `_onChange` is also invoked directly on the stash/pop path, so one user
    // gesture legitimately produces several payloads for one element.
    setElementTag(shape, NATURE, [DATA]);
    shape.surface.updateElement(shape.id, { xywh: '[9,9,10,10]' });
    await settle();

    expect(ctx.patches).toHaveLength(1);
  });

  test('a move republishes nothing: the state has not changed', async () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.patches.length = 0;

    ctx.surface.updateElement(shape.id, { xywh: '[300,300,100,100]' });
    await settle();

    // Patches are full-state and idempotent, so re-sending one converges — but
    // a drag emitting dozens of them is still a flood the host does not need.
    expect(ctx.patches).toEqual([]);
  });

  test('changing the value set publishes the new state', async () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.patches.length = 0;

    setElementTag(shape, NATURE, [PRACTICE]);
    await settle();

    expect(ctx.patches).toHaveLength(1);
    expect(ctx.patches[0].tags).toEqual({ [NATURE]: [PRACTICE] });
  });
});

describe('an element that is not bound', () => {
  test('qualifying it publishes nothing at all', async () => {
    const ctx = setup();
    const shape = ctx.addShape({ role: 'wardley:component' });

    setElementTag(shape, NATURE, [DATA]);
    await settle();

    // There is no record to reflect onto. Qualification is an element-local
    // write and never needed the host.
    expect(ctx.patches).toEqual([]);
  });

  test('binding it later publishes the qualification it already had', async () => {
    const ctx = setup();
    const shape = ctx.addShape();
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    expect(ctx.patches).toEqual([]);

    ctx.surface.updateElement(shape.id, { pivotDocId: RECORD });
    await settle();

    // The patch is the element's CURRENT FULL STATE, never a delta — which is
    // what makes it idempotent and the `void` return survivable.
    expect(ctx.patches).toHaveLength(1);
    expect(ctx.patches[0].tags).toEqual({ [NATURE]: [DATA] });
  });
});

describe('retraction — no orphaned materialities', () => {
  let ctx!: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  test('deleting the element retracts', async () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.patches.length = 0;

    ctx.surface.deleteElement(shape.id);
    await settle();

    // Deleting a bound element changes no tag, so a change-driven design would
    // publish nothing and the record would keep materialities attributed to an
    // occurrence that no longer exists.
    expect(ctx.patches).toEqual([
      {
        pivotDocId: RECORD,
        elementId: shape.id,
        framework: undefined,
        role: undefined,
        tags: {},
        present: false,
      },
    ]);
  });

  test('unbinding retracts', async () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.patches.length = 0;

    shape.clearField('pivotDocId');
    await settle();

    expect(ctx.patches).toHaveLength(1);
    expect(ctx.patches[0]).toMatchObject({
      pivotDocId: RECORD,
      present: false,
    });
  });

  test('re-binding retracts the OLD record, then publishes the new one', async () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.patches.length = 0;

    ctx.surface.updateElement(shape.id, { pivotDocId: OTHER_RECORD });
    await settle();

    // Two patches, in order, on two different records: without the retraction
    // the first record would keep an occurrence that has moved away.
    expect(ctx.patches.map(p => [p.pivotDocId, p.present])).toEqual([
      [RECORD, false],
      [OTHER_RECORD, true],
    ]);
  });

  test('materialities are keyed per occurrence: N elements → 1 record', async () => {
    const first = ctx.addShape({ pivotDocId: RECORD });
    const second = ctx.addShape({ pivotDocId: RECORD });
    setElementTag(first, NATURE, [DATA]);
    setElementTag(second, NATURE, [PRACTICE]);
    await settle();
    ctx.patches.length = 0;

    ctx.surface.deleteElement(first.id);
    await settle();

    // The retraction names ONE elementId, so the record drops that occurrence's
    // contribution and keeps the other's. Two occurrences that disagree coexist
    // as two attributed contributions; the library never merges them, never
    // picks a winner and never observes the result.
    expect(ctx.patches).toHaveLength(1);
    expect(ctx.patches[0]).toMatchObject({
      elementId: first.id,
      present: false,
    });
  });
});

describe('undo and redo', () => {
  test('undoing a qualification publishes the reverted state', async () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.store.captureSync();
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.patches.length = 0;

    ctx.store.undo();
    await settle();

    // The defect this whole design exists to prevent: publishing from the
    // `@field()` setter, or from the command layer, means the element reverts
    // while the record keeps the derived materiality — a silent, permanent
    // desync on the very first undo.
    expect(ctx.patches).toHaveLength(1);
    expect(ctx.patches[0].tags).toEqual({});
    expect(ctx.patches[0].present).toBe(true);
  });

  test('redo republishes, and later per-tag writes are still seen', async () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.store.captureSync();
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.store.undo();
    await settle();
    ctx.patches.length = 0;

    ctx.store.redo();
    await settle();
    expect(ctx.patches).toHaveLength(1);
    expect(ctx.patches[0].tags).toEqual({ [NATURE]: [DATA] });

    // The nested map is a FRESH instance after a redo, and neither undo nor
    // redo goes through the accessor's setter. Without re-attaching the nested
    // observer, this second write would be invisible.
    ctx.patches.length = 0;
    setElementTag(shape, 'wardley:criticality', ['wardley:criticality/high']);
    await settle();
    expect(ctx.patches).toHaveLength(1);
    expect(ctx.patches[0].tags).toMatchObject({
      'wardley:criticality': ['wardley:criticality/high'],
    });
  });

  test('undoing a bind retracts', async () => {
    const ctx = setup();
    const shape = ctx.addShape();
    ctx.store.captureSync();
    ctx.surface.updateElement(shape.id, { pivotDocId: RECORD });
    await settle();
    ctx.patches.length = 0;

    ctx.store.undo();
    await settle();

    expect(ctx.patches).toHaveLength(1);
    expect(ctx.patches[0]).toMatchObject({
      pivotDocId: RECORD,
      present: false,
    });
  });
});

describe('a remote peer', () => {
  test('a change arriving from another client is not published here', async () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.patches.length = 0;

    // A second real client: same document, its own `clientID`. Everything it
    // writes reaches us through `Y.applyUpdate`, which is what makes
    // `transaction.local` false on this side.
    const doc = shape.yMap.doc!;
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));

    // `prop:elements` is a `Boxed`, i.e. a Y.Map holding the real elements map
    // under `value`.
    const remoteBlock = remote
      .getMap('blocks')
      .get(ctx.surface.id) as Y.Map<unknown>;
    const remoteElements = (
      remoteBlock.get('prop:elements') as Y.Map<unknown>
    ).get('value') as Y.Map<Y.Map<unknown>>;
    const remoteElement = remoteElements.get(shape.id)!;
    remote.transact(() => {
      (remoteElement.get('tags') as Y.Map<string[]>).set(NATURE, [PRACTICE]);
    });

    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote));
    await settle();

    // The change LANDED — this is a real edit, not a no-op update…
    expect(shape.tags!.get(NATURE)).toEqual([PRACTICE]);
    // …and this client stayed silent about it. `local` already partitions the
    // fleet into exactly one publisher and N−1 silent observers: no leader
    // election, no lock, no acknowledgement. The peer that made the change is
    // the one that announces it.
    expect(ctx.patches).toEqual([]);
  });

  test('an element a PEER created and bound still retracts when we delete it', async () => {
    const ctx = setup();
    // A first element only so the surface's Y structures exist locally.
    ctx.addShape();
    await settle();

    const doc = ctx.surface.elementModels[0].yMap.doc!;
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));

    const remoteElements = (
      (remote.getMap('blocks').get(ctx.surface.id) as Y.Map<unknown>).get(
        'prop:elements'
      ) as Y.Map<unknown>
    ).get('value') as Y.Map<Y.Map<unknown>>;

    // The peer creates a bound, qualified occurrence — entirely its business.
    const REMOTE_ID = 'peer-element';
    remote.transact(() => {
      const element = new Y.Map<unknown>();
      element.set('type', 'shape');
      element.set('id', REMOTE_ID);
      element.set('index', 'a0');
      element.set('seed', 1);
      element.set('xywh', '[0,0,10,10]');
      element.set('shapeType', 'rect');
      element.set('pivotDocId', RECORD);
      const tags = new Y.Map<string[]>();
      tags.set(NATURE, [DATA]);
      element.set('tags', tags);
      remoteElements.set(REMOTE_ID, element);
    });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote));
    await settle();

    // Nothing published: it is not our change.
    expect(ctx.patches).toEqual([]);
    expect(ctx.surface.getElementById(REMOTE_ID)).toBeTruthy();

    // …but WE delete it. And now the retraction is ours to emit: the peer that
    // bound it sees this deletion as remote, so if retraction belonged to the
    // binder, nobody would emit it at all and the host would keep a materiality
    // attributed to an occurrence that no longer exists.
    ctx.surface.deleteElement(REMOTE_ID);
    await settle();

    expect(ctx.patches).toEqual([
      {
        pivotDocId: RECORD,
        elementId: REMOTE_ID,
        framework: undefined,
        role: undefined,
        tags: {},
        present: false,
      },
    ]);
  });

  test('a remote change invalidates what WE last published', async () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });

    // 1. We publish `data`. The host holds `data`, and so does our fingerprint.
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    expect(ctx.patches.at(-1)?.tags).toEqual({ [NATURE]: [DATA] });
    ctx.patches.length = 0;

    // 2. The peer switches it to `practice` and publishes that itself. The host
    //    now holds `practice`; our fingerprint still says `data`.
    const doc = shape.yMap.doc!;
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
    const remoteElements = (
      (remote.getMap('blocks').get(ctx.surface.id) as Y.Map<unknown>).get(
        'prop:elements'
      ) as Y.Map<unknown>
    ).get('value') as Y.Map<Y.Map<unknown>>;
    remote.transact(() => {
      (remoteElements.get(shape.id)!.get('tags') as Y.Map<string[]>).set(
        NATURE,
        [PRACTICE]
      );
    });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote));
    await settle();
    expect(ctx.patches).toEqual([]);

    // 3. We go back to `data`.
    setElementTag(shape, NATURE, [DATA]);
    await settle();

    // Without dropping our fingerprint on the remote touch, this compares equal
    // to what WE last sent and the patch is suppressed — the element says
    // `data`, the host keeps `practice`, until some third, different value
    // comes along. Milder than a lost retraction (host-side cache staleness,
    // not document data, and it heals on the next real change) but free to
    // close.
    expect(ctx.patches).toHaveLength(1);
    expect(ctx.patches[0].tags).toEqual({ [NATURE]: [DATA] });
  });

  test("a peer's own deletion is the peer's retraction, not ours", async () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.patches.length = 0;

    const doc = shape.yMap.doc!;
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
    const remoteElements = (
      (remote.getMap('blocks').get(ctx.surface.id) as Y.Map<unknown>).get(
        'prop:elements'
      ) as Y.Map<unknown>
    ).get('value') as Y.Map<Y.Map<unknown>>;
    remote.transact(() => remoteElements.delete(shape.id));
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote));
    await settle();

    // Exactly one client publishes per change, and it is the one whose
    // transaction it is. Two retractions for one deletion would be a duplicate,
    // not a safety net.
    expect(ctx.surface.getElementById(shape.id)).toBeFalsy();
    expect(ctx.patches).toEqual([]);
  });
});

describe('degradation', () => {
  test('a provider with no write-back subscribes to nothing', async () => {
    const ctx = setup({ withProvider: false });
    const shape = ctx.addShape({ pivotDocId: RECORD });

    setElementTag(shape, NATURE, [DATA]);
    await settle();

    // Checked once, at mount: with nobody to announce to, the whole watcher
    // costs one lookup. Binding and qualification keep working — they are
    // element-local writes and never needed the host.
    expect(ctx.patches).toEqual([]);
    expect(shape.tags).toBeInstanceOf(Y.Map);
  });

  test('a throwing host is swallowed, and the element keeps its truth', async () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });
    await settle();

    // The channel is fire-and-forget by contract: there is nothing a caller
    // could do with the failure, and the element remains the source of truth
    // either way.
    expect(() => setElementTag(shape, NATURE, [DATA])).not.toThrow();
    await settle();
    expect(shape.tags).toBeInstanceOf(Y.Map);
  });

  test('unmounting stops everything', async () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });
    await settle();
    ctx.publisher.unmounted();
    ctx.patches.length = 0;

    setElementTag(shape, NATURE, [DATA]);
    await settle();

    expect(ctx.patches).toEqual([]);
  });
});

describe('opening a board republishes nothing', () => {
  test('elements already on the surface are not announced at mount', async () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });
    setElementTag(shape, NATURE, [DATA]);
    await settle();
    ctx.patches.length = 0;

    // Re-mounting is what opening the editor on an existing board looks like.
    ctx.publisher.unmounted();
    ctx.publisher.mounted();
    await settle();

    // Not a local change, and flooding the host with patches it already holds
    // on every editor open is exactly what the rebuild path
    // (`collectPivotOccurrences`) exists to replace.
    expect(ctx.patches).toEqual([]);
  });
});
