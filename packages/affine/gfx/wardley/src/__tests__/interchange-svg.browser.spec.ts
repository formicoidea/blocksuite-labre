import {
  InterchangeExtension,
  InterchangeIdentifier,
} from '@labre/affine-block-surface';
import { Container } from '@labre/global/di';
import { describe, expect, it } from 'vitest';

import { WARDLEY_INTERCHANGE, WARDLEY_SVG_IMPORT } from '../interchange';

/**
 * The half of Wardley's interchange spec that actually RUNS the `.svg` reader,
 * and so goes through DOMPurify — in a real browser, because that is the only
 * DOM the sanitizer supports. happy-dom answers `''` from the `Node.prototype`
 * `nodeName` getter DOMPurify (>= 3.4.8) reads, and every tag is removed as
 * disallowed. The declaration tests, which sanitize nothing, stay in
 * `interchange.unit.spec.ts`.
 */

function mount() {
  const container = new Container();
  InterchangeExtension(WARDLEY_INTERCHANGE).setup!(container);
  return container.provider();
}

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
