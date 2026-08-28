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

/**
 * How many capabilities the whole assembly declares, derived rather than
 * remembered — the number a merge breaks silently otherwise.
 *
 * bpmn: `.bpmn` out, `.bpmn` in, `.svg` in — 3.
 * c4:   mermaid out — 1.
 * wardley: `.svg` in — 1.
 *
 * A framework that adds one adds a line here and a row to its own test below.
 */
const DECLARED_CAPABILITIES = 3 + 1 + 1;

describe('the interchange registry is flag-gated tooling', () => {
  test('BPMN declares both directions of `.bpmn`, and the SVG fallback', () => {
    const found = interchangeCapabilities(mountEdgelessProvider(ALL_ON), {
      framework: 'bpmn',
    });

    // Three rows, because the unit of declaration is the TRIPLE: a direction is
    // never implied by its opposite, and a second FORMAT is a second row rather
    // than an option on the first. Sorted by id, so a menu built from this list
    // comes out the same on every boot.
    expect(found.map(capability => capability.id)).toEqual([
      'bpmn:bpmn:export',
      'bpmn:bpmn:import',
      'bpmn:svg:import',
    ]);
    // …and the tiers differ, which is the whole of what a user is entitled to
    // expect (ADR 0012, P2): the `.bpmn` pair owes the full preservation
    // contract, the SVG owes recognition and says so before the file is read.
    expect(found.map(capability => capability.format.tier)).toEqual([
      'semantic',
      'semantic',
      'visual',
    ]);
  });

  test('Wardley declares the SVG fallback with the flag on', () => {
    const found = interchangeCapabilities(mountEdgelessProvider(ALL_ON), {
      framework: 'wardley',
    });

    // One row today. The OWM DSL — the roadmap's REFERENCE Wardley import, and
    // an export that still lives in labre-mcp — lands beside it.
    expect(found.map(capability => capability.id)).toEqual([
      'wardley:svg:import',
    ]);
    expect(found[0].format.tier).toBe('visual');
  });

  test('one `.svg` is claimed by two frameworks, and neither is inferred', () => {
    // ADR 0012 rejects "one capability per format, with the framework inferred
    // from the file": a picture is not a fact about which vocabulary it is a
    // picture OF. So the same format id carries two capabilities, they are
    // separate declarations with separate ids, and a UI (or a user) chooses.
    const found = interchangeCapabilities(mountEdgelessProvider(ALL_ON), {
      format: 'svg',
    });
    expect(found.map(capability => capability.id)).toEqual([
      'bpmn:svg:import',
      'wardley:svg:import',
    ]);
    expect(found.map(capability => capability.framework)).toEqual([
      'bpmn',
      'wardley',
    ]);
  });

  test('the whole assembly declares exactly what its frameworks do', () => {
    expect(interchangeCapabilities(mountEdgelessProvider(ALL_ON))).toHaveLength(
      DECLARED_CAPABILITIES
    );
  });

  test('C4 declares its mermaid export with the flag on', () => {
    const found = interchangeCapabilities(mountEdgelessProvider(ALL_ON), {
      framework: 'c4',
    });

    // One row, and the asymmetry is the point: C4 writes mermaid and cannot
    // read it, so there is no `c4:mermaid:import` to pair this with.
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
    expect(interchangeCapabilities(provider, { framework: 'wardley' })).toEqual(
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
