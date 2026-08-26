import {
  type BackgroundRect,
  backgroundInstanceZoneBand,
  backgroundInstanceZones,
  backgroundPlot,
} from '@labre/affine-block-surface';

import { BPMN_POOL_BACKGROUND } from './background.js';
import { POOL_LANE_GRAB } from './consts.js';

/**
 * Where a pointer is on a pool, in ELEMENT-LOCAL model units.
 *
 * Pure, and lifted out of `element-view.ts` so the answers can be asserted
 * without an editor, a viewport or a canvas around them. The view converts the
 * pointer and hands it here; everything about WHICH gesture a point means is
 * decided in this file.
 *
 * Every box is derived from `backgroundInstanceZones` /
 * `backgroundInstanceZoneBand` — the same two functions the renderer paints
 * from and the audit reports from. Nothing here restates a coordinate, so a
 * target cannot drift away from the thing it is a target for.
 *
 * ponytail: a ROTATED pool is not accounted for — the caller converts by
 * subtraction, so every box assumes an upright pool. Same reserve
 * `backgroundAxisFacts` documents, for the same reason: nothing rotates a
 * framework background today. Upgrade: rotate the local point by
 * `-model.rotate` about the element centre, in the caller that has the element.
 */

/** What these functions need of a pool: its box and its lanes. */
export interface BpmnPoolGeometry {
  deserializedXYWH: readonly number[];
  lanes?: unknown;
}

/** A lane band and, when the declaration asks for one, its title strip. */
export interface BpmnLaneBand {
  top: number;
  height: number;
  strip: BackgroundRect | null;
}

export interface BpmnPoolBands {
  plot: ReturnType<typeof backgroundPlot>;
  bands: BpmnLaneBand[];
}

/** The lane bands of this pool, or `null` when it has no usable partition. */
export function bpmnPoolBands(model: BpmnPoolGeometry): BpmnPoolBands | null {
  const [, , w, h] = model.deserializedXYWH;
  const plot = backgroundPlot(BPMN_POOL_BACKGROUND, w, h);
  if (!(plot.width > 0) || !(plot.height > 0)) return null;

  const zones = backgroundInstanceZones(
    BPMN_POOL_BACKGROUND,
    model as unknown as Readonly<Record<string, unknown>>
  );
  if (zones.length === 0) return null;

  return {
    plot,
    bands: zones.map(zone => ({
      top: plot.y0 + zone.rect.y * plot.height,
      height: zone.rect.h * plot.height,
      strip: backgroundInstanceZoneBand(BPMN_POOL_BACKGROUND, zone, plot),
    })),
  };
}

/**
 * A hit box's width, grown to stay reachable when the board is zoomed out.
 *
 * 44 view pixels is the touch-target floor, converted to model units so the box
 * is at least a fingertip wide however far out the pool is drawn; the painted
 * width wins once the pool is large enough on screen for it to. The growth is
 * CAPPED, because a target that swallows the thing it sits next to is its own
 * kind of broken — at 0.2 zoom an uncapped floor would make a lane's title band
 * wider than the flow area it titles.
 */
export function bpmnReachable(
  painted: number,
  cap: number,
  zoom: number
): number {
  return Math.max(painted, Math.min(44 / (zoom || 1), cap));
}

/**
 * The INTERNAL lane boundary the point is on, as the index of the lane BELOW
 * it — so `i` separates lane `i - 1` from lane `i`. `null` for anywhere else.
 *
 * Internal only: the outer edges belong to the plot, and dragging one would be
 * a resize of the pool, which the handles already do.
 */
export function bpmnLaneBoundaryAt(
  model: BpmnPoolGeometry,
  local: readonly [number, number]
): number | null {
  const geometry = bpmnPoolBands(model);
  if (!geometry) return null;
  const { plot, bands } = geometry;

  // The strip on the left is the participant's name, not the flow area: a
  // separator does not run through it, so neither does its grab zone.
  if (local[0] < plot.x0 || local[0] > plot.x1) return null;

  for (let i = 1; i < bands.length; i++) {
    if (Math.abs(local[1] - bands[i].top) <= POOL_LANE_GRAB) return i;
  }
  return null;
}

/**
 * The lane whose TITLE BAND the point is in, or `null`.
 *
 * The band, not a corner box (PO recette, 2026-08-26): a lane name is written
 * down a strip at the lane's leading edge, so that strip is what you aim at to
 * change it. Its whole height is live — the name is centred in it, and a band
 * you may only click the top of would be a target that lies about where it is.
 */
export function bpmnLaneTitleBandAt(
  model: BpmnPoolGeometry,
  local: readonly [number, number],
  zoom: number
): number | null {
  const geometry = bpmnPoolBands(model);
  if (!geometry) return null;
  const { plot, bands } = geometry;

  for (let i = 0; i < bands.length; i++) {
    const strip = bands[i].strip;
    if (!strip) continue;
    // Grown across the strip only; along it, a lane is already as tall as it
    // is. Capped at half the plot so the target never covers the flow area.
    const width = bpmnReachable(strip.w, plot.width / 2, zoom);
    if (
      local[0] >= strip.x &&
      local[0] <= strip.x + width &&
      local[1] >= strip.y &&
      local[1] <= strip.y + strip.h
    ) {
      return i;
    }
  }
  return null;
}

/**
 * Whether the point is in the POOL's own title band — the left margin strip the
 * participant name is written up.
 *
 * The whole pool used to open the participant editor. That was right while a
 * pool held one name; with a name per lane it would mean a double-click in the
 * middle of the flow area renames the participant, which is neither of the two
 * things a user double-clicking there could have meant.
 */
export function bpmnInPoolTitleBand(
  model: BpmnPoolGeometry,
  local: readonly [number, number],
  zoom: number
): boolean {
  const [, , w, h] = model.deserializedXYWH;
  const plot = backgroundPlot(BPMN_POOL_BACKGROUND, w, h);
  // The band IS the margin, clamped to a pool narrower than its own margin —
  // the same degenerate case the renderer clamps.
  const painted = Math.min(plot.x0, w);
  if (!(painted > 0)) return false;
  // Grown rightwards, capped at twice the margin: past that lies the lane
  // strip, which has its own claim on those units — see `bpmnPoolTargetAt`.
  const width = bpmnReachable(painted, painted * 2, zoom);
  return local[0] >= 0 && local[0] <= width && local[1] >= 0 && local[1] <= h;
}

/** What a double-click at this point would rename. */
export type BpmnPoolTarget =
  | { kind: 'lane'; index: number }
  | { kind: 'participant' };

/**
 * THE arbiter: which name, if any, a point on a pool is aiming at.
 *
 * The two title bands are adjacent, and both grow when the board is zoomed out
 * (`bpmnReachable`), so on a small pool they OVERLAP — at zoom 1 a 560-unit
 * pool already has a 28-unit participant band grown to 44, which reaches into
 * the lane strip beside it. Something has to arbitrate, and it is this
 * function rather than the view, so the answer can be asserted without an
 * editor and so there is exactly one of it.
 *
 * The LANE wins the overlap. The strip is painted with the lane's name written
 * down it, so it is the name a user is looking at when they aim there; handing
 * their double-click to the participant instead would rename the one thing they
 * demonstrably were not pointing at.
 */
export function bpmnPoolTargetAt(
  model: BpmnPoolGeometry,
  local: readonly [number, number],
  zoom: number
): BpmnPoolTarget | null {
  const index = bpmnLaneTitleBandAt(model, local, zoom);
  if (index !== null) return { kind: 'lane', index };
  if (bpmnInPoolTitleBand(model, local, zoom)) return { kind: 'participant' };
  return null;
}
