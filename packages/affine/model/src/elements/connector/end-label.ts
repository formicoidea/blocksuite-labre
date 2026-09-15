import type { IVec, XYWH } from '@labre/global/gfx';
import { Vec } from '@labre/global/gfx';

/**
 * Which of a connector's two ends a label belongs to.
 *
 * `source` and `target` are the names the connector already uses for its two
 * `Connection`s, so an end label's identity is the identity of the endpoint it
 * follows — never a left/right or a first/last, which flip when the author
 * reverses the edge.
 */
export type ConnectorLabelEnd = 'source' | 'target';

/**
 * How far along the path, from its endpoint, an end label is anchored by
 * default — in model units, i.e. board units at zoom 1.
 *
 * Far enough to clear the endpoint head (a `DEFAULT_ARROW_SIZE` head on a
 * 4-unit stroke is about 10 units long), close enough that the reader attaches
 * the text to that end rather than to the middle of the line.
 */
export const DEFAULT_CONNECTOR_END_LABEL_DISTANCE = 12;

/**
 * How close to an endpoint a gesture has to land to mean "that end" — in model
 * units, so it is a constant on the board and not on the screen (zooming out
 * does not widen the target).
 *
 * `docs/adr/0018` phase 2. Deliberately generous, and for a reason a hairline
 * makes plain: the end label a user is reaching for is usually not there yet, so
 * there is no box to aim at, and the thing they aim at instead is the ARROWHEAD.
 *
 * It lives here, beside the box the same clause places, because it is one fact
 * about the same notation and because BOTH the hit test that delivers the
 * gesture ({@link connectorEndNear}) and the picker that decides what it meant
 * (`pickConnectorLabelWhich`, in the gfx pack) have to agree about it. They did
 * not until the PO's recette of 14/09/2026: the picker was generous and the hit
 * test was the line itself, so past about five units off the stroke the
 * double-click reached nobody and the editor's own "add text here" answered it
 * instead.
 */
export const CONNECTOR_END_LABEL_GRAB = 24;

/**
 * Which END of a path a point is reaching for, or `null` for none.
 *
 * The nearer end wins a tie-free comparison; a point within reach of both ends
 * of a very short connector gets the nearer one, which is the same rule
 * `pickConnectorLabelWhich` applies and the only one that stays stable as the
 * author drags the line.
 *
 * Pure, and exported, because it is the whole of a gesture's reach and a spec
 * should be able to ask it without driving a pointer.
 */
export function connectorEndNear(
  path: readonly IVec[],
  point: IVec,
  grab: number = CONNECTOR_END_LABEL_GRAB
): ConnectorLabelEnd | null {
  if (!path.length) return null;

  const first = path[0];
  const last = path[path.length - 1];
  const toSource = Vec.dist(point, [first[0], first[1]]);
  const toTarget = Vec.dist(point, [last[0], last[1]]);

  if (Math.min(toSource, toTarget) > grab) return null;
  return toSource <= toTarget ? 'source' : 'target';
}

/**
 * The default box for a connector end label — where it sits when nothing has
 * placed it yet.
 *
 * Pure geometry, deliberately: the editor seeding a new end label
 * (`mountConnectorLabelEditor`), the canvas renderer painting one that has no
 * stored box, and the path generator re-anchoring one after a re-route all
 * need the SAME answer, and none of them should have to reimplement it. No DOM,
 * no model, no measurement — the caller brings the text's measured size.
 *
 * The box is anchored `distance` units along the path from that end's endpoint
 * and pushed off the line by half its own height, so it sits BESIDE the stroke
 * instead of on it. The push uses the path's tangent taken in the **source →
 * target** orientation for both ends, which is what keeps the two labels on the
 * same side of the line: a `0..*` above one end and a `1` below the other reads
 * as two unrelated notes.
 *
 * @param path the connector's path in the coordinate space the returned box
 *   belongs to — `absolutePath` for a persisted `labelXYWH`-style box. Accepts
 *   `PointLocation[]`; only the coordinates are read, never the tangents.
 * @param end which endpoint the label belongs to.
 * @param size the label's measured size.
 * @param distance how far along the path to anchor it. A path shorter than
 *   `distance` anchors the box at its FAR endpoint rather than off the line —
 *   a two-unit-long connector puts both labels in the same place, which is
 *   honest about there being no room, and is the only way the box stays on the
 *   stroke it annotates.
 */
export function connectorEndLabelBox(
  path: readonly IVec[],
  end: ConnectorLabelEnd,
  size: { w: number; h: number },
  distance: number = DEFAULT_CONNECTOR_END_LABEL_DISTANCE
): XYWH {
  const { w, h } = size;
  const forward = end === 'source';
  const count = path.length;

  if (count === 0) {
    return [-w / 2, -h / 2, w, h];
  }

  const endpoint = path[forward ? 0 : count - 1];
  let anchor: IVec = [endpoint[0], endpoint[1]];
  // A degenerate path (one point, or every point coincident) has no direction
  // to be beside; `[1, 0]` puts the label above the anchor, the same place a
  // left-to-right connector would.
  let tangent: IVec = [1, 0];
  let remaining = Math.max(0, distance);

  for (let step = 0; step < count - 1; step++) {
    const from = path[forward ? step : count - 1 - step];
    const to = path[forward ? step + 1 : count - 2 - step];
    const segment = Vec.dist(from, to);

    if (segment > 0) {
      // Always source → target, whichever end we walk from.
      tangent = Vec.uni(
        forward
          ? [to[0] - from[0], to[1] - from[1]]
          : [from[0] - to[0], from[1] - to[1]]
      );
    }

    if (segment >= remaining) {
      const t = segment === 0 ? 0 : remaining / segment;
      anchor = [
        from[0] + (to[0] - from[0]) * t,
        from[1] + (to[1] - from[1]) * t,
      ];
      remaining = 0;
      break;
    }

    remaining -= segment;
    anchor = [to[0], to[1]];
  }

  const center = Vec.add(anchor, Vec.mul(Vec.per(tangent), h / 2));

  return [center[0] - w / 2, center[1] - h / 2, w, h];
}
