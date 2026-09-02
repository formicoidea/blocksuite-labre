import type { RootBlockModel } from '@labre/affine-model';
import { WidgetComponent } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import {
  css,
  type CSSResultGroup,
  html,
  type TemplateResult,
  unsafeCSS,
} from 'lit';
import { ifDefined } from 'lit/directives/if-defined.js';
import { styleMap } from 'lit/directives/style-map.js';

/**
 * **The editor-anchored info panel** — ADR 0011.
 *
 * One place where the canvas tells you about itself: a panel pinned to the
 * EDITOR, sitting just above the senior button bar and taking exactly its
 * width. Not a popover beside the element it talks about.
 *
 * The PO's decision of 02/08/2026, in one sentence: *the metadata of the canvas
 * is shown in a panel anchored to the editor, above the senior button bar, at
 * its width*. Two surfaces answer to it today — the reversed reading
 * (`reading-widget.ts`) and Map quality (`map-quality-widget.ts`) — and they
 * answer to it through this class rather than through two copies of the same
 * geometry.
 *
 * ## Why the toolbar is the ruler
 *
 * Because it is the only horizontal measure on the board that a user already
 * reads as "the tool's own furniture". A fixed 480px panel was a second,
 * arbitrary measure that lined up with nothing; the recette capture drew the
 * alignment as two red rules down the toolbar's edges, which is precisely what
 * {@link EditorAnchoredPanel.anchorBox} computes. The bar is measured, never
 * predicted: its width is `fit-content` over a tool count that changes with the
 * editor's width, so any arithmetic here would be a copy of `edgeless-toolbar`'s
 * layout that drifts the first time a tool is added.
 *
 * ## What is shared, and what is not
 *
 * Shared: the host geometry and its layer, the panel's box and chrome, the
 * pinned header over a scrolling body, the click-away and Escape contracts, and
 * the re-measure wiring. Not shared: a single line of CONTENT — each panel
 * passes its own header and body to
 * {@link EditorAnchoredPanel.renderAnchoredPanel}, and neither knows the other
 * exists.
 */

/** The bottom toolbar widget — the senior button bar this pattern aligns on. */
const ANCHOR_WIDGET_TAG = 'edgeless-toolbar-widget';

/**
 * The visible, rounded bar inside that widget's shadow root.
 *
 * The WIDGET is `width: 100%` up to a 900px cap and mostly empty space; the
 * BAR is the box a user sees and the one the alignment is about.
 */
const ANCHOR_BAR_SELECTOR = '.edgeless-toolbar-container';

/**
 * The measure used when the bar cannot be measured at all — a read-only board
 * renders no toolbar, and a widget can be asked to paint before the toolbar has
 * mounted. Centred, so the fallback looks deliberate rather than broken.
 */
const PANEL_FALLBACK_WIDTH = 480;
/** Never narrower than this, however cramped the editor gets. */
const PANEL_MIN_WIDTH = 240;
/** Breathing room at the sides and at the top of a small editor. */
const PANEL_MARGIN = 16;
/** Clearance kept between the panel's bottom edge and the bar's top edge. */
const PANEL_BAR_GAP = 12;
/**
 * Clearance above the editor's bottom edge when there is no bar to measure.
 *
 * `edgeless-toolbar` is 64px tall over a 16px bottom padding; the remainder is
 * the gap.
 */
const PANEL_FALLBACK_BOTTOM = 96;
const PANEL_MAX_HEIGHT = 420;
const PANEL_MIN_HEIGHT = 160;

/**
 * **Above every toolbar, the contextual one included.**
 *
 * The ceiling inside `.widgets-container` is `--affine-z-index-popover`, which
 * the theme sets to `1000`: `editor-toolbar` — the contextual toolbar the PO
 * found the reading panel hiding behind — takes it verbatim, and so does the
 * zoom bar. The bottom `edgeless-toolbar` is only `z-index: 1`, and its senior
 * sub-menus are appended INSIDE its own subtree, so they are capped at that 1
 * with it. Ten above the variable clears the lot with headroom to spare.
 *
 * The fallback matters as much as the value: it is the host's theme stylesheet
 * that defines the variable, never this library.
 *
 * It is set on the HOST rather than on the panel. Every widget host is a
 * sibling in `.widgets-container`, and `affine-toolbar-widget` declares no
 * stacking context of its own, so `editor-toolbar`'s 1000 competes at that
 * level — which makes it the only level where this contest can be won.
 *
 * What still paints above it, correctly and by design: `popMenu` context menus
 * (1001) and the toolbar drag preview (9999), both mounted on `editor-host`
 * outside the contained widgets layer. A dropdown opened FROM one of these
 * panels would go through `popMenu` and land on top of it, which is what one
 * wants.
 */
export const EDITOR_ANCHORED_PANEL_Z_INDEX =
  'calc(var(--affine-z-index-popover, 1000) + 10)';

/** Where the panel goes, in pixels relative to its own zero-sized host. */
export type AnchoredPanelBox = {
  left: number;
  width: number;
  bottom: number;
  maxHeight: number;
};

/**
 * The corner radius of the senior button bar, which this panel wears too.
 *
 * `edgeless-toolbar` rounds at 16 and so, since #199, does every menu that
 * slides out of it. The panel is the same family of chrome floating over the
 * same bar; at 8 it read as a foreign box parked above the toolbar.
 */
const PANEL_RADIUS = 16;

/**
 * The inset between the panel's border and the words inside it.
 *
 * It has to clear the corner arc, not merely look comfortable: an inner
 * rectangle inset by less than `r × (1 − 1/√2)` ≈ 4.7px has its own corners cut
 * by a 16px radius. Every inset below is at or above that, which is why the
 * scrolling box never bleeds into the rounded edge.
 */
const PANEL_INLINE_PADDING = 16;

/**
 * The width of the scrollbar the body reserves, and the width the thumb takes.
 *
 * Reserved permanently (`scrollbar-gutter: stable`) rather than appearing with
 * the overflow: the panel's content is recomputed on every board change, so a
 * gutter that came and went would shift the text sideways under the reader
 * while they are reading it.
 */
const PANEL_SCROLLBAR_WIDTH = 8;

/**
 * The host geometry, the layer and the panel's chrome — the half of the pattern
 * that is CSS.
 *
 * Exported as a stylesheet rather than inherited, because a lit component that
 * declares `static styles` REPLACES its base class's: a subclass composes with
 * `static override styles = [editorAnchoredPanelStyles, css\`…\`]` and adds only
 * what its own content needs.
 */
export const editorAnchoredPanelStyles = css`
  /*
    A ZERO-SIZED host, pinned to the bottom-left corner of the editor.

    Zero-sized is not a style choice, it is the only safe one:
    \`.widgets-container > * { pointer-events: auto }\` is an OUTER-tree rule on
    a shadowless block component, so it beats \`:host { pointer-events: none }\`
    outright. A host with a real box would swallow canvas clicks across the
    whole bottom of the board. The panel below carries the box.

    \`left: 0\` rather than the \`left: 50%\` a centred panel would want: the
    panel is placed against the MEASURED bar, and a zero-width host at the
    container's own origin is what turns a viewport rect into an offset with no
    arithmetic to get wrong.
  */
  :host {
    position: absolute;
    left: 0;
    bottom: 0;
    z-index: ${unsafeCSS(EDITOR_ANCHORED_PANEL_Z_INDEX)};
    pointer-events: none;
  }

  /*
    The FRAME, and nothing that scrolls.

    \`overflow: hidden\` rather than \`overflow-y: auto\`: the panel owns the
    rounded corners, so it is the box that must clip — and a box that clips is
    the only one whose children can be trusted not to paint over the arc. The
    scrolling moved one level in, to \`.editor-anchored-panel-body\`, which is
    what pins the header.

    A column, because \`max-height\` has to be shared: the header takes what it
    needs and the body takes the rest. The measured maximum
    ({@link EditorAnchoredPanel.anchorBox}) therefore still means what it says —
    the whole panel, header included, never exceeds it.
  */
  .editor-anchored-panel {
    position: absolute;
    box-sizing: border-box;
    display: flex;
    flex-direction: column;
    overflow: hidden;
    border-radius: ${unsafeCSS(PANEL_RADIUS)}px;
    border: 1px solid var(--affine-border-color);
    background: var(--affine-background-overlay-panel-color, #fff);
    box-shadow: var(--affine-shadow-2);
    color: var(--affine-text-primary-color);
    font-family: var(--affine-font-family);
    font-size: 14px;
    line-height: 1.4;
    pointer-events: auto;
  }

  /*
    The header stays. It is the sentence that says what the panel is about, and
    a title that scrolls out of its own panel leaves the reader looking at a
    list of values with nothing naming them.

    \`flex: 0 0 auto\` so a long title wraps rather than being squeezed, and the
    bottom border so the body visibly passes UNDER it instead of appearing to
    end mid-air.
  */
  .editor-anchored-panel-header {
    flex: 0 0 auto;
    padding: 12px ${unsafeCSS(PANEL_INLINE_PADDING)}px 8px;
    border-bottom: 1px solid var(--affine-border-color);
  }

  /*
    The one box that scrolls.

    \`min-height: 0\` is belt-and-braces, not load-bearing: a flex child's
    automatic minimum size is its content, but \`overflow-y: auto\` already
    resets it to zero (CSS flexbox § 4.5) — the suite stays green with the
    line removed (lead's mutation probe). Spelled out anyway so the shrink
    survives the day someone moves the overflow off this box.

    The right inset is split — \`padding-right\` plus the reserved gutter — so
    the text sits the same distance from both edges while the scrollbar keeps a
    lane of its own. The bottom inset is a MARGIN rather than padding: padding
    is inside the scrolling box, so the scrollbar would run down to it and into
    the bottom arc; a margin ends the scrolling box early and leaves the corner
    to the frame.
  */
  .editor-anchored-panel-body {
    flex: 1 1 auto;
    min-height: 0;
    overflow-y: auto;
    scrollbar-gutter: stable;
    padding: 12px ${unsafeCSS(PANEL_INLINE_PADDING - PANEL_SCROLLBAR_WIDTH)}px 0
      ${unsafeCSS(PANEL_INLINE_PADDING)}px;
    margin-bottom: 12px;
  }

  /*
    The house scrollbar: thin, invisible at rest, and only drawn while the
    pointer is over the box it belongs to. Same values as \`table-block-css\`
    and the data-view scrollers, so the editor has one scrollbar and not three.
  */
  .editor-anchored-panel-body::-webkit-scrollbar {
    width: ${unsafeCSS(PANEL_SCROLLBAR_WIDTH)}px;
  }

  .editor-anchored-panel-body::-webkit-scrollbar-thumb {
    border-radius: ${unsafeCSS(PANEL_SCROLLBAR_WIDTH / 2)}px;
    background-color: transparent;
  }

  .editor-anchored-panel-body::-webkit-scrollbar-track {
    background-color: transparent;
  }

  .editor-anchored-panel-body:hover::-webkit-scrollbar-thumb {
    background-color: var(--affine-black-30);
  }

  .editor-anchored-panel-body:hover::-webkit-scrollbar-track {
    background-color: var(--affine-hover-color);
  }
`;

/**
 * The base every editor-anchored info panel extends.
 *
 * A subclass says WHEN it is open and HOW it closes; everything else — where it
 * sits, what layer it is in, what dismisses it and when it re-measures — comes
 * from here.
 */
export abstract class EditorAnchoredPanel extends WidgetComponent<RootBlockModel> {
  // Typed as the GROUP, not as the single sheet it defaults to: a subclass
  // composes with `[editorAnchoredPanelStyles, css\`…\`]`, and a narrower
  // declaration here would make that composition a type error.
  static override styles: CSSResultGroup = editorAnchoredPanelStyles;

  /** The bar this panel is currently observing, so it can stop observing it. */
  private _observedBar: Element | null = null;

  private _anchorObserver: ResizeObserver | null = null;

  get gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  /** Whether a panel is on screen — the subclass's own open state. */
  protected abstract get panelOpen(): boolean;

  /** Put the panel away. The subclass owns what "away" means for its state. */
  protected abstract closePanel(): void;

  /** Keep a click inside the panel from reaching the canvas behind it. */
  protected readonly swallow = (event: Event) => {
    event.stopPropagation();
  };

  private readonly _onDocumentPointerDown = (event: PointerEvent) => {
    if (!this.panelOpen) return;
    // Anything inside this widget keeps it open. The toolbar entry that opened
    // it is in another tree, and its own click already landed.
    if (event.composedPath().includes(this)) return;
    this.closePanel();
  };

  /**
   * Escape is listened for on the EDITOR HOST, not on `document`, so a host
   * application keeps its own global Escape while the panel handles its own:
   * with a panel open Escape dismisses the panel rather than clearing the
   * canvas selection behind it, and a library has no business making that call
   * for the whole page.
   */
  private readonly _onHostKeydown = (event: KeyboardEvent) => {
    if (!this.panelOpen || event.key !== 'Escape') return;
    event.stopPropagation();
    this.closePanel();
  };

  /** The visible senior bar, or `null` when there is none to measure. */
  protected anchorBar(): HTMLElement | null {
    const widget = this.std.host.querySelector(ANCHOR_WIDGET_TAG);
    return (
      widget?.shadowRoot?.querySelector<HTMLElement>(ANCHOR_BAR_SELECTOR) ??
      null
    );
  }

  /**
   * The panel's box: the bar's own left edge and width, lifted clear of it.
   *
   * Measured, and deliberately NOT clamped to a minimum when the measure
   * succeeded — "same width as the bar" is the decision, and a panel that
   * quietly stopped matching under some width would be the one bug this whole
   * pattern exists to remove. The floors apply to the FALLBACK, which has no
   * bar to agree with.
   *
   * The vertical is read off the same rect: the panel's bottom sits
   * {@link PANEL_BAR_GAP} above the bar's top, which stays true whatever the
   * bar's height and however the host's theme pads it.
   */
  protected anchorBox(): AnchoredPanelBox {
    const { width: editorWidth, height: editorHeight } = this.gfx.viewport;
    // A zero-sized host at the container's origin: `top` is the container's
    // bottom edge, `left` its left edge.
    const origin = this.getBoundingClientRect();
    const bar = this.anchorBar()?.getBoundingClientRect() ?? null;

    let left: number;
    let width: number;
    let bottom: number;

    if (bar && bar.width > 0) {
      left = bar.left - origin.left;
      width = bar.width;
      bottom = Math.max(origin.top - bar.top + PANEL_BAR_GAP, PANEL_BAR_GAP);
    } else {
      width = Math.max(
        PANEL_MIN_WIDTH,
        Math.min(PANEL_FALLBACK_WIDTH, editorWidth - PANEL_MARGIN * 2)
      );
      left = Math.max(PANEL_MARGIN, (editorWidth - width) / 2);
      bottom = PANEL_FALLBACK_BOTTOM;
    }

    return {
      left,
      width,
      bottom,
      maxHeight: Math.max(
        PANEL_MIN_HEIGHT,
        Math.min(PANEL_MAX_HEIGHT, editorHeight - bottom - PANEL_MARGIN)
      ),
    };
  }

  /**
   * The panel's frame: the box, the dialog semantics and the pointer
   * swallowing. The subclass passes its own two halves and nothing else.
   *
   * ## Why the header is a parameter and not a line of the body
   *
   * Because the split is the whole fix. Both panels rendered their title as the
   * first node of a body that was itself the scrolling box, so a reading long
   * enough to scroll scrolled its own title away. Making the header an argument
   * is what forces a consumer to say which of its markup stays put — a default
   * would have quietly kept the old behaviour for whoever forgot.
   *
   * The header is where a panel puts its title and, if it has one, the actions
   * that belong beside it: Map quality's close button rides there and stays
   * reachable however far the checklist runs.
   *
   * Deliberately NOT `aria-modal`: it promises everything behind the dialog is
   * inert, and these panels promise the opposite — the canvas stays usable
   * behind them, which is why they follow the editor instead of closing on a
   * pan. Claiming modality without trapping focus is a label that lies to a
   * screen reader, and trapping Tab from a host that is still interactive would
   * be the library taking something that is not its to take.
   */
  protected renderAnchoredPanel(
    options: {
      testid: string;
      label: string;
      /** The panel's own class, for the content styles it adds. */
      variant: string;
      /** The element the panel is about, when it is about one. */
      elementId?: string;
    },
    /** Pinned: the title, and whatever must stay beside it. */
    header: unknown,
    /** Scrolled: everything the panel has to say. */
    body: unknown
  ): TemplateResult {
    const { left, width, bottom, maxHeight } = this.anchorBox();

    return html`<div
      class="editor-anchored-panel ${options.variant}"
      role="dialog"
      tabindex="-1"
      aria-label=${options.label}
      data-testid=${options.testid}
      data-element-id=${ifDefined(options.elementId)}
      style=${styleMap({
        left: `${left}px`,
        width: `${width}px`,
        bottom: `${bottom}px`,
        maxHeight: `${maxHeight}px`,
      })}
      @pointerdown=${this.swallow}
      @pointerup=${this.swallow}
      @click=${this.swallow}
    >
      <div
        class="editor-anchored-panel-header"
        data-testid="anchored-panel-header"
      >
        ${header}
      </div>
      <div class="editor-anchored-panel-body" data-testid="anchored-panel-body">
        ${body}
      </div>
    </div>`;
  }

  /**
   * Click-away, Escape, and the two things that move the bar under the panel.
   *
   * Idempotent by convention: a subclass calls it from both `firstUpdated` and
   * a later `connectedCallback`, because `WithDisposable` throws the group away
   * on disconnect while lit runs `firstUpdated` exactly once.
   *
   * `viewportUpdated` covers a resize and a zoom. The ResizeObserver on the bar
   * covers what a viewport event CANNOT: the bar's own width is `fit-content`
   * over a tool count the toolbar recomputes on a debounce of its own, so the
   * measure taken during the resize is legitimately stale a frame later. The
   * observer is the second look that lands on the settled value.
   */
  protected wireAnchoredPanel() {
    const { _disposables } = this;

    _disposables.add(
      this.gfx.viewport.viewportUpdated.subscribe(() => {
        if (this.panelOpen) this.requestUpdate();
      })
    );

    const observer = new ResizeObserver(() => {
      if (this.panelOpen) this.requestUpdate();
    });
    this._anchorObserver = observer;
    this._syncAnchorObserver();

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
      observer.disconnect();
      this._anchorObserver = null;
      this._observedBar = null;
    });
  }

  /**
   * Point the observer at whichever bar is on screen NOW.
   *
   * The bar is not a fixed element: a read-only board renders no toolbar at
   * all, and lit's `cache` swaps the presentation toolbar in and out — so the
   * node observed on mount can be gone, and a different one in its place, by
   * the time a panel opens.
   */
  private _syncAnchorObserver() {
    const observer = this._anchorObserver;
    if (!observer) return;
    const bar = this.anchorBar();
    if (bar === this._observedBar) return;
    if (this._observedBar) observer.unobserve(this._observedBar);
    this._observedBar = bar;
    if (bar) observer.observe(bar);
  }

  override updated() {
    this._syncAnchorObserver();
  }
}
