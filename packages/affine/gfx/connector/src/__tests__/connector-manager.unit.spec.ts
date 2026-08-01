import type { LocalConnectorElementModel } from '@labre/affine-model';
import { ConnectorMode } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { ConnectorPathGenerator } from '../connector-manager';

/**
 * Latent state normally filtered upstream by connectorWatcher: an endpoint
 * holds `{ id }` (no position) while the element is absent from the store.
 * Each mode dereferences the endpoint element on its own code path
 * (Straight and Curve read `.xywh`, Orthogonal destructures the empty
 * result of _computeStartEndPoint), so each gets its own case — see the
 * probe in PR #88's discussion.
 *
 * Expected degraded behavior: empty path, last bound kept, no throw.
 */
function makeConnector(mode: ConnectorMode): LocalConnectorElementModel {
  return {
    mode,
    source: { id: 'gone-source' },
    target: { id: 'gone-target' },
    xywh: '[10,20,100,50]',
    path: [],
    updatingPath: false,
  } as unknown as LocalConnectorElementModel;
}

describe('ConnectorPathGenerator.updatePath with an absent endpoint element', () => {
  it.each([
    ['Straight', ConnectorMode.Straight],
    ['Orthogonal', ConnectorMode.Orthogonal],
    ['Curve', ConnectorMode.Curve],
  ])('%s: degrades to an empty path instead of throwing', (_label, mode) => {
    const connector = makeConnector(mode);

    // The default elementGetter resolves every id to null, i.e. every
    // endpoint references an absent element.
    expect(() =>
      ConnectorPathGenerator.updatePath(connector, null)
    ).not.toThrow();

    expect(connector.path).toEqual([]);
    // The last bound is kept — no bbox derived from an empty point set.
    expect(connector.xywh).toBe('[10,20,100,50]');
    expect(connector.updatingPath).toBe(false);
  });
});
