import type { RootBlockModel } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { WidgetComponent, WidgetViewExtension } from '@labre/std';
import type { SurfaceBlockModel } from '@labre/std/gfx';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import { effect } from '@preact/signals-core';
import { css, html, nothing, unsafeCSS } from 'lit';
import { state } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

import {
  distinctByRule,
  resolveViolationAnchors,
  userFacingViolations,
  ValidationManager,
  type Violation,
  type ViolationSeverity,
  VIOLATION_MARK_COLOR,
  VIOLATION_MARK_PADDING,
} from './validation.js';

export const VIOLATION_DETAIL_WIDGET = 'affine-violation-detail-widget';

const BUBBLE_WIDTH = 280;
const BUBBLE_GAP = 12;

/**
 * Chrome wording, and only chrome: an English default so a catalogue-less
 * playground reads correctly. A RULE's wording never gets a default — see
 * {@link translateKey}.
 */
const SEVERITY_FALLBACK: Record<ViolationSeverity, string> = {
  'blocking-overridable': 'Blocking',
  warning: 'Warning',
  audit: 'Audit',
};

/**
 * The PERSISTENT half of the PF7 affordance, and the restitution behind it.
 *
 * `ValidationOverlay` flashes a bracket when a violation appears and fades it
 * out a few seconds later. What survives that fade is this: a small amber
 * badge pinned to the anchor's top-right corner for as long as the violation
 * holds, and — on click — a bubble naming what is wrong.
 *
 * ## Why DOM and not the canvas overlay
 *
 * Because it is clickable. Widgets render into the root block's
 * `.widgets-container`, which sits above the canvas with `pointer-events: none`
 * and re-enables them on its children — the house pattern for an affordance
 * that takes clicks over the canvas (`edgeless-element-link`, whose hover
 * bubble this one is modelled on, `edgeless-auto-connect`, `note-slicer`).
 * Stopping the pointer pair there (see {@link ViolationDetailWidget._swallow})
 * keeps the click off the element underneath, with no special case in
 * `DefaultTool` and no change to the edgeless event dispatcher.
 *
 * DOM also gives the badge its constant on-screen size for free: only its
 * POSITION is converted from model space (`viewport.toViewCoord`), never its
 * dimensions, so it neither grows at zoom 4 nor vanishes at zoom 0.2.
 *
 * ## What it knows
 *
 * Nothing about rules. It consumes normalised {@link Violation} objects off
 * `ValidationManager.violations$` and resolves their `messageKey` through the
 * host's catalogue ({@link translateKey}), falling back to the raw key. No rule
 * logic, no hard-coded rule wording — the library must not put words in a
 * framework's mouth.
 */
export class ViolationDetailWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 1;
      pointer-events: none;
    }

    .violation-badge {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      border: none;
      padding: 0;
      background: ${unsafeCSS(VIOLATION_MARK_COLOR)};
      color: #fff;
      font-family: var(--affine-font-family);
      font-size: 11px;
      font-weight: 700;
      line-height: 1;
      cursor: pointer;
      pointer-events: auto;
      transform: translate(-50%, -50%);
      box-shadow: var(--affine-shadow-1);
    }

    .violation-badge:hover,
    .violation-badge[aria-expanded='true'] {
      filter: brightness(1.1);
    }

    .violation-badge:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: 2px;
    }

    .violation-bubble {
      position: absolute;
      box-sizing: border-box;
      width: ${unsafeCSS(BUBBLE_WIDTH)}px;
      max-height: 320px;
      overflow-y: auto;
      padding: 12px;
      border-radius: 8px;
      border: 1px solid var(--affine-border-color);
      background: var(--affine-background-overlay-panel-color, #fff);
      box-shadow: var(--affine-shadow-2);
      color: var(--affine-text-primary-color);
      font-family: var(--affine-font-family);
      font-size: 14px;
      line-height: 1.4;
      pointer-events: auto;
    }

    .violation-entry + .violation-entry {
      margin-top: 12px;
      padding-top: 12px;
      border-top: 1px solid var(--affine-border-color);
    }

    .violation-severity {
      display: inline-block;
      margin-bottom: 4px;
      padding: 1px 6px;
      border-radius: 4px;
      background: var(--affine-hover-color);
      color: var(--affine-text-secondary-color);
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }

    .violation-severity[data-severity='blocking-overridable'] {
      color: var(--affine-error-color, #eb4335);
    }

    .violation-message {
      overflow-wrap: anywhere;
    }

    .violation-suggestion {
      margin-top: 4px;
      color: var(--affine-text-secondary-color);
      font-size: 13px;
      overflow-wrap: anywhere;
    }
  `;

  /**
   * The anchor whose bubble is open, or `null`. Purely local UI state: which
   * findings a user has looked at is nobody's business but this session's.
   */
  @state()
  private accessor _openAnchorId: string | null = null;

  @state()
  private accessor _violations: readonly Violation[] = [];

  private _elementSubscription: { unsubscribe(): void } | null = null;

  /** The surface {@link _elementSubscription} is attached to, if any. */
  private _watchedSurface: SurfaceBlockModel | null = null;

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  /**
   * Follow a moving anchor, but only while something is flagged. On a clean
   * board — the overwhelming majority of boards, and every board with no
   * framework enabled — this subscription does not exist, so the busiest
   * signal on the surface costs the widget nothing.
   *
   * Idempotent on purpose: `violations$` is handed a freshly built array on
   * every 120 ms re-evaluation, so this runs constantly while a violation
   * holds and must not tear the subscription down and rebuild it each time.
   */
  private _watchElements() {
    const surface = this._violations.length > 0 ? this.gfx.surface : null;
    if (surface === this._watchedSurface) return;

    this._elementSubscription?.unsubscribe();
    this._elementSubscription = null;
    this._watchedSurface = surface;
    if (!surface) return;

    // `requestUpdate` is already batched by lit into one render per frame, so
    // a burst of element updates costs one repaint.
    this._elementSubscription = surface.elementUpdated.subscribe(() => {
      this.requestUpdate();
    });
  }

  /**
   * Forget the open bubble once its anchor stops being flagged.
   *
   * Not cosmetic: `render` would already skip a bubble whose anchor is gone,
   * but a STALE `_openAnchorId` would silently match again if the same group
   * were broken a second time, and the bubble would reappear on its own,
   * unasked. A correction closes the bubble for good.
   */
  private _closeIfAnchorGone() {
    if (this._openAnchorId === null) return;
    const surface = this.gfx.surface;
    const stillFlagged =
      surface !== null &&
      resolveViolationAnchors(this._violations, surface).some(
        anchor => anchor.id === this._openAnchorId
      );
    if (!stillFlagged) this._openAnchorId = null;
  }

  private readonly _onDocumentPointerDown = (event: PointerEvent) => {
    if (this._openAnchorId === null) return;
    // Anything inside this widget — the badge itself, the bubble — keeps it
    // open; a click anywhere else, canvas included, closes it.
    if (event.composedPath().includes(this)) return;
    this._openAnchorId = null;
  };

  private readonly _onDocumentKeydown = (event: KeyboardEvent) => {
    if (this._openAnchorId === null || event.key !== 'Escape') return;
    // Swallow it: with a bubble open, Escape dismisses the bubble rather than
    // clearing the canvas selection behind it.
    event.stopPropagation();
    this._openAnchorId = null;
  };

  /**
   * The edgeless `click` is SYNTHESISED by the event dispatcher from a
   * `pointerdown`/`pointerup` pair observed on the editor host, and the tool
   * then picks its target by coordinate — not by DOM target. Swallowing the
   * native `click` would therefore not be enough: the pointer pair alone is
   * what selects the element sitting under the badge (and starts dragging it).
   *
   * Stopping the pair at the badge is what makes the affordance click-through
   * safe, and it costs nothing else: the dispatcher listens on an ancestor, so
   * everything that is not aimed at the badge is untouched.
   */
  private readonly _swallow = (event: Event) => {
    event.stopPropagation();
  };

  private readonly _toggle = (anchorId: string) => (event: Event) => {
    event.stopPropagation();
    this._openAnchorId = this._openAnchorId === anchorId ? null : anchorId;
  };

  /**
   * `WithDisposable` throws the disposable group away on disconnect and starts
   * a fresh one on reconnect, while lit runs `firstUpdated` exactly once — so
   * wiring set up there and nowhere else never comes back if the widget is
   * detached and re-attached, and a persistent finding indicator would go
   * silently dead. Wiring lives in one idempotent method, called from both.
   */
  private _wire() {
    const { _disposables, gfx } = this;

    const validation = this.std.getOptional(ValidationManager);
    if (validation) {
      _disposables.add(
        effect(() => {
          const next = userFacingViolations(validation.violations$.value);
          // Stay still on a clean board: the effect runs once on creation, and
          // assigning a new empty array there would re-render the widget from
          // inside its own first update for nothing.
          if (next.length === 0 && this._violations.length === 0) return;
          this._violations = next;
          this._watchElements();
          this._closeIfAnchorGone();
        })
      );
    }

    _disposables.add(
      gfx.viewport.viewportUpdated.subscribe(() => {
        // Badges follow the viewport; the bubble does not. Closing it on
        // pan/zoom is the honest simple answer — it can never end up pointing
        // at a badge that has moved, scrolled off screen or changed size.
        this._openAnchorId = null;
        if (this._violations.length > 0) this.requestUpdate();
      })
    );

    document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
    document.addEventListener('keydown', this._onDocumentKeydown, true);
    _disposables.add(() => {
      document.removeEventListener(
        'pointerdown',
        this._onDocumentPointerDown,
        true
      );
      document.removeEventListener('keydown', this._onDocumentKeydown, true);
      this._elementSubscription?.unsubscribe();
      this._elementSubscription = null;
      this._watchedSurface = null;
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    // First connection is handled by `firstUpdated`, when `std` is guaranteed
    // to have arrived through the lit context.
    if (this.hasUpdated) this._wire();
  }

  override firstUpdated() {
    this._wire();
  }

  private _severityLabel(severity: ViolationSeverity): string {
    return translateKey(
      this.std,
      `com.labre.validation.severity.${severity}`,
      SEVERITY_FALLBACK[severity]
    );
  }

  private _renderBubble(violations: readonly Violation[], x: number, y: number) {
    // Flip to the left of the badge rather than overflow the viewport.
    const flip = x + BUBBLE_GAP + BUBBLE_WIDTH > this.gfx.viewport.width;

    return html`<div
      class="violation-bubble"
      role="dialog"
      aria-label=${translateKey(
        this.std,
        'com.labre.validation.bubble.label',
        'Validation details'
      )}
      style=${styleMap({
        left: flip
          ? `${x - BUBBLE_GAP - BUBBLE_WIDTH}px`
          : `${x + BUBBLE_GAP}px`,
        top: `${y + BUBBLE_GAP}px`,
      })}
      @pointerdown=${this._swallow}
      @pointerup=${this._swallow}
      @click=${this._swallow}
    >
      ${distinctByRule(violations).map(
        violation => html`<div class="violation-entry">
          <div class="violation-severity" data-severity=${violation.severity}>
            ${this._severityLabel(violation.severity)}
          </div>
          <div class="violation-message">
            ${translateKey(this.std, violation.messageKey)}
          </div>
          ${violation.suggestion
            ? html`<div class="violation-suggestion">
                ${translateKey(this.std, violation.suggestion)}
              </div>`
            : nothing}
        </div>`
      )}
    </div>`;
  }

  override render() {
    if (this._violations.length === 0) return nothing;
    const surface = this.gfx.surface;
    if (!surface) return nothing;

    // Anchors are resolved at render time, exactly like the canvas overlay
    // resolves them at paint time: the badge follows a group that moves and
    // falls back onto the element the moment the group is dissolved.
    const anchors = resolveViolationAnchors(this._violations, surface);
    const { viewport } = this.gfx;
    const badgeLabel = translateKey(
      this.std,
      'com.labre.validation.badge.label',
      'Show validation details'
    );

    return html`${anchors.map(anchor => {
      const [x, y] = viewport.toViewCoord(anchor.bound.maxX, anchor.bound.y);
      // On the bracket's top-right corner: same gap, measured in screen pixels
      // on both sides.
      const badgeX = x + VIOLATION_MARK_PADDING;
      const badgeY = y - VIOLATION_MARK_PADDING;
      const open = this._openAnchorId === anchor.id;

      return html`<button
          class="violation-badge"
          type="button"
          data-anchor-id=${anchor.id}
          data-testid="violation-badge"
          aria-expanded=${open}
          aria-label=${badgeLabel}
          title=${badgeLabel}
          style=${styleMap({ left: `${badgeX}px`, top: `${badgeY}px` })}
          @pointerdown=${this._swallow}
          @pointerup=${this._swallow}
          @click=${this._toggle(anchor.id)}
        >
          !
        </button>
        ${open
          ? this._renderBubble(anchor.violations, badgeX, badgeY)
          : nothing}`;
    })}`;
  }
}

export const violationDetailWidget = WidgetViewExtension(
  'affine:page',
  VIOLATION_DETAIL_WIDGET,
  literal`${unsafeStatic(VIOLATION_DETAIL_WIDGET)}`
);
