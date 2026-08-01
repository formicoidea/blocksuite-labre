import {
  evaluateRules,
  type ValidationProfile,
  type ValidationRule,
  type Violation,
} from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';
import * as Y from 'yjs';

import { WARDLEY_PROFILES } from '../profiles';
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
 * ## What PF13 changed
 *
 * The reference map used to be nodes and neutral filler, because the only rule
 * was element-against-frame. It now carries the artefacts the real rules are
 * about — change arrows with routed paths, inertia bars, labels, dependencies —
 * and is measured against a family that is NOT element-local: `no-overlap`
 * compares pairs, so the naive cost is quadratic in the participants rather
 * than linear in the surface.
 *
 * Two numbers therefore matter, and both are asserted:
 *
 * - the FULL evaluation, which is what a load, a paste or an undo pays;
 * - the worst realistic DIRTY SET — one element dragged across a dense map —
 *   which is what every one of the 120 ms debounce ticks pays while a user
 *   is actually working.
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
 * - `validationExceptions` is the same `@field()` accessor, and the engine
 *   reads it for every element it indicts (PF8). Left as a plain `undefined`
 *   property it would cost nothing and the exception lookup would be measured
 *   against a fiction;
 * - `validationProfile` is that same accessor again, read once per
 *   role-carrying element on every evaluation (PF9). It is the one read the
 *   profile pass adds to the budget, so it has to cost what it costs;
 * - `elementBound` is `Bound.deserialize(this.xywh)`, so a `JSON.parse` on top
 *   of a `xywh` read — not a `new Bound(...tuple)`. `no-overlap` reads it once
 *   per participant and then compares rectangles, which is precisely the point
 *   of hoisting it.
 *
 * Backed by a real `Y.Map` attached to a real `Y.Doc`, as on a live canvas.
 */
function element(
  doc: Y.Doc,
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  validationProfile?: string,
  absolutePath?: [number, number][]
): GfxPrimitiveElementModel {
  const yMap = new Y.Map<unknown>();
  doc.getMap<Y.Map<unknown>>('elements').set(id, yMap);
  yMap.set('xywh', `[${xywh.join(',')}]`);
  if (role !== undefined) yMap.set('role', role);
  if (validationProfile !== undefined) {
    yMap.set('validationProfile', validationProfile);
  }

  const preserved = new Map<string, unknown>();
  const read = (key: string) =>
    (yMap.doc ? yMap.get(key) : null) ?? preserved.get(key) ?? undefined;

  return {
    id,
    // A routed path is `@local()` on the real connector — a plain property, as
    // here — so this one is honest by being cheap.
    ...(absolutePath ? { absolutePath } : {}),
    get role() {
      return read('role') as string | undefined;
    },
    get validationExceptions() {
      return read('validationExceptions') as unknown[] | undefined;
    },
    get validationProfile() {
      return read('validationProfile') as string | undefined;
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
 * A large, realistic Wardley map: one background and a mix of everything the
 * three rules are written about.
 *
 * - nodes and their labels, laid out the way the toolbox lays them out, dense
 *   enough that a fair number genuinely collide;
 * - dependencies with routed paths, some of them under a label;
 * - change arrows, a tenth of them pointing backwards;
 * - inertia bars, most of them nowhere near a transition;
 * - and a sixth of the surface NEUTRAL, which the engine must skip on the
 *   cheapest possible test.
 */
function referenceMap(
  size: number,
  profile?: string
): GfxPrimitiveElementModel[] {
  const doc = new Y.Doc();
  const elements: GfxPrimitiveElementModel[] = [
    element(doc, 'bg', [0, 0, MAP_W, MAP_H], WARDLEY_ROLE.map, profile),
  ];

  for (let i = 0; i < size; i++) {
    const x = 20 + ((i * 37) % (MAP_W - 200));
    const y = 20 + ((i * 53) % (MAP_H - 80));
    const id = `el-${i}`;

    switch (i % 6) {
      case 0:
        elements.push(element(doc, id, [x, y, 18, 18], WARDLEY_ROLE.component));
        break;
      case 1:
        // The label of the node before it, at the toolbox's own offset — so a
        // handful of them land on a neighbour, as on a real crowded map.
        elements.push(element(doc, id, [x + 17, y - 4, 120, 26], WARDLEY_ROLE.label));
        break;
      case 2: {
        const to: [number, number] = [x + 240, y + 60];
        elements.push(
          element(doc, id, [x, y, 240, 60], WARDLEY_ROLE.dependency, undefined, [
            [x, y],
            to,
          ])
        );
        break;
      }
      case 3: {
        // A tenth of the arrows run backwards: a real violating population.
        const back = i % 10 === 3;
        const from: [number, number] = back ? [x + 180, y] : [x, y];
        const to: [number, number] = back ? [x, y] : [x + 180, y];
        elements.push(
          element(doc, id, [x, y, 180, 2], WARDLEY_ROLE.changeArrow, undefined, [
            from,
            to,
          ])
        );
        break;
      }
      case 4:
        elements.push(element(doc, id, [x, y, 8, 44], WARDLEY_ROLE.inertia));
        break;
      default:
        // Neutral: a free text, a generalist rectangle, a legend glyph.
        elements.push(element(doc, id, [x, y, 40, 24]));
    }
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
    // an early exit rather than the real path — and it must produce them from
    // all three rules, or one family could regress unmeasured.
    const violations = evaluateRules(WARDLEY_RULES, map);
    expect(violations.length).toBeGreaterThan(20);
    expect(new Set(violations.map(v => v.ruleId)).size).toBe(
      WARDLEY_RULES.length
    );
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

  it(`stays inside the frame with profiles in force`, () => {
    // PF9 adds one `validationProfile` read per role-carrying element and one
    // profile lookup per finding. The budget is unchanged, and so is the answer
    // for a map on the strict profile.
    const strict = referenceMap(MAP_SIZE, 'wardley.strict');
    const ms = medianMs(() =>
      evaluateRules(WARDLEY_RULES, strict, WARDLEY_PROFILES)
    );

    console.info(
      `[bench] strict profile, ${MAP_SIZE} elements + background: ${ms.toFixed(3)} ms (budget ${FRAME_BUDGET_MS} ms)`
    );
    expect(evaluateRules(WARDLEY_RULES, strict, WARDLEY_PROFILES).length)
      .toBeGreaterThan(20);
    expect(ms).toBeLessThan(FRAME_BUDGET_MS);
  });
});

/**
 * The dirty set (PF5.13): what a DRAG costs.
 *
 * This is the number the user actually feels. A full evaluation happens on a
 * load or a paste and can afford a frame; a drag fires the 120 ms debounce over
 * and over, and every one of those ticks has to be invisible.
 */
describe('a drag on a dense map re-judges only what moved', () => {
  const map = referenceMap(MAP_SIZE, 'wardley.strict');
  const previous = evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES);

  /**
   * The worst realistic case: the element the pair-wise family has the most to
   * say about — a label, i.e. a participant in three of the four declared
   * combinations — plus the map itself, because dragging a node inside a group
   * wakes its neighbours too.
   */
  const dragged = map.filter(el => el.role === WARDLEY_ROLE.label).slice(0, 3);
  const dirty = new Set(dragged.map(el => el.id));

  it('re-judges a drag well inside the frame', () => {
    const ms = medianMs(() =>
      evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES, {
        dirty,
        previous,
      })
    );

    console.info(
      `[bench] dirty set (${dirty.size} dragged), ${MAP_SIZE} elements: ${ms.toFixed(3)} ms (budget ${FRAME_BUDGET_MS} ms)`
    );
    expect(ms).toBeLessThan(FRAME_BUDGET_MS);
  });

  it('reaches exactly the same verdict as a full pass', () => {
    // The whole point: the dirty set is a way of NOT doing work, never a
    // different answer. Nothing moved between the two, so they must agree
    // finding for finding.
    const incremental = evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES, {
      dirty,
      previous,
    });
    const key = (v: Violation) => `${v.ruleId}|${v.elementIds.join('+')}`;

    expect(incremental.map(key).sort()).toEqual(previous.map(key).sort());
  });

  it('re-judges everything when the MAP itself moved', () => {
    // A frame is not a participant of the pair-wise family, so no pair-wise
    // re-test would ever reach the findings measured against it — and moving a
    // map re-attributes every one of them. The dirty set is a way of not doing
    // work, never a way of losing an answer.
    const key = (v: Violation) => `${v.ruleId}|${v.elementIds.join('+')}`;
    const mapMoved = evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES, {
      dirty: new Set(['bg']),
      // Deliberately empty: a correct incremental pass must not depend on
      // carrying anything over here, because it cannot.
      previous: [],
    });

    expect(mapMoved.map(key).sort()).toEqual(previous.map(key).sort());
  });

  it('is cheaper than the full pass it replaces', () => {
    const full = medianMs(() =>
      evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES)
    );
    const incremental = medianMs(() =>
      evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES, { dirty, previous })
    );

    console.info(
      `[bench] full ${full.toFixed(3)} ms vs dirty ${incremental.toFixed(3)} ms`
    );
    expect(incremental).toBeLessThan(full);
  });
});

describe('a rule switched off costs nothing', () => {
  /**
   * `'off'` is not a filter over findings, it is a rule that never runs. The
   * short-circuit fires when nothing on the board can raise the rule — which
   * means the DEFAULT has to be off too, since a background naming no profile
   * falls back to it.
   */
  const OFF_PROFILE: ValidationProfile = {
    id: 'wardley.off',
    framework: 'wardley',
    labelKey: 'com.labre.wardley.profile.off',
    isDefault: true,
    rules: Object.fromEntries(WARDLEY_RULES.map(rule => [rule.id, 'off'])),
  };

  const map = referenceMap(MAP_SIZE);

  it('never walks the surface', () => {
    const ms = medianMs(() =>
      evaluateRules(WARDLEY_RULES, map, [OFF_PROFILE])
    );

    console.info(
      `[bench] every rule off, same ${MAP_SIZE}-element map: ${ms.toFixed(4)} ms`
    );
    expect(evaluateRules(WARDLEY_RULES, map, [OFF_PROFILE])).toEqual([]);
    // Not quite the flag-off floor: the one pass that reads which profiles are
    // in play still happens, because it is what proves the rule can be skipped.
    expect(ms).toBeLessThan(0.5);
  });
});
