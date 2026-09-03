import { describe, expect, test } from 'vitest';

import {
  ABANDON_WINDOW_MS,
  BlockLifecycleTracker,
  IDLE_GAP_MS,
} from '../../services/telemetry-service/block-lifecycle-watcher.js';
import type { TelemetryEventMap } from '../../services/telemetry-service/index.js';

function setup(startAt = 1_000) {
  let now = startAt;
  const events: { event: keyof TelemetryEventMap; props: unknown }[] = [];
  const tracker = new BlockLifecycleTracker(
    { track: (event, props) => events.push({ event, props }) },
    () => now
  );
  return {
    tracker,
    events,
    names: () => events.map(e => e.event),
    tick: (ms: number) => (now += ms),
  };
}

const add = (id: string, init = false) =>
  ({
    type: 'add',
    id,
    flavour: 'affine:note',
    isLocal: true,
    init,
  }) as const;
const update = (id: string) =>
  ({ type: 'update', id, flavour: 'affine:note', isLocal: true }) as const;
const del = (id: string) =>
  ({ type: 'delete', id, flavour: 'affine:note', isLocal: true }) as const;

describe('BlockLifecycleTracker', () => {
  test('reports canvas flavours only — prose never reaches the bus', () => {
    const { tracker, events, tick } = setup();
    for (const flavour of ['affine:paragraph', 'affine:list', 'affine:page']) {
      tracker.handle({ ...add('p'), flavour });
      tracker.handle({ ...update('p'), flavour });
      tick(1_000);
      tracker.handle({ ...del('p'), flavour });
    }
    tracker.flush();
    expect(events).toEqual([]);

    // Canvas blocks and every embed card do report.
    tracker.handle({ ...update('s'), flavour: 'affine:surface' });
    tracker.handle({ ...update('e'), flavour: 'affine:embed-linked-doc' });
    expect(events.map(e => (e.props as { flavour: string }).flavour)).toEqual([
      'affine:surface',
      'affine:embed-linked-doc',
    ]);
  });

  test('ignores remote and initial-load mutations', () => {
    const { tracker, events } = setup();
    tracker.handle({ ...update('a'), isLocal: false });
    tracker.handle({ ...del('a'), isLocal: false });
    tracker.handle(add('b', true));
    tracker.handle(del('b'));
    // The delete of a loaded block is local: BlockDeleted only, no abandon.
    expect(events).toEqual([
      { event: 'BlockDeleted', props: { flavour: 'affine:note' } },
    ]);
  });

  test('one editing session = one BlockEdited + one BlockUsageDuration', () => {
    const { tracker, names, events, tick } = setup();
    tracker.handle(update('a'));
    tick(5_000);
    tracker.handle(update('a'));
    tick(5_000);
    tracker.handle(update('a'));
    expect(names()).toEqual(['BlockEdited']);

    // Next edit after the idle gap closes the session and opens a new one.
    tick(IDLE_GAP_MS + 1);
    tracker.handle(update('a'));
    expect(names()).toEqual([
      'BlockEdited',
      'BlockUsageDuration',
      'BlockEdited',
    ]);
    expect(events[1].props).toEqual({
      flavour: 'affine:note',
      durationMs: 10_000,
    });
  });

  test('delete shortly after create emits BlockAbandoned with age', () => {
    const { tracker, names, events, tick } = setup();
    tracker.handle(add('a'));
    tick(ABANDON_WINDOW_MS - 1);
    tracker.handle(del('a'));
    expect(names()).toEqual(['BlockDeleted', 'BlockAbandoned']);
    expect(events[1].props).toEqual({
      flavour: 'affine:note',
      reason: 'deleted-after-create',
      ageMs: ABANDON_WINDOW_MS - 1,
    });
  });

  test('delete after the abandon window is a plain BlockDeleted', () => {
    const { tracker, names, tick } = setup();
    tracker.handle(add('a'));
    tick(ABANDON_WINDOW_MS + 1);
    tracker.handle(del('a'));
    expect(names()).toEqual(['BlockDeleted']);
  });

  test('flush closes open sessions', () => {
    const { tracker, names, tick } = setup();
    tracker.handle(update('a'));
    tick(3_000);
    tracker.handle(update('a'));
    tracker.flush();
    expect(names()).toEqual(['BlockEdited', 'BlockUsageDuration']);
    // A second flush is a no-op.
    tracker.flush();
    expect(names()).toHaveLength(2);
  });

  test('single-update session has no duration to report', () => {
    const { tracker, names } = setup();
    tracker.handle(update('a'));
    tracker.flush();
    expect(names()).toEqual(['BlockEdited']);
  });
});
