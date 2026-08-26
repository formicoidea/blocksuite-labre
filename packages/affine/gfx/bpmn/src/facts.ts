import {
  backgroundInstanceZones,
  backgroundPlot,
} from '@labre/affine-block-surface';
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
 * ## One convention, copied rather than reinvented
 *
 * Both read the element's CENTRE against ratios of the pool's PLOT, and take the
 * FIRST matching zone in declaration order — the convention `plotRatios` and
 * `zoneAt` already use inside the audit. Copied deliberately and stated here so
 * it stays copied: the day these two disagree with the audit, one component gets
 * two answers about which lane it is in, and no user can be told which is right.
 * The centre also has the property the geometry needs — a task wider than a lane
 * still belongs to exactly one of them.
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

/** The whole plot, as the ratios every zone rectangle is expressed in. */
const WHOLE_PLOT = { x: 0, y: 0, w: 1, h: 1 } as const;

/**
 * The pool whose plot contains the bound's centre, or `null`.
 *
 * ## Which attribution rule this is, and why it is not the audit's whole one
 *
 * The audit attributes in two halves (`attribute()` in `audit.ts`, and
 * `attributeBackground()` in `validation.ts`): the frame that CONTAINS the
 * element, failing that the NEAREST by edge-to-edge gap. This is the containment
 * half only, with the audit's own first-match-in-document-order tie-break —
 * which is the sanctioned reduction, and it is the right one here for two
 * reasons.
 *
 * - The nearest-fallback never returns `null` while a single pool exists on the
 *   board. That is correct for an audit, which has to say something about every
 *   role-carrying element it reports; it is wrong for a fact query, whose whole
 *   value is telling "in this pool" apart from "beside it". A task dropped on
 *   bare canvas is not in a pool, and saying so is the answer.
 * - Containment is tested on the CENTRE against the plot, not on the full
 *   element box against the element box, so this function and {@link bpmnLaneOf}
 *   are the same test at two scales. A laned pool therefore cannot answer "yes,
 *   this pool" and "no lane" for a lane set that covers the plot — the two are
 *   congruent by construction rather than by agreement.
 *
 * Ties — a centre inside two overlapping pools — go to the first pool in the
 * order given, which for a surface is document order. The audit's `attribute()`
 * returns on its first containing frame the same way.
 */
export function bpmnPoolOf(
  pools: readonly BpmnPoolElementModel[],
  bound: Bound
): BpmnPoolElementModel | null {
  for (const pool of pools) {
    const at = plotRatios(pool, bound);
    if (at !== null && within(at, WHOLE_PLOT)) return pool;
  }
  return null;
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
