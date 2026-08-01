import { describe, expect, it } from 'vitest';

import { reassociateConnectorsCommand } from '../commands/reassociate-connectors.js';

describe('reassociateConnectorsCommand', () => {
  it('re-points both endpoints of a self-loop connector', () => {
    const connector = {
      id: 'c1',
      source: { id: 'old' },
      target: { id: 'old' },
    };
    const updates: Record<string, Record<string, { id: string }>> = {};
    const surface = {
      getConnectors: () => [connector],
      updateElement: (id: string, props: Record<string, { id: string }>) => {
        updates[id] = { ...updates[id], ...props };
      },
    };
    let nextCalled = false;

    reassociateConnectorsCommand(
      {
        oldId: 'old',
        newId: 'new',
        std: { get: () => ({ surface }) },
      } as never,
      () => {
        nextCalled = true;
      }
    );

    expect(nextCalled).toBe(true);
    expect(updates.c1.source.id).toBe('new');
    expect(updates.c1.target.id).toBe('new');
  });
});
