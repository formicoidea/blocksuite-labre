import type { ConnectorElementModel } from '@labre/affine-model';
import type { IVec } from '@labre/global/gfx';
import type { EdgeDirectionDef, RoleDefs } from '@labre/std/gfx';
import { InteractivityExtension } from '@labre/std/gfx';
import { effect, signal } from '@preact/signals-core';

import {
  asTypedEdge,
  edgeIsBound,
  roleVocabularies,
  type TypedEdge,
} from './typed-edge.js';

/**
 * **M2 of `docs/adr/0010` — "show it".**
 *
 * A typed edge reveals its orientation on hover and on selection: ONE mark, the
 * role's verb laid ALONG the link — `depends on` — in a box whose far end is a
 * point aimed at the target. At rest the board keeps the canonical arrowless
 * look, because on a Wardley map a permanent head already means something else
 * (evolution movement), and two meanings on one glyph make both unreadable.
 *
 * ## The chevron is gone (PO acceptance of 02/08/2026, point 5)
 *
 * The first cut of M2 drew two marks: a canvas chevron at the target end, and
 * a horizontal DOM tooltip holding the bare verb. Two things were wrong with
 * it, and they had one cause between them.
 *
 * - The label was placed on `path[floor(length / 2)]`, the middle VERTEX. A
 *   straight link has exactly two points, so the "middle" vertex IS the target
 *   end — the tooltip landed on the tip of the link and covered the chevron it
 *   was meant to complement.
 * - Even placed correctly, a horizontal box across a diagonal link reads as a
 *   sticker dropped on the map rather than as a statement about that link.
 *
 * The fix is one mark instead of two: the verb, rotated onto the line,
 * ending in the point that used to be a separate chevron. So this file no
 * longer owns a canvas overlay at all — {@link labelAnchorOf} says where the
 * label goes and which way it turns, and the DOM widget draws it. Nothing can
 * overlap something that no longer exists.
 *
 * ## Why a manager, and not the element renderer
 *
 * An `ElementRenderer` is `(model, ctx, matrix, renderer, rc)`: it knows the
 * element and knows nothing about hover or selection, which are the two things
 * this affordance is made of. So the state lives in an `InteractivityExtension`
 * that owns two signals, and the widget reads them.
 *
 * Nothing here touches an element model: no CRDT write, no undo entry, not even
 * a `@local()` field. The reveal is session state and leaves with the pointer.
 */

/**
 * The one colour the reveal is drawn in — the house primary, i.e. the colour of
 * an affordance rather than of ink. Deliberately NOT the framework's palette:
 * the label is the tool talking about the drawing, not part of the drawing.
 */
export const EDGE_DIRECTION_COLOR = '#1e96eb';

const pathOf = (model: ConnectorElementModel): IVec[] | null => {
  const path = model.absolutePath as IVec[] | undefined;
  return Array.isArray(path) && path.length >= 2 ? path : null;
};

/**
 * Where the label sits on a typed edge, and how it is turned.
 *
 * All of it in MODEL space: the widget projects `at` through the viewport and
 * scales the box by the zoom, so the label is glued to its link the way a
 * street name is glued to its street.
 */
export interface EdgeLabelAnchor {
  /** The model point the label CENTRES on — the middle of the drawn path. */
  at: IVec;
  /**
   * Rotation in radians, always within `[-π/2, π/2]`: the angle of the median
   * segment, turned by 180° when that angle would stand the text on its head.
   */
  angle: number;
  /**
   * Whether that 180° turn happened. It is the whole reason the caller needs
   * this flag: the point of the box must face the TARGET, so on a link running
   * right-to-left — where the turn put the box's right end at the SOURCE — the
   * point moves to the box's left end. The words themselves never reverse; a
   * mirrored `depends on` would be a smudge, not a rotation.
   */
  flipped: boolean;
}

/**
 * The middle of the drawn path by ARC LENGTH, and the segment it falls in.
 *
 * Arc length rather than "the middle vertex": on a two-point path the middle
 * vertex is the target endpoint, which is exactly where the label must not go,
 * and on an elbowed path the vertex nearest the middle can sit far from it.
 *
 * When the middle lands exactly on a corner — two equal arms — the arm the path
 * ARRIVES BY wins (`>=`). Both angles are true there and neither is better; what
 * matters is that the same path always answers the same way, so the label
 * cannot flicker between two rotations across repaints.
 */
function median(
  path: readonly IVec[]
): { at: IVec; from: IVec; to: IVec } | null {
  let total = 0;
  for (let i = 1; i < path.length; i++) {
    total += Math.hypot(path[i][0] - path[i - 1][0], path[i][1] - path[i - 1][1]);
  }
  // A path of zero length is a link drawn on a single point: no middle, no
  // angle, nothing to say.
  if (total === 0) return null;

  const half = total / 2;
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const from = path[i - 1];
    const to = path[i];
    const length = Math.hypot(to[0] - from[0], to[1] - from[1]);
    if (length === 0) continue;
    if (walked + length >= half) {
      const t = (half - walked) / length;
      return {
        at: [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t],
        from,
        to,
      };
    }
    walked += length;
  }
  return null;
}

/**
 * Where a typed edge's label goes and how it is turned — the whole geometry
 * of M2 since the chevron was folded into the label.
 *
 * `null` for an edge with no direction to show: no routed path yet, or a path
 * whose points all coincide. Silence, not a guess.
 */
export function labelAnchorOf(
  model: ConnectorElementModel
): EdgeLabelAnchor | null {
  const path = pathOf(model);
  if (!path) return null;
  const middle = median(path);
  if (!middle) return null;

  const { at, from, to } = middle;
  // Canvas y grows downward and so does CSS's rotation sense, so this angle is
  // handed to `rotate()` unchanged.
  let angle = Math.atan2(to[1] - from[1], to[0] - from[0]);
  let flipped = false;
  if (angle > Math.PI / 2) {
    angle -= Math.PI;
    flipped = true;
  } else if (angle < -Math.PI / 2) {
    angle += Math.PI;
    flipped = true;
  }
  return { at, angle, flipped };
}

/** The `direction` declaration of a role id, when that role is an edge. */
function directionOfRole(
  vocabularies: readonly RoleDefs[],
  roleId: string
): EdgeDirectionDef | undefined {
  for (const defs of vocabularies) {
    const def = defs[roleId];
    if (def !== undefined) return def.kind === 'edge' ? def.direction : undefined;
  }
  return undefined;
}

/**
 * Owns "which typed edges are revealing their direction", and the hint the
 * armed tool shows (M1). Both are session state, both are signals, and both are
 * read by the overlay and by the widget — so the two halves of the affordance
 * can never disagree about what is on screen.
 *
 * No-op until some framework registers a role vocabulary: on a board of
 * generalist connectors this subscribes to nothing at all.
 */
export class EdgeDirectionManager extends InteractivityExtension {
  static override key = 'edge-direction';

  /** Ids of the typed edges revealing their direction: hover ∪ selection. */
  readonly revealed$ = signal<readonly string[]>([]);

  /**
   * The gesture hint of the armed tool, when that tool draws a typed edge —
   * M1's half of the affordance. `null` for every other tool, which is every
   * tool whose gesture decides no persisted orientation.
   */
  readonly armedHint$ = signal<{ key: string; fallback?: string } | null>(null);

  private _hovered: string | null = null;

  private _subscriptions: (() => void)[] = [];

  private _vocabularies: readonly RoleDefs[] | null = null;

  private get _roles(): readonly RoleDefs[] {
    this._vocabularies ??= roleVocabularies(this.std);
    return this._vocabularies;
  }

  /**
   * The revealed edges, resolved NOW rather than remembered.
   *
   * The same reasoning as the validation overlay's: the widget re-renders far
   * more often than this state changes, and an edge can lose a binding or a
   * role between two frames. A frozen snapshot would keep labelling a relation
   * that no longer exists.
   */
  revealedEdges(): TypedEdge[] {
    const surface = this.gfx.surface;
    if (!surface) return [];
    const edges: TypedEdge[] = [];
    for (const id of this.revealed$.peek()) {
      const edge = asTypedEdge(this._roles, surface.getElementById(id));
      // The ADR's guard: an edge bound to nothing relates nothing, so it says
      // nothing at all.
      if (edge && edgeIsBound(edge.model)) edges.push(edge);
    }
    return edges;
  }

  override mounted() {
    // No framework loaded => no vocabulary => no typed edge can exist. The
    // cheapest possible exit, taken once.
    if (this._roles.length === 0) return;

    this._subscriptions.push(
      this.event.on('pointermove', context => {
        this._hover(context.event.x, context.event.y);
      }),
      // Dragging is not reading: the mark would follow the pointer around and
      // say nothing about the edge underneath it.
      //
      // No `pointerleave` handler, deliberately: nothing in this editor
      // DISPATCHES that event to interactivity extensions (`DefaultTool` emits
      // `pointerdown` and `pointermove`), so subscribing to it would be a line
      // that reads like a guarantee and delivers nothing. Leaving the canvas
      // with the pointer keeps the last hover until the next move or the next
      // selection change, which is what the board already does with every other
      // hover affordance.
      this.event.on('dragstart', () => this._setHovered(null))
    );

    const selection = this.gfx.selection.slots.updated.subscribe(() =>
      this._sync()
    );
    this._subscriptions.push(() => selection.unsubscribe());
    // An EFFECT over both signals rather than a subscription to the tool name:
    // `setTool` writes the name BEFORE the options, and the two Wardley
    // connector tools share one name ('connector') and differ only by their
    // `role` option — so a name subscription would read a stale role, and would
    // not fire at all when the user switches from the link tool to the arrow.
    this._subscriptions.push(
      effect(() => {
        const armed = this.gfx.tool.currentToolName$.value;
        const option = this.gfx.tool.currentToolOption$.value as {
          options?: { role?: string };
        };
        this._syncArmed(armed === 'connector' ? option?.options?.role : undefined);
      })
    );
  }

  override unmounted() {
    for (const dispose of this._subscriptions) dispose();
    this._subscriptions = [];
    this._hovered = null;
    this.revealed$.value = [];
    this.armedHint$.value = null;
    super.unmounted();
  }

  private _hover(vx: number, vy: number) {
    // Hovering is a READING gesture: while a tool is armed the user is drawing,
    // and the hint (M1) is what speaks then.
    if (this.gfx.tool.currentToolName$.peek() !== 'default') {
      this._setHovered(null);
      return;
    }
    const [x, y] = this.gfx.viewport.toModelCoord(vx, vy);
    const hits = this.gfx.getElementByPoint(x, y, { all: true });
    let found: string | null = null;
    // Topmost first: the last hit is the element the pointer is aiming at.
    for (let i = hits.length - 1; i >= 0; i--) {
      const edge = asTypedEdge(this._roles, hits[i]);
      if (edge && edgeIsBound(edge.model)) {
        found = edge.model.id;
        break;
      }
    }
    this._setHovered(found);
  }

  private _setHovered(id: string | null) {
    if (this._hovered === id) return;
    this._hovered = id;
    this._sync();
  }

  private _syncArmed(role: string | undefined) {
    const direction =
      role === undefined ? undefined : directionOfRole(this._roles, role);

    const key = direction?.gestureHintKey;
    const next =
      key === undefined
        ? null
        : {
            key,
            ...(direction?.gestureHintFallback !== undefined
              ? { fallback: direction.gestureHintFallback }
              : {}),
          };
    if ((this.armedHint$.peek()?.key ?? null) === (next?.key ?? null)) return;
    this.armedHint$.value = next;
  }

  /** Recompute hover ∪ selection, and publish only when it actually changed. */
  private _sync() {
    const ids: string[] = [];
    if (this._hovered) ids.push(this._hovered);
    for (const element of this.gfx.selection.selectedElements) {
      const edge = asTypedEdge(this._roles, element);
      if (edge && edgeIsBound(edge.model) && !ids.includes(edge.model.id)) {
        ids.push(edge.model.id);
      }
    }

    const current = this.revealed$.peek();
    if (ids.length === current.length && ids.every((id, i) => id === current[i])) {
      return;
    }
    this.revealed$.value = ids;
  }
}
