import { ViewExtensionManager } from '@labre/affine-ext-loader';
import {
  ElementRendererIdentifier,
  interchangeCapabilities,
} from '@labre/affine-block-surface';
import { Container } from '@labre/global/di';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';
import { type BlockFlags, OPTIONAL_BLOCKS } from '../../flags.js';

/**
 * Interchange is TOOLING, and the flag contract says so (`docs/adr/0009`,
 * `docs/adr/0012` P1).
 *
 * Offering to read or write a file is a button, so a framework whose flag is
 * off declares no capability. What a past import WROTE is content and is not
 * gated by anything — `reversed-contract-doc.unit.spec.ts` is where that half
 * is pinned, on the same documents, with every flag off.
 */

/** Every optional block AND every framework switched off. */
const ALL_OFF = Object.fromEntries(
  OPTIONAL_BLOCKS.map(block => [block, false])
) as BlockFlags;

const ALL_ON: BlockFlags = {};

/** Mount the edgeless view extensions for real and read the DI container back. */
function mountEdgelessProvider(flags: BlockFlags) {
  const manager = new ViewExtensionManager(getInternalViewExtensions(flags));
  const container = new Container();
  manager.get('edgeless').forEach(ext => ext.setup(container));
  return container.provider();
}

describe('the interchange registry is flag-gated tooling', () => {
  test('BPMN declares its `.bpmn` export with the flag on', () => {
    const found = interchangeCapabilities(mountEdgelessProvider(ALL_ON), {
      framework: 'bpmn',
    });

    expect(found.map(capability => capability.id)).toEqual([
      'bpmn:bpmn:export',
    ]);
    expect(found[0].format.tier).toBe('semantic');
  });

  test('C4 declares its mermaid export with the flag on', () => {
    const found = interchangeCapabilities(mountEdgelessProvider(ALL_ON), {
      framework: 'c4',
    });

    expect(found.map(capability => capability.id)).toEqual([
      'c4:mermaid:export',
    ]);
    expect(found[0].format.tier).toBe('semantic');
  });

  test('it declares nothing at all with the flag off', () => {
    const provider = mountEdgelessProvider(ALL_OFF);

    expect(interchangeCapabilities(provider, { framework: 'bpmn' })).toEqual(
      []
    );
    // Nothing else has slipped a capability in through an always-on extension:
    // the registry is empty, not merely BPMN-less.
    expect(interchangeCapabilities(provider)).toEqual([]);
  });

  test('what the flag removes is the button, never the drawing', () => {
    // The two halves of ADR 0009, on one container. The capability is gone…
    const off = mountEdgelessProvider(ALL_OFF);
    expect(interchangeCapabilities(off, { framework: 'bpmn' })).toEqual([]);

    // …and the renderer that paints a stored pool is not, so a board a previous
    // import wrote still opens and still draws with nothing to export it.
    expect(
      off.getOptional(ElementRendererIdentifier('bpmnPool'))
    ).toBeDefined();
  });
});
