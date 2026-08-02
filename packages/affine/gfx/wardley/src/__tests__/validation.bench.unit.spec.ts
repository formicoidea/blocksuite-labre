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
  absolutePath?: [number, number][],
  text?: string
): GfxPrimitiveElementModel {
  const yMap = new Y.Map<unknown>();
  doc.getMap<Y.Map<unknown>>('elements').set(id, yMap);
  yMap.set('xywh', `[${xywh.join(',')}]`);
  if (role !== undefined) yMap.set('role', role);
  if (validationProfile !== undefined) {
    yMap.set('validationProfile', validationProfile);
  }
  // A real label is a text element, and a `text` role is measured by the INK of
  // its words: `no-overlap` reads the Y.Text of every label on every pass, so
  // the budget has to be measured against a real attached one.
  if (text !== undefined) {
    yMap.set('text', new Y.Text(text));
    yMap.set('fontSize', 18);
    yMap.set('textAlign', 'left');
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
    get text() {
      return read('text');
    },
    get fontSize() {
      return read('fontSize') as number | undefined;
    },
    get textAlign() {
      return read('textAlign') as string | undefined;
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
        elements.push(
          element(
            doc,
            id,
            [x + 17, y - 4, 120, 26],
            WARDLEY_ROLE.label,
            undefined,
            undefined,
            'Customer'
          )
        );
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

  /**
   * The case a three-element drag hides: a LASSO.
   *
   * Selecting a third of a map and moving it is an entirely ordinary gesture,
   * and the dirty path costs `dirtyParticipants × p` against the sweep's
   * `p²/2`. Unbounded, it crossed over around 10–30 % of the participants and
   * reached **8× the sweep — 18 ms, outside the frame** — for the one gesture
   * where the sweep it replaced cost 2.2 ms and was comfortably inside it.
   *
   * The family now compares the two costs before choosing. This measures the
   * shape of the curve, not one point on it, because "it is fast for a drag of
   * three" was exactly the claim that hid the problem.
   */
  it('stays inside the frame at EVERY dirty-set size', () => {
    const participants = map.filter(
      el =>
        el.role !== undefined &&
        el.role !== WARDLEY_ROLE.map &&
        el.role !== WARDLEY_ROLE.inertia &&
        el.role !== WARDLEY_ROLE.changeArrow
    );
    const fullPass = () =>
      medianMs(() => evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES));

    /**
     * The baseline is bracketed rather than taken once at the top.
     *
     * This suite runs beside 96 other files and the machine's load moves under
     * it, so a ratio between a figure measured at the start and one measured
     * half a second later measures the load and not the code — that is the
     * flake this replaces. One measurement on each side of the loop is enough
     * to be contemporaneous with all five points; measuring it INSIDE the loop
     * would be more contemporaneous still and would put 130 full passes under a
     * wall-clock assertion, which is a different way of being wrong.
     */
    const before = fullPass();
    const points: { size: number; ms: number }[] = [];
    for (const fraction of [0.02, 0.1, 0.3, 0.6, 1]) {
      const size = Math.max(1, Math.round(participants.length * fraction));
      const lasso = new Set(participants.slice(0, size).map(el => el.id));
      points.push({
        size,
        ms: medianMs(() =>
          evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES, {
            dirty: lasso,
            previous,
          })
        ),
      });
    }
    const full = Math.max(before, fullPass());

    for (const { size, ms } of points) {
      console.info(
        `[bench] lasso drag, |dirty|=${size} of ${participants.length} participants: ` +
          `${ms.toFixed(3)} ms (full ${full.toFixed(3)} ms, budget ${FRAME_BUDGET_MS} ms)`
      );
      expect(ms).toBeLessThan(FRAME_BUDGET_MS);
      // Never several times the price of the thing it is avoiding. The bound is
      // 3× and not 2×, and the number is not a taste: measured beside the other
      // 96 files of the suite, the SAME full pass reads 2.7 ms and 5.2 ms
      // within one test, so the noise floor here is a factor of two and a 2×
      // bound is a coin toss. The regression this guard exists for was measured
      // at EIGHT times the sweep; 3× still catches it, and the budget
      // assertion above — the one a user feels — stays exact.
      expect(ms).toBeLessThan(full * 3 + 2);
    }
  });
});

/**
 * ## The budget's horizon — read this before adding a second pair-wise family
 *
 * `no-overlap` is the only super-linear term in the engine: everything else is
 * a constant per element. Measured on this generator, with the three rules of
 * THIS slice and nothing else, EVALUATION ONLY — the map is built outside the
 * timer, or the linear generator dilutes the quadratic engine and every figure
 * below is a statement about the wrong thing. Recorded so the next slice
 * inherits a FIGURE rather than a conclusion:
 *
 * ```
 *   500 elements :   2.0 ms     (the reference map, and the claim in the PR)
 *  1000 elements :   5.2 ms     (still inside, with two thirds of the frame spare)
 *  2000 elements :  15.0 ms     (the whole budget, exactly — this IS the wall)
 *  4000 elements :  50.0 ms     (3× outside)
 * ```
 *
 * Four times the elements is sixteen times the work: the wall is at roughly
 * **2000 elements today** — the one figure this slice hands on, and the same
 * one the `SCALE` line below recomputes on every run (measured across runs on
 * one machine: 1650 to 2100, median ~1930). It moves DOWN as rules are added:
 * each extra pair-wise rule is another full sweep.
 *
 * So the honest trigger for a spatial index is **the second pair-wise rule, or
 * the first board past ~2000 elements — whichever comes first.** Not "when we
 * have fourteen frameworks": one more `no-overlap` rule halves the headroom on
 * its own, and one dense board reaches the wall without any help.
 *
 * "No spatial index, measured first" was the right call for this slice and is
 * the wrong call for the next one that crosses either line. The case below is
 * asserted so that whoever crosses it meets a failing test, not a paragraph.
 */
describe('the budget horizon, recorded for the next slice', () => {
  it('grows QUADRATICALLY, and says where that puts the wall', () => {
    // Both sizes measured here, in the same test, on the same machine: an
    // absolute millisecond count at 1000 elements is a statement about the CI
    // runner's mood, while the RATIO between two sizes is a statement about the
    // engine. Doubling the elements must cost about four times, never eight —
    // that would mean a lost hoist or a third nested loop.
    // Both maps are BUILT OUTSIDE the timer, like every other measurement in
    // this file. The generator is linear and the evaluation quadratic, so a
    // build left inside the closure dominates the small point and drags the
    // measured ratio down towards ×2 — it made the shape look better than it
    // is, and the extrapolated wall ~60 % more pessimistic than it is.
    const smallMap = referenceMap(500, 'wardley.strict');
    const bigMap = referenceMap(1000, 'wardley.strict');
    const small = medianMs(
      () => evaluateRules(WARDLEY_RULES, smallMap, WARDLEY_PROFILES),
      7,
      2
    );
    const big = medianMs(
      () => evaluateRules(WARDLEY_RULES, bigMap, WARDLEY_PROFILES),
      7,
      2
    );
    const ratio = big / small;
    // Where this puts the 16 ms wall, extrapolated from the measured curve.
    const wall = Math.round(1000 * Math.sqrt(FRAME_BUDGET_MS / big));

    console.info(
      `[bench] SCALE 500 → 1000 elements: ${small.toFixed(3)} → ${big.toFixed(3)} ms ` +
        `(×${ratio.toFixed(2)}, quadratic ≈ ×4) — the ${FRAME_BUDGET_MS} ms wall ` +
        `is around ${wall} elements TODAY, and moves down with every rule added. ` +
        `See the note above this suite before adding a second pair-wise family.`
    );

    // Quadratic, not worse. Generous against a noisy runner in both
    // directions; the SHAPE is the claim, and the only part of this that is a
    // statement about the engine rather than about the machine — `wall` moves
    // by a factor of four between an idle runner and a loaded one, so it is
    // logged and never asserted.
    expect(ratio).toBeLessThan(8);
  });

  it('has exactly ONE pair-wise rule — the second one is the trigger', () => {
    // The enforceable half of the note above. Every `no-overlap` rule is
    // another full sweep of the participants against themselves, so the second
    // one halves the headroom on its own — which is why "when we have fourteen
    // frameworks" was never the honest trigger.
    //
    // When this fails: read the note, measure again, and either build the
    // spatial index or write down why the numbers still say not to. What must
    // not happen is a second sweep landing because the first one was cheap.
    const pairwise = WARDLEY_RULES.filter(rule => rule.family === 'no-overlap');

    expect(pairwise.map(rule => rule.id)).toEqual([
      'wardley.overlapping-artefacts',
    ]);
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
