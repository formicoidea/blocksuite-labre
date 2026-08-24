/**
 * MF3 — the reversed reading against a REAL document (the invariants).
 *
 * The engine's five fields are unit-tested in `blocks/surface`, the Wardley
 * declaration in `gfx/wardley`. What can only be shown against a real store is
 * the promise the PO's arbitration is made of:
 *
 * - **opening a proposal writes nothing** — a hundred times over, byte for byte;
 * - **confirming writes through the two EXISTING commands**, once each;
 * - **read-only reads, and offers nothing to confirm**;
 * - **the drift trigger is asynchronous, debounced and local** — never on the
 *   16 ms path, never on a colleague's gesture;
 * - **no provider, no drift, no proposal from the record** — the degraded path
 *   is the tested one.
 */
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import {
  compareReading,
  ReadingManager,
  ReadingProfileIdentifier,
  readRecord,
} from '@labre/affine-block-surface';
import { pivotCommands, tagCommands } from '@labre/affine-block-root';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import {
  PivotPropertiesConfigIdentifier,
  PivotPropertiesProvider,
  type PivotPropertiesService,
  type PivotSnapshot,
  UniverseTagDefsProvider,
} from '@labre/affine-shared/services';
import {
  WARDLEY_NATURE,
  WARDLEY_NATURE_TAG_ID,
  WARDLEY_READING,
  WARDLEY_TAG_DEFS,
} from '@labre/affine-gfx-wardley';
import type { BlockStdScope } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { computed, signal } from '@preact/signals-core';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { getInternalStoreExtensions } from '../extensions/store.js';

const RECORD = 'pivot-payments';
const MAP = [0, 0, 1600, 900] as const;

/** Longer than the trigger's own debounce, so a settled board is settled. */
const settleDrift = () => new Promise<void>(resolve => setTimeout(resolve, 320));
const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));

function setup({
  withProvider = true,
  withTagDefs = true,
  properties = [] as PivotSnapshot['properties'],
}: {
  withProvider?: boolean;
  /** The framework's tag pack, as its flag-gated view extension seeds it. */
  withTagDefs?: boolean;
  properties?: PivotSnapshot['properties'];
} = {}) {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id: 'reading' });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const store = collection.createDoc('home').getStore({ id: 'home' });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('MF3') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;

  const service: PivotPropertiesService = {
    properties$: (docId: string) =>
      computed(
        () =>
          ({
            status: 'ready',
            snapshot: { docId, title: 'Payments', properties },
          }) as const
      ),
  };

  const surface$ = signal<SurfaceBlockModel | null>(surface);
  const selected: unknown[] = [];
  const gfx = { surface, surface$, selection: { selectedElements: selected } };

  const std = {
    store,
    provider: {
      getAll: (identifier: unknown) => {
        if (identifier === ReadingProfileIdentifier) {
          return new Map([['wardley', WARDLEY_READING]]);
        }
        // The real pack, seeded the way the framework seeds it: what the record
        // says is resolved against THESE values and nothing else.
        if (identifier === UniverseTagDefsProvider && withTagDefs) {
          return new Map([[WARDLEY_TAG_DEFS.packId, WARDLEY_TAG_DEFS]]);
        }
        return new Map();
      },
    },
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : undefined,
    getOptional: (identifier: unknown) => {
      if (identifier === PivotPropertiesProvider) {
        return withProvider ? service : undefined;
      }
      if (identifier === PivotPropertiesConfigIdentifier) {
        return withProvider ? { hoverFields: ['nature', 'phase'] } : undefined;
      }
      return undefined;
    },
  } as unknown as BlockStdScope;

  const reading = new ReadingManager(std);
  reading.mounted();

  const add = (props: Record<string, unknown>) => {
    const id = surface.addElement(props as never);
    return surface.getElementById(id)!;
  };

  /** A real Wardley map background: the persisted type is `wardley`. */
  const addMap = () =>
    add({
      type: 'wardley',
      role: 'wardley:map',
      xywh: `[${MAP.join(',')}]`,
    });

  /** A component whose centre sits at the given fraction of the map. */
  const addComponent = (fx = 0.55, fy = 0.5, props: Record<string, unknown> = {}) =>
    add({
      type: 'shape',
      shapeType: 'ellipse',
      role: 'wardley:component',
      xywh: `[${MAP[2] * fx - 9},${MAP[3] * fy - 9},18,18]`,
      ...props,
    });

  const doc = store.doc.spaceDoc;
  const snapshot = () => Y.encodeStateAsUpdate(doc);

  return {
    store,
    surface,
    std,
    reading,
    add,
    addMap,
    addComponent,
    doc,
    snapshot,
    selected,
  };
}

describe('opening a proposal', () => {
  let ctx!: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  test('reads the five fields off the document', () => {
    ctx.addMap();
    const component = ctx.addComponent(0.55, 0.4);
    const supplier = ctx.addComponent(0.55, 0.8);
    ctx.add({
      type: 'connector',
      role: 'wardley:dependency',
      source: { id: component.id },
      target: { id: supplier.id },
    });

    ctx.reading.open(component.id);
    const reading = ctx.reading.reading(component.id)!;

    expect(reading.nodeType.roleId).toBe('wardley:component');
    // Nothing carried, nothing invented.
    expect(reading.nature).toBeUndefined();
    expect(reading.phase?.zoneId).toBe('product');
    expect(reading.relations).toHaveLength(1);
    expect(reading.relations[0]).toMatchObject({
      otherId: supplier.id,
      side: 'supplier',
      contradictsGeometry: false,
    });
  });

  test('writes NOTHING — a hundred times over', () => {
    ctx.addMap();
    const component = ctx.addComponent();
    const before = ctx.snapshot();

    for (let i = 0; i < 100; i++) {
      ctx.reading.open(component.id);
      // Everything the panel asks for on a render.
      expect(ctx.reading.reading(component.id)).not.toBeNull();
      expect(ctx.reading.profileOf(component.id)).toBe(WARDLEY_READING);
      readRecord(ctx.std, component, WARDLEY_READING);
      ctx.reading.close();
    }

    // Byte for byte: the whole arbitration in one assertion. A reading is a
    // read, and a read leaves no trace in the document.
    expect(Y.encodeStateAsUpdate(ctx.doc)).toEqual(before);
    expect(component.yMap.has('tags')).toBe(false);
    expect(component.yMap.has('pivotDocId')).toBe(false);
  });

  test('has nothing to say about a neutral element', () => {
    const shape = ctx.add({
      type: 'shape',
      shapeType: 'rect',
      xywh: '[0,0,10,10]',
    });
    expect(ctx.reading.reading(shape.id)).toBeNull();
    expect(ctx.reading.profileOf(shape.id)).toBeNull();
  });
});

describe('confirming', () => {
  const setTag = tagCommands.find(c => c.id === 'tag.set')!;
  const bindPivot = pivotCommands.find(c => c.id === 'pivot.bind')!;
  const invocation = {
    surface: 'contextual-toolbar',
    source: 'toolbar:general',
  } as const;

  test('a nature goes through `tag.set`, once, and writes it', () => {
    const ctx = setup();
    const component = ctx.addComponent();
    const run = vi.spyOn(setTag, 'run');

    // Exactly what the panel passes when the record proposes a nature the
    // element does not carry.
    setTag.run(ctx.std, invocation, {
      tag: WARDLEY_NATURE_TAG_ID,
      values: [WARDLEY_NATURE.data],
      elementIds: [component.id],
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(
      (component.tags as Y.Map<string[]>).get(WARDLEY_NATURE_TAG_ID)
    ).toEqual([WARDLEY_NATURE.data]);
    run.mockRestore();
  });

  test('a record link goes through `pivot.bind`, once, and writes it', () => {
    const ctx = setup();
    const component = ctx.addComponent();
    const run = vi.spyOn(bindPivot, 'run');

    bindPivot.run(ctx.std, invocation, {
      pivotDocId: RECORD,
      elementIds: [component.id],
    });

    expect(run).toHaveBeenCalledTimes(1);
    expect(component.pivotDocId).toBe(RECORD);
    run.mockRestore();
  });

  test('a read-only document reads, and refuses both writes', () => {
    const ctx = setup();
    ctx.addMap();
    const component = ctx.addComponent();
    ctx.store.readonly = true;

    // The reading itself is untouched: looking at a board one cannot edit is
    // exactly as legitimate as looking at one you can.
    ctx.reading.open(component.id);
    expect(ctx.reading.reading(component.id)?.phase?.zoneId).toBe('product');

    // The panel hides its confirmations on this same fact…
    expect(ctx.std.store.readonly).toBe(true);
    // …and the commands behind them refuse anyway, which is what makes the
    // hidden affordance a courtesy rather than the guard.
    expect(setTag.when?.(ctx.std)).toBe(false);
    expect(bindPivot.when?.(ctx.std)).toBe(false);

    setTag.run(ctx.std, invocation, {
      tag: WARDLEY_NATURE_TAG_ID,
      values: [WARDLEY_NATURE.data],
      elementIds: [component.id],
    });
    bindPivot.run(ctx.std, invocation, {
      pivotDocId: RECORD,
      elementIds: [component.id],
    });

    expect(component.yMap.has('tags')).toBe(false);
    expect(component.pivotDocId).toBeUndefined();
  });
});

/**
 * The record speaks the HOST's alphabet.
 *
 * The scenario is the ordinary one, not an exotic one: a pivot record whose
 * `nature` property is a multi-select holding the words a human picked
 * (`"Activity"`), against an element whose tag values are namespaced ids
 * (`wardley:nature/activity`). Before the resolution these tests pin down, the
 * panel offered a button that wrote `"Activity"` into the document — a value no
 * def describes — and reported a permanent, false drift on an element that was
 * correctly qualified.
 */
describe('what the record says, in the host’s own words', () => {
  const natureProperty = (values: string[]) => [
    {
      key: 'nature',
      label: 'Nature',
      value: { kind: 'tags' as const, value: values },
    },
  ];

  test('a host LABEL resolves to the value id the framework describes', () => {
    const ctx = setup({ properties: natureProperty(['Activity']) });
    const component = ctx.addComponent(0.55, 0.5, { pivotDocId: RECORD });

    const record = readRecord(ctx.std, component, WARDLEY_READING)!;
    // What the panel proposes, and therefore what a confirmation would write:
    // the ID, never the word.
    expect(record.nature).toEqual([WARDLEY_NATURE.activity]);
    expect(record.unknownNature).toBeUndefined();
  });

  test('confirming it writes the framework’s id, not the host’s word', () => {
    const ctx = setup({ properties: natureProperty(['Activity']) });
    const component = ctx.addComponent(0.55, 0.5, { pivotDocId: RECORD });
    const setTag = tagCommands.find(c => c.id === 'tag.set')!;

    const record = readRecord(ctx.std, component, WARDLEY_READING)!;
    setTag.run(
      ctx.std,
      { surface: 'contextual-toolbar', source: 'toolbar:general' },
      {
        tag: WARDLEY_NATURE_TAG_ID,
        values: record.nature,
        elementIds: [component.id],
      }
    );

    expect(
      (component.tags as Y.Map<string[]>).get(WARDLEY_NATURE_TAG_ID)
    ).toEqual([WARDLEY_NATURE.activity]);
  });

  test('a correctly qualified element does not drift against that word', async () => {
    const ctx = setup({ properties: natureProperty(['Activity']) });
    ctx.addMap();
    const component = ctx.addComponent(0.55, 0.5, {
      pivotDocId: RECORD,
      tags: { [WARDLEY_NATURE_TAG_ID]: [WARDLEY_NATURE.activity] },
    });

    const record = readRecord(ctx.std, component, WARDLEY_READING)!;
    const reading = ctx.reading.reading(component.id)!;
    expect(compareReading(reading, record)).toEqual([]);

    ctx.surface.updateElement(component.id, { xywh: '[860,440,18,18]' });
    await settleDrift();
    expect(ctx.reading.drift$.value).toBeNull();
  });

  test('a word no def describes is named, never proposed, never compared', async () => {
    const ctx = setup({ properties: natureProperty(['Bogus']) });
    ctx.addMap();
    const component = ctx.addComponent(0.55, 0.5, { pivotDocId: RECORD });

    const record = readRecord(ctx.std, component, WARDLEY_READING)!;
    // Nothing to confirm — the panel renders the sentence and no button.
    expect(record.nature).toBeUndefined();
    expect(record.unknownNature).toEqual(['Bogus']);
    expect(compareReading(ctx.reading.reading(component.id)!, record)).toEqual(
      []
    );

    ctx.surface.updateElement(component.id, { xywh: '[860,440,18,18]' });
    await settleDrift();
    expect(ctx.reading.drift$.value).toBeNull();
  });

  test('with no pack seeded, every word is unresolvable — and silent', () => {
    const ctx = setup({
      withTagDefs: false,
      properties: natureProperty(['Activity']),
    });
    const component = ctx.addComponent(0.55, 0.5, { pivotDocId: RECORD });

    const record = readRecord(ctx.std, component, WARDLEY_READING)!;
    expect(record.nature).toBeUndefined();
    expect(record.unknownNature).toEqual(['Activity']);
  });
});

describe('the drift trigger', () => {
  test('never fires on the gesture itself, and fires once it has settled', async () => {
    const ctx = setup({
      properties: [
        {
          key: 'phase',
          label: 'Phase',
          value: { kind: 'text', value: 'genesis' },
        },
      ],
    });
    ctx.addMap();
    const component = ctx.addComponent(0.55, 0.5, { pivotDocId: RECORD });
    await settleDrift();
    ctx.reading.drift$.value = null;

    // A drag: the element moves, and the check must not be anywhere near the
    // frame that moved it.
    ctx.surface.updateElement(component.id, { xywh: '[900,400,18,18]' });
    expect(ctx.reading.drift$.value).toBeNull();
    await tick();
    expect(ctx.reading.drift$.value).toBeNull();

    await settleDrift();
    expect(ctx.reading.drift$.value).toMatchObject({
      elementId: component.id,
      pivotDocId: RECORD,
      // The zone's OWN wording, straight out of the background declaration —
      // the library never re-spells a framework's vocabulary.
      fields: [{ field: 'phase', read: 'Product (+Rental)', record: 'genesis' }],
    });
  });

  test('says nothing about an element that is not linked', async () => {
    const ctx = setup({
      properties: [
        { key: 'phase', label: 'Phase', value: { kind: 'text', value: 'genesis' } },
      ],
    });
    ctx.addMap();
    const component = ctx.addComponent();

    ctx.surface.updateElement(component.id, { xywh: '[900,400,18,18]' });
    await settleDrift();

    // Without a record there is nothing to disagree with, and the reading is
    // just a reading.
    expect(ctx.reading.drift$.value).toBeNull();
  });

  test('stays silent on a colleague’s change', async () => {
    const ctx = setup({
      properties: [
        { key: 'phase', label: 'Phase', value: { kind: 'text', value: 'genesis' } },
      ],
    });
    ctx.addMap();
    const component = ctx.addComponent(0.55, 0.5, { pivotDocId: RECORD });
    await settleDrift();
    ctx.reading.drift$.value = null;

    // A second real client: same document, its own clientID. Everything it
    // writes reaches us through `Y.applyUpdate`, which is what makes
    // `transaction.local` false on this side.
    const doc = component.yMap.doc!;
    const remote = new Y.Doc();
    Y.applyUpdate(remote, Y.encodeStateAsUpdate(doc));
    const remoteElements = (
      (remote.getMap('blocks').get(ctx.surface.id) as Y.Map<unknown>).get(
        'prop:elements'
      ) as Y.Map<unknown>
    ).get('value') as Y.Map<Y.Map<unknown>>;
    remote.transact(() => {
      remoteElements.get(component.id)!.set('xywh', '[100,400,18,18]');
    });
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(remote));
    await settleDrift();

    // The change LANDED…
    expect(component.xywh).toBe('[100,400,18,18]');
    // …and this client said nothing about it: `local` partitions the fleet into
    // one watcher and N−1 silent observers, exactly as the materiality
    // publisher does.
    expect(ctx.reading.drift$.value).toBeNull();
  });

  test('degrades to silence with no host provider', async () => {
    const ctx = setup({ withProvider: false });
    ctx.addMap();
    const component = ctx.addComponent(0.55, 0.5, { pivotDocId: RECORD });

    // No provider: no record side at all, so no comparison and no proposal —
    // the panel shows the local reading and nothing else.
    expect(readRecord(ctx.std, component, WARDLEY_READING)).toBeUndefined();

    ctx.surface.updateElement(component.id, { xywh: '[900,400,18,18]' });
    await settleDrift();
    expect(ctx.reading.drift$.value).toBeNull();
  });

  test('an unfilled record property is never a disagreement', async () => {
    const ctx = setup({ properties: [] });
    ctx.addMap();
    const component = ctx.addComponent(0.55, 0.5, { pivotDocId: RECORD });

    const record = readRecord(ctx.std, component, WARDLEY_READING)!;
    const reading = ctx.reading.reading(component.id)!;
    expect(compareReading(reading, record)).toEqual([]);

    ctx.surface.updateElement(component.id, { xywh: '[900,400,18,18]' });
    await settleDrift();
    expect(ctx.reading.drift$.value).toBeNull();
  });
});
