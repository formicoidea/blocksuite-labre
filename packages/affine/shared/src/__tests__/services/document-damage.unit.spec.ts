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
 */
import type { BlockStdScope } from '@labre/std';
import type { SurfaceElementDamageReport } from '@labre/std/gfx';
import { describe, expect, test } from 'vitest';

import { DocumentDamageTelemetryWatcher } from '../../services/telemetry-service/document-damage-watcher.js';
import {
  TelemetryProvider,
  type TelemetryEventMap,
} from '../../services/telemetry-service/index.js';

/** The surface API the watcher touches, and nothing else. */
function fakeSurface(damagedIds: string[] = []) {
  const listeners = new Set<(report: SurfaceElementDamageReport) => void>();
  let unsubscribed = 0;
  return {
    flavour: 'affine:surface',
    damagedElements: new Map(
      damagedIds.map(id => [id, { type: 'shape', reason: 'missing-xywh' }])
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
    damage(id: string) {
      listeners.forEach(next =>
        next({ id, type: 'shape', reason: 'missing-xywh' })
      );
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
