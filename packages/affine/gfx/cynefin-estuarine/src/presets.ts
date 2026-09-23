import { ShapeStyle, TextFitMode } from '@labre/affine-model';

import { REF_H as CYN_H, REF_W as CYN_W } from './cynefin/consts';
import {
  HEX_FILL,
  HEX_SIZE,
  HEX_STROKE,
  HEX_VERTICES,
  REF_H as EST_H,
  REF_W as EST_W,
} from './estuarine/consts';
import { ESTUARINE_ROLE } from './estuarine/roles';

/**
 * What a Cynefin / Estuarine artefact IS, as props — the ONE description the
 * creation actions and the templates both read.
 *
 * Split out of `actions.ts` for the reason Wardley's and BPMN's `presets.ts`
 * give: the palette used to restate these props by hand and drifted the moment
 * the toolbox moved. The hexagon lost the `textFitMode` that #52 gave it, and
 * the estuarine background was drawn at scale 1 while the button drew it at
 * 1.2. Derived from one table, neither can happen again.
 */

/**
 * Estuarine map default scale: how many canvas units one reference unit of the
 * drawing is worth when the map is born. The DRAWING's size, in other words —
 * which is why it is this number, and not the birth box, that is the constant.
 */
export const MAP_SCALE = 1.2;

/**
 * The box an estuarine map is born in — the size the toolbox draws.
 *
 * Derived from the CROPPED reference box (`estuarine/consts.ts`), so the board
 * is born just big enough to hold its drawing plus a thin margin. It shrank
 * when the crop tightened (828 × 961.2 → 790.8 × 943.8) and the drawing inside
 * it did not change size by a single unit — `MAP_SCALE` is still 1.2.
 */
export const ESTUARINE_MAP_W = EST_W * MAP_SCALE;
export const ESTUARINE_MAP_H = EST_H * MAP_SCALE;

/** The box a Cynefin frame is born in. */
export const CYNEFIN_W = CYN_W;
export const CYNEFIN_H = CYN_H;

/**
 * The Cynefin frame, as props.
 *
 * NO role, deliberately and for good: the framework is out of the validation
 * perimeter (PO, 26/08/2026 — see `estuarine/roles.ts`). Stated here once so
 * the neutrality is a decision rather than an omission on either side.
 */
export function cynefinBackgroundProps(box: {
  xywh: string;
}): Record<string, unknown> & { type: string } {
  return { type: 'cynefin', xywh: box.xywh };
}

/**
 * The estuarine map, as props.
 *
 * The map is this framework's ROOT INSTANCE: the role is what makes the Map
 * quality checklist reachable on it (WS4).
 */
export function estuarineMapProps(box: {
  xywh: string;
}): Record<string, unknown> & { type: string } {
  return { type: 'estuarine', role: ESTUARINE_ROLE.map, xywh: box.xywh };
}

/**
 * A hexi constraint, as props.
 *
 * A hexagon is a plain polygon on the canvas: nothing about its geometry says
 * "constraint". The role is the only place that does. The fit mode is the other
 * half of the notation — a constraint behaves like a post-it, fixed hex, text
 * shrinks — and it is exactly what the palette had lost.
 */
export function estuarineHexagonProps(box: {
  xywh: string;
}): Record<string, unknown> & { type: string } {
  return {
    type: 'shape',
    role: ESTUARINE_ROLE.constraint,
    shapeType: 'polygon',
    // A fresh array of fresh pairs: this goes into a document, and two hexagons
    // sharing one literal would be two elements sharing one array.
    vertices: HEX_VERTICES.map(([x, y]) => [x, y]),
    filled: true,
    fillColor: HEX_FILL,
    strokeColor: HEX_STROKE,
    strokeWidth: 2,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    textFitMode: TextFitMode.Contained,
    xywh: box.xywh,
  };
}

/** The box a hexagon is born in, centred on a point. */
export function estuarineHexagonBox(cx: number, cy: number): string {
  return `[${cx - HEX_SIZE / 2},${cy - HEX_SIZE / 2},${HEX_SIZE},${HEX_SIZE}]`;
}
