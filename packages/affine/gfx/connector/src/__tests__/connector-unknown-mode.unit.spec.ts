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
 * - a connector whose routing throws, whatever the cause, is reported once
 *   and costs only itself: the connectors after it in the same batch, or in
 *   the pass the watcher makes when it mounts, are routed, and every later
 *   change schedules a new batch.
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
  /** A connector whose routing throws, whatever the cause. */
  const broken = {
    type: 'connector',
    get source(): never {
      throw new Error('this connector cannot be read');
    },
  };
  /** A connector the watcher hands to the router: two free ends. */
  const routable = {
    type: 'connector',
    source: { position: [0, 0] },
    target: { position: FAR_END },
  };

  function mount(atMount: object[] = []) {
    const scheduled: (() => void)[] = [];
    vi.spyOn(globalThis, 'queueMicrotask').mockImplementation(task => {
      scheduled.push(task);
    });
    const routed: unknown[] = [];
    vi.spyOn(ConnectorPathGenerator, 'updatePath').mockImplementation(
      connector => {
        routed.push(connector);
      }
    );
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const elementAdded = new Subject<{ id: string; local: boolean }>();
    const byId: Record<string, object> = { broken, routable };
    const surface = {
      elementAdded,
      elementUpdated: new Subject(),
      store: {
        slots: { blockUpdated: new Subject() },
        hasBlock: () => false,
        getModelById: () => null,
      },
      hasElementById: () => true,
      getElementById: (id: string) => byId[id] ?? null,
      getElementsByType: () => atMount,
      getConnectors: () => [],
    } as unknown as SurfaceBlockModel;

    let dispose: (() => void) | undefined;
    const mounting = () => {
      dispose = connectorWatcher(surface) as () => void;
    };
    /** Queues both connectors in one batch, the broken one first. */
    const batch = () => {
      elementAdded.next({ id: 'broken', local: true });
      elementAdded.next({ id: 'routable', local: true });
      scheduled.at(-1)!();
    };
    return {
      mounting,
      batch,
      scheduled,
      routed,
      error,
      dispose: () => dispose?.(),
    };
  }

  it('routes the connectors after one that throws, in the same batch', () => {
    const { mounting, batch, routed, error, dispose } = mount();
    mounting();

    expect(batch).not.toThrow();

    expect(routed).toEqual([routable]);
    expect(error).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('routes every later batch, and reports the broken connector once', () => {
    const { mounting, batch, scheduled, routed, error, dispose } = mount();
    mounting();

    batch();
    batch();

    expect(scheduled).toHaveLength(2);
    expect(routed).toEqual([routable, routable]);
    expect(error).toHaveBeenCalledTimes(1);
    dispose();
  });

  it('routes the connectors after one that throws when it mounts', () => {
    const { mounting, routed, error, dispose } = mount([broken, routable]);

    expect(mounting).not.toThrow();

    expect(routed).toEqual([routable]);
    expect(error).toHaveBeenCalledTimes(1);
    dispose();
  });
});
