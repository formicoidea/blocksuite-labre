import type { BackgroundRect } from '@labre/affine-block-surface';
import {
  backgroundInstanceZones,
  backgroundPlot,
} from '@labre/affine-block-surface';
import type { UmlPartitionOrientation } from '@labre/affine-model';

import {
  UML_DIAGRAM_FRAME,
  UML_FRAGMENT_FRAME,
  UML_REGION_FRAME,
  umlPartitionFrame,
} from './background.js';
import {
  UML_OPERAND_GRAB,
  UML_OPERAND_GUARD_HEIGHT,
  UML_OPERAND_GUARD_WIDTH,
} from './consts.js';

/**
 * Where the UML diagram frame's heading band is, in ELEMENT-LOCAL model units.
 *
 * Pure, and kept out of `element-view.ts` so the answer can be asserted without
 * an editor, a viewport or a canvas around it — the same split `board-hit.ts`
 * makes for the C4 board and `pool-hit.ts` for the BPMN pool.
 *
 * The rectangle is derived from `backgroundPlot`, the very function the renderer
 * lays the heading out from: nothing here restates a coordinate, so the strip a
 * user aims at cannot drift away from the strip the frame reserves.
 *
 * ponytail: a ROTATED frame is not accounted for — the caller converts by
 * subtraction (and, in `UmlFrameView`, by de-rotating about the centre first),
 * so every box here assumes an upright frame. Same reserve `board-hit.ts` and
 * `pool-hit.ts` both document.
 */

/** What this file needs of a frame: its box. */
export interface UmlDiagramGeometry {
  deserializedXYWH: readonly number[];
}

/**
 * The frame's heading band, or `null` when there is no room for one.
 *
 * The band IS the top margin, full width, clamped to a frame shorter than its
 * own heading — the degenerate case the model's own carve-out clamps too.
 */
export function umlDiagramBand(
  model: UmlDiagramGeometry
): BackgroundRect | null {
  const [, , w, h] = model.deserializedXYWH;
  if (!(w > 0) || !(h > 0)) return null;

  const plot = backgroundPlot(UML_DIAGRAM_FRAME, w, h);
  const height = Math.min(plot.y0, h);
  if (!(height > 0)) return null;

  return { x: 0, y: 0, w, h: height };
}

/**
 * Whether an element-local point is in the frame's heading band.
 *
 * The WHOLE band, not the tight box of the cut-corner tag. The strip is part of
 * the sheet — nothing is ever dropped there by convention, and the drawing goes
 * below it — so a click anywhere along it belongs to the frame, and this is the
 * same answer `UmlDiagramElementModel.includesPoint` gives: what is picked is
 * what is renamed.
 *
 * No zoom-grown target, unlike the BPMN pool's 28-unit strip: growing this one
 * would put the rename zone outside the band the MODEL lets a click select, and
 * the two agreeing is worth more than the pixels it would gain at 0.2 zoom.
 */
export function umlInDiagramBand(
  model: UmlDiagramGeometry,
  local: readonly [number, number]
): boolean {
  const band = umlDiagramBand(model);
  if (!band) return false;
  const [lx, ly] = local;
  return (
    lx >= band.x &&
    lx <= band.x + band.w &&
    ly >= band.y &&
    ly <= band.y + band.h
  );
}

/* ── The two behaviour frames ──────────────────────────────────────────── */

/**
 * What these functions need of a partition: its box and which way it runs.
 *
 * `orientation` is the MODEL's own union rather than a `string`, so a caller
 * cannot hand this a lane running some third way the renderer has no band for —
 * the structural type is what lets a unit test pass a plain object, and the
 * union is what keeps that object honest.
 */
export interface UmlPartitionGeometry {
  deserializedXYWH: readonly number[];
  orientation?: UmlPartitionOrientation;
}

/**
 * A partition's NAME BAND, or `null` when there is no room for one.
 *
 * The band is the deep margin — the top of a vertical lane, the left edge of a
 * horizontal one — read off whichever of the two declarations the element's
 * `orientation` selects, so the strip a user aims at is the strip the renderer
 * reserved. Clamped to a lane dragged smaller than its own header, the
 * degenerate case the model's carve-out clamps too.
 */
export function umlPartitionBand(
  model: UmlPartitionGeometry
): BackgroundRect | null {
  const [, , w, h] = model.deserializedXYWH;
  if (!(w > 0) || !(h > 0)) return null;

  const def = umlPartitionFrame(model);
  const plot = backgroundPlot(def, w, h);

  if (model.orientation === 'horizontal') {
    const width = Math.min(plot.x0, w);
    if (!(width > 0)) return null;
    return { x: 0, y: 0, w: width, h };
  }

  const height = Math.min(plot.y0, h);
  if (!(height > 0)) return null;
  return { x: 0, y: 0, w, h: height };
}

/**
 * The composite state's name band, or `null` when there is no room for one.
 *
 * Always the top margin: unlike a partition, a composite state has no
 * orientation to turn (§14.2.4 writes its name across the top and nowhere
 * else), so this is the diagram frame's own arithmetic against a second
 * declaration.
 */
export function umlRegionBand(
  model: UmlDiagramGeometry
): BackgroundRect | null {
  const [, , w, h] = model.deserializedXYWH;
  if (!(w > 0) || !(h > 0)) return null;

  const plot = backgroundPlot(UML_REGION_FRAME, w, h);
  const height = Math.min(plot.y0, h);
  if (!(height > 0)) return null;

  return { x: 0, y: 0, w, h: height };
}

/** Whether an element-local point is inside a {@link BackgroundRect}. */
function inRect(rect: BackgroundRect | null, local: readonly [number, number]) {
  if (!rect) return false;
  const [lx, ly] = local;
  return (
    lx >= rect.x &&
    lx <= rect.x + rect.w &&
    ly >= rect.y &&
    ly <= rect.y + rect.h
  );
}

/**
 * Whether an element-local point is in a partition's name band.
 *
 * The WHOLE band, exactly as {@link umlInDiagramBand} claims the whole heading
 * strip and for the same reason: the header is part of the LANE — nothing is
 * ever dropped there by convention, and the flow goes below or beside it — so a
 * click anywhere along it belongs to the partition, and this is the same answer
 * `UmlPartitionElementModel.includesPoint` gives. What is picked is what is
 * renamed.
 */
export function umlInPartitionBand(
  model: UmlPartitionGeometry,
  local: readonly [number, number]
): boolean {
  return inRect(umlPartitionBand(model), local);
}

/** The same question of a composite state's name band. */
export function umlInRegionBand(
  model: UmlDiagramGeometry,
  local: readonly [number, number]
): boolean {
  return inRect(umlRegionBand(model), local);
}

/* ── The combined fragment ─────────────────────────────────────────────── */

/** What these functions need of a fragment: its box and its operands. */
export interface UmlFragmentGeometry {
  deserializedXYWH: readonly number[];
  operands?: unknown;
}

/**
 * The fragment's OPERATOR BAND, or `null` when there is no room for one.
 *
 * The diagram frame's own arithmetic against a second declaration: the band is
 * the top margin, full width, clamped to a fragment dragged shorter than its
 * own tag — the degenerate case the model's carve-out clamps too.
 */
export function umlFragmentBand(
  model: UmlDiagramGeometry
): BackgroundRect | null {
  const [, , w, h] = model.deserializedXYWH;
  if (!(w > 0) || !(h > 0)) return null;

  const plot = backgroundPlot(UML_FRAGMENT_FRAME, w, h);
  const height = Math.min(plot.y0, h);
  if (!(height > 0)) return null;

  return { x: 0, y: 0, w, h: height };
}

/** Whether an element-local point is in the fragment's operator band. */
export function umlInFragmentBand(
  model: UmlDiagramGeometry,
  local: readonly [number, number]
): boolean {
  return inRect(umlFragmentBand(model), local);
}

/** One operand band of a fragment: where it starts, and how tall it is. */
export interface UmlOperandBand {
  top: number;
  height: number;
}

export interface UmlFragmentOperands {
  plot: ReturnType<typeof backgroundPlot>;
  bands: UmlOperandBand[];
}

/**
 * The operand bands of this fragment, or `null` when it carries no usable
 * partition — which is every `opt`, every `loop` and every `ref`.
 *
 * Derived from `backgroundInstanceZones`, the very function the renderer paints
 * the separators from and the audit reports the zones from, so a grab zone
 * cannot drift away from the line it is a grab zone for. The BPMN pool's
 * `bpmnPoolBands` with one thing missing: an operand has no title strip,
 * because §17.6.4 writes its guard in a corner rather than down a band.
 */
export function umlFragmentOperands(
  model: UmlFragmentGeometry
): UmlFragmentOperands | null {
  const [, , w, h] = model.deserializedXYWH;
  const plot = backgroundPlot(UML_FRAGMENT_FRAME, w, h);
  if (!(plot.width > 0) || !(plot.height > 0)) return null;

  const zones = backgroundInstanceZones(
    UML_FRAGMENT_FRAME,
    model as unknown as Readonly<Record<string, unknown>>
  );
  if (zones.length === 0) return null;

  return {
    plot,
    bands: zones.map(zone => ({
      top: plot.y0 + zone.rect.y * plot.height,
      height: zone.rect.h * plot.height,
    })),
  };
}

/**
 * The INTERNAL operand separator the point is on, as the index of the operand
 * BELOW it — so `i` separates operand `i - 1` from operand `i`. `null` for
 * anywhere else.
 *
 * Internal only, exactly as the pool's is: the outer edges belong to the plot,
 * and dragging one would be a resize of the fragment, which the handles do.
 */
export function umlOperandBoundaryAt(
  model: UmlFragmentGeometry,
  local: readonly [number, number]
): number | null {
  const geometry = umlFragmentOperands(model);
  if (!geometry) return null;
  const { plot, bands } = geometry;

  if (local[0] < plot.x0 || local[0] > plot.x1) return null;

  for (let i = 1; i < bands.length; i++) {
    if (Math.abs(local[1] - bands[i].top) <= UML_OPERAND_GRAB) return i;
  }
  return null;
}

/**
 * The operand whose GUARD CORNER the point is in, or `null`.
 *
 * A corner box and not a whole band, which is the opposite call the BPMN pool
 * makes about its lane names — and the notation is the difference. A lane's
 * name is a TITLE written down a strip that belongs to nothing else; an
 * operand's guard is a condition written over the messages it governs, and a
 * rename zone covering the whole operand would swallow every double-click meant
 * for the conversation inside it.
 *
 * The box is the guard's own line: as wide as {@link UML_OPERAND_GUARD_WIDTH}
 * from the plot's left edge, as tall as the line the declaration writes it on,
 * anchored at the same inset the renderer uses.
 */
export function umlOperandGuardAt(
  model: UmlFragmentGeometry,
  local: readonly [number, number]
): number | null {
  const geometry = umlFragmentOperands(model);
  if (!geometry) return null;
  const { plot, bands } = geometry;

  for (let i = 0; i < bands.length; i++) {
    const top = bands[i].top;
    const height = Math.min(UML_OPERAND_GUARD_HEIGHT, bands[i].height);
    if (
      local[0] >= plot.x0 &&
      local[0] <= plot.x0 + Math.min(UML_OPERAND_GUARD_WIDTH, plot.width) &&
      local[1] >= top &&
      local[1] <= top + height
    ) {
      return i;
    }
  }
  return null;
}
