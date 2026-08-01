/**
 * `tag.set` — the promotion rung "component → materialities" (MF3, ADR 0007
 * §§ 4 and 6), driven end to end through the registry's `runCommand` bottleneck
 * against a REAL store.
 *
 * Real, because the three things most worth asserting here are invisible to a
 * stub:
 *
 * - **Undo is one step.** `store.transact()` is not an undo boundary — the
 *   `Y.UndoManager` has no `captureTimeout`, so Yjs merges transactions within
 *   500 ms. Only a real history stack can show that a qualification issued
 *   right after a drag undoes on its own, which is what "promotion never
 *   touches geometry" reduces to from the user's seat.
 * - **The last tag removed removes the KEY**, rather than leaving an empty
 *   nested map that syncs to every peer forever.
 * - **The nested map is mutated IN PLACE**, which is the single reason the
 *   field is a `Y.Map` and not a plain object.
 */
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import { TelemetryProvider } from '@labre/affine-shared/services';
import {
  CommandTelemetryIdentifier,
  isCommandAvailable,
  runCommand,
  SurfaceSelection,
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandInvocation,
} from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
  readElementTags,
} from '@labre/std/gfx';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { beforeEach, describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { getCommandManifest, getCommands } from '../../commands.js';
import { commandTelemetryReporter } from '../../extensions/command-telemetry.js';
import { getInternalStoreExtensions } from '../../extensions/store.js';

const NATURE = 'wardley:nature';
const DATA = 'wardley:nature/data';
const PRACTICE = 'wardley:nature/practice';
const CRITICALITY = 'wardley:criticality';
const HIGH = 'wardley:criticality/high';

const tagCommand = getCommands().find(
  c => c.id === 'tag.set'
) as AnyCommandDescriptor;

const fromPalette: CommandInvocation = {
  surface: 'palette',
  source: 'context-menu',
};

interface Captured {
  event: string;
  payload: Record<string, unknown>;
}

/** A real document with a real surface, plus the smallest `std` the command reads. */
function setup() {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id: 'tag-command' });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const store = collection.createDoc('home').getStore({ id: 'home' });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('MF3') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;

  const events: Captured[] = [];
  let selected: GfxPrimitiveElementModel[] = [];
  let editing = false;

  const gfx = {
    surface,
    get selection() {
      return { selectedElements: selected, editing };
    },
  };

  const std = {
    store,
    selection: {
      filter: (type: unknown) =>
        type === SurfaceSelection
          ? [{ elements: selected.map(el => el.id), editing }]
          : [],
    },
    get: (identifier: unknown) =>
      identifier === GfxControllerIdentifier ? gfx : undefined,
    getOptional: (identifier: unknown) => {
      // The REAL reporter, so `runCommand`'s bottleneck is live: the moment a
      // future edit gives `tag.set` a `telemetry` field while its body still
      // emits, every "exactly one event" assertion below reads 2.
      if (identifier === CommandTelemetryIdentifier) {
        return commandTelemetryReporter;
      }
      if (identifier === TelemetryProvider) {
        return {
          track: (event: string, payload: Record<string, unknown>) =>
            events.push({ event, payload }),
        };
      }
      return undefined;
    },
  } as unknown as BlockStdScope;

  const addShape = (props: Record<string, unknown> = {}) => {
    const id = surface.addElement({
      type: 'shape',
      xywh: '[0,0,100,100]',
      shapeType: 'rect',
      ...props,
    });
    return surface.getElementById(id)!;
  };

  return {
    store,
    surface,
    std,
    events,
    addShape,
    select: (...elements: GfxPrimitiveElementModel[]) => {
      selected = elements;
    },
    setEditing: (value: boolean) => {
      editing = value;
    },
  };
}

const setTag = (
  std: BlockStdScope,
  params: { tag: string; values: string[]; elementIds?: string[] }
) => runCommand(std, tagCommand, fromPalette, params);

describe('the command is in the registry, on the right surfaces', () => {
  test('it is registered, keyless by intent, and selection-gated', () => {
    expect(tagCommand).toBeTruthy();
    expect(tagCommand.owner).toBe('core');
    expect(tagCommand.availability).toBe('selection');
    // Keyless: no default chord, but `toShortcutDescriptor` is total, so
    // Settings › Shortcuts can still bind it.
    expect(tagCommand.defaultKeys).toEqual({ mac: [], other: [] });
    // Not in the senior menu: qualifying is not creating an artefact, and the
    // toolbar entry reaches it through the registry rather than the menu.
    expect(tagCommand.surfaces).toEqual(['palette', 'agent']);
    expect(tagCommand.labelKey).toBeTruthy();
  });

  test('it crosses the host seam carrying no function', () => {
    const entry = getCommandManifest().find(e => e.id === 'tag.set')!;

    expect(entry.availability).toBe('selection');
    expect(entry).not.toHaveProperty('run');
    expect(entry).not.toHaveProperty('when');
    // The zod schema is a graph of functions; serializing settles whether the
    // projection is clean or merely shallow.
    expect(JSON.parse(JSON.stringify(entry))).toEqual(entry);
  });

  test('the agent learns what to send', () => {
    const entry = getCommandManifest().find(e => e.id === 'tag.set')!;

    // Without this, an agent reading the manifest has no way to know the
    // command takes a tag id and a value list, and an argument-less call is a
    // silent no-op.
    expect(entry.params).toEqual([
      { key: 'tag', kind: 'string', required: true },
      { key: 'values', kind: 'string[]', required: true },
      { key: 'elementIds', kind: 'string[]', required: false },
    ]);
  });

  test('availability follows the selection, and `when` narrows it further', () => {
    const { std, addShape, select, setEditing } = setup();

    expect(isCommandAvailable(std, tagCommand)).toBe(false);
    expect(tagCommand.when?.(std)).toBe(false);

    select(addShape());
    expect(isCommandAvailable(std, tagCommand)).toBe(true);
    expect(tagCommand.when?.(std)).toBe(true);

    setEditing(true);
    expect(isCommandAvailable(std, tagCommand)).toBe(false);
  });
});

describe('qualifying an element', () => {
  let ctx!: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  test('the first tag lands as a real nested Y.Map', () => {
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);

    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    expect(shape.yMap.get('tags')).toBeInstanceOf(Y.Map);
    expect(readElementTags(shape)).toEqual({ [NATURE]: [DATA] });
  });

  test('a second tag merges; the map is mutated in place', () => {
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);
    setTag(ctx.std, { tag: NATURE, values: [DATA] });
    const map = shape.tags;

    setTag(ctx.std, { tag: CRITICALITY, values: [HIGH] });

    // In place, NOT replaced: replacing the map restores whole-blob
    // last-write-wins and silently drops a concurrent edit on another tag.
    expect(shape.tags).toBe(map);
    expect(readElementTags(shape)).toEqual({
      [NATURE]: [DATA],
      [CRITICALITY]: [HIGH],
    });
  });

  test('an empty value list removes the tag, and the last one removes the key', () => {
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);
    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    setTag(ctx.std, { tag: NATURE, values: [] });

    expect(readElementTags(shape)).toEqual({});
    // Back to costing nothing, exactly like an element that never was
    // qualified — no tombstone syncing to every peer forever.
    expect(shape.yMap.has('tags')).toBe(false);
    expect(shape.serialize()).not.toHaveProperty('tags');
  });

  test('promotion touches no geometry and never swaps the element', () => {
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);
    const before = { ...shape.serialize() };

    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    expect(shape.type).toBe(before.type);
    expect(shape.xywh).toBe(before.xywh);
    expect(shape.index).toBe(before.index);
    expect(shape.seed).toBe(before.seed);
    expect(shape.rotate).toBe(before.rotate);
    expect(shape.role).toBe('wardley:component');
  });

  test('no rung requires the previous one', () => {
    // A plain rectangle with no role and no binding can still be qualified:
    // the rungs are independent axes, ordered only by what is USEFUL.
    const shape = ctx.addShape();
    ctx.select(shape);

    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    expect(readElementTags(shape)).toEqual({ [NATURE]: [DATA] });
    expect(shape.role).toBeUndefined();
    expect(shape.pivotDocId).toBeUndefined();
  });

  test('explicit elementIds win over the selection; an empty array does nothing', () => {
    const selectedShape = ctx.addShape();
    const target = ctx.addShape();
    ctx.select(selectedShape);

    setTag(ctx.std, { tag: NATURE, values: [DATA], elementIds: [target.id] });
    expect(readElementTags(target)).toEqual({ [NATURE]: [DATA] });
    expect(readElementTags(selectedShape)).toEqual({});

    // "These zero elements" is not "fall back to the selection": an agent that
    // computed a target list and came up empty must not have its gesture
    // redirected onto whatever the user happened to have selected.
    setTag(ctx.std, { tag: CRITICALITY, values: [HIGH], elementIds: [] });
    expect(readElementTags(selectedShape)).toEqual({});
  });

  test('one gesture qualifies a whole selection', () => {
    const a = ctx.addShape({ role: 'wardley:component' });
    const b = ctx.addShape({ role: 'wardley:component' });
    ctx.select(a, b);

    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    expect(readElementTags(a)).toEqual({ [NATURE]: [DATA] });
    expect(readElementTags(b)).toEqual({ [NATURE]: [DATA] });
    // One event with a count, not N events — cheaper and more truthful.
    expect(ctx.events).toHaveLength(1);
    expect(ctx.events[0].payload.elementCount).toBe(2);
  });

  test('invalid params are refused without writing anything', () => {
    const shape = ctx.addShape();
    ctx.select(shape);

    expect(() =>
      runCommand(ctx.std, tagCommand, fromPalette, { tag: NATURE })
    ).not.toThrow();
    expect(shape.yMap.has('tags')).toBe(false);
    expect(ctx.events).toEqual([]);
  });
});

describe('undo', () => {
  test('a qualification issued right after a drag undoes on its own', () => {
    const ctx = setup();
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);

    // A drag: the geometry write the promotion must never be merged with.
    ctx.store.captureSync();
    ctx.surface.updateElement(shape.id, { xywh: '[40,40,100,100]' });

    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    ctx.store.undo();

    // Without `captureSync()` BEFORE the write, Yjs's 500 ms default merges the
    // two transactions and this single undo would revert the move as well —
    // so from the user's seat the qualification DID move geometry, breaking
    // two of the ladder's own invariants at once.
    expect(readElementTags(shape)).toEqual({});
    expect(shape.xywh).toBe('[40,40,100,100]');
  });

  test('undoing a per-tag write restores the other tags', () => {
    const ctx = setup();
    const shape = ctx.addShape();
    ctx.select(shape);
    setTag(ctx.std, { tag: NATURE, values: [DATA] });
    setTag(ctx.std, { tag: CRITICALITY, values: [HIGH] });

    ctx.store.undo();

    expect(readElementTags(shape)).toEqual({ [NATURE]: [DATA] });
  });
});

describe('a read-only document is never written to', () => {
  let ctx!: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  test('the command is not offered', () => {
    ctx.select(ctx.addShape());
    expect(tagCommand.when?.(ctx.std)).toBe(true);

    ctx.store.readonly = true;

    // `availability: 'selection'` cannot express this — the union holds ONE
    // value per command and does not compose — so `when` carries the state
    // precondition.
    expect(tagCommand.when?.(ctx.std)).toBe(false);
  });

  test('qualifying writes nothing, throws nothing, and emits nothing', () => {
    const shape = ctx.addShape();
    ctx.select(shape);
    ctx.store.readonly = true;

    expect(() =>
      setTag(ctx.std, { tag: NATURE, values: [DATA] })
    ).not.toThrow();
    expect(shape.yMap.has('tags')).toBe(false);
    expect(ctx.events).toEqual([]);
  });

  test('REMOVING a tag is refused too — the destructive half', () => {
    const shape = ctx.addShape();
    ctx.select(shape);
    setTag(ctx.std, { tag: NATURE, values: [DATA] });
    ctx.events.length = 0;
    ctx.store.readonly = true;

    setTag(ctx.std, { tag: NATURE, values: [] });

    // The half that would actually have succeeded: both `Store.transact` and
    // `clearField` carry no read-only guard of their own, so a document the
    // user cannot edit would have lost a persisted qualification — and reported
    // the promotion while doing it.
    expect(readElementTags(shape)).toEqual({ [NATURE]: [DATA] });
    expect(ctx.events).toEqual([]);
  });

  test('the guard is in `run`, not only in `when`', () => {
    const shape = ctx.addShape();
    ctx.store.readonly = true;

    // `runCommand` consults neither `when` nor `availability`, so a caller that
    // skips both — which the palette and the agent do — must still be stopped.
    runCommand(ctx.std, tagCommand, fromPalette, {
      tag: NATURE,
      values: [DATA],
      elementIds: [shape.id],
    });

    expect(shape.yMap.has('tags')).toBe(false);
    expect(ctx.events).toEqual([]);
  });
});

describe('telemetry', () => {
  let ctx!: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  test('one gesture, one FrameworkElementPromoted on the tag rung', () => {
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);

    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    expect(ctx.events).toHaveLength(1);
    expect(ctx.events[0]).toEqual({
      event: 'FrameworkElementPromoted',
      payload: {
        page: 'whiteboard editor',
        framework: 'wardley',
        rung: 'tag',
        direction: 'promote',
        role: 'wardley:component',
        elementCount: 1,
        control: 'context-menu',
        module: 'palette',
      },
    });
  });

  test('clearing a tag is a demotion', () => {
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);
    setTag(ctx.std, { tag: NATURE, values: [DATA] });
    ctx.events.length = 0;

    setTag(ctx.std, { tag: NATURE, values: [] });

    expect(ctx.events[0].payload.direction).toBe('demote');
  });

  test('a gesture that changes nothing is not reported', () => {
    const shape = ctx.addShape();
    ctx.select(shape);
    setTag(ctx.std, { tag: NATURE, values: [DATA] });
    ctx.events.length = 0;

    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    expect(ctx.events).toEqual([]);
  });

  test('a roleless element belongs to no framework, and says so by omission', () => {
    const shape = ctx.addShape();
    ctx.select(shape);

    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    // Absent rather than `'unknown'`, per the repo convention: no rung requires
    // the previous one, so a plain rectangle carrying a tag is a legal state
    // that belongs to no framework. The library must not invent an identity.
    expect(ctx.events[0].payload.framework).toBeUndefined();
    expect(ctx.events[0].payload.role).toBeUndefined();
  });

  test('a selection whose roles disagree omits the role rather than guessing', () => {
    const a = ctx.addShape({ role: 'wardley:component' });
    const b = ctx.addShape({ role: 'wardley:market' });
    ctx.select(a, b);

    setTag(ctx.std, { tag: NATURE, values: [PRACTICE] });

    expect(ctx.events).toHaveLength(1);
    expect(ctx.events[0].payload.role).toBeUndefined();
    expect(ctx.events[0].payload.elementCount).toBe(2);
  });

  test('no board content ever reaches the event', () => {
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);

    setTag(ctx.std, { tag: NATURE, values: [DATA] });

    // Ids only: which rung was crossed, in which direction, under which role.
    // The chosen VALUES are not in the payload — they are board content.
    const serialized = JSON.stringify(ctx.events[0].payload);
    expect(serialized).not.toContain(DATA);
  });
});
