import type { RootBlockModel } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { WidgetComponent, WidgetViewExtension } from '@labre/std';
import { GfxControllerIdentifier, type RoleDefs } from '@labre/std/gfx';
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
import {
  endpointNamesOf,
  roleVocabularies,
  type TypedEdge,
} from './typed-edge.js';

export const EDGE_DIRECTION_WIDGET = 'affine-edge-direction-widget';

/**
 * Screen pixels between the bottom of the viewport and the armed-tool hint —
 * clear of the edgeless toolbar, which is the one thing that lives down there.
 */
const HINT_BOTTOM_GAP = 96;

/** How wide the hint may get before the sentence wraps. */
const HINT_MAX_WIDTH = 420;

/**
 * The PROSE of `docs/adr/0010`'s M1 and M2, on the pattern
 * `violation-detail-widget` established one directory away — and, since the
 * chevron was folded into the label, the whole of what M2 draws.
 *
 * Two things, both of them sentences and therefore both of them here rather
 * than on the canvas (a tooltip rendered at a quarter size is not a smaller
 * tooltip, it is an unreadable one):
 *
 * - **M2** — while a typed edge is hovered or selected, the WHOLE sentence laid
 *   along the link: `Kettle depends on Electricity`, in a box that ends in a
 *   point aimed at the provider. Since the PO acceptance of 02/08/2026 this is
 *   the only mark the reveal draws; the canvas chevron it used to sit on top of
 *   is folded into that point (see `direction-reveal.ts`).
 * - **M1** — while a tool that draws a typed edge is armed, the sentence that
 *   tells the user which way to drag. That is what turns the direction their
 *   gesture writes into a statement they made.
 *
 * It knows no framework: the verb is a key declared by a ROLE
 * (`EdgeDirectionDef`) and resolved through the host's catalogue, and the two
 * names come out of the document itself.
 */
export class EdgeDirectionWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      pointer-events: none;
    }

    /*
     * The sentence, laid along its link.
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
     * Which END of the box is the point — never which end of the SENTENCE.
     * data-arrow=end is the ordinary case: the link runs left-to-right on
     * screen, so the target is past the last word. data-arrow=start is the same
     * box on a link running the other way, turned 180° to stay readable: the
     * target is now behind the first word, so the point moves there and the
     * sentence is left alone.
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
      transform: translateX(-50%);
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

  private _vocabularies: readonly RoleDefs[] | null = null;

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
   * The sentence a revealed edge makes, in the framework's own words.
   *
   * The verb when the role declares one; the role's LABEL otherwise, because
   * the label is the only mark left and an unlabelled arrow says which way
   * without ever saying what. `''` when the role declares neither, which is the
   * one case where the library genuinely has nothing to add.
   */
  private _sentenceFor(edge: TypedEdge): string {
    const verb = edge.direction
      ? translateKey(
          this.std,
          edge.direction.verbKey,
          edge.direction.verbFallback
        )
      : edge.role.labelKey
        ? translateKey(this.std, edge.role.labelKey, edge.role.labelFallback)
        : '';

    // Resolved once: this runs on every pan and every zoom frame while an edge
    // is revealed, and the registered vocabularies cannot change under a
    // mounted editor.
    this._vocabularies ??= roleVocabularies(this.std);
    const { source, target } = endpointNamesOf(this._vocabularies, edge.model);
    // An unnamed end is DROPPED, not blanked: `depends on Electricity` is a
    // half-sentence the user can finish by looking at the line; a leading gap
    // is a promise of a name that was never there.
    return [source, verb, target].filter(Boolean).join(' ');
  }

  private _renderLabel(edgeId: string) {
    const manager = this._manager;
    const edge = manager
      ?.revealedEdges()
      .find(candidate => candidate.model.id === edgeId);
    if (!edge) return nothing;

    const anchor = labelAnchorOf(edge.model);
    if (!anchor) return nothing;

    const sentence = this._sentenceFor(edge);
    if (!sentence) return nothing;

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
        : sentence}
      style=${styleMap({
        left: `${x}px`,
        top: `${y}px`,
        // Read right to left, as CSS composes it: scale by the zoom and turn
        // onto the line, both about the box's centre, and only THEN slide that
        // centre onto the anchor. The lengths in the class are model units, so
        // `scale` is what makes them model units on screen.
        transform: `translate(-50%, -50%) rotate(${degrees}deg) scale(${viewport.zoom})`,
      })}
    >
      ${sentence}
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
        top: `${Math.max(0, viewport.height - HINT_BOTTOM_GAP)}px`,
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
