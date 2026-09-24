import type { BpmnNodeKind } from '@labre/affine-model';
import { fitsInscribedLabel } from '@labre/affine-shared/utils';
import { describe, expect, it } from 'vitest';

import { bpmnLabelMode, NODE_SIZE } from '../consts';
import { NODE_PRESETS } from '../presets';

/**
 * Rule R38 for BPMN (ADR 0029): a kind's label is INSCRIBED exactly when
 * "Hello World" at 18 units fits its symbol at the creation size, and
 * GRAVITATES otherwise.
 *
 * What it would have caught: the events, gateways and data shapes the pack
 * shipped with an inscribed name that could never fit a 56-unit ring or a
 * 72-unit diamond (user feedback, 24/09/2026); and, the other way, an activity
 * shrunk back under the probe — the 120×72 task only held the name on two
 * cramped lines — while `BPMN_EXTERNAL_LABEL_KINDS` still said "inscribed".
 * The list and the sizes are spelled separately; this spec holds them together.
 */
describe('BPMN label mode follows the symbol size (R38)', () => {
  const kinds = Object.keys(NODE_SIZE) as BpmnNodeKind[];

  it.each(kinds)('%s', kind => {
    const expected = fitsInscribedLabel({
      ...NODE_SIZE[kind],
      shapeType: NODE_PRESETS[kind].shapeType,
    })
      ? 'inscribed'
      : 'external';
    expect(bpmnLabelMode(kind)).toBe(expected);
  });
});
