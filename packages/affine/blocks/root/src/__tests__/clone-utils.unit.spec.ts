import type { SerializedConnectorElement } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { mapConnectorIds } from '../edgeless/utils/clone-utils.js';

describe('mapConnectorIds', () => {
  it('keeps the original id when an endpoint was not cloned', () => {
    const props = {
      source: { id: 'cloned' },
      target: { id: 'outside' },
    } as SerializedConnectorElement;
    const ids = new Map([['cloned', 'cloned-copy']]);

    mapConnectorIds(props, ids);

    expect(props.source.id).toBe('cloned-copy');
    expect(props.target.id).toBe('outside');
  });
});
