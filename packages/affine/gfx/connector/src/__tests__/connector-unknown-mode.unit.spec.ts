/**
 * A connector whose `mode` this client does not know is routed, never thrown
 * on (#669 follow-up, ADR 0056; a known limit of ADR 0053).
 *
 * What it would have caught: `_generateConnectorPath` threw
 * `unknown connector mode` for a connector stored without `mode` (a writer
 * outside the editor) or with a newer client's mode (the enum is
 * append-only). The throw came from the connector watcher: synchronously when
 * the watcher mounted, and otherwise in its microtask, where it also left
 * `pendingFlag` up, so no connector of the surface was ever routed again for
 * the session.
 *
 * The contract held here:
 * - an absent or unknown mode is routed as Straight, the reading every other
 *   reader (renderer, bound, handles) already gives anything but Curve;
 * - a routing that throws, whatever the cause, no longer wedges the watcher:
 *   the next change schedules a new pass.
 */
import type { SurfaceBlockModel } from '@labre/affine-block-surface';
import type { LocalConnectorElementModel } from '@labre/affine-model';
import { ConnectorMode } from '@labre/affine-model';
import { Subject } from 'rxjs';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ConnectorPathGenerator } from '../connector-manager';
import { connectorWatcher } from '../connector-watcher';

const UNKNOWN_MODE = 99;
const FAR_END = [100, 50];

/** Two free ends, so every mode can route without any element. */
function freeConnector(mode: unknown): LocalConnectorElementModel {
  return {
    mode,
    source: { position: [0, 0] },
    target: { position: FAR_END },
    xywh: '[0,0,0,0]',
    path: [],
    updatingPath: false,
  } as unknown as LocalConnectorElementModel;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a connector whose mode this client does not know', () => {
  it.each([
    ['absent', undefined],
    ['a newer client’s', UNKNOWN_MODE],
  ])('%s mode is routed as Straight, without throwing', (_label, mode) => {
    const connector = freeConnector(mode);
    const straight = freeConnector(ConnectorMode.Straight);

    expect(() =>
      ConnectorPathGenerator.updatePath(connector, null)
    ).not.toThrow();
    ConnectorPathGenerator.updatePath(straight, null);

    expect(connector.path.length).toBeGreaterThan(0);
    expect(connector.path.map(point => [...point])).toEqual(
      straight.path.map(point => [...point])
    );
    expect(connector.xywh).toBe(straight.xywh);
  });
});

describe('the connector watcher', () => {
  it('routes again after a routing that threw', () => {
    const scheduled: (() => void)[] = [];
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(task => {
      scheduled.push(task);
    });

    const elementAdded = new Subject<{ id: string; local: boolean }>();
    const broken = {
      type: 'connector',
      get source(): never {
        throw new Error('this connector cannot be read');
      },
    };
    const surface = {
      elementAdded,
      elementUpdated: new Subject(),
      store: {
        slots: { blockUpdated: new Subject() },
        hasBlock: () => false,
        getModelById: () => null,
      },
      hasElementById: () => true,
      getElementById: () => broken,
      getElementsByType: () => [],
      getConnectors: () => [],
    } as unknown as SurfaceBlockModel;

    const dispose = connectorWatcher(surface) as () => void;

    elementAdded.next({ id: 'broken', local: true });
    expect(scheduled).toHaveLength(1);
    expect(() => scheduled[0]()).toThrow('this connector cannot be read');

    const before = scheduled.length;
    elementAdded.next({ id: 'broken', local: true });
    expect(scheduled).toHaveLength(before + 1);

    dispose();
  });
});
