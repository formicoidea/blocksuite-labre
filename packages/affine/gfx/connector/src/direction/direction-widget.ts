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
  midpointOf,
} from './direction-reveal.js';

export const EDGE_DIRECTION_WIDGET = 'affine-edge-direction-widget';

/** Screen pixels between the label and the line it describes. */
const LABEL_GAP = 10;

/**
 * The PROSE half of `docs/adr/0010`'s M1 and M2 — the canvas overlay's DOM
 * sibling, on the pattern `violation-detail-widget` established one directory
 * away.
 *
 * Two things, both of them sentences and therefore both of them here rather
 * than on the canvas (a tooltip rendered at a quarter size is not a smaller
 * tooltip, it is an unreadable one):
 *
 * - **M2** — while a typed edge is hovered or selected, the role's own VERB
 *   next to it: the chevron says which end, the verb says what the sentence is.
 *   "this end _depends on_ that end", in the framework's words and never in the
 *   library's.
 * - **M1** — while a tool that draws a typed edge is armed, the sentence that
 *   tells the user which way to drag. That is what turns the direction their
 *   gesture writes into a statement they made.
 *
 * It knows no framework: both strings are keys declared by a ROLE
 * (`EdgeDirectionDef`) and resolved through the host's catalogue.
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

    .edge-direction-verb {
      position: absolute;
      box-sizing: border-box;
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid ${unsafeCSS(EDGE_DIRECTION_COLOR)};
      background: var(--affine-background-overlay-panel-color, #fff);
      color: var(--affine-text-primary-color);
      font-family: var(--affine-font-family);
      font-size: 12px;
      line-height: 1.3;
      white-space: nowrap;
      transform: translate(-50%, -50%);
      /* Strictly an annotation: it must never take a click away from the edge
         it is describing. */
      pointer-events: none;
    }

    .edge-direction-hint {
      position: absolute;
      left: 50%;
      bottom: 96px;
      transform: translateX(-50%);
      max-width: min(420px, 80vw);
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
        // The label is pinned to a model point, so a pan or a zoom moves it.
        if (this._revealed.length > 0) this.requestUpdate();
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

  private _renderVerb(edgeId: string) {
    const manager = this._manager;
    const edge = manager
      ?.revealedEdges()
      .find(candidate => candidate.model.id === edgeId);
    // No verb declared: the chevron already says which end, and the library has
    // no wording of its own to add.
    if (!edge?.direction) return nothing;

    const middle = midpointOf(edge.model);
    if (!middle) return nothing;

    const [x, y] = this.gfx.viewport.toViewCoord(middle[0], middle[1]);
    const verb = translateKey(
      this.std,
      edge.direction.verbKey,
      edge.direction.verbFallback
    );
    const label = edge.role.labelKey
      ? translateKey(this.std, edge.role.labelKey, edge.role.labelFallback)
      : verb;

    return html`<div
      class="edge-direction-verb"
      data-testid="edge-direction-verb"
      data-edge-id=${edgeId}
      title=${label}
      style=${styleMap({ left: `${x}px`, top: `${y - LABEL_GAP}px` })}
    >
      ${verb}
    </div>`;
  }

  override render() {
    if (this._revealed.length === 0 && this._hint === null) return nothing;

    return html`${this._revealed.map(id => this._renderVerb(id))}
    ${this._hint
      ? html`<div class="edge-direction-hint" data-testid="edge-direction-hint">
          ${translateKey(this.std, this._hint.key, this._hint.fallback)}
        </div>`
      : nothing}`;
  }
}

export const edgeDirectionWidget = WidgetViewExtension(
  'affine:page',
  EDGE_DIRECTION_WIDGET,
  literal`${unsafeStatic(EDGE_DIRECTION_WIDGET)}`
);
