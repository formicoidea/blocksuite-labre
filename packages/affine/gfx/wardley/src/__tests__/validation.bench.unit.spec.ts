import { evaluateRules, type ValidationRule } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { WARDLEY_ROLE } from '../roles';
import { WARDLEY_RULES } from '../rules';

/**
 * The 16 ms harness (PF5.12, decision #7).
 *
 * A full evaluation of a large reference map must fit inside one 60 fps frame,
 * and a board whose frameworks are all switched off must cost nothing at all.
 * Assertive on purpose: this runs in the normal unit suite (`yarn test:unit`,
 * one CI job on PRs), so a regression fails the build rather than a dashboard.
 *
 * Threshold is deliberately generous against CI noise — the real numbers are
 * two orders of magnitude below it, so a genuine regression still trips it.
 */

/** One 60 fps frame. */
const FRAME_BUDGET_MS = 16;

/** Wardley elements on the reference map, background excluded. */
const MAP_SIZE = 500;

const MAP_W = 1600;
const MAP_H = 900;

/**
 * PRODUCTION-SHAPED element stand-in. Every accessor the engine touches costs
 * what it costs in production, or the budget is measured against a fiction:
 *
 * - `role` is a `@field()` accessor — `(yMap.doc ? yMap.get(k) : null) ??
 *   _preserved.get(k) ?? fallback`, i.e. two Map lookups, paid even by a
 *   neutral element;
 * - `elementBound` is `Bound.deserialize(this.xywh)`, so a `JSON.parse` on top
 *   of a `xywh` read — not a `new Bound(...tuple)`.
 *
 * Backed by a real `Y.Map` attached to a real `Y.Doc`, as on a live canvas.
 */
function element(
  doc: Y.Doc,
  id: string,
  xywh: [number, number, number, number],
  role?: string
): GfxPrimitiveElementModel {
  const yMap = new Y.Map<unknown>();
  doc.getMap<Y.Map<unknown>>('elements').set(id, yMap);
  yMap.set('xywh', `[${xywh.join(',')}]`);
  if (role !== undefined) yMap.set('role', role);

  const preserved = new Map<string, unknown>();
  const read = (key: string) =>
    (yMap.doc ? yMap.get(key) : null) ?? preserved.get(key) ?? undefined;

  return {
    id,
    get role() {
      return read('role') as string | undefined;
    },
    get xywh() {
      return read('xywh') as string;
    },
    get elementBound() {
      return Bound.deserialize(read('xywh') as string);
    },
  } as unknown as GfxPrimitiveElementModel;
}

/**
 * A large, realistic Wardley map: one background, a mix of the roles a real
 * map carries, a tenth of the nodes parked off-map (the violating population),
 * and a fifth of the elements neutral (labels, inertia bars) which the engine
 * must skip.
 */
function referenceMap(size: number): GfxPrimitiveElementModel[] {
  const doc = new Y.Doc();
  const elements: GfxPrimitiveElementModel[] = [
    element(doc, 'bg', [0, 0, MAP_W, MAP_H], WARDLEY_ROLE.map),
  ];

  const roles = [
    WARDLEY_ROLE.component,
    WARDLEY_ROLE.market,
    WARDLEY_ROLE.ecosystem,
    WARDLEY_ROLE.anchor,
    WARDLEY_ROLE.pipeline,
    undefined, // neutral: a label or an inertia bar
  ];

  for (let i = 0; i < size; i++) {
    const role = roles[i % roles.length];
    const offMap = i % 10 === 0;
    const x = offMap ? MAP_W + 200 + (i % 7) * 30 : 20 + ((i * 37) % (MAP_W - 60));
    const y = offMap ? MAP_H + 200 + (i % 5) * 30 : 20 + ((i * 53) % (MAP_H - 60));
    elements.push(element(doc, `el-${i}`, [x, y, 40, 24], role));
  }
  return elements;
}

/** Median of `runs` timed evaluations, after a warm-up. */
function medianMs(run: () => unknown, runs = 21, warmup = 5): number {
  for (let i = 0; i < warmup; i++) run();

  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return samples[Math.floor(samples.length / 2)];
}

describe(`validation stays inside one frame (${MAP_SIZE}+ elements)`, () => {
  const map = referenceMap(MAP_SIZE);

  it('builds a reference map worth measuring', () => {
    expect(map).toHaveLength(MAP_SIZE + 1);
    // The map must actually produce violations, otherwise the bench measures
    // an early exit rather than the real path.
    const violations = evaluateRules(WARDLEY_RULES, map);
    expect(violations.length).toBeGreaterThan(20);
  });

  it(`evaluates the whole map in under ${FRAME_BUDGET_MS} ms`, () => {
    const ms = medianMs(() => evaluateRules(WARDLEY_RULES, map));

    console.info(
      `[bench] full evaluation, ${MAP_SIZE} elements + background: ${ms.toFixed(3)} ms (budget ${FRAME_BUDGET_MS} ms)`
    );
    expect(ms).toBeLessThan(FRAME_BUDGET_MS);
  });

  it('costs nothing when no framework is active (flag off)', () => {
    // Flag off => no rule is registered => the engine returns before touching
    // a single element. Latency must be indistinguishable from zero.
    const noRules: readonly ValidationRule[] = [];
    const ms = medianMs(() => evaluateRules(noRules, map));

    console.info(
      `[bench] flag off, same ${MAP_SIZE}-element map: ${ms.toFixed(4)} ms`
    );
    expect(evaluateRules(noRules, map)).toEqual([]);
    expect(ms).toBeLessThan(0.05);
  });
});
