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
  anchorEmphasis,
  distinctByRule,
  resolveViolationAnchors,
  userFacingViolations,
  ValidationManager,
  VERDICT_PROPS,
  VIOLATION_BADGE_SIZE,
  type Violation,
  type ViolationAnchor,
  type ViolationSeverity,
  VIOLATION_MARK_COLOR,
  VIOLATION_MARK_PADDING,
} from './validation.js';

export const VIOLATION_DETAIL_WIDGET = 'affine-violation-detail-widget';

/**
 * The bubble is TEXT, so it stays in screen pixels while the markers that open
 * it scale with the board. A tooltip rendered at a quarter size is not a
 * smaller tooltip, it is an unreadable one — the same reasoning that puts the
 * markers in model units puts the prose in screen units.
 */
const BUBBLE_WIDTH = 280;
const BUBBLE_GAP = 12;
const BUBBLE_MAX_HEIGHT = 320;

/**
 * Screen-pixel floor for anything clickable. The VISUAL is strictly model
 * space; this is invisible padding around it, so a badge drawn three pixels
 * wide at zoom 0.2 can still be hit with a thumb.
 *
 * 44 px is the figure the repo already uses for canvas affordances —
 * `edgeless-auto-complete` wraps a 24 px arrow in a 44 px-tall hit box.
 */
const MIN_HIT_TARGET = 44;

/**
 * Outward thickness, in screen pixels, of the invisible band that makes the
 * BRACKET clickable while it is on screen.
 *
 * Outward only, never inward: the bracket rings an element the user is very
 * likely to want to grab and drag back where it belongs, and a hit surface
 * covering the anchor's whole area would make that element unclickable for the
 * three seconds the mark lasts — trading a readable board for an unusable one.
 * The band is the mark, not the thing the mark points at.
 */
const BRACKET_HIT_BAND = 22;

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
 * `.widgets-container`, which covers the canvas; the container itself is
 * `pointer-events: none` but explicitly re-enables them on each widget host
 * (`.widgets-container > * { pointer-events: auto }`). What keeps the canvas
 * usable is therefore not that rule but the host's geometry: it is an
 * absolutely positioned, zero-sized box at the viewport origin, so it has no
 * area to intercept anything and only its positioned children are hit. That is
 * the house pattern for an affordance that takes clicks over the canvas
 * (`edgeless-element-link`, whose hover bubble this one is modelled on,
 * `edgeless-auto-connect`, `note-slicer`).
 * Stopping the pointer pair there (see {@link ViolationDetailWidget._swallow})
 * keeps the click off the element underneath, with no special case in
 * `DefaultTool` and no change to the edgeless event dispatcher.
 *
 * ## Sizing
 *
 * Both markers are sized in MODEL units and multiplied by the zoom on the way
 * to the screen, so they shrink with the board instead of swelling over it —
 * see the note on the mark constants in `validation.ts`. The exception is the
 * hit area: a transparent box with a screen-pixel floor around the model-sized
 * visual, so a badge three pixels wide stays reachable. That split is the
 * `edgeless-auto-complete` pattern (a 24 px arrow inside a 44 px target).
 *
 * ## Sequencing
 *
 * The badge is shown only for anchors whose {@link anchorEmphasis} has reached
 * zero — i.e. whose bracket has finished fading. While the bracket is up the
 * widget renders an invisible band over it instead, so the mark on the canvas
 * is clickable and opens the same bubble. The two markers are never on screen
 * together.
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
    /* Above edgeless-selected-rect (z-index 1), whose north-east resize handle
       lands exactly where the badge does and would otherwise bury it — widget
       hosts are siblings, so a tie is settled by registration order, which
       nothing guarantees. Still well below the toolbars. */
    :host {
      position: absolute;
      top: 0;
      left: 0;
      z-index: 2;
      pointer-events: none;
    }

    /* Transparent hit box with a screen-pixel floor; the amber dot inside it
       is the model-sized visual. */
    .violation-badge {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      border: none;
      padding: 0;
      background: transparent;
      cursor: pointer;
      pointer-events: auto;
      transform: translate(-50%, -50%);
    }

    .violation-badge-dot {
      display: block;
      box-sizing: border-box;
      border-radius: 50%;
      background: ${unsafeCSS(VIOLATION_MARK_COLOR)};
      box-shadow: var(--affine-shadow-1);
    }

    .violation-badge:hover .violation-badge-dot,
    .violation-badge[aria-expanded='true'] .violation-badge-dot {
      filter: brightness(1.1);
    }

    .violation-badge:focus-visible .violation-badge-dot {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: 2px;
    }

    /* One of the four invisible strips that make the canvas bracket clickable
       while it is on screen. Outward of the anchor only — never over it. */
    .violation-bracket-hit {
      position: absolute;
      background: transparent;
      border: none;
      padding: 0;
      cursor: pointer;
      pointer-events: auto;
    }

    .violation-bubble {
      position: absolute;
      box-sizing: border-box;
      width: ${unsafeCSS(BUBBLE_WIDTH)}px;
      max-height: ${unsafeCSS(BUBBLE_MAX_HEIGHT)}px;
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

  /** Fires once, when the oldest bracket finishes fading and a badge is due. */
  private _handoverTimer: ReturnType<typeof setTimeout> | null = null;

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  private get _timeline() {
    return this.std.getOptional(ValidationManager)?.timeline ?? null;
  }

  /**
   * Wake up at the exact instant the bracket hands over.
   *
   * The canvas half repaints itself on animation frames while it fades; the DOM
   * half has nothing to react to, because no violation changed — only time
   * passed. One timer, set to the earliest expiry and re-armed after each
   * render, is all it takes; there is nothing to arm once every mark has
   * settled, so a quiet board runs no clock.
   */
  private _scheduleHandover() {
    if (this._handoverTimer) {
      clearTimeout(this._handoverTimer);
      this._handoverTimer = null;
    }
    const timeline = this._timeline;
    if (!timeline || this._violations.length === 0) return;

    const now = performance.now();
    const expiry = timeline.nextExpiryAt(now);
    if (expiry === null) return;

    this._handoverTimer = setTimeout(
      () => {
        this._handoverTimer = null;
        this.requestUpdate();
      },
      Math.max(0, expiry - now)
    );
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

    // Same filter the engine uses: only a prop that can move an anchor is
    // worth a repaint. `SpotlightManager` writes `opacity` on every element it
    // dims, and that must not redraw a badge that has not moved.
    // `requestUpdate` is batched by lit into one render per frame anyway.
    this._elementSubscription = surface.elementUpdated.subscribe(({ props }) => {
      if (props && !VERDICT_PROPS.some(prop => prop in props)) return;
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

  /**
   * Escape is listened for on the EDITOR HOST, not on `document`.
   *
   * The handler swallows the key so that, with a bubble open, Escape dismisses
   * the bubble rather than clearing the canvas selection behind it — and a
   * library has no business making that call for the whole page. Scoped to the
   * host, the host application keeps its own global Escape (close the modal,
   * leave full screen) whatever this widget is doing.
   */
  private readonly _onHostKeydown = (event: KeyboardEvent) => {
    if (this._openAnchorId === null || event.key !== 'Escape') return;
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
   * Stopping the pair on the affordance is what makes it click-through safe,
   * and it costs nothing else: the dispatcher listens on an ancestor, so
   * everything that is not aimed at the mark is untouched.
   */
  private readonly _swallow = (event: Event) => {
    event.stopPropagation();
  };

  private readonly _toggle = (anchorId: string) => (event: Event) => {
    event.stopPropagation();
    this._openAnchorId = this._openAnchorId === anchorId ? null : anchorId;
  };

  /** Open on the bracket, never toggle: a second click on a fading mark that
   * has just been replaced by a badge would read as the bubble refusing to
   * open. */
  private readonly _open = (anchorId: string) => (event: Event) => {
    event.stopPropagation();
    this._openAnchorId = anchorId;
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

    // Click-away stays on `document` — it only OBSERVES, never swallows, so a
    // click anywhere in the page can close the bubble without the library
    // taking anything from the host.
    document.addEventListener('pointerdown', this._onDocumentPointerDown, true);
    const host = this.std.host;
    host.addEventListener('keydown', this._onHostKeydown, true);

    _disposables.add(() => {
      document.removeEventListener(
        'pointerdown',
        this._onDocumentPointerDown,
        true
      );
      host.removeEventListener('keydown', this._onHostKeydown, true);
      this._elementSubscription?.unsubscribe();
      this._elementSubscription = null;
      this._watchedSurface = null;
      if (this._handoverTimer) {
        clearTimeout(this._handoverTimer);
        this._handoverTimer = null;
      }
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

  /**
   * Roughly how tall the bubble will be, to decide WHETHER to flip. It only
   * has to be good enough to pick a side; once flipped, the transform pins the
   * bottom edge exactly, so an underestimate cannot push content off screen.
   */
  private _estimateBubbleHeight(entries: readonly Violation[]): number {
    const padding = 24;
    const perEntry = 70;
    return Math.min(
      BUBBLE_MAX_HEIGHT,
      padding + Math.max(1, entries.length) * perEntry
    );
  }

  private _severityLabel(severity: ViolationSeverity): string {
    return translateKey(
      this.std,
      `com.labre.validation.severity.${severity}`,
      SEVERITY_FALLBACK[severity]
    );
  }

  private _renderBubble(violations: readonly Violation[], x: number, y: number) {
    const entries = distinctByRule(violations);
    const { viewport } = this.gfx;

    // Flip rather than overflow the viewport. Horizontally the width is known,
    // so the position is computed outright; vertically it is not, so the
    // flipped bubble is pinned by its BOTTOM edge with a transform — exact
    // whatever the content turns out to measure, where an estimate would leave
    // a tall bubble hanging off the screen again.
    const flipX = x + BUBBLE_GAP + BUBBLE_WIDTH > viewport.width;
    const flipY = y + BUBBLE_GAP + this._estimateBubbleHeight(entries) >
      viewport.height;

    return html`<div
      class="violation-bubble"
      role="dialog"
      data-testid="violation-bubble"
      data-flip-y=${flipY}
      aria-label=${translateKey(
        this.std,
        'com.labre.validation.bubble.label',
        'Validation details'
      )}
      style=${styleMap({
        left: flipX ? `${x - BUBBLE_GAP - BUBBLE_WIDTH}px` : `${x + BUBBLE_GAP}px`,
        top: flipY ? `${y - BUBBLE_GAP}px` : `${y + BUBBLE_GAP}px`,
        ...(flipY ? { transform: 'translateY(-100%)' } : {}),
      })}
      @pointerdown=${this._swallow}
      @pointerup=${this._swallow}
      @click=${this._swallow}
    >
      ${entries.map(
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

  /**
   * Badge centre, in screen pixels.
   *
   * Computed in MODEL space and converted once, so the offset scales with the
   * mark instead of drifting away from it as the board is zoomed.
   *
   * Pushed a further half-badge diagonally outward rather than centred on the
   * bracket's corner: dead on the corner it sits under the north-east resize
   * handle of `edgeless-selected-rect` — which is exactly where it lands
   * whenever the offending element is selected, i.e. right after the user
   * dropped it there.
   */
  private _badgeAt(anchor: ViolationAnchor): [number, number] {
    const offset = VIOLATION_MARK_PADDING + VIOLATION_BADGE_SIZE / 2;
    const [x, y] = this.gfx.viewport.toViewCoord(
      anchor.bound.maxX + offset,
      anchor.bound.y - offset
    );
    return [x, y];
  }

  private _renderBadge(anchor: ViolationAnchor, label: string) {
    const { zoom } = this.gfx.viewport;
    const [x, y] = this._badgeAt(anchor);
    const visual = VIOLATION_BADGE_SIZE * zoom;
    const target = Math.max(visual, MIN_HIT_TARGET);
    const open = this._openAnchorId === anchor.id;

    return html`<button
      class="violation-badge"
      type="button"
      data-anchor-id=${anchor.id}
      data-testid="violation-badge"
      aria-expanded=${open}
      aria-label=${label}
      title=${label}
      style=${styleMap({
        left: `${x}px`,
        top: `${y}px`,
        width: `${target}px`,
        height: `${target}px`,
      })}
      @pointerdown=${this._swallow}
      @pointerup=${this._swallow}
      @click=${this._toggle(anchor.id)}
    >
      <span
        class="violation-badge-dot"
        data-testid="violation-badge-dot"
        style=${styleMap({ width: `${visual}px`, height: `${visual}px` })}
      ></span>
    </button>`;
  }

  /**
   * Four invisible strips hugging the outside of the bracket, so the mark the
   * user is looking at is the thing they can click.
   *
   * Strips rather than one box over the anchor: the interior belongs to the
   * element, which stays selectable and draggable throughout — the three
   * seconds the bracket lasts are exactly when someone is most likely to grab
   * the node and put it back on the map.
   */
  private _renderBracketHit(anchor: ViolationAnchor, label: string) {
    const { viewport } = this.gfx;
    const { bound } = anchor;
    const [left, top] = viewport.toViewCoord(
      bound.x - VIOLATION_MARK_PADDING,
      bound.y - VIOLATION_MARK_PADDING
    );
    const [right, bottom] = viewport.toViewCoord(
      bound.maxX + VIOLATION_MARK_PADDING,
      bound.maxY + VIOLATION_MARK_PADDING
    );
    const band = BRACKET_HIT_BAND;
    const width = right - left;
    const height = bottom - top;

    const strips = [
      { left: left - band, top: top - band, width: width + band * 2, height: band },
      { left: left - band, top: bottom, width: width + band * 2, height: band },
      { left: left - band, top, width: band, height },
      { left: right, top, width: band, height },
    ];

    return strips.map(
      strip => html`<button
        class="violation-bracket-hit"
        type="button"
        tabindex="-1"
        aria-hidden="true"
        data-anchor-id=${anchor.id}
        data-testid="violation-bracket-hit"
        title=${label}
        style=${styleMap({
          left: `${strip.left}px`,
          top: `${strip.top}px`,
          width: `${Math.max(0, strip.width)}px`,
          height: `${Math.max(0, strip.height)}px`,
        })}
        @pointerdown=${this._swallow}
        @pointerup=${this._swallow}
        @click=${this._open(anchor.id)}
      ></button>`
    );
  }

  override render() {
    if (this._violations.length === 0) return nothing;
    const surface = this.gfx.surface;
    if (!surface) return nothing;

    // Anchors are resolved at render time, exactly like the canvas overlay
    // resolves them at paint time: the marker follows a group that moves and
    // falls back onto the element the moment the group is dissolved.
    const anchors = resolveViolationAnchors(this._violations, surface);
    const timeline = this._timeline;
    const now = performance.now();
    const label = translateKey(
      this.std,
      'com.labre.validation.badge.label',
      'Show validation details'
    );

    // Re-arm for the next handover; a render is the only moment we know one is
    // still pending.
    this._scheduleHandover();

    return html`${anchors.map(anchor => {
      // Strictly one marker at a time: while the bracket is still drawn the
      // badge does not exist, and the bracket's own band takes the clicks.
      const fresh = timeline ? anchorEmphasis(anchor, timeline, now) > 0 : false;
      const [badgeX, badgeY] = this._badgeAt(anchor);

      return html`${fresh
        ? this._renderBracketHit(anchor, label)
        : this._renderBadge(anchor, label)}
      ${this._openAnchorId === anchor.id
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
