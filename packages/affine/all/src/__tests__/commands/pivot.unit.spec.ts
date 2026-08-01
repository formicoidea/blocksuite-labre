/**
 * `pivot.bind` — the promotion rung "role → component" (MF1, ADRs 0005 § 3 and
 * 0007 § 6), driven end to end through the registry's `runCommand` bottleneck
 * against a REAL store.
 *
 * Real, because the two things most worth asserting here are invisible to a
 * stub:
 *
 * - **Undo is one step.** `store.transact()` is not an undo boundary — the
 *   `Y.UndoManager` has no `captureTimeout`, so Yjs merges transactions within
 *   500 ms. Only a real history stack can show that a bind issued right after
 *   a drag undoes on its own, which is the invariant "promotion never touches
 *   geometry" reduces to from the user's seat.
 * - **Unbinding removes the KEY.** The `@field()` setter is unconditional, so
 *   assigning `undefined` would leave a tombstone that syncs to every peer.
 */
import { StoreExtensionManager } from '@labre/affine-ext-loader';
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import {
  PivotPropertiesConfigIdentifier,
  PivotPropertiesProvider,
  TelemetryProvider,
  type PivotPropertiesService,
} from '@labre/affine-shared/services';
import {
  CommandTelemetryIdentifier,
  isCommandAvailable,
  runCommand,
  SurfaceSelection,
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandInvocation,
} from '@labre/std';
import { GfxControllerIdentifier, GfxPrimitiveElementModel } from '@labre/std/gfx';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { computed } from '@preact/signals-core';
import { beforeEach, describe, expect, test, vi } from 'vitest';

import { getCommandManifest, getCommands } from '../../commands.js';
import { commandTelemetryReporter } from '../../extensions/command-telemetry.js';
import { getInternalStoreExtensions } from '../../extensions/store.js';

const RECORD = 'pivot-payments';
const OTHER_RECORD = 'pivot-onboarding';

const bindCommand = getCommands().find(
  c => c.id === 'pivot.bind'
) as AnyCommandDescriptor;

const fromPalette: CommandInvocation = {
  surface: 'palette',
  source: 'context-menu',
};

interface Captured {
  event: string;
  payload: Record<string, unknown>;
}

/**
 * A real document with a real surface, plus the smallest `std` the command
 * reads. The provider is registered as a SPY: the hard rule of ADR 0005 § 3 is
 * that the binding path never calls it, and the only way to prove a negative
 * is to have something that would notice.
 */
function setup() {
  const manager = new StoreExtensionManager(getInternalStoreExtensions({}));
  const collection = new TestWorkspace({ id: 'pivot-command' });
  collection.storeExtensions = manager.get('store');
  collection.meta.initialize();

  const store = collection.createDoc('home').getStore({ id: 'home' });
  let surfaceId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('MF1') });
    surfaceId = store.addBlock('affine:surface', {}, rootId);
  });
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;

  const events: Captured[] = [];
  const providerCalls: string[] = [];
  let selected: GfxPrimitiveElementModel[] = [];
  let editing = false;

  const pivotProvider: PivotPropertiesService = {
    properties$: pivotDocId => {
      providerCalls.push(`properties$:${pivotDocId}`);
      return computed(() => ({ status: 'loading' }) as const);
    },
    peek: pivotDocId => {
      providerCalls.push(`peek:${pivotDocId}`);
      return undefined;
    },
    publishOccurrenceMaterialities: patch => {
      providerCalls.push(`publish:${patch.pivotDocId}`);
    },
  };

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
      // future edit gives `pivot.bind` a `telemetry` field while its body still
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
      if (identifier === PivotPropertiesProvider) return pivotProvider;
      if (identifier === PivotPropertiesConfigIdentifier) {
        return { hoverFields: ['owner', 'status'] };
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

  const select = (...elements: GfxPrimitiveElementModel[]) => {
    selected = elements;
  };

  return {
    store,
    surface,
    std,
    events,
    providerCalls,
    addShape,
    select,
    setEditing: (value: boolean) => {
      editing = value;
    },
  };
}

const bind = (
  std: BlockStdScope,
  params: { pivotDocId: string | null; elementIds?: string[] }
) => runCommand(std, bindCommand, fromPalette, params);

describe('the command is in the registry, on the right surfaces', () => {
  test('it is registered, keyless by intent, and selection-gated', () => {
    expect(bindCommand).toBeTruthy();
    expect(bindCommand.owner).toBe('core');
    expect(bindCommand.availability).toBe('selection');
    // Keyless: no default chord, but `toShortcutDescriptor` is total, so
    // Settings › Shortcuts can still bind it.
    expect(bindCommand.defaultKeys).toEqual({ mac: [], other: [] });
    // Not in the senior menu: it is not a framework artefact, and the UI that
    // picks WHICH record lives host-side (MF2).
    expect(bindCommand.surfaces).toEqual(['palette', 'agent']);
    expect(bindCommand.labelKey).toBeTruthy();
  });

  test('it crosses the host seam carrying no function', () => {
    const entry = getCommandManifest().find(e => e.id === 'pivot.bind')!;

    expect(entry.availability).toBe('selection');
    expect(entry).not.toHaveProperty('run');
    expect(entry).not.toHaveProperty('when');
    for (const value of Object.values(entry)) {
      expect(typeof value).not.toBe('function');
    }
    // The zod schema is a graph of functions; the assertion above only reads
    // the top level, so it would pass either by the projection being clean or
    // by there being nothing to project. Serializing settles it.
    expect(JSON.parse(JSON.stringify(entry))).toEqual(entry);
  });

  test('the agent learns what to send', () => {
    const entry = getCommandManifest().find(e => e.id === 'pivot.bind')!;

    // Without this, an agent reading the manifest has no way to know the
    // command takes a record id, and an argument-less call is a silent no-op.
    expect(entry.params).toEqual([
      { key: 'pivotDocId', kind: 'string', required: true, nullable: true },
      { key: 'elementIds', kind: 'string[]', required: false },
    ]);
  });

  test('a nullary command advertises no parameters', () => {
    const undoEntry = getCommandManifest().find(e => e.id === 'undo')!;
    expect(undoEntry.params).toBeUndefined();
  });

  test('availability follows the selection, and `when` narrows it further', () => {
    const { std, addShape, select, setEditing } = setup();

    expect(isCommandAvailable(std, bindCommand)).toBe(false);
    expect(bindCommand.when?.(std)).toBe(false);

    const shape = addShape();
    select(shape);
    expect(isCommandAvailable(std, bindCommand)).toBe(true);
    expect(bindCommand.when?.(std)).toBe(true);

    // A keystroke aimed at a canvas text editor belongs to that editor.
    setEditing(true);
    expect(isCommandAvailable(std, bindCommand)).toBe(false);
  });
});

describe('a read-only document is never written to', () => {
  let ctx!: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  test('the command is not offered', () => {
    const shape = ctx.addShape();
    ctx.select(shape);
    expect(bindCommand.when?.(ctx.std)).toBe(true);

    ctx.store.readonly = true;

    // `availability: 'selection'` cannot express this — the union holds ONE
    // value per command and does not compose — so `when` carries the state
    // precondition. A surface that consults it stops here.
    expect(bindCommand.when?.(ctx.std)).toBe(false);
  });

  test('binding writes nothing, throws nothing, and emits nothing', () => {
    const shape = ctx.addShape();
    ctx.select(shape);
    ctx.store.readonly = true;

    // Before the guard this threw `Cannot update element in readonly mode` out
    // of `runCommand`, into the palette or the agent that called it.
    expect(() => bind(ctx.std, { pivotDocId: RECORD })).not.toThrow();
    expect(shape.pivotDocId).toBeUndefined();
    expect(ctx.events).toEqual([]);
  });

  test('UNBINDING does not delete the key — the destructive half', () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.select(shape);
    ctx.store.readonly = true;

    bind(ctx.std, { pivotDocId: null });

    // This is the one that actually succeeded: `clearField` goes through
    // `Store.transact`, which carries no read-only guard of its own, so a
    // document the user cannot edit lost a persisted value — and reported the
    // promotion while doing it.
    expect(shape.pivotDocId).toBe(RECORD);
    expect(shape.yMap.has('pivotDocId')).toBe(true);
    expect(ctx.events).toEqual([]);
  });

  test('the guard is in `run`, not only in `when`', () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.store.readonly = true;

    // `runCommand` consults neither `when` nor `availability`, so a caller that
    // skips both — which the palette and the agent do — must still be stopped.
    runCommand(ctx.std, bindCommand, fromPalette, {
      pivotDocId: null,
      elementIds: [shape.id],
    });

    expect(shape.pivotDocId).toBe(RECORD);
    expect(ctx.events).toEqual([]);
  });

  test('lifting read-only lets the same gesture through', () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.select(shape);
    ctx.store.readonly = true;
    bind(ctx.std, { pivotDocId: null });

    ctx.store.readonly = false;
    bind(ctx.std, { pivotDocId: null });

    expect(shape.pivotDocId).toBeUndefined();
    expect(ctx.events).toHaveLength(1);
  });
});

describe('binding, re-binding, unbinding', () => {
  let ctx!: ReturnType<typeof setup>;

  beforeEach(() => {
    ctx = setup();
  });

  test('it writes the binding on the selection', () => {
    const shape = ctx.addShape();
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: RECORD });

    expect(shape.pivotDocId).toBe(RECORD);
    expect(shape.yMap.get('pivotDocId')).toBe(RECORD);
  });

  test('explicit element ids act instead of the selection', () => {
    const selectedShape = ctx.addShape();
    const target = ctx.addShape();
    ctx.select(selectedShape);

    // How a host picker or an agent acts on something other than what is
    // currently selected.
    bind(ctx.std, { pivotDocId: RECORD, elementIds: [target.id] });

    expect(target.pivotDocId).toBe(RECORD);
    expect(selectedShape.pivotDocId).toBeUndefined();
  });

  test('re-promotion replaces the record', () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: OTHER_RECORD });

    expect(shape.pivotDocId).toBe(OTHER_RECORD);
  });

  test('unbinding removes the key rather than leaving a tombstone', () => {
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: null });

    expect(shape.pivotDocId).toBeUndefined();
    // Assigning `undefined` through the accessor would leave the key behind and
    // sync the phantom to every peer; `clearField` deletes it.
    expect(shape.yMap.has('pivotDocId')).toBe(false);
    expect(shape.serialize()).not.toHaveProperty('pivotDocId');
  });

  test('several selected elements become several occurrences of one record', () => {
    const first = ctx.addShape();
    const second = ctx.addShape();
    ctx.select(first, second);

    bind(ctx.std, { pivotDocId: RECORD });

    expect([first.pivotDocId, second.pivotDocId]).toEqual([RECORD, RECORD]);
  });

  test('invalid params are refused without touching the document', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.select(shape);

    // The key is REQUIRED on purpose: a forgotten argument must not silently
    // destroy a binding.
    runCommand(ctx.std, bindCommand, fromPalette, {});
    runCommand(ctx.std, bindCommand, fromPalette, { pivotDocId: '' });

    expect(shape.pivotDocId).toBe(RECORD);
    expect(ctx.events).toEqual([]);
    expect(error).toHaveBeenCalledTimes(2);
    error.mockRestore();
  });

  test('an empty selection is a no-op', () => {
    bind(ctx.std, { pivotDocId: RECORD });
    expect(ctx.events).toEqual([]);
  });
});

describe('undo is one step, and it is only the binding', () => {
  test('a bind issued right after a move undoes on its own', () => {
    const ctx = setup();
    const shape = ctx.addShape();
    ctx.select(shape);

    // A drag, immediately followed by the promotion. Without `captureSync()`
    // BEFORE the write, Yjs's 500 ms default merges the two transactions and a
    // single Ctrl+Z reverts both — so from the user's seat the promotion DID
    // move geometry, breaking the ladder's own invariant.
    ctx.store.captureSync();
    ctx.surface.updateElement(shape.id, { xywh: '[50,50,100,100]' });
    bind(ctx.std, { pivotDocId: RECORD });

    ctx.store.undo();

    expect(shape.pivotDocId).toBeUndefined();
    expect(shape.xywh).toBe('[50,50,100,100]');

    ctx.store.undo();
    expect(shape.xywh).toBe('[0,0,100,100]');
  });

  test('redo restores the binding', () => {
    const ctx = setup();
    const shape = ctx.addShape();
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: RECORD });
    ctx.store.undo();
    ctx.store.redo();

    expect(shape.pivotDocId).toBe(RECORD);
  });

  test('undoing an unbind restores the binding in one step', () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: null });
    expect(shape.pivotDocId).toBeUndefined();

    ctx.store.undo();

    expect(shape.pivotDocId).toBe(RECORD);
  });
});

describe('telemetry — one event per gesture, and it is not a creation', () => {
  test('a promotion reports the rung, the direction and the framework', () => {
    const ctx = setup();
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: RECORD });

    // Emitted exactly once. `FrameworkElementAdded` would have been wrong AND
    // costly: a promotion inserts nothing, so reusing it would count a
    // drawn-then-bound shape twice, forever (ADR 0007 § 7).
    expect(ctx.events).toEqual([
      {
        event: 'FrameworkElementPromoted',
        payload: {
          page: 'whiteboard editor',
          framework: 'wardley',
          rung: 'pivot',
          direction: 'promote',
          role: 'wardley:component',
          elementCount: 1,
          control: 'context-menu',
          module: 'palette',
        },
      },
    ]);
  });

  test('unbinding reports the reverse direction', () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD, role: 'wardley:market' });
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: null });

    expect(ctx.events[0].payload).toMatchObject({
      rung: 'pivot',
      direction: 'demote',
      framework: 'wardley',
      elementCount: 1,
    });
  });

  test('a roleless element reports no framework rather than inventing one', () => {
    const ctx = setup();
    const shape = ctx.addShape();
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: RECORD });

    // No rung requires the previous one (ADR 0007 § 6): a plain rectangle may
    // be bound to a record, and it belongs to no framework.
    expect(ctx.events[0].payload.framework).toBeUndefined();
    expect(ctx.events[0].payload.role).toBeUndefined();
  });

  test('a gesture spanning disagreeing roles reports neither role nor framework', () => {
    const ctx = setup();
    const wardley = ctx.addShape({ role: 'wardley:component' });
    const plain = ctx.addShape();
    ctx.select(wardley, plain);

    bind(ctx.std, { pivotDocId: RECORD });

    expect(ctx.events).toHaveLength(1);
    expect(ctx.events[0].payload).toMatchObject({ elementCount: 2 });
    expect(ctx.events[0].payload.role).toBeUndefined();
  });

  test('the bottleneck stays silent — no command emits twice', () => {
    const ctx = setup();
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);

    // `runCommand` calls the REAL reporter here (see `setup`). A command that
    // emits from its body must therefore NOT declare `telemetry`, or the
    // gesture reports twice — once as a promotion, once as a creation. The
    // exception ADR 0008 records comes with this guard attached.
    expect(bindCommand.telemetry).toBeUndefined();
    bind(ctx.std, { pivotDocId: RECORD });
    expect(ctx.events).toHaveLength(1);
  });

  test('a gesture that changes nothing emits nothing', () => {
    const ctx = setup();
    const shape = ctx.addShape({ pivotDocId: RECORD });
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: RECORD });

    expect(ctx.events).toEqual([]);
  });

  test('only the elements that actually changed are counted', () => {
    const ctx = setup();
    const already = ctx.addShape({ pivotDocId: RECORD });
    const fresh = ctx.addShape();
    ctx.select(already, fresh);

    bind(ctx.std, { pivotDocId: RECORD });

    expect(ctx.events[0].payload.elementCount).toBe(1);
  });
});

describe('the pivot record is never on the critical path', () => {
  test('creating, moving and binding never touch the provider', () => {
    const ctx = setup();

    const shape = ctx.addShape();
    ctx.surface.updateElement(shape.id, { xywh: '[10,10,100,100]' });
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: RECORD });
    bind(ctx.std, { pivotDocId: OTHER_RECORD });
    bind(ctx.std, { pivotDocId: null });

    // The invariant that makes the pivot record safe to introduce at all: the
    // binding gesture is one transaction and cannot be slowed, blocked or
    // failed by the host's data layer. A binding to a record that does not
    // exist is a legal, persisted state — the command never checks.
    expect(ctx.providerCalls).toEqual([]);
  });

  test('binding to a record that does not exist still succeeds', () => {
    const ctx = setup();
    const shape = ctx.addShape();
    ctx.select(shape);

    bind(ctx.std, { pivotDocId: 'a-record-nobody-has-created-yet' });

    expect(shape.pivotDocId).toBe('a-record-nobody-has-created-yet');
  });

  test('the gesture changes no geometry, no type and no style', () => {
    const ctx = setup();
    const shape = ctx.addShape({ role: 'wardley:component' });
    ctx.select(shape);
    const before = { ...shape.serialize() };

    bind(ctx.std, { pivotDocId: RECORD });

    const after = shape.serialize();
    // Promotion is never a conversion: no element is created, destroyed or
    // swapped, and `xywh` / `index` / `seed` / every style field are untouched.
    expect(after.type).toBe(before.type);
    expect(after.xywh).toBe(before.xywh);
    expect(after.index).toBe(before.index);
    expect(after.seed).toBe(before.seed);
    expect(after.role).toBe(before.role);
    expect(Object.keys(after).filter(k => !(k in before))).toEqual([
      'pivotDocId',
    ]);
  });
});
