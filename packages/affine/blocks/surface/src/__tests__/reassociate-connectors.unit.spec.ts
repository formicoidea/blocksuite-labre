import { GfxControllerIdentifier } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { reassociateConnectorsCommand } from '../commands/reassociate-connectors.js';

type Endpoint = { id: string };
type Connector = { id: string; source: Endpoint; target: Endpoint };

/**
 * Runs the command over `connectors` and returns, per connector id, the props
 * that were actually written. An endpoint absent from the result is an endpoint
 * the command chose not to touch.
 */
function run(connectors: Connector[], oldId = 'old', newId = 'new') {
  const updates: Record<string, Record<string, Endpoint>> = {};
  const surface = {
    getConnectors: (id: string) =>
      connectors.filter(c => c.source.id === id || c.target.id === id),
    updateElement: (id: string, props: Record<string, Endpoint>) => {
      updates[id] = { ...updates[id], ...props };
    },
  };
  let nextCalled = false;

  reassociateConnectorsCommand(
    {
      oldId,
      newId,
      // The command must ask for the gfx controller and nothing else: a stub
      // answering every identifier alike would hide a wrong lookup.
      std: {
        get: (identifier: unknown) => {
          expect(identifier).toBe(GfxControllerIdentifier);
          return { surface };
        },
      },
    } as never,
    () => {
      nextCalled = true;
    }
  );

  return { updates, nextCalled };
}

describe('reassociateConnectorsCommand', () => {
  it('re-points both endpoints of a self-loop connector', () => {
    const { updates, nextCalled } = run([
      { id: 'c1', source: { id: 'old' }, target: { id: 'old' } },
    ]);

    expect(nextCalled).toBe(true);
    expect(updates.c1.source.id).toBe('new');
    expect(updates.c1.target.id).toBe('new');
  });

  it('re-points only the matching endpoint when the two differ', () => {
    // The nominal case: the converted block sits at one end, an unrelated
    // element at the other. Removing the early `continue` must not start
    // dragging that other element along.
    const { updates, nextCalled } = run([
      { id: 'c1', source: { id: 'old' }, target: { id: 'other' } },
      { id: 'c2', source: { id: 'other' }, target: { id: 'old' } },
    ]);

    expect(nextCalled).toBe(true);
    expect(updates.c1.source.id).toBe('new');
    expect(updates.c1.target).toBeUndefined();
    expect(updates.c2.target.id).toBe('new');
    expect(updates.c2.source).toBeUndefined();
  });
});
