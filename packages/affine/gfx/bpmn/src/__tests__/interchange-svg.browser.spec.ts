import {
  InterchangeExtension,
  InterchangeIdentifier,
} from '@labre/affine-block-surface';
import { Container } from '@labre/global/di';
import { describe, expect, it } from 'vitest';

import { BPMN_INTERCHANGE } from '../interchange';

/**
 * The one test of BPMN's interchange spec that actually RUNS the `.svg`
 * reader, and so goes through DOMPurify — in a real browser, because that is
 * the only DOM the sanitizer supports. happy-dom answers `''` from the
 * `Node.prototype` `nodeName` getter DOMPurify (>= 3.4.8) reads, and every tag
 * is removed as disallowed. Everything else stays in
 * `interchange.unit.spec.ts`.
 */

function mount() {
  const container = new Container();
  InterchangeExtension(BPMN_INTERCHANGE).setup!(container);
  return container.provider();
}

describe('the `.svg` capability resolves and runs', () => {
  it('reads a `.svg` with plain stubs, and writes no payload', () => {
    // P3's purity requirement over the SECOND format, and P2's hard rule
    // stated where a framework declares it: a visual import carries nothing,
    // quarantines nothing and writes no `interchange` key on anything. The
    // anti-decay test with the whole fixture table lives in the parser's own
    // package; this is the framework's half of it.
    const capability = mount().get(InterchangeIdentifier('bpmn:svg:import'));
    if (capability.direction !== 'import') throw new Error('expected import');

    const result = capability.run(
      '<svg xmlns="http://www.w3.org/2000/svg"><rect x="0" y="0" width="40" height="20"/></svg>',
      { name: 'sketch.svg' }
    );
    expect(result.elements).toHaveLength(1);
    expect(result.elements[0]).not.toHaveProperty('interchange');
    expect(result.report.carried).toBe(0);
    expect(result.report.quarantined).toBe(0);
  });
});
