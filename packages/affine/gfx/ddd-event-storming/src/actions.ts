import { backgroundSize, DefaultTool } from '@labre/affine-block-surface';
import { ConnectorTool } from '@labre/affine-gfx-connector';
import { LABEL_COLOR } from '@labre/affine-gfx-ddd-shared';
import { ConnectorMode, PointStyle, StrokeStyle } from '@labre/affine-model';
import { EditPropsStore } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { GfxController } from '@labre/std/gfx';

import { EVENT_STORMING_BACKGROUND } from './background';
import { ES_ROLE } from './roles';

/**
 * Creation / activation actions for the Event Storming toolbox — the BEHAVIOUR
 * layer, depending on nothing but the {@link GfxController}.
 *
 * They emit no telemetry: since PF3 the single emission point is the command
 * registry's `runCommand` (`docs/adr/0008`).
 */

const FLOW_STROKE_WIDTH = 2;

/** Create the board at the viewport centre, select it, return to the default tool. */
export function createEventStormingBoard(gfx: GfxController): void {
  if (!gfx.surface) return;
  const { width, height } = backgroundSize(EVENT_STORMING_BACKGROUND);
  const { centerX, centerY } = gfx.viewport;
  const id = gfx.surface.addElement({
    type: EVENT_STORMING_BACKGROUND.type,
    // The board is a first-class role: rules frame stickies against `es:board`,
    // never against the `eventStorming` element type. The declaration owns it,
    // so a templated board and a hand-drawn one agree.
    role: EVENT_STORMING_BACKGROUND.role,
    resizeEnabled: EVENT_STORMING_BACKGROUND.geometry.resizable,
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
 * Activate the native connector tool, pre-styled and TYPED as a flow. The user
 * then drags from what happens first to what follows, and the endpoints attach.
 *
 * ## Why this replaces the old palette entry
 *
 * Until WS5 the Flow entry dropped a 220-unit arrow at the viewport centre: a
 * line between two points in mid-air, attached to nothing. It looked like the
 * notation and said nothing — no rule could read its ends, and the user still
 * had to drag both endpoints onto the stickies by hand.
 *
 * The gesture now IS the statement (`docs/adr/0010`): the tool announces which
 * way to drag (the role's `gestureHint` — "drag from what happens first to what
 * follows"), the drawn connector carries `es:flow`, and its endpoints are real
 * element references. That is what makes both `es.against-timeline` and
 * `es.forbidden-arc` possible at all.
 *
 * ## What the style says, and what the role says
 *
 * Style is presentation: a plain straight line with a rear arrowhead, which is
 * exactly what the old drawing looked like, so a board mixing arcs drawn before
 * and after WS5 still reads as one board. Meaning is the role, and only the
 * role: restyling an arc never changes what it means, and an arc drawn before
 * WS5 keeps its look and stays neutral.
 */
export function activateEventStormingFlow(gfx: GfxController): void {
  gfx.std.get(EditPropsStore).recordLastProps('connector', {
    mode: ConnectorMode.Straight,
    stroke: LABEL_COLOR,
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: FLOW_STROKE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    // The arrow points at what FOLLOWS, which is the target: the role's verb is
    // "leads to", so the source is what happens first.
    rearEndpointStyle: PointStyle.Arrow,
  });
  gfx.tool.setTool(ConnectorTool, {
    mode: ConnectorMode.Straight,
    role: ES_ROLE.flow,
  });
  // The Event Storming palette stays open (native sub-menu behaviour): it only
  // closes on re-click of the senior button, another senior tool, or Escape.
}
