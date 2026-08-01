import { DefaultTool } from '@labre/affine-block-surface';
import { ShapeStyle, TextFitMode } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';

import { REF_H as CYN_H, REF_W as CYN_W } from './cynefin/consts';
import {
  HEX_FILL,
  HEX_SIZE,
  HEX_STROKE,
  HEX_VERTICES,
  REF_H as EST_H,
  REF_W as EST_W,
} from './estuarine/consts';

/**
 * Creation actions for the Cynefin / Estuarine toolbox — lifted out of
 * `toolbar/menu.ts` by PF3. This is also the framework that emitted NO
 * telemetry at all before the switchover: routing every surface through
 * `runCommand` fixes that for free (`docs/adr/0008`).
 */

/** Estuarine map default size (REF aspect, scaled up so it reads on canvas). */
const MAP_SCALE = 1.2;

const gfxOf = (std: BlockStdScope) => std.get(GfxControllerIdentifier);

function finish(gfx: GfxController, id: string) {
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
}

export function createCynefin(std: BlockStdScope) {
  const gfx = gfxOf(std);
  if (!gfx.surface) return;
  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: 'cynefin',
    xywh: new Bound(
      centerX - CYN_W / 2,
      centerY - CYN_H / 2,
      CYN_W,
      CYN_H
    ).serialize(),
  });
  finish(gfx, id);
}

export function createEstuarineMap(std: BlockStdScope) {
  const gfx = gfxOf(std);
  if (!gfx.surface) return;
  const width = EST_W * MAP_SCALE;
  const height = EST_H * MAP_SCALE;
  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: 'estuarine',
    xywh: new Bound(
      centerX - width / 2,
      centerY - height / 2,
      width,
      height
    ).serialize(),
  });
  finish(gfx, id);
}

export function createConstraintHexagon(std: BlockStdScope) {
  const gfx = gfxOf(std);
  if (!gfx.surface) return;
  const { centerX: cx, centerY: cy } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: 'shape',
    shapeType: 'polygon',
    vertices: HEX_VERTICES,
    filled: true,
    fillColor: HEX_FILL,
    strokeColor: HEX_STROKE,
    strokeWidth: 2,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    // hexi constraints behave like post-its: fixed hex, text shrinks
    textFitMode: TextFitMode.Contained,
    xywh: new Bound(
      cx - HEX_SIZE / 2,
      cy - HEX_SIZE / 2,
      HEX_SIZE,
      HEX_SIZE
    ).serialize(),
  });
  finish(gfx, id);
}
