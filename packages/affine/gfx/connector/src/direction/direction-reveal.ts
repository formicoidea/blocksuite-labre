import type { CanvasRenderer } from '@labre/affine-block-surface';
import { Overlay, OverlayIdentifier } from '@labre/affine-block-surface';
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
 * A typed edge reveals its orientation on hover and on selection: a chevron at
 * the TARGET end, plus — in the DOM sibling of this overlay — the role's own
 * verb. At rest the board keeps the canonical arrowless look, because on a
 * Wardley map a permanent head already means something else (evolution
 * movement), and two meanings on one glyph make both unreadable.
 *
 * ## Why an overlay and a manager, and not the element renderer
 *
 * An `ElementRenderer` is `(model, ctx, matrix, renderer, rc)`: it knows the
 * element and knows nothing about hover or selection, which are the two things
 * this affordance is made of. So the shape is the one the validation affordance
 * already uses one directory away — a manager owning the state, a canvas
 * overlay for the mark, a DOM widget for the prose.
 *
 * Nothing here touches an element model: no CRDT write, no undo entry, not even
 * a `@local()` field. The reveal is session state and leaves with the pointer.
 */

/**
 * The one colour the reveal is drawn in — the house primary, i.e. the colour of
 * an affordance rather than of ink. Deliberately NOT the framework's palette:
 * the chevron is the tool talking about the drawing, not part of the drawing.
 */
export const EDGE_DIRECTION_COLOR = '#1e96eb';

/** Chevron arm length, in MODEL units: the mark zooms with the board. */
const CHEVRON = 12;
const CHEVRON_ANGLE = (28 * Math.PI) / 180;
const CHEVRON_WIDTH = 2;

/**
 * The last two DISTINCT points of a path — where it arrives from, and the tip.
 * `null` for a path with no length, which has no direction to show.
 */
function incoming(path: readonly IVec[]): [IVec, IVec] | null {
  const end = path[path.length - 1];
  if (!end) return null;
  for (let i = path.length - 2; i >= 0; i--) {
    const point = path[i];
    if (point[0] !== end[0] || point[1] !== end[1]) return [point, end];
  }
  return null;
}

const pathOf = (model: ConnectorElementModel): IVec[] | null => {
  const path = model.absolutePath as IVec[] | undefined;
  return Array.isArray(path) && path.length >= 2 ? path : null;
};

/**
 * Where a typed edge's mark goes and which way it points: the tip of the path
 * at the TARGET end, and the unit vector arriving there.
 *
 * The Rear end and no other — the same end the product default already arrows
 * (`consts/connector.ts`), and the object of the role's verb.
 */
export function targetAnchorOf(
  model: ConnectorElementModel
): { at: IVec; heading: IVec } | null {
  const path = pathOf(model);
  if (!path) return null;
  const ends = incoming(path);
  if (!ends) return null;

  const [from, at] = ends;
  const dx = at[0] - from[0];
  const dy = at[1] - from[1];
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  return { at, heading: [dx / length, dy / length] };
}

/** The middle of a path, where the DOM label hangs. */
export function midpointOf(model: ConnectorElementModel): IVec | null {
  const path = pathOf(model);
  if (!path) return null;
  const middle = path[Math.floor(path.length / 2)];
  return middle ? [middle[0], middle[1]] : null;
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

  private get _overlay(): EdgeDirectionOverlay | null {
    return (
      (this.std.getOptional(
        OverlayIdentifier(EdgeDirectionOverlay.overlayName)
      ) as EdgeDirectionOverlay | null) ?? null
    );
  }

  /**
   * The revealed edges, resolved NOW rather than remembered.
   *
   * The same reasoning as the validation overlay's: the canvas repaints far
   * more often than this state changes, and an edge can lose a binding or a
   * role between two frames. A frozen snapshot would keep drawing a chevron on
   * a relation that no longer exists.
   */
  revealedEdges(): TypedEdge[] {
    const surface = this.gfx.surface;
    if (!surface) return [];
    const edges: TypedEdge[] = [];
    for (const id of this.revealed$.peek()) {
      const edge = asTypedEdge(this._roles, surface.getElementById(id));
      // The ADR's guard: an edge bound to nothing relates nothing, so it says
      // nothing — no chevron, no verb.
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

  /** Recompute hover ∪ selection, and repaint only when it actually changed. */
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
    this._overlay?.refresh();
  }
}

/**
 * The canvas half of M2: a chevron at the target end of every revealed edge.
 *
 * Model units, like the validation marks and for the same reason — an
 * affordance that grows relative to the board as you zoom out ends up being all
 * you can see.
 */
export class EdgeDirectionOverlay extends Overlay {
  static override overlayName = 'edge-direction';

  private _detached = false;

  private get _manager(): EdgeDirectionManager | null {
    return this.gfx.std.getOptional(EdgeDirectionManager) ?? null;
  }

  override setRenderer(renderer: CanvasRenderer | null) {
    this._detached = renderer === null;
    super.setRenderer(renderer);
  }

  override dispose() {
    this._detached = true;
    super.dispose();
  }

  override render(ctx: CanvasRenderingContext2D): void {
    if (this._detached) return;
    const edges = this._manager?.revealedEdges() ?? [];
    // The overlay repaints on every pan, zoom and edit: it must cost nothing
    // between the moments it has something to say.
    if (edges.length === 0) return;

    ctx.save();
    ctx.strokeStyle = EDGE_DIRECTION_COLOR;
    ctx.lineWidth = CHEVRON_WIDTH;
    ctx.lineCap = 'round';

    const cos = Math.cos(CHEVRON_ANGLE);
    const sin = Math.sin(CHEVRON_ANGLE);
    for (const { model } of edges) {
      const anchor = targetAnchorOf(model);
      if (!anchor) continue;
      const [hx, hy] = anchor.heading;
      const [x, y] = anchor.at;
      // Two strokes back from the tip, symmetric about the incoming direction.
      // A chevron reads as "this way"; a FILLED head would read as ink, and on
      // a Wardley map that ink already means evolution movement.
      const arms: [number, number][] = [
        [-hx * cos + hy * sin, -hy * cos - hx * sin],
        [-hx * cos - hy * sin, -hy * cos + hx * sin],
      ];
      ctx.beginPath();
      for (const [ax, ay] of arms) {
        ctx.moveTo(x, y);
        ctx.lineTo(x + ax * CHEVRON, y + ay * CHEVRON);
      }
      ctx.stroke();
    }

    ctx.restore();
  }
}
