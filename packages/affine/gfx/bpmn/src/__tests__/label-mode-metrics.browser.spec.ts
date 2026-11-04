import { getFontString, getLineHeight, wrapText } from '@labre/affine-gfx-text';
import {
  type BpmnNodeKind,
  FontFamily,
  FontStyle,
  FontWeight,
} from '@labre/affine-model';
import { fitsInscribedLabel } from '@labre/affine-shared/utils';
import { describe, expect, it } from 'vitest';

import { INNER_FONT_SIZE, NODE_SIZE } from '../consts';
import { NODE_PRESETS } from '../presets';

/**
 * R38's fit test against REAL font metrics (ADR 0029) — the ground truth
 * `fitsInscribedLabel` is checked against.
 *
 * `fitsInscribedLabel` (`@labre/affine-shared/utils`) decides with arithmetic
 * whether a symbol carries its name inside it: a 0.5 em average advance and a
 * 1.2 em line height, so the rule stays checkable without a canvas. This spec
 * lays the probe "Hello World" out the way the shape renderer lays out a
 * shape's text — `wrapText` at the inner width, `getLineHeight` per line, both
 * from `@labre/affine-gfx-text` — in Chromium, and compares the two verdicts
 * for every BPMN kind at its creation size.
 *
 * What it would have caught: a kind the arithmetic calls inscribed while the
 * renderer would break a word or need a third line, or the reverse (the
 * `ponytail:` this spec replaced in `label-mode.ts`); and a kind resized INTO
 * the band where the verdict depends on the face, which fails the second block
 * until somebody decides about it.
 *
 * ## Which face is measured
 *
 * The renderer's own family string, `Inter` at 18 units. In the test browser
 * the Inter face is never loaded (the font loader fetches it from a host), so
 * Chromium measures the platform's sans-serif fallback: Arial on Windows
 * (92.7 px for the probe, 20 px per line), something else on a Linux runner.
 * Inter itself sets the probe at ≈ 5.4 em ≈ 97 px. A verdict that changes
 * between those faces is not a fact about the shape, so a kind whose verdict
 * flips within ±{@link FACE_VARIANCE} of the measured metrics is NOT compared:
 * it must be listed in {@link NEAR_THRESHOLD}, the one place a reader learns
 * which kinds sit on the edge.
 *
 * The geometry (insets, inscribed factors) is the helper's and is copied here,
 * held by the first block: replaying the copy with the helper's two constants
 * reproduces `fitsInscribedLabel` for every kind. Only the metric differs.
 */

const PROBE = 'Hello World';
const PROBE_WORDS = ['Hello', 'World'];
/** The helper's defaults: `[vertical, horizontal]` shape text inset. */
const PADDING: [number, number] = [10, 20];
/** The helper's inscribed rectangle, per silhouette. */
const INSCRIBED: Record<string, number> = { ellipse: 0.7, diamond: 0.5 };
/** The helper's two assumptions, in em. */
const ASSUMED_ADVANCE_EM = 0.5;
const ASSUMED_LINE_HEIGHT_EM = 1.2;
/** Most lines the probe may take: one, or one word per line. */
const MAX_PROBE_LINES = 2;

/**
 * How far a sans-serif fallback's metrics stray from Inter's on the probe:
 * Arial sets it ≈ 5 % narrower, DejaVu Sans ≈ 7 % wider.
 */
const FACE_VARIANCE = 0.08;

/**
 * The kinds whose verdict depends on the face, at their creation size.
 *
 * `textAnnotation` (140×48, inner 100×28): the probe on one line is 99 by the
 * arithmetic, ≈ 97 in Inter, 92.7 in Arial — inscribed in all three, but with
 * 1 to 7 units to spare, and a wider fallback breaks it onto two lines that the
 * 28-unit height cannot hold. Its mode stays inscribed (ADR 0029); a change
 * would be a product decision and an amendment there.
 */
const NEAR_THRESHOLD: readonly BpmnNodeKind[] = ['textAnnotation'];

const kinds = Object.keys(NODE_SIZE) as BpmnNodeKind[];

function innerBox(kind: BpmnNodeKind) {
  const { w, h } = NODE_SIZE[kind];
  const factor = INSCRIBED[NODE_PRESETS[kind].shapeType] ?? 1;
  return {
    w: (w - 2 * PADDING[1]) * factor,
    h: (h - 2 * PADDING[0]) * factor,
  };
}

const helperVerdict = (kind: BpmnNodeKind) =>
  fitsInscribedLabel({
    ...NODE_SIZE[kind],
    shapeType: NODE_PRESETS[kind].shapeType,
  });

function arithmeticVerdict(kind: BpmnNodeKind): boolean {
  const box = innerBox(kind);
  if (box.w <= 0 || box.h <= 0) return false;
  const advance = ASSUMED_ADVANCE_EM * INNER_FONT_SIZE;
  const line = ASSUMED_LINE_HEIGHT_EM * INNER_FONT_SIZE;
  if (PROBE.length * advance <= box.w && line <= box.h) return true;
  return (
    PROBE_WORDS[0].length * advance <= box.w && MAX_PROBE_LINES * line <= box.h
  );
}

/**
 * The renderer's verdict: the probe wrapped at the inner width, every word
 * whole, on one line or two, and the lines no taller than the inner height.
 *
 * `scale` grows the TEXT by shrinking the box it is laid out in — the same
 * question for a face `scale` times wider and taller than the measured one.
 */
function measuredVerdict(kind: BpmnNodeKind, scale = 1): boolean {
  const box = innerBox(kind);
  if (box.w <= 0 || box.h <= 0) return false;
  const font = getFontString({
    fontStyle: FontStyle.Normal,
    fontWeight: FontWeight.Regular,
    fontSize: INNER_FONT_SIZE,
    fontFamily: FontFamily.Inter,
  });
  const lines = wrapText(PROBE, font, box.w / scale)
    .split('\n')
    .map(line => line.trim());
  const whole =
    lines.length <= MAX_PROBE_LINES &&
    lines.join(' ') === PROBE &&
    lines.every(line => line === PROBE || PROBE_WORDS.includes(line));
  if (!whole) return false;
  const lineHeight = getLineHeight(
    FontFamily.Inter,
    INNER_FONT_SIZE,
    FontWeight.Regular
  );
  return lines.length * lineHeight <= box.h / scale;
}

const nearThreshold = (kind: BpmnNodeKind) =>
  measuredVerdict(kind, 1 - FACE_VARIANCE) !==
  measuredVerdict(kind, 1 + FACE_VARIANCE);

describe('the geometry copied from fitsInscribedLabel', () => {
  it.each(kinds)('%s replays the helper', kind => {
    expect(arithmeticVerdict(kind)).toBe(helperVerdict(kind));
  });
});

describe('the kinds whose verdict depends on the face', () => {
  it('are exactly the declared ones', () => {
    expect(kinds.filter(nearThreshold)).toEqual(NEAR_THRESHOLD);
  });
});

describe('the arithmetic fit agrees with the measured one', () => {
  const judged = kinds.filter(kind => !NEAR_THRESHOLD.includes(kind));

  it.each(judged)('%s', kind => {
    expect(measuredVerdict(kind)).toBe(helperVerdict(kind));
  });
});
