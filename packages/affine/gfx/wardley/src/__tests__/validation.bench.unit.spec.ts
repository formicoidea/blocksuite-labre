import {
  evaluateCheckup,
  evaluateRules,
  frameMembership,
  scopeOf,
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

/**
 * Wall-clock allowance for a measurement, as opposed to the budget being
 * measured.
 *
 * A bench takes dozens of samples of something that is allowed to cost a frame,
 * so it is inherently near vitest's 1 s default — and on a loaded runner it goes
 * past it. That failure says nothing about the engine and hides the assertions
 * that would: generous here, strict in the `expect`s.
 */
const BENCH_TIMEOUT_MS = 30_000;

/** Wardley elements on the reference map, background excluded. */
const MAP_SIZE = 500;

/**
 * An ON-DEMAND rule, declared here because no framework ships one any more: the
 * PO dropped Wardley's check-up on the recette of 02/08/2026, while the moment
 * itself (PF5.14) stayed in the engine as a platform capability. The zero-cost
 * claim below is the engine's, so it is measured with the engine's own switch
 * flipped on a rule that otherwise does real work on this map.
 */
const ON_DEMAND_PROBE: readonly ValidationRule[] = [
  {
    ...WARDLEY_RULES[0],
    id: 'bench.on-demand-probe',
    moment: 'on-demand',
    severity: 'audit',
  },
];

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
  text?: string,
  /**
   * The two ends of a typed edge. Plain properties, like the routed path: on a
   * real connector `source`/`target` are `@field()` accessors, but W4 reads
   * each of them once per edge — never per element and never in a loop — so the
   * two Y.Map lookups they would add are below the noise of the pass they sit
   * in, and modelling them here would only make the fixture longer.
   */
  ends?: { source: string; target: string }
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
    ...(ends
      ? { source: { id: ends.source }, target: { id: ends.target } }
      : {}),
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
        // BOUND to the component of this row and the next one — which is what
        // makes W4 evaluate it at all, and what makes this map measure the
        // family rather than its early exit. The generator's positions are
        // pseudo-random, so roughly half the pairs come out against the value
        // chain: a real violating population, like the arrows below.
        const source = `el-${i - 2}`;
        const target = i + 4 < size ? `el-${i + 4}` : `el-${i - 8}`;
        elements.push(
          element(
            doc,
            id,
            [x, y, 240, 60],
            WARDLEY_ROLE.dependency,
            undefined,
            [[x, y], to],
            undefined,
            { source, target }
          )
        );
        break;
      }
      case 3: {
        // A tenth of the arrows run backwards: a real violating population.
        const back = i % 10 === 3;
        const from: [number, number] = back ? [x + 180, y] : [x, y];
        const to: [number, number] = back ? [x, y] : [x + 180, y];
        elements.push(
          element(
            doc,
            id,
            [x, y, 180, 2],
            WARDLEY_ROLE.changeArrow,
            undefined,
            [from, to]
          )
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

/**
 * Median AND best of one sweep — the best is for holding a measurement against
 * an ABSOLUTE budget.
 *
 * The relative tests in this file read their noise floor off the same samples
 * they assert on, because no constant chosen on a developer's laptop describes
 * a CI box under ten parallel suites. The absolute budget used to ignore its
 * own advice: it held the MEDIAN against a fixed 16 ms, and under a full
 * parallel run the median of the same 2 ms evaluation reads 17.5–19 ms —
 * a number about the scheduler, not the engine. Scaling the budget by the
 * sweep's own inflation (median ÷ best) is algebraically the same claim as
 * holding the BEST sample against the unscaled budget, so that is what the
 * budget tests assert: the best sample is the engine's cost on the one
 * iteration the machine let it run — the only number of a sweep a loaded
 * runner cannot inflate — and a real regression inflates every sample, the
 * best one included. The median is still logged (it is what a user on that
 * machine would have felt) and it stays the statistic every RELATIVE
 * comparison is made of, where shared load cancels out instead of lying.
 */
function sweepMs(
  run: () => unknown,
  runs = 21,
  warmup = 5
): { median: number; best: number } {
  for (let i = 0; i < warmup; i++) run();

  const samples: number[] = [];
  for (let i = 0; i < runs; i++) {
    const start = performance.now();
    run();
    samples.push(performance.now() - start);
  }
  samples.sort((a, b) => a - b);
  return {
    median: samples[Math.floor(samples.length / 2)],
    best: samples[0],
  };
}

/** Median of `runs` timed evaluations, after a warm-up. */
function medianMs(run: () => unknown, runs = 21, warmup = 5): number {
  return sweepMs(run, runs, warmup).median;
}

/**
 * One median per variant, measured on INTERLEAVED samples.
 *
 * Measuring one variant and then the next is what a naive A/B bench does, and on
 * a shared runner it compares the machine's mood at two moments as much as it
 * compares the code: back-to-back medians of the *same* evaluation drift by half
 * again on this suite, and by three times under a full parallel run. Rotating
 * through the variants inside a single sweep puts all of them through the same
 * thermal state, the same GC pauses and the same neighbouring test files, so
 * what is left between them is the difference between them.
 *
 * Taking more than two also lets a caller include the SAME work twice and read
 * its own noise floor off the result — see the on-demand test below, which is
 * the only honest way to say "these two are indistinguishable" on a box whose
 * load nobody controls.
 *
 * The BEST sample comes back beside the median, for the claims a median cannot
 * carry. Measured on 17/09/2026 with six copies of this file running at once:
 * the interleaved medians of IDENTICAL work landed anywhere between ×0.5 and
 * ×2.6 of each other — a burst of load falls inside one variant's samples and
 * not its neighbour's, and 21 samples do not average a burst away — while their
 * best samples stayed within ×0.85–×1.10. See `sweepMs`: the best sample is the
 * one number of a sweep a loaded runner cannot inflate.
 */
function sweepEachMs(
  runs: readonly (() => unknown)[],
  samples = 21,
  warmup = 5
): { median: number; best: number }[] {
  for (let i = 0; i < warmup; i++) for (const run of runs) run();

  const buckets: number[][] = runs.map(() => []);
  for (let i = 0; i < samples; i++) {
    for (let k = 0; k < runs.length; k++) {
      // Rotated every iteration, so no variant systematically pays for warming
      // the cache the next one then reads.
      const index = (k + i) % runs.length;
      const start = performance.now();
      runs[index]();
      buckets[index].push(performance.now() - start);
    }
  }

  return buckets.map(bucket => {
    bucket.sort((x, y) => x - y);
    return { median: bucket[Math.floor(bucket.length / 2)], best: bucket[0] };
  });
}

/**
 * Two medians, measured ALTERNATELY — for a comparison between two ways of
 * doing the same work.
 *
 * `medianMs` twice in a row is a comparison between two moments as much as
 * between two implementations: a runner that gets busy between them shifts one
 * side and not the other. That was tolerable while the saving was most of the
 * evaluation; with a fourth rule paying a fixed cost on BOTH sides, the margin
 * is now a fraction of the total, and the drift is bigger than the thing being
 * measured. Interleaving makes any load the two sides share cancel out.
 */
function pairedMedianMs(
  a: () => unknown,
  b: () => unknown,
  runs = 21,
  warmup = 5
): [number, number] {
  for (let i = 0; i < warmup; i++) {
    a();
    b();
  }
  const aSamples: number[] = [];
  const bSamples: number[] = [];
  for (let i = 0; i < runs; i++) {
    let start = performance.now();
    a();
    aSamples.push(performance.now() - start);
    start = performance.now();
    b();
    bSamples.push(performance.now() - start);
  }
  const median = (samples: number[]) =>
    samples.sort((x, y) => x - y)[Math.floor(samples.length / 2)];
  return [median(aSamples), median(bSamples)];
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

  // The explicit timeout is the wall-clock allowance for TAKING 26 samples of
  // something allowed to cost a frame each — on a loaded runner that sails past
  // vitest's 1 s default, and a bench that fails for want of wall-clock time
  // reports nothing about the engine. The assertion below is what must fail.
  it(
    `evaluates the whole map in under ${FRAME_BUDGET_MS} ms`,
    () => {
      const { median, best } = sweepMs(() => evaluateRules(WARDLEY_RULES, map));

      console.info(
        `[bench] full evaluation, ${MAP_SIZE} elements + background: ` +
          `median ${median.toFixed(3)} ms, best ${best.toFixed(3)} ms (budget ${FRAME_BUDGET_MS} ms)`
      );
      expect(best).toBeLessThan(FRAME_BUDGET_MS);
    },
    BENCH_TIMEOUT_MS
  );

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

  /**
   * PF5.14's acceptance criterion, measured rather than asserted in prose: an
   * on-demand rule must cost the drawing path ZERO.
   *
   * Measured against PROBE rules since 02/08/2026 — Wardley ships no on-demand
   * rule any more (the PO dropped the check-up), and the property being measured
   * is the engine's, not the framework's. The probes are the real rules with
   * their moment changed, so the work skipped is real work on a real map.
   *
   * Both halves are checked, because either one alone is easy to fake: the
   * ANSWER must be identical (the rules are never evaluated, not merely
   * filtered out of the results afterwards), and the TIME must be
   * indistinguishable (they are skipped before an element is touched, not
   * walked and discarded).
   *
   * Given an explicit timeout because it is the most expensive case in the file:
   * interleaving means BOTH variants are sampled on every iteration, so it does
   * roughly twice the work of a plain `medianMs` and lands near the 1 s default
   * on a loaded runner. A bench that fails for want of wall-clock time reports
   * nothing about the engine — the assertions below are what must fail, if
   * anything does.
   */
  it(
    'pays nothing for the on-demand rules registered beside them',
    () => {
      // EVERY real-time rule registered a second time as an on-demand one, not
      // the single probe: walked by mistake, one extra rule reads ×1.1–1.3 of
      // the pass (measured), which no bound that survives a loaded runner can
      // tell from noise. A whole second rule set reads ×2, and that one can.
      const both = [
        ...WARDLEY_RULES,
        ...WARDLEY_RULES.map(
          (rule): ValidationRule => ({
            ...rule,
            id: `bench.on-demand.${rule.id}`,
            moment: 'on-demand',
            severity: 'audit',
          })
        ),
      ];

      expect(evaluateRules(both, map)).toEqual(
        evaluateRules(WARDLEY_RULES, map)
      );

      /**
       * THREE variants in ONE sweep, two of which are the same work.
       *
       * Interleaving alone still cannot name a fixed bound, because the number the
       * assertion needs is "how far apart may two IDENTICAL measurements land on
       * this machine, right now" — and a loaded runner deschedules threads and
       * pauses for GC inside one variant's samples and not another's. No constant
       * chosen on a developer's laptop describes a CI box under ten parallel
       * suites; measured across runs here, the same evaluation lands anywhere
       * between ×1.05 and ×1.4 of itself.
       *
       * So the noise floor is measured FROM THE SAME SAMPLES as the claim, not by
       * a second call a moment later — which was the flaw in the first attempt:
       * a separate calibration sweep reports the machine's mood at a different
       * moment, which is precisely the thing being corrected for.
       *
       * And it is read off the BEST samples, not the medians. The medians were
       * the second flaw: with six copies of this file running, two identical
       * variants read ×1.07 of each other while the third, equally idle, read
       * ×2.2 — the spread between two medians under-reads the spread of a third
       * (see `sweepEachMs`). A rule set that is really walked is walked on
       * every sample, the best one included, so nothing is lost by asking the
       * one sample the runner left alone.
       */
      const [withoutA, with_, withoutB] = sweepEachMs([
        () => evaluateRules(WARDLEY_RULES, map),
        () => evaluateRules(both, map),
        () => evaluateRules(WARDLEY_RULES, map),
      ]);

      const without = (withoutA.best + withoutB.best) / 2;
      const noise =
        Math.max(withoutA.best, withoutB.best) /
        Math.min(withoutA.best, withoutB.best);
      // Measured under that load: skipped reads ×0.96–1.07 of the pass and its
      // own spread stays under ×1.2; walked reads ×2. The floor sits between.
      const bound = without * Math.max(noise, 1.5) + 0.05;

      console.info(
        `[bench] real-time pass, ${WARDLEY_RULES.length} rules: best ${without.toFixed(3)} ms ` +
          `(median ${((withoutA.median + withoutB.median) / 2).toFixed(3)}) — ` +
          `with ${both.length - WARDLEY_RULES.length} on-demand rules also registered: ` +
          `best ${with_.best.toFixed(3)} ms (median ${with_.median.toFixed(3)}; ` +
          `interleaved; must be the same number) — ` +
          `noise floor ×${noise.toFixed(2)} (${withoutA.best.toFixed(3)} vs ` +
          `${withoutB.best.toFixed(3)} ms for identical work), bound ${bound.toFixed(3)} ms`
      );
      // What the extra rules may cost is two property reads per evaluation, which
      // is unmeasurable. Anything past the spread the SAME work shows on this
      // machine would mean they are actually being walked.
      expect(with_.best).toBeLessThan(bound);
    },
    BENCH_TIMEOUT_MS
  );

  it('runs those same rules only when asked, and finds something', () => {
    // The other side of the coin: an on-demand rule is not inert data, it is a
    // rule that works — it simply works at the other moment. The probe is W1
    // with its moment changed, and a tenth of the arrows on this map run
    // backwards, so a check-up over it must find them.
    const checked = referenceMap(MAP_SIZE);
    const remarks = evaluateCheckup(ON_DEMAND_PROBE, checked);

    console.info(
      `[bench] check-up over ${MAP_SIZE} elements: ${remarks.length} remarks`
    );
    expect(remarks.length).toBeGreaterThan(0);
    // ...and not one of them reached the real-time answer.
    expect(evaluateRules(ON_DEMAND_PROBE, checked)).toEqual([]);
  });

  it('takes the same rule off the path on its SEVERITY alone', () => {
    // PF7.6, at the bench rather than in a comment: drop the explicit moment
    // and keep `audit`, and the rule is still never walked on the drawing path.
    // No timing here — a walk either happens or it does not, and the answer
    // says so on any machine.
    const bySeverity = ON_DEMAND_PROBE.map(rule => ({
      ...rule,
      moment: undefined,
    }));
    const checked = referenceMap(MAP_SIZE);

    expect(evaluateRules(bySeverity, checked)).toEqual([]);
    expect(evaluateCheckup(bySeverity, checked).length).toBeGreaterThan(0);
  });

  it(
    `stays inside the frame with profiles in force`,
    () => {
      // PF9 adds one `validationProfile` read per role-carrying element and one
      // profile lookup per finding. The budget is unchanged, and so is the
      // answer for a map on the strict profile.
      const strict = referenceMap(MAP_SIZE, 'wardley.strict');
      const { median, best } = sweepMs(() =>
        evaluateRules(WARDLEY_RULES, strict, WARDLEY_PROFILES)
      );

      console.info(
        `[bench] strict profile, ${MAP_SIZE} elements + background: ` +
          `median ${median.toFixed(3)} ms, best ${best.toFixed(3)} ms (budget ${FRAME_BUDGET_MS} ms)`
      );
      expect(
        evaluateRules(WARDLEY_RULES, strict, WARDLEY_PROFILES).length
      ).toBeGreaterThan(20);
      expect(best).toBeLessThan(FRAME_BUDGET_MS);
    },
    BENCH_TIMEOUT_MS
  );
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

  it(
    're-judges a drag well inside the frame',
    () => {
      const { median, best } = sweepMs(() =>
        evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES, {
          dirty,
          previous,
        })
      );

      console.info(
        `[bench] dirty set (${dirty.size} dragged), ${MAP_SIZE} elements: ` +
          `median ${median.toFixed(3)} ms, best ${best.toFixed(3)} ms (budget ${FRAME_BUDGET_MS} ms)`
      );
      expect(best).toBeLessThan(FRAME_BUDGET_MS);
    },
    BENCH_TIMEOUT_MS
  );

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

  it(
    'is cheaper than the full pass it replaces',
    () => {
      // Interleaved: the saving is the pair-wise family's, while the three
      // element-local rules and W4 cost the same on both sides, so the margin is
      // a fraction of the total and a drifting runner would decide the verdict.
      const [full, incremental] = pairedMedianMs(
        () => evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES),
        () =>
          evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES, {
            dirty,
            previous,
          })
      );

      console.info(
        `[bench] full ${full.toFixed(3)} ms vs dirty ${incremental.toFixed(3)} ms`
      );
      expect(incremental).toBeLessThan(full);
    },
    BENCH_TIMEOUT_MS
  );

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
  // Five dirty-set sizes, each measured over 21 runs plus a warm-up, against
  // an engine that now carries a fourth rule: past the package's 1 s default on
  // a loaded machine. The BUDGET each evaluation is held to is unchanged — it
  // is the number of evaluations this one test performs that needs the room.
  it(
    'stays inside the frame at EVERY dirty-set size',
    { timeout: BENCH_TIMEOUT_MS },
    () => {
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
      const points: { size: number; median: number; best: number }[] = [];
      for (const fraction of [0.02, 0.1, 0.3, 0.6, 1]) {
        const size = Math.max(1, Math.round(participants.length * fraction));
        const lasso = new Set(participants.slice(0, size).map(el => el.id));
        points.push({
          size,
          ...sweepMs(() =>
            evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES, {
              dirty: lasso,
              previous,
            })
          ),
        });
      }
      const full = Math.max(before, fullPass());

      for (const { size, median, best } of points) {
        console.info(
          `[bench] lasso drag, |dirty|=${size} of ${participants.length} participants: ` +
            `median ${median.toFixed(3)} ms, best ${best.toFixed(3)} ms ` +
            `(full ${full.toFixed(3)} ms, budget ${FRAME_BUDGET_MS} ms)`
        );
        // The budget on the best sample, like every absolute budget in this
        // file (see `sweepMs`); the median carries the RELATIVE claim below,
        // where the load it embeds is on both sides and cancels out.
        expect(best).toBeLessThan(FRAME_BUDGET_MS);
        // Never several times the price of the thing it is avoiding. The bound is
        // 3× and not 2×, and the number is not a taste: measured beside the other
        // 96 files of the suite, the SAME full pass reads 2.7 ms and 5.2 ms
        // within one test, so the noise floor here is a factor of two and a 2×
        // bound is a coin toss. The regression this guard exists for was measured
        // at EIGHT times the sweep; 3× still catches it, and the budget
        // assertion above — the one a user feels — stays exact.
        expect(median).toBeLessThan(full * 3 + 2);
      }
      // Six medianMs measurements in one test — the most expensive case in the
      // file, and the one that has been timing out under load since before this
      // slice. The BUDGET assertions above are untouched; only the wall-clock
      // allowance for taking the samples is.
    }
  );
});

/**
 * ## The budget's horizon — read this before adding a second pair-wise family
 *
 * `no-overlap` is the only super-linear term in the engine: everything else is
 * a constant per element. Measured on this generator, with the four rules of
 * today and nothing else, EVALUATION ONLY — the map is built outside the timer,
 * or the linear generator dilutes the quadratic engine and every figure below
 * is a statement about the wrong thing. Best of interleaved samples, all three
 * variants measured in ONE session on one quiet developer machine through a
 * temporary switch, so the ratios are the claim and the absolute numbers are
 * only the setting:
 *
 * ```
 *              every pair    prune on x    + inline y gate
 *   500 :         1.2 ms        0.9 ms         0.8 ms      (the reference map)
 *  1000 :         3.6 ms        2.2 ms         1.9 ms
 *  2000 :        15.3 ms        8.3 ms         6.3 ms      (was the wall)
 *  4000 :        47.1 ms       22.5 ms        19.0 ms
 * ```
 *
 * The pair-wise family alone, which is what actually changed: 0.86 → 0.52 →
 * 0.47 ms at 500, 3.34 → 1.53 → 1.32 at 1000, 10.66 → 4.64 → 3.80 at 2000,
 * 42.62 → 16.50 → 13.97 at 4000.
 *
 * Couples actually handed to the collision test, counted at the call site:
 *
 * ```
 *   500 :      31 375        4 593            550
 *  1000 :     125 250       18 553          1 722
 *  2000 :     500 500       74 536          6 734
 *  4000 :   2 001 000      298 769         27 037
 * ```
 *
 * The x prune throws away ~85 % of the couples at every size; of the ones it
 * keeps, ~91 % share no y extent, and the two subtractions in the loop now say
 * so before `declared` builds its closures over `couples`. Net of the linear
 * term the family pays whatever it prunes (subject building — `elementBound`
 * is a `JSON.parse`, a `text` role is measured ink — about 12 ms of the 4000
 * figures, read off the naive/pruned pair), a couple inside the x band costs
 * ~15 ns when it reaches `declared`, and single-digit nanoseconds when the y
 * gate refuses it. The wall clock improves by much less than the couple count
 * in both steps, for the same reason each time: what is thrown away is the
 * cheapest work there was.
 *
 * ## What did NOT change: the shape
 *
 * It is still quadratic on THIS generator, and for a reason worth writing down:
 * the reference map is a fixed 1600 × 900 board, so doubling the elements
 * doubles the DENSITY, and the number of subjects sharing any x band grows with
 * the element count exactly as the naive count did. The prune and the y gate
 * divide the constant by three; they do not change the exponent on a board that
 * is asked to hold twice as much in the same space. A real board that grows in
 * AREA as it grows in artefacts — which is what a user actually draws — sees a
 * genuinely near-linear pass.
 *
 * So the wall moved by a constant, not by a class: from roughly **2100 elements
 * to roughly 3600** on this generator and this machine, extrapolated from the
 * measured 2000 and 4000 points on both sides of the change with the linear
 * term separated out. Read it as an order of magnitude and not as a number: the
 * `SCALE` line below recomputes a cruder version of it from the 500 → 1000 pair
 * on every run, and read 1875 and 2433 on two runs of the same quiet machine
 * minutes apart, which is exactly why it is logged and never asserted. It still
 * moves DOWN as rules are added: each extra pair-wise rule is another full
 * sweep — a cheaper one now, but a whole one.
 *
 * W4 (`docs/adr/0010`) joined the pack without moving that wall, and the suite
 * above says why: it is priced by the RELATIONS somebody drew, so it adds a
 * linear term (~0.3 ms on the reference map, a fifth of the full evaluation)
 * and no second sweep. A rule about a pair of elements is not automatically a
 * quadratic rule — a rule about every pair is.
 *
 * ## The trigger for a real spatial index
 *
 * The one-axis prune IS the cheap half of a spatial index, and it is now spent.
 * What is left is the density of x-overlapping subjects, and the board that
 * defeats it is not hypothetical: a framework whose artefacts SPAN the map —
 * swimlanes, phase bands, a Wardley evolution zone drawn as a full-width
 * rectangle — puts every subject in every other subject's x band and degenerates
 * to a walk over every couple. What it does NOT degenerate to any more is the
 * old cost: those couples now die on two subtractions rather than on `declared`
 * plus `boundsOverlap`, which is the difference between the last two columns
 * above. The upgrade path, when a board does that or a second pair-wise family
 * lands, is to make y an INDEX rather than a filter (sort on y as well and
 * intersect the two candidate sets) or a uniform grid keyed on the bound; both
 * cost memory per pass, which is why neither is here yet. The `ponytail:` note in
 * `evaluateNoOverlap` says the same thing beside the code.
 *
 * The case below is asserted so that whoever crosses it meets a failing test,
 * not a paragraph.
 *
 * ## What PF5.4 moved, and what it did not
 *
 * Everything above is the FULL pass — a load, a paste, an undo — and PF5.4 does
 * not touch it. What it moves is the other number, the DRAG: since PF5.4 every
 * family re-judges only the closure of what changed (`docs/adr/0015`), where
 * before only `no-overlap` did. Measured by the last suite in this file, on top
 * of the prune above, all four rules, profiles in force, three labels dragged,
 * best of two quiet runs:
 *
 * ```
 *              full pass   tick before (PF5.13)   tick now
 *  2000 el :     6.6 ms          4.1 ms            3.7 ms   (inside the frame)
 *  4000 el :    16.7 ms          8.8 ms            8.0 ms   (inside the frame)
 *  8000 el :    64.1 ms         28.1 ms           27.3 ms   (past it)
 * ```
 *
 * So there are now TWO walls and they are far apart: a board stops OPENING
 * inside a frame around the figure above, and stops being DRAGGABLE inside one
 * near 6000 elements. PF5.4's own share of that second figure is ~9 % on THIS
 * pack — the rest was already `no-overlap`'s — because Wardley's two narrowable
 * families are linear with a nearly empty body, and the closure removes only
 * what a family does per subject. It is the pack this slice helps least; the
 * next figure worth taking is BPMN's or C4's, not another Wardley one.
 */
describe('the budget horizon, recorded for the next slice', () => {
  it(
    'grows QUADRATICALLY, and says where that puts the wall',
    () => {
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
      // Interleaved, for the reason `pairedMedianMs` documents: the RATIO is the
      // only claim about the engine here, and measuring the two sizes one after
      // the other lets a runner that gets busy in between decide it.
      const [small, big] = pairedMedianMs(
        () => evaluateRules(WARDLEY_RULES, smallMap, WARDLEY_PROFILES),
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
    },
    BENCH_TIMEOUT_MS
  );

  /**
   * The two boards past the reference map, MEASURED rather than extrapolated —
   * and logged rather than asserted.
   *
   * 2000 is where the pre-prune curve met the frame exactly and the figure the
   * last slice handed on as "the wall". On a quiet developer machine it now
   * comes in around 6 ms best, comfortably inside the budget; on the same
   * machine running three other heavy sessions it reads 31–38 ms. An absolute
   * budget at 2000 would therefore be a coin toss, and there is no CI job to
   * average the mood out — so the figure is printed for whoever is reading the
   * horizon note and the budget stays asserted where it has eight times the
   * headroom (the 500-element reference map, above). 4000 is still out of the
   * frame, at around 20 ms best where it used to be three frames out.
   *
   * The claim about the ENGINE — that the curve is not worse than quadratic —
   * is asserted next door on an interleaved ratio, which is the only kind of
   * number a shared machine cannot decide.
   */
  it(
    'says what 2000 and 4000 elements cost today',
    () => {
      const twoK = referenceMap(2000, 'wardley.strict');
      const two = sweepMs(
        () => evaluateRules(WARDLEY_RULES, twoK, WARDLEY_PROFILES),
        15,
        5
      );
      const fourK = referenceMap(4000, 'wardley.strict');
      const four = sweepMs(
        () => evaluateRules(WARDLEY_RULES, fourK, WARDLEY_PROFILES),
        7,
        3
      );

      console.info(
        `[bench] full evaluation, 2000 elements: median ${two.median.toFixed(3)} ms, ` +
          `best ${two.best.toFixed(3)} ms (budget ${FRAME_BUDGET_MS} ms) — ` +
          `4000 elements: median ${four.median.toFixed(3)} ms, best ${four.best.toFixed(3)} ms ` +
          `— logged, never asserted: see the comment above`
      );

      // Only that the boards were evaluated at all: a silent pass would make
      // the figures above a measurement of an early exit.
      expect(
        evaluateRules(WARDLEY_RULES, twoK, WARDLEY_PROFILES).length
      ).toBeGreaterThan(100);
    },
    BENCH_TIMEOUT_MS
  );

  it('has exactly ONE pair-wise rule — the second one is the trigger', () => {
    // The enforceable half of the note above. Every `no-overlap` rule is
    // another full sweep of the participants against themselves. The sweep is
    // pruned on x now, so the second one costs a fraction of what the second
    // one used to cost — but it is still a whole extra pass over the
    // participants, and it still comes out of the same 16 ms. Cheaper is not
    // free, which is why "when we have fourteen frameworks" was never the
    // honest trigger.
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

/**
 * W4's own shape, measured apart from the pair-wise family it shares a budget
 * with.
 *
 * The claim `docs/adr/0010` makes is that a relative-order rule is priced by the
 * RELATIONS somebody drew, not by the couples of nodes that could have had one:
 * one indexing pass, then one pass over the edges. No transitive closure, no
 * sweep. A quadratic W4 would be a different rule wearing the same name — it
 * would also halve the headroom of the whole engine, which is the number the
 * suite above is written to protect.
 *
 * So this measures the family ALONE at two sizes and asserts the growth is
 * linear, not quadratic. The absolute milliseconds are logged and never
 * asserted: they are a statement about the machine, the RATIO is the statement
 * about the engine.
 */
describe('W4 is priced by the relations, not by the pairs', () => {
  const w4 = WARDLEY_RULES.filter(
    rule => rule.family === 'relative-order-along-axis'
  );

  it('has a violating population to measure', () => {
    const found = evaluateRules(w4, referenceMap(MAP_SIZE));
    // Both halves matter: findings prove the family runs to the end, and the
    // count proves the reference map is not accidentally conformant.
    expect(found.length).toBeGreaterThan(10);
    expect(found.every(v => v.elementIds.length === 3)).toBe(true);
  });

  /**
   * The shape, asserted by COUNTING rather than by timing.
   *
   * A chain of 200 nodes, every link drawn upside-down, is 199 relations. A
   * family that walked the pairs — or that closed the graph to find out what
   * transitively depends on what — would have 19 900 comparisons to make and,
   * on this fixture, that many things to say. 199 findings is the whole claim,
   * and unlike a millisecond count it cannot be argued with by a busy machine.
   */
  it('is priced by the RELATIONS: a 200-node chain is 199 findings', () => {
    const doc = new Y.Doc();
    const size = 200;
    const elements: GfxPrimitiveElementModel[] = [
      element(doc, 'bg', [0, 0, MAP_W, MAP_H], WARDLEY_ROLE.map),
    ];
    // Nodes alternate between the bottom and the top of the value chain, and
    // every link is drawn from the LOWER one to the higher one — 199 relations,
    // every one of them against the order, each pair far enough apart that the
    // declared slack cannot excuse it.
    const low = 700;
    const high = 200;
    const yOf = (i: number) => (i % 2 === 0 ? low : high);
    for (let i = 0; i < size; i++) {
      elements.push(
        element(
          doc,
          `n-${i}`,
          [20 + i * 7, yOf(i), 18, 18],
          WARDLEY_ROLE.component
        )
      );
      if (i === 0) continue;
      // The consumer is the one sitting lower: exactly what W4 refuses.
      const consumer = yOf(i) === low ? `n-${i}` : `n-${i - 1}`;
      const provider = yOf(i) === low ? `n-${i - 1}` : `n-${i}`;
      elements.push(
        element(
          doc,
          `d-${i}`,
          [20 + i * 7, high, 18, 8],
          WARDLEY_ROLE.dependency,
          undefined,
          undefined,
          undefined,
          { source: consumer, target: provider }
        )
      );
    }

    const found = evaluateRules(w4, elements);
    expect(found).toHaveLength(size - 1);
    // ...and every one of them names exactly one relation and its two ends.
    expect(new Set(found.map(v => v.elementIds.length))).toEqual(new Set([3]));
  });

  it(
    'stays a small fraction of the frame at twice the reference map',
    () => {
      const small = referenceMap(MAP_SIZE, 'wardley.strict');
      const big = referenceMap(MAP_SIZE * 2, 'wardley.strict');
      // One interleaved sweep of 21, where there were two back-to-back sweeps
      // of 7. The best sample only means "the iteration the machine let run"
      // if the sweep is long enough to contain one: under six parallel copies
      // of this file, the best of seven read 7 ms for an evaluation that costs
      // 1.2 — a burst of load simply outlasted the whole sweep. Interleaving
      // the small map stretches the window further and makes the logged ratio
      // a comparison of two maps rather than of two moments.
      const [oneWay, twice] = sweepEachMs([
        () => evaluateRules(w4, small, WARDLEY_PROFILES),
        () => evaluateRules(w4, big, WARDLEY_PROFILES),
      ]);

      console.info(
        `[bench] W4 alone, ${MAP_SIZE} → ${MAP_SIZE * 2} elements ` +
          `(${Math.round(MAP_SIZE / 6)} → ${Math.round((MAP_SIZE * 2) / 6)} bound edges): ` +
          `best ${oneWay.best.toFixed(3)} → ${twice.best.toFixed(3)} ms (×${(twice.best / oneWay.best).toFixed(2)}), ` +
          `median ${oneWay.median.toFixed(3)} → ${twice.median.toFixed(3)} ms — budget ${FRAME_BUDGET_MS} ms`
      );

      // The RATIO is logged, never asserted: both figures are well under a
      // millisecond on an idle machine, which is exactly where a median stops
      // being a statement about the engine and becomes one about the runner's
      // mood. The shape is asserted above, by counting. What is worth pinning
      // here is the absolute: the family must not eat the frame on a board twice
      // the size of the reference map — held to the best sample, like every
      // absolute budget in this file (see `sweepMs`).
      expect(twice.best).toBeLessThan(FRAME_BUDGET_MS / 2);
    },
    BENCH_TIMEOUT_MS
  );
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
    const ms = medianMs(() => evaluateRules(WARDLEY_RULES, map, [OFF_PROFILE]));

    console.info(
      `[bench] every rule off, same ${MAP_SIZE}-element map: ${ms.toFixed(4)} ms`
    );
    expect(evaluateRules(WARDLEY_RULES, map, [OFF_PROFILE])).toEqual([]);
    // Not quite the flag-off floor: the one pass that reads which profiles are
    // in play still happens, because it is what proves the rule can be skipped.
    expect(ms).toBeLessThan(0.5);
  });
});

/**
 * The DIRTY TICK past the reference map (PF5.4).
 *
 * The suite at the top of this file measures the tick on 500 elements, where
 * the only family that knew what had changed was `no-overlap`. PF5.4 gave the
 * other twelve the same knowledge, derived from the dependency scopes of
 * `docs/adr/0015` and from nothing else. These are the figures past the point
 * where a linear family stops being free.
 *
 * Three sizes, each map built OUTSIDE the timer. `wasIn` is the manager's
 * memory of where everything was ({@link frameMembership}); without it a rule
 * framing against a background cannot be narrowed at all, which is why the
 * 500-element suite above still reads a full pass for those rules.
 *
 * ## Where the tick's cost actually goes, measured
 *
 * Wardley's four rules straddle the seam this slice draws, and that is what
 * makes the pack worth measuring here: `orientation-against-axis` (`'element'`)
 * and W4 `relative-order-along-axis` (`'relations'`) are narrowed to the three
 * dragged labels; `no-overlap` and W2 `attachment` are `'surface'` and are
 * evaluated over the whole board on every tick, exactly as before.
 *
 * Best of two quiet runs on one developer machine, all four rules, profiles in
 * force, measured ON TOP of the sweep-and-prune of #227 — the pass a user
 * actually pays for:
 *
 * ```
 *              full pass   tick before (PF5.13)   tick now   without W2
 *  2000 el :     6.6 ms          4.1 ms            3.7 ms      3.1 ms
 *  4000 el :    16.7 ms          8.8 ms            8.0 ms      6.7 ms
 *  8000 el :    64.1 ms         28.1 ms           27.3 ms     22.9 ms
 * ```
 *
 * Three things this says, and the PR says all three:
 *
 * - **The tick is 1.6× to 2.2× cheaper than the full pass**, and a floor on
 *   that ratio is what is asserted below: it is a statement about the engine,
 *   where an absolute millisecond count on an unknown machine is not. It used
 *   to be 3.5× to 6.5×; #227 did not make the tick slower, it made the full
 *   pass three times faster, and the ratio is a fraction with a moving
 *   denominator.
 * - **PF5.4's own share of the tick is ~9 %, and ~3 % at 8000.** The rest was
 *   already `no-overlap`'s (PF5.13). That is the honest headline on THIS pack,
 *   and it is small for a reason worth reading before quoting it elsewhere:
 *   Wardley's two narrowable families are linear with a nearly empty body, and
 *   their index passes still walk the surface, so what the closure removes is
 *   the per-subject work after the filter and nothing before it. The slice pays
 *   off in proportion to what a family does PER SUBJECT. Wardley is therefore
 *   the pack it helps LEAST, and the one measured here only because this file
 *   is the one with a 16 ms harness. The figure worth taking next is a pack
 *   whose families tally, attribute and pair — BPMN's 22 rules, C4's 16.
 * - **W2 `attachment` costs about a sixth of the tick** (0.6 / 1.2 / 4.1 ms)
 *   and is paid in full because it is declared `'surface'`: its carriers are
 *   collected from the whole board, bounded by a tolerance and by no frame
 *   (`docs/adr/0015`). It does not dominate, so nothing about it is changed
 *   here; bounding that search to the subject's own frame would let the table
 *   entry narrow to `'frame'`, and that is a slice of its own.
 *
 * The wall is unchanged: at 8000 elements the tick is 27 ms and the frame
 * budget is 16. What moved is where a DRAG stops fitting, not where a board
 * stops opening.
 *
 * What is ASSERTED here is the equality of the two answers at every size, and a
 * floor on the ratio from 4000 elements up. The frame budget is logged and not
 * asserted, unlike everywhere else in this file, and so is the ratio at 2000 —
 * see the comment on the assertion below for the two measurements that decided
 * it.
 */
describe('the dirty tick, every family (PF5.4)', () => {
  const SIZES = [2000, 4000, 8000] as const;
  const tickKey = (violation: Violation) =>
    `${violation.ruleId}|${violation.elementIds.join('+')}`;

  it('has Wardley rules on both sides of the seam', () => {
    // Otherwise every figure below is about one half of the mechanism, and the
    // "W2 is paid in full" claim is unverifiable.
    const narrowed = WARDLEY_RULES.filter(rule => scopeOf(rule) !== 'surface');
    expect(narrowed.length).toBeGreaterThan(0);
    expect(narrowed.length).toBeLessThan(WARDLEY_RULES.length);
  });

  for (const size of SIZES) {
    // Built outside every timer, like the horizon suite above: the generator is
    // linear and the full pass quadratic, so a build left inside a closure
    // makes the tick look better than it is.
    const map = referenceMap(size, 'wardley.strict');
    const previous = evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES);
    const wasIn = frameMembership(WARDLEY_RULES, map);
    // The worst realistic drag, as in the 500-element suite: three labels, the
    // element the families have the most to say about.
    const dirty = new Set(
      map
        .filter(el => el.role === WARDLEY_ROLE.label)
        .slice(0, 3)
        .map(el => el.id)
    );
    const tick = () =>
      evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES, {
        dirty,
        previous,
        wasIn,
      });

    // The same tick without W2, to price the one family that is `'surface'` and
    // whose evaluator this slice deliberately leaves alone.
    const withoutW2 = WARDLEY_RULES.filter(
      rule => rule.family !== 'attachment'
    );
    const previousWithoutW2 = evaluateRules(withoutW2, map, WARDLEY_PROFILES);
    const tickWithoutW2 = () =>
      evaluateRules(withoutW2, map, WARDLEY_PROFILES, {
        dirty,
        previous: previousWithoutW2,
        wasIn,
      });

    it(`reaches exactly the same verdict as a full pass at ${size}`, () => {
      // The whole point, at every size: a way of NOT doing work, never a
      // different answer. The fuzz in `@labre/affine-all` proves this over every
      // shipped pack under random mutation; this one proves the same thing
      // where the boards are big enough for the closure to matter.
      expect(tick().map(tickKey).sort()).toEqual(previous.map(tickKey).sort());
    });

    it(
      `re-judges a drag on ${size} elements`,
      () => {
        // Interleaved, for the reason `pairedMedianMs` documents: the RATIO is
        // the claim about the engine, and measuring the two one after the other
        // would let a machine that got busy in between decide it.
        const [full, dirtyTick] = pairedMedianMs(
          () => evaluateRules(WARDLEY_RULES, map, WARDLEY_PROFILES),
          tick,
          7,
          3
        );
        const whole = sweepMs(tick, 9, 3);
        const withoutAttachment = sweepMs(tickWithoutW2, 9, 3);

        console.info(
          `[bench] PF5.4 dirty tick, ${size} elements, ${dirty.size} dragged: ` +
            `${whole.best.toFixed(2)} ms best, ${whole.median.toFixed(2)} ms ` +
            `median, against ${full.toFixed(2)} ms for the full pass it ` +
            `replaces (interleaved medians: ×${(full / dirtyTick).toFixed(1)}). ` +
            `Budget ${FRAME_BUDGET_MS} ms. Without W2 attachment — 'surface' ` +
            `scope, so Wardley pays it whole on every tick — the same tick is ` +
            `${withoutAttachment.best.toFixed(2)} ms best, i.e. W2 is ` +
            `${(whole.best - withoutAttachment.best).toFixed(2)} ms of it.`
        );

        // Everything above is LOGGED. Two things are not asserted here, and
        // both were measured rather than guessed.
        //
        // **The frame budget.** Alone, this tick reads 3.7 ms at 2000 and
        // 8.0 ms at 4000 against the 16 ms frame — 4.3× and 2.0× of room.
        // Inside the full `yarn test:unit` run, the same sweep's BEST sample
        // reads 17.8 ms and 34.0 ms: five times the isolated figure, which is
        // the inflation `sweepMs` documents and which the older budgets in this
        // file survive only because they measure a 1 ms evaluation. Asserting
        // it here would fail the suite on a statement about the scheduler, and
        // there is no CI job to give that statement a fixed machine.
        //
        // **The ratio at 2000 elements.** Interleaving cancels load only while
        // the gap is bigger than the noise, and at this size it is not: the two
        // `'surface'` families are most of BOTH sides, the quiet ratio is 1.6×,
        // and under the full parallel run the same pair read 1.20×. So the
        // ratio is asserted from 4000 up, where it measured 2.0× and 2.2×
        // quiet, and logged at 2000.
        if (size > SIZES[0]) {
          // Deliberately loose. What this guard is FOR is a tick that stopped
          // being a tick — a closure that narrows nothing, or a `previous` no
          // longer carried, both of which read ×1.0. It cannot be tightened
          // into a guard on this slice's own contribution, and pretending
          // otherwise makes it fail the day the full pass gets faster again:
          // that is exactly what #227 did to the 2× floor this started at.
          expect(dirtyTick * 1.25).toBeLessThan(full);
        }
      },
      BENCH_TIMEOUT_MS
    );
  }
});
