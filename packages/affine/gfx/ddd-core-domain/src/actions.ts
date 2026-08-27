import { backgroundSize } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { MOVEMENT_COLOR } from '@labre/affine-gfx-ddd-shared';
import { ConnectorMode, PointStyle, StrokeStyle } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import { type GfxController, GfxControllerIdentifier } from '@labre/std/gfx';

import { CORE_DOMAIN_BACKGROUND } from './core-domain/background';
import { CORE_DOMAIN_ROLE } from './roles';

type Surface = NonNullable<GfxController['surface']>;

/** The stroke width the movement arrow has always been drawn at. */
const MOVEMENT_STROKE_WIDTH = 2;

/**
 * Post a Core Domain Chart background, centred on `(cx, cy)`.
 *
 * The size, the role and whether the handles are offered all come from the
 * DECLARATION (`createWardleyBackground` is the pattern): the chart is a
 * first-class role, so validation rules position artefacts against
 * `core-domain:chart` and never against the `coreDomain` element type, and a
 * chart posted from the sub-menu agrees with one posted from a template.
 */
export function createCoreDomainChart(
  surface: Surface,
  cx: number,
  cy: number
): string {
  const { width, height } = backgroundSize(CORE_DOMAIN_BACKGROUND);
  return surface.addElement({
    type: CORE_DOMAIN_BACKGROUND.type,
    role: CORE_DOMAIN_BACKGROUND.role,
    resizeEnabled: CORE_DOMAIN_BACKGROUND.geometry.resizable,
    xywh: new Bound(cx - width / 2, cy - height / 2, width, height).serialize(),
  });
}

/**
 * Activate the native connector tool, pre-styled for a movement over time
 * (dashed, red, arrow at the far end) and TYPED with `core-domain:movement`.
 *
 * The gesture replaces the free arrow the sub-menu used to drop on the canvas,
 * and the reason is `docs/adr/0010`: a movement is a sentence — "this context
 * is moving to that position" — and its `source → target` pair only becomes a
 * STATEMENT once the user drew it end to end, from the current position to the
 * future one (the role's own gesture hint). `core-domain.malformed-movement`
 * reads exactly that pair back.
 *
 * Arrows drawn before this change carry no role and stay neutral: they are
 * drawings, and no rule will ever speak about them.
 */
export function activateMovement(std: BlockStdScope): void {
  const gfx = std.get(GfxControllerIdentifier);
  gfx.tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    role: CORE_DOMAIN_ROLE.movement,
    // The look rides on the activation, never through the last-props store:
    // the plain connector tool must keep the user's own style (#144 M1).
    style: {
      stroke: MOVEMENT_COLOR,
      strokeStyle: StrokeStyle.Dash,
      strokeWidth: MOVEMENT_STROKE_WIDTH,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.Arrow,
    },
  });
}
