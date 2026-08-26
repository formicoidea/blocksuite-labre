import { backgroundSize, DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { LABEL_COLOR } from '@labre/affine-gfx-ddd-shared';
import {
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model';
import { EditPropsStore } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { GfxController } from '@labre/std/gfx';

import { CONTEXT_MAP_BACKGROUND } from './background';
import { CM_PATTERN_ROLE, type ContextMapPatternKind } from './roles';

/**
 * Creation / activation actions for the Context Map toolbox — the BEHAVIOUR
 * layer, depending on nothing but the {@link GfxController}.
 *
 * They emit no telemetry: since PF3 the single emission point is the command
 * registry's `runCommand` (`docs/adr/0008`).
 */

const RELATIONSHIP_STROKE_WIDTH = 2;

/** Create the board at the viewport centre, select it, return to the default tool. */
export function createContextMapBoard(gfx: GfxController): void {
  if (!gfx.surface) return;
  const { width, height } = backgroundSize(CONTEXT_MAP_BACKGROUND);
  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: CONTEXT_MAP_BACKGROUND.type,
    // The board is a first-class role: rules frame contexts against
    // `context-map:board`, never against the `contextMap` element type. The
    // declaration owns it, so a templated board and a hand-drawn one agree.
    role: CONTEXT_MAP_BACKGROUND.role,
    resizeEnabled: CONTEXT_MAP_BACKGROUND.geometry.resizable,
    xywh: new Bound(
      centerX - width / 2,
      centerY - height / 2,
      width,
      height
    ).serialize(),
  });
  gfx.doc.captureSync();
  gfx.tool.setTool(DefaultTool);
  gfx.selection.set({ elements: [id], editing: false });
}

/**
 * Activate the native connector tool, pre-styled and TYPED for one Context Map
 * pattern. The user then drags from one bounded context to another and the
 * endpoints attach.
 *
 * ## Why this replaces the old palette entry
 *
 * Until WS2 each pattern entry dropped a free-floating GROUP at the viewport
 * centre: a connector between two points in mid-air, an abbreviation tag and,
 * for the U/D patterns, two letters. It looked like the notation and said
 * nothing — the link was attached to nothing, so no rule could read its ends,
 * and the user still had to drag both endpoints onto the contexts by hand.
 *
 * The gesture now IS the statement (`docs/adr/0010`): the tool announces which
 * way to drag (the role's `gestureHint`), the drawn connector carries the
 * pattern's role, and the endpoints are real element references — which is what
 * makes the whole of `rules.ts` possible.
 *
 * ## What the style says, and what the role says
 *
 * Style is presentation: `dashed` for the two "no real integration" patterns
 * (Separate Ways, Big Ball of Mud), a rear arrowhead for the five U/D ones so
 * the sheet still reads at a glance. Meaning is the role, and only the role: a
 * user restyling a link never changes what it means, and a link drawn before
 * WS2 keeps its old look and stays neutral.
 *
 * The abbreviation TAG is not drawn any more. A label riding on the connector is
 * `ConnectorToolOptions.label`, which was cut from v1 — the pattern reads from
 * the hover reveal (M2) and the toolbar until it lands.
 */
export function activateContextMapRelationship(
  gfx: GfxController,
  kind: ContextMapPatternKind,
  style: { upDown: boolean; dashed: boolean }
): void {
  gfx.std.get(EditPropsStore).recordLastProps('connector', {
    mode: ConnectorMode.Straight,
    stroke: LABEL_COLOR,
    strokeStyle: style.dashed ? StrokeStyle.Dash : StrokeStyle.Solid,
    strokeWidth: RELATIONSHIP_STROKE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    // The arrow points at the DOWNSTREAM end, which is the target: the role's
    // verb is "is upstream of", so the source is the upstream context.
    rearEndpointStyle: style.upDown ? PointStyle.Arrow : PointStyle.None,
  });
  gfx.tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    role: CM_PATTERN_ROLE[kind],
  });
  // The Context Map palette stays open (native sub-menu behaviour): it only
  // closes on re-click of the senior button, another senior tool, or Escape.
}
