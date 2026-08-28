import {
  InterchangeExtension,
  InterchangeIdentifier,
  interchangeCapabilities,
  parseSvgSketch,
} from '@labre/affine-block-surface';
import { Container } from '@labre/global/di';
import { describe, expect, it } from 'vitest';

import {
  WARDLEY_INTERCHANGE,
  WARDLEY_SVG_FORMAT,
  WARDLEY_SVG_IMPORT,
} from '../interchange';

/**
 * Wardley's entry in the interchange registry (`docs/adr/0012`, P1).
 *
 * A bare DI container and plain strings: a capability is declaration data plus
 * a pure function of text, and one that could not be resolved and called this
 * way would have broken P3 — which is the property that lets labre-mcp call
 * the very same reader with no editor anywhere near it.
 */

function mount() {
  const container = new Container();
  InterchangeExtension(WARDLEY_INTERCHANGE).setup!(container);
  return container.provider();
}

describe('the declaration', () => {
  it('is the triple, and the `.svg` row is the visual one of three', () => {
    expect(WARDLEY_SVG_IMPORT.id).toBe('wardley:svg:import');
    expect(WARDLEY_SVG_IMPORT.framework).toBe('wardley');
    expect(WARDLEY_SVG_IMPORT.direction).toBe('import');
    // Narrowed on the FORMAT, because Wardley declares two of them: the OWM
    // pair is the roadmap's reference Wardley route and has its own spec next
    // door. What this file is about is the row beside it.
    expect(
      interchangeCapabilities(mount(), { framework: 'wardley', format: 'svg' })
    ).toEqual([WARDLEY_SVG_IMPORT]);
  });

  it('is the only VISUAL row Wardley declares', () => {
    // The tier is what a user is entitled to expect (ADR 0012, P2), and the two
    // formats promise different things: `.owm` carries coordinates and
    // round-trips, `.svg` carries a picture and does not. A second visual row
    // would be a second set of guesses, and it would owe its own paragraph.
    const visual = interchangeCapabilities(mount(), {
      framework: 'wardley',
    }).filter(capability => capability.format.tier === 'visual');
    expect(visual).toEqual([WARDLEY_SVG_IMPORT]);
  });

  it('declares `.svg` as a VISUAL format', () => {
    // Visual, so it owes recognition and nothing else: no preservation
    // contract, no `interchange` payload, no round-trip — and the surface that
    // offers it says so before the file is read (ADR 0012, P2).
    expect(WARDLEY_SVG_FORMAT).toEqual({
      id: 'svg',
      tier: 'visual',
      extensions: ['.svg'],
      mime: 'image/svg+xml',
    });
  });

  it('wraps the SHARED parser, adding nothing of its own', () => {
    // The identity, not an equivalence. Wardley and BPMN read a `.svg` through
    // ONE function, so they cannot drift into recognising different pictures,
    // and the heuristics statement ADR 0012's open question 2 asks for is
    // written once — in that parser's module documentation — rather than twice
    // with the second copy going stale.
    expect(WARDLEY_SVG_IMPORT.run).toBe(parseSvgSketch);
  });
});

describe('the capability resolves and runs', () => {
  it('reads a map-shaped SVG off the container, with no editor', () => {
    const capability = mount().get(InterchangeIdentifier('wardley:svg:import'));
    if (capability.direction !== 'import') throw new Error('expected import');

    const result = capability.run(
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400">' +
        '<circle cx="180" cy="90" r="6"/>' +
        '<text x="192" y="88" font-size="12">Customer</text>' +
        '</svg>',
      { name: 'map.svg' }
    );

    // A circle and its label, as a level-1 sketch: a plain ellipse and an
    // editable text element. Nothing here decided the circle was a component —
    // that promotion is the author's, and it is the whole of ADR 0007's ladder.
    expect(result.elements.map(props => props.type)).toEqual(['shape', 'text']);
    expect(result.elements[1].text).toBe('Customer');
    expect(result.report.mapped).toBe(2);
  });

  it('writes no `interchange` payload, and reports nothing carried', () => {
    // P2's hard rule, at the framework's own door. The anti-decay test with
    // the whole fixture table lives in the parser's package; this is Wardley's
    // half of it, and it is here so that a future OWM capability added to this
    // file cannot quietly hand the SVG row a payload.
    const result = WARDLEY_SVG_IMPORT.run(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect width="10" height="10"/></svg>',
      {}
    );
    for (const props of result.elements) {
      expect(props).not.toHaveProperty('interchange');
    }
    expect([result.report.carried, result.report.quarantined]).toEqual([0, 0]);
    expect(result.report.sourceVersion).toBeUndefined();
  });
});
