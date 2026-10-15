import {
  backgroundInstanceZones,
  backgroundPlot,
  containingFrame,
} from '@labre/affine-block-surface/interchange';
import type { BpmnLane, BpmnPoolElementModel } from '@labre/affine-model';
import type { Bound } from '@labre/global/gfx';

import { BPMN_POOL_BACKGROUND } from './background.js';

/**
 * Where a BPMN artefact SITS — the facts, answerable without a `BlockStdScope`.
 *
 * The audit already computes exactly this (`collectAuditFacts`), and computes it
 * better: it attributes across every framework at once and reports the answer as
 * a serializable fact. What it will not do is answer a question — it runs only
 * for frames matched by a REGISTERED validation rule, and BPMN registers none
 * until the rules session lands. A host, a template check or a rule being
 * written today therefore has nowhere to ask "which lane is this task in", and
 * has been doing the arithmetic by hand at every call site.
 *
 * These two functions are that arithmetic, once. Pure by construction — models
 * and a `Bound` in, model data out; no DI, no std, no signal — so a rule can
 * call them, a test can call them with a stub, and the answer cannot depend on
 * which extensions happen to be registered.
 *
 * ## Two conventions, and the asymmetry between them is the point (PF2.4)
 *
 * {@link bpmnPoolOf} asks about MEMBERSHIP and answers with WHOLE containment in
 * the pool's element bound — the shared `containingFrame`, the same test the
 * validation engine and the audit use, so one artefact never gets two answers
 * about which participant it is on.
 *
 * {@link bpmnLaneOf} asks about POSITION inside a pool it is already in, and
 * keeps the CENTRE against ratios of the PLOT, first matching zone in
 * declaration order — the convention `plotRatios` and `zoneAt` use in the audit.
 * A lane is a band drawn across a pool, and a task taller than a band still has
 * to be in exactly one of them.
 *
 * So a task must be WHOLLY inside a pool, but may straddle two lanes. That is
 * deliberate: a board is a container, a band is a reading.
 */

/**
 * `lane` — the namespace the pool's instance zones report under.
 *
 * Read off the declaration rather than spelled again: `backgroundInstanceZones`
 * builds `lane:<id>` from this very field, and a second copy of the string is a
 * second thing to keep in step.
 */
const LANE_PREFIX = BPMN_POOL_BACKGROUND.instanceZones?.idPrefix ?? 'lane';

/**
 * A bound's centre, as ratios of `pool`'s plot. `null` for a degenerate plot —
 * a pool dragged narrower than its own name band has no flow area to be inside.
 *
 * Ratios of the PLOT and not of the element box, for the reason the audit gives:
 * the margin between the two is where the name band lives, and a task laid over
 * the band is not in the flow area at all.
 */
function plotRatios(
  pool: BpmnPoolElementModel,
  bound: Bound
): readonly [number, number] | null {
  const frame = pool.elementBound;
  const plot = backgroundPlot(BPMN_POOL_BACKGROUND, frame.w, frame.h);
  if (!(plot.width > 0) || !(plot.height > 0)) return null;
  return [
    (bound.x + bound.w / 2 - frame.x - plot.x0) / plot.width,
    (bound.y + bound.h / 2 - frame.y - plot.y0) / plot.height,
  ];
}

/** Inclusive containment of a plot-ratio point, exactly as `zoneAt` tests it. */
function within(
  at: readonly [number, number],
  rect: { x: number; y: number; w: number; h: number }
): boolean {
  return (
    at[0] >= rect.x &&
    at[0] <= rect.x + rect.w &&
    at[1] >= rect.y &&
    at[1] <= rect.y + rect.h
  );
}

/**
 * The pool an artefact belongs to: the one that WHOLLY CONTAINS its bound
 * (PF2.4), or `null`.
 *
 * The pool's ELEMENT bound and not its plot: membership is one question with one
 * answer across the product, and `containingFrame` is where it is answered — the
 * same function `containingBackground` uses inside the validation engine, so a
 * task the engine indicts for hanging off a pool is not reported as being in it.
 * The name band therefore counts as part of the pool for MEMBERSHIP; it is only
 * the lane arithmetic below that still subtracts it.
 *
 * No nearest-pool fallback, unlike the audit's frame attribution: a task dropped
 * beside a pool is not in it, and inventing one here would put a rule's finding
 * on a participant the author never drew it on.
 */
export function bpmnPoolOf(
  pools: readonly BpmnPoolElementModel[],
  bound: Bound
): BpmnPoolElementModel | null {
  return containingFrame(bound, pools, pool => pool.elementBound);
}

/**
 * The lane of `pool` the bound's centre falls in — `null` when the pool carries
 * no lane, when the centre is outside its plot, or when the partition is
 * malformed enough that `backgroundInstanceZones` dropped the band it would have
 * been in.
 *
 * The lanes come from the declaration, never from `pool.lanes` read directly:
 * `backgroundInstanceZones` is what normalises the weights into rectangles,
 * drops the rows a user's typo made unusable and redistributes their space, and
 * a second reading of the raw prop would place a task in a band the pool does
 * not paint. The `BpmnLane` handed back is the model's own row, matched by id,
 * so a caller gets the thing it can rename or resize.
 *
 * The CENTRE, deliberately unlike {@link bpmnPoolOf}: a task must be wholly in a
 * pool, but may straddle two lanes and is then read in the one its centre is in.
 * See the module comment — a board is a container, a band is a reading.
 *
 * First match in declaration order, so a centre landing exactly ON a divider
 * belongs to the band ABOVE it. Arbitrary in isolation and deliberate together:
 * it is the tie `zoneAt` breaks, and the two must break it the same way.
 */
export function bpmnLaneOf(
  pool: BpmnPoolElementModel,
  bound: Bound
): BpmnLane | null {
  const at = plotRatios(pool, bound);
  if (at === null) return null;

  const zones = backgroundInstanceZones(
    BPMN_POOL_BACKGROUND,
    pool as unknown as Readonly<Record<string, unknown>>
  );
  for (const zone of zones) {
    if (!within(at, zone.rect)) continue;
    return (
      pool.lanes?.find(lane => zone.id === `${LANE_PREFIX}:${lane.id}`) ?? null
    );
  }
  return null;
}
