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
 *
 * One owner is not a framework and has no flag: the CANVAS, whose draw.io
 * writer exports what the canvas paints (`canvas:drawio:export`, ADR 0019
 * amendment of 2026-10-14). It is the one capability left with every flag off,
 * and this spec says so rather than tolerating it.
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
 * bpmn:    `.bpmn` out, `.bpmn` in, `.svg` in — 3.
 * c4:      mermaid out — 1.
 * wardley: renderer JSON out, JSON in, `.owm` out, `.owm` in, `.svg` in — 5.
 * uml:     PlantUML out, PlantUML in, XMI out, XMI in, draw.io in — 5.
 * canvas:  draw.io out, the generic rendering, never gated — 1.
 *
 * A framework that adds one adds a TERM here and a row to its own test below —
 * spelled as a sum per framework rather than as a total, so a merge that brings
 * two frameworks together adds two terms instead of silently agreeing on a
 * number that is short by one.
 */
const DECLARED_CAPABILITIES = 3 + 1 + 5 + 5 + 1;

/** What no flag removes: the canvas's own writer. */
const CANVAS_CAPABILITIES = ['canvas:drawio:export'];

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

  test('Wardley declares both JSON and OWM directions and the SVG fallback', () => {
    const found = interchangeCapabilities(mountEdgelessProvider(ALL_ON), {
      framework: 'wardley',
    });

    // Five rows across THREE formats, sorted by id. The renderer JSON pair
    // (#555) and the OWM pair — the row ADR 0012 records as OWED: the Wardley
    // serializer used to live in labre-mcp, outside this repo, which is the
    // ADR's one named violation of P3 — and the SVG row is the visual-tier
    // fallback beside them.
    expect(found.map(capability => capability.id)).toEqual([
      'wardley:json:export',
      'wardley:json:import',
      'wardley:owm:export',
      'wardley:owm:import',
      'wardley:svg:import',
    ]);
    // …and the tiers differ, which is the whole of what a user is entitled to
    // expect (P2). A `[visibility, evolution]` pair IS a position on the two
    // axes, so the JSON and OWM imports are translations and owe the full
    // preservation contract; the SVG one owes recognition, and says so before
    // the file is read.
    expect(found.map(capability => capability.format.tier)).toEqual([
      'semantic',
      'semantic',
      'semantic',
      'semantic',
      'visual',
    ]);
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

  test('UML declares both directions of its two formats, and one reader more', () => {
    const found = interchangeCapabilities(mountEdgelessProvider(ALL_ON), {
      framework: 'uml',
    });

    // Five rows because the unit of declaration is the TRIPLE: three formats,
    // both directions of the two Labre writes, and one it only reads. Sorted by
    // id, so a menu built from this list comes out the same on every boot.
    expect(found.map(capability => capability.id)).toEqual([
      'uml:drawio:import',
      'uml:plantuml:export',
      'uml:plantuml:import',
      'uml:xmi:export',
      'uml:xmi:import',
    ]);
    // The TIERS, which are the whole of what a user is entitled to expect
    // before the picker closes (`docs/adr/0012` P2). PlantUML and XMI are
    // SEMANTIC in both directions — a UML class carries its attributes and
    // operations as text the grammar parses, and both files carry that model,
    // so both owe the full preservation contract. draw.io is VISUAL, and that
    // is the honest label rather than a modest one: an `mxCell` says
    // `endArrow=block`, not `uml:Generalization`, so every UML fact read out of
    // it is a guess made from a style string (`docs/adr/0019`).
    expect(found.map(capability => capability.format.tier)).toEqual([
      'visual',
      'semantic',
      'semantic',
      'semantic',
      'semantic',
    ]);
    // …and the asymmetry left is the one ADR 0019 argues for: there is no
    // `uml:drawio:export`, because writing a picture back is a re-render (P2).
    // A board that came in from draw.io leaves through PlantUML or XMI with its
    // model intact — and as a PICTURE through the canvas's generic writer,
    // which is the canvas's capability and not UML's (amendment 2026-10-14).
    expect(
      found.filter(capability => capability.direction === 'export')
    ).toHaveLength(2);
  });

  test('the canvas writes draw.io whatever the flags, and owns nothing else', () => {
    for (const flags of [ALL_ON, ALL_OFF]) {
      const found = interchangeCapabilities(mountEdgelessProvider(flags), {
        framework: 'canvas',
      });
      expect(found.map(capability => capability.id)).toEqual(
        CANVAS_CAPABILITIES
      );
      // The visual tier, said before the file is written: a rendering, not a
      // model, so no round trip is promised (ADR 0012 P2).
      expect(found[0].format.tier).toBe('visual');
      expect(found[0].direction).toBe('export');
    }
    // One draw.io format, two owners and two directions: UML reads it, the
    // canvas writes it, and neither is the other's.
    expect(
      interchangeCapabilities(mountEdgelessProvider(ALL_ON), {
        format: 'drawio',
      }).map(capability => capability.id)
    ).toEqual(['canvas:drawio:export', 'uml:drawio:import']);
  });

  test('it declares nothing a framework owns with the flag off', () => {
    const provider = mountEdgelessProvider(ALL_OFF);

    expect(interchangeCapabilities(provider, { framework: 'bpmn' })).toEqual(
      []
    );
    expect(interchangeCapabilities(provider, { framework: 'wardley' })).toEqual(
      []
    );
    // Nothing else has slipped a capability in through an always-on extension:
    // the registry holds the canvas's writer and nothing more, not merely no
    // BPMN. This is the assertion that catches an `InterchangeExtension`
    // registered from a framework's RENDER view extension instead of its
    // flag-gated one.
    expect(
      interchangeCapabilities(provider).map(capability => capability.id)
    ).toEqual(CANVAS_CAPABILITIES);
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
