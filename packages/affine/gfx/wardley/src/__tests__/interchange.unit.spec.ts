import {
  InterchangeExtension,
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
import { importWardleySvg } from '../svg-import';

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

  it('runs Wardley’s OWN reader, no longer the shared parser', () => {
    // The opposite of the pin this replaced (ADR 0032 §1). Wardley recognises
    // the map a picture is a picture of, so it owes its own heuristics
    // statement (`svg-import.ts`) and must not be the function BPMN declares —
    // BPMN keeps `run: parseSvgSketch`, pinned in its own package. What the
    // two still share is the sanitiser and the sketch walk, and the anti-decay
    // assertion runs against this reader in `svg-import.browser.spec.ts`.
    expect(WARDLEY_SVG_IMPORT.run).not.toBe(parseSvgSketch);
    expect(WARDLEY_SVG_IMPORT.run).toBe(importWardleySvg);
  });
});
