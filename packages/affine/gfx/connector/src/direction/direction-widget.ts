import type { RootBlockModel } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { WidgetComponent, WidgetViewExtension } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { effect } from '@preact/signals-core';
import { css, html, nothing, unsafeCSS } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

import {
  EDGE_DIRECTION_COLOR,
  EdgeDirectionManager,
  labelAnchorOf,
} from './direction-reveal.js';
import { edgeVerbOf, type TypedEdge } from './typed-edge.js';

export const EDGE_DIRECTION_WIDGET = 'affine-edge-direction-widget';

/**
 * Screen pixels between the bottom of the viewport and the armed-tool hint —
 * clear of the edgeless toolbar, which is the one thing that lives down there.
 * The hint hangs UPWARDS from that line (see the rule below), so the whole box
 * is above the strip and not merely its top edge.
 */
const HINT_BOTTOM_GAP = 96;

/** How wide the hint may get before the sentence wraps. */
const HINT_MAX_WIDTH = 420;

/** One line of hint, box included — the room it needs above its anchor line. */
const HINT_MIN_HEIGHT = 48;

/**
 * **Under every toolbar** — the reverse of the reading panel's choice, for the
 * reverse reason (PO recette of 02/08/2026, point 4).
 *
 * What this widget draws belongs to the CANVAS: a label glued to a link, in
 * model units, turning and scaling with the map. The toolbars overhang the
 * canvas, so a canvas mark that paints over the senior menu — which is what the
 * PO photographed — is a layering mistake and not a matter of taste. The
 * reading panel is the opposite case: a piece of UI the user is reading, which
 * the toolbars may wait underneath.
 *
 * `0`, not `2`, and both numbers are about siblings rather than about depth.
 * `.widgets-container` has `contain: layout`, so it is a stacking context and
 * every widget host competes inside it: `edgeless-toolbar-widget` takes
 * `z-index: 1` (its senior menu and sub-menus are appended inside its own
 * subtree, so they ride on that 1), and `editor-toolbar` — the contextual one —
 * takes `--affine-z-index-popover`, which the theme sets to 1000. `2` cleared
 * the first of those and that is exactly the bug. `0` is under both, and still
 * over the canvas: the container as a whole paints above `.edgeless-container`,
 * which is its earlier sibling OUTSIDE it.
 */
const EDGE_DIRECTION_Z_INDEX = 0;

/**
 * The PROSE of `docs/adr/0010`'s M1 and M2, on the pattern
 * `violation-detail-widget` established one directory away — and, since the
 * chevron was folded into the label, the whole of what M2 draws.
 *
 * Two things, both of them WORDS and therefore both of them here rather than on
 * the canvas (a tooltip rendered at a quarter size is not a smaller tooltip, it
 * is an unreadable one):
 *
 * - **M2** — while a typed edge is hovered or selected, the role's VERB laid
 *   along the link: `needs`, in a box that ends in a point aimed at the
 *   provider. Since the PO acceptance of 02/08/2026 this is the only mark the
 *   reveal draws; the canvas chevron it used to sit on top of is folded into
 *   that point (see `direction-reveal.ts`). Since the second pass of the same
 *   recette it is the verb ALONE: the full sentence was longer than the links
 *   it was laid on, so it covered the very components it named — and those
 *   names are already drawn at both ends of the line.
 * - **M1** — while a tool that draws a typed edge is armed, the sentence that
 *   tells the user which way to drag. That is what turns the direction their
 *   gesture writes into a statement they made.
 *
 * It knows no framework: the verb is a key declared by a ROLE
 * (`EdgeDirectionDef`) and resolved through the host's catalogue.
 */
export class EdgeDirectionWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      z-index: ${unsafeCSS(EDGE_DIRECTION_Z_INDEX)};
      pointer-events: none;
    }

    /*
     * The verb, laid along its link.
     *
     * Every length below is in MODEL units: render() multiplies the whole box
     * by the viewport zoom, so the label keeps its proportion to the line it
     * names instead of swelling into a banner when the user zooms out. That is
     * the same rule the chevron it replaces obeyed, and the same one the
     * validation marks obey.
     *
     * Filled rather than outlined, because the box is a SHAPE now: an arrow's
     * point has no border to speak of, and a hairline diagonal at 40 % zoom is
     * a smudge. Solid house blue with white text reads in both themes and
     * cannot be mistaken for the map's own ink.
     *
     * The background here is the DEFAULT, which every role that declares no
     * chipColor keeps: render() overrides it inline only for a role that asks
     * for one, so a colour decision taken about one relation never repaints the
     * others.
     */
    .edge-direction-label {
      --edge-direction-point: 9px;
      position: absolute;
      box-sizing: border-box;
      padding: 2px 8px;
      border-radius: 3px;
      background: ${unsafeCSS(EDGE_DIRECTION_COLOR)};
      color: #fff;
      font-family: var(--affine-font-family);
      font-size: 12px;
      font-weight: 500;
      line-height: 1.4;
      white-space: nowrap;
      /* The box turns and scales about its own centre, which render() has
         already put on the middle of the path. */
      transform-origin: center center;
      /* Strictly an annotation: it must never take a click away from the edge
         it is describing. */
      pointer-events: none;
    }

    /*
     * Which END of the box is the point — never which end of the WORDS.
     * data-arrow=end is the ordinary case: the link runs left-to-right on
     * screen, so the target is past the last word. data-arrow=start is the same
     * box on a link running the other way, turned 180° to stay readable: the
     * target is now behind the first word, so the point moves there and the
     * verb is left alone, spelled the way it is read.
     */
    .edge-direction-label[data-arrow='end'] {
      padding-right: calc(8px + var(--edge-direction-point));
      clip-path: polygon(
        0 0,
        calc(100% - var(--edge-direction-point)) 0,
        100% 50%,
        calc(100% - var(--edge-direction-point)) 100%,
        0 100%
      );
    }

    .edge-direction-label[data-arrow='start'] {
      padding-left: calc(8px + var(--edge-direction-point));
      clip-path: polygon(
        var(--edge-direction-point) 0,
        100% 0,
        100% 100%,
        var(--edge-direction-point) 100%,
        0 50%
      );
    }

    /*
     * Positioned in SCREEN pixels from the widget host, which sits at the
     * viewport's origin: left and top are handed in by render() off
     * gfx.viewport, exactly like the validation badge's are.
     *
     * It cannot be positioned against the host itself. That host is a
     * zero-sized absolutely positioned box (the house pattern for a widget that
     * must not intercept the canvas), so bottom: 96px put the banner 96 px
     * ABOVE the viewport's top edge, and left: 50% of a zero width put it on
     * the left border — off screen twice over.
     */
    .edge-direction-hint {
      position: absolute;
      /*
       * Hangs UPWARDS from the line render() computes, rather than downwards
       * from it. The widget now paints UNDER the toolbars (see
       * EDGE_DIRECTION_Z_INDEX), so a box whose lower third crossed the
       * 80px-tall toolbar strip would have that third clipped away by it — and
       * the clipped third is where a two-line hint puts its second line.
       * HINT_BOTTOM_GAP is the strip's clearance, so anchoring the box's
       * BOTTOM there puts the whole of it in the clear whatever it says.
       */
      transform: translate(-50%, -100%);
      /*
       * width, not max-width alone. An absolutely positioned box shrinks to fit
       * its CONTAINING BLOCK, and this one's containing block is the zero-sized
       * widget host — so the banner collapsed to its longest word (95 px) and
       * grew five lines tall, which is how it ended up below the bottom edge it
       * was supposed to sit above. max-content sizes it to the sentence; the cap
       * comes from render(), which knows how wide the viewport is.
       */
      width: max-content;
      /* So the viewport-derived max-width caps the BOX, padding and border
         included — the number render() computes is a screen budget, not a
         content budget. */
      box-sizing: border-box;
      padding: 6px 12px;
      border-radius: 8px;
      border: 1px solid var(--affine-border-color);
      background: var(--affine-background-overlay-panel-color, #fff);
      box-shadow: var(--affine-shadow-1);
      color: var(--affine-text-secondary-color);
      font-family: var(--affine-font-family);
      font-size: 13px;
      line-height: 1.4;
      text-align: center;
      pointer-events: none;
    }
  `;

  @state()
  private accessor _revealed: readonly string[] = [];

  @state()
  private accessor _hint: { key: string; fallback?: string } | null = null;

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  private get _manager(): EdgeDirectionManager | null {
    return this.std.getOptional(EdgeDirectionManager) ?? null;
  }

  /**
   * Idempotent wiring, called from both `firstUpdated` and a later
   * `connectedCallback`: `WithDisposable` throws its group away on disconnect
   * while lit runs `firstUpdated` once, so wiring done only there never comes
   * back if the widget is detached and re-attached.
   */
  private _wire() {
    const manager = this._manager;
    if (!manager) return;

    this._disposables.add(
      effect(() => {
        const next = manager.revealed$.value;
        if (next.length === 0 && this._revealed.length === 0) return;
        this._revealed = next;
      })
    );
    this._disposables.add(
      effect(() => {
        this._hint = manager.armedHint$.value;
      })
    );
    this._disposables.add(
      this.gfx.viewport.viewportUpdated.subscribe(() => {
        // The label is pinned to a model point AND scaled by the zoom, so a pan
        // or a zoom moves it — and the hint is pinned to the viewport's own
        // size, so a RESIZE moves that one. Both are on screen only while
        // something is revealed
        // or a tool is armed, so a quiet board re-renders nothing.
        if (this._revealed.length > 0 || this._hint !== null) {
          this.requestUpdate();
        }
      })
    );
    const surface = this.gfx.surface;
    if (surface) {
      const subscription = surface.elementUpdated.subscribe(() => {
        // An endpoint re-drag reroutes the path under the label. Cheap: lit
        // batches this into one render per frame, and it only runs while
        // something is actually revealed.
        if (this._revealed.length > 0) this.requestUpdate();
      });
      this._disposables.add(() => subscription.unsubscribe());
    }
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) this._wire();
  }

  override firstUpdated() {
    this._wire();
  }

  /**
   * The word a revealed edge is labelled with, in the framework's own words —
   * the role's verb, said in the host's language.
   *
   * `''` when the role declares neither verb nor label, in which case the
   * caller draws nothing at all.
   */
  private _verbFor(edge: TypedEdge): string {
    const verb = edgeVerbOf(edge);
    return verb ? translateKey(this.std, verb.key, verb.fallback) : '';
  }

  private _renderLabel(edgeId: string) {
    const manager = this._manager;
    const edge = manager
      ?.revealedEdges()
      .find(candidate => candidate.model.id === edgeId);
    if (!edge) return nothing;

    const anchor = labelAnchorOf(edge.model);
    if (!anchor) return nothing;

    const verb = this._verbFor(edge);
    if (!verb) return nothing;

    // Declared by the ROLE, defaulted by the stylesheet: only a relation that
    // asked for its own colour gets an inline background at all.
    const chipColor = edge.direction?.chipColor;
    const { viewport } = this.gfx;
    const [x, y] = viewport.toViewCoord(anchor.at[0], anchor.at[1]);
    // Two decimals: below what a reader can see on a 12 px box, and it keeps
    // the attribute readable in devtools instead of `45.00000000000001deg`.
    const degrees = ((anchor.angle * 180) / Math.PI).toFixed(2);

    return html`<div
      class="edge-direction-label"
      data-testid="edge-direction-label"
      data-edge-id=${edgeId}
      data-arrow=${anchor.flipped ? 'start' : 'end'}
      title=${edge.role.labelKey
        ? translateKey(this.std, edge.role.labelKey, edge.role.labelFallback)
        : verb}
      style=${styleMap({
        left: `${x}px`,
        top: `${y}px`,
        ...(chipColor ? { background: chipColor } : {}),
        // Read right to left, as CSS composes it: scale by the zoom and turn
        // onto the line, both about the box's centre, and only THEN slide that
        // centre onto the anchor. The lengths in the class are model units, so
        // `scale` is what makes them model units on screen.
        transform: `translate(-50%, -50%) rotate(${degrees}deg) scale(${viewport.zoom})`,
      })}
    >
      ${verb}
    </div>`;
  }

  /**
   * The armed tool's hint, centred near the bottom of the EDITOR VIEWPORT —
   * above the toolbar, where the user's eyes already are while they aim.
   *
   * The viewport rect is the only frame available to a widget host that is a
   * zero-sized box at its origin, and it is the one the other canvas
   * affordances measure against (`violation-detail-widget` flips its bubble
   * against `viewport.width` / `viewport.height` the same way).
   */
  private _renderHint(hint: { key: string; fallback?: string }) {
    const { viewport } = this.gfx;
    return html`<div
      class="edge-direction-hint"
      data-testid="edge-direction-hint"
      style=${styleMap({
        left: `${viewport.width / 2}px`,
        // The BOTTOM of the box, since the rule above hangs it upwards. The
        // floor is what keeps a very short editor pushing the banner down
        // rather than off its top edge, which is what `0` would now do.
        top: `${Math.max(HINT_MIN_HEIGHT, viewport.height - HINT_BOTTOM_GAP)}px`,
        // The cap a percentage cannot express here: the containing block is the
        // zero-sized host, so the only honest width bound is the viewport's.
        maxWidth: `${Math.max(120, Math.min(HINT_MAX_WIDTH, viewport.width - 32))}px`,
      })}
    >
      ${translateKey(this.std, hint.key, hint.fallback)}
    </div>`;
  }

  override render() {
    if (this._revealed.length === 0 && this._hint === null) return nothing;

    return html`${this._revealed.map(id => this._renderLabel(id))}
    ${this._hint ? this._renderHint(this._hint) : nothing}`;
  }
}

export const edgeDirectionWidget = WidgetViewExtension(
  'affine:page',
  EDGE_DIRECTION_WIDGET,
  literal`${unsafeStatic(EDGE_DIRECTION_WIDGET)}`
);
