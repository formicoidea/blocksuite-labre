/**
 * `DocumentDamageTelemetryWatcher` — "how many documents open damaged" (#318).
 *
 * The three properties the metric depends on, and what breaks without each:
 *
 * 1. **The opening batch is READ, not awaited.** Element models are built when
 *    the surface block model is created, long before this watcher is mounted,
 *    so a subscription alone would count zero for every document that opened
 *    damaged — i.e. for the whole population being measured.
 * 2. **One event per batch, not per element.** A document with forty broken
 *    elements is one damaged document; forty events would make the count of
 *    distinct documents unreadable.
 * 3. **Ids are deduplicated for the watcher's lifetime.** A resync that
 *    re-announces an element already counted must add nothing.
 * 4. **One event per REASON in a batch (#669, ADR 0053).** An element skipped
 *    because a newer client wrote it is not a bound that never arrived; with a
 *    single hard-coded reason, every skipped element would have been counted
 *    as `missing-xywh`.
 */
import type { BlockStdScope } from '@labre/std';
import type {
  SurfaceDamageReason,
  SurfaceElementDamageReport,
} from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { DocumentDamageTelemetryWatcher } from '../../services/telemetry-service/document-damage-watcher.js';
import {
  TelemetryProvider,
  type TelemetryEventMap,
} from '../../services/telemetry-service/index.js';

/** The surface API the watcher touches, and nothing else. */
function fakeSurface(
  damagedIds: string[] = [],
  reasonOf: (id: string) => SurfaceDamageReason = () => 'missing-xywh'
) {
  const listeners = new Set<(report: SurfaceElementDamageReport) => void>();
  let unsubscribed = 0;
  return {
    flavour: 'affine:surface',
    damagedElements: new Map(
      damagedIds.map(id => [id, { type: 'shape', reason: reasonOf(id) }])
    ),
    elementDamaged: {
      subscribe: (next: (report: SurfaceElementDamageReport) => void) => {
        listeners.add(next);
        return {
          unsubscribe: () => {
            unsubscribed++;
            listeners.delete(next);
          },
        };
      },
    },
    /** A later arrival, the way a remote sync delivers one. */
    damage(id: string, reason: SurfaceDamageReason = 'missing-xywh') {
      listeners.forEach(next => next({ id, type: 'shape', reason }));
    },
    unsubscribedCount: () => unsubscribed,
  };
}

function setup(surfaces: ReturnType<typeof fakeSurface>[], withAdapter = true) {
  const events: { event: keyof TelemetryEventMap; props: unknown }[] = [];
  const telemetry = {
    track: (event: keyof TelemetryEventMap, props: unknown) =>
      events.push({ event, props }),
  };
  const std = {
    getOptional: (identifier: unknown) =>
      withAdapter && identifier === TelemetryProvider ? telemetry : undefined,
    store: { getModelsByFlavour: () => surfaces },
  } as unknown as BlockStdScope;

  return { watcher: new DocumentDamageTelemetryWatcher(std), events };
}

/** Lets the watcher's `queueMicrotask` batch run. */
const settle = () => Promise.resolve();

describe('DocumentDamageTelemetryWatcher', () => {
  test('a document opening with two damaged elements reports once', () => {
    const { watcher, events } = setup([fakeSurface(['a', 'b'])]);

    watcher.mounted();

    expect(events).toEqual([
      {
        event: 'DocumentDamaged',
        props: { reason: 'missing-xywh', elementCount: 2 },
      },
    ]);
  });

  test('a healthy document reports nothing', () => {
    const { watcher, events } = setup([fakeSurface()]);

    watcher.mounted();

    expect(events).toEqual([]);
  });

  test('a later arrival is one more event, a repeat is none', async () => {
    const surface = fakeSurface(['a', 'b']);
    const { watcher, events } = setup([surface]);
    watcher.mounted();

    surface.damage('c');
    await settle();
    expect(events).toHaveLength(2);
    expect(events[1]).toEqual({
      event: 'DocumentDamaged',
      props: { reason: 'missing-xywh', elementCount: 1 },
    });

    // The same id again — a resync, an undo on a peer — adds nothing, whether
    // it was counted in the opening batch or in a later one.
    surface.damage('c');
    surface.damage('a');
    await settle();
    expect(events).toHaveLength(2);
  });

  test('several arrivals in one turn are one event, not one each', async () => {
    const surface = fakeSurface();
    const { watcher, events } = setup([surface]);
    watcher.mounted();

    surface.damage('a');
    surface.damage('b');
    surface.damage('c');
    await settle();

    expect(events).toEqual([
      {
        event: 'DocumentDamaged',
        props: { reason: 'missing-xywh', elementCount: 3 },
      },
    ]);
  });

  test('a batch mixing reasons is one event per reason', async () => {
    const surface = fakeSurface(['a', 'b', 'c'], id =>
      id === 'a' ? 'missing-xywh' : 'unknown-type'
    );
    const { watcher, events } = setup([surface]);

    watcher.mounted();
    expect(events).toEqual([
      {
        event: 'DocumentDamaged',
        props: { reason: 'missing-xywh', elementCount: 1 },
      },
      {
        event: 'DocumentDamaged',
        props: { reason: 'unknown-type', elementCount: 2 },
      },
    ]);

    surface.damage('d', 'unreadable');
    surface.damage('e', 'unknown-type');
    await settle();
    expect(events.slice(2)).toEqual([
      {
        event: 'DocumentDamaged',
        props: { reason: 'unreadable', elementCount: 1 },
      },
      {
        event: 'DocumentDamaged',
        props: { reason: 'unknown-type', elementCount: 1 },
      },
    ]);
  });

  test('unmounted unsubscribes and drops what was in flight', async () => {
    const surface = fakeSurface();
    const { watcher, events } = setup([surface]);
    watcher.mounted();

    surface.damage('a');
    watcher.unmounted();
    await settle();

    expect(events).toEqual([]);
    expect(surface.unsubscribedCount()).toBe(1);
  });

  test('no adapter: nothing is subscribed and nothing throws', async () => {
    const surface = fakeSurface(['a']);
    const { watcher, events } = setup([surface], false);

    expect(() => watcher.mounted()).not.toThrow();
    surface.damage('b');
    await settle();

    expect(events).toEqual([]);
    expect(() => watcher.unmounted()).not.toThrow();
  });
});
