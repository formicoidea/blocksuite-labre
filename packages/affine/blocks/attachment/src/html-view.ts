import type { AttachmentBlockModel } from '@labre/affine-model';
import { EMBED_CARD_HEIGHT } from '@labre/affine-shared/consts';
import { translateKey } from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import { WithDisposable } from '@labre/global/lit';
import type { BlockStdScope } from '@labre/std';
import { ExpandCloseIcon, ExpandFullIcon } from '@blocksuite/icons/lit';
import { css, html, LitElement, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';

import {
  ATTACHMENT_HTML_EXIT_FULLSCREEN,
  ATTACHMENT_HTML_FULLSCREEN,
  ATTACHMENT_HTML_INTERACT,
  ATTACHMENT_HTML_RESIZE,
  ATTACHMENT_HTML_STOP_INTERACTING,
} from './translations.js';
import { HtmlInteraction, htmlInteractionOf } from './html-interaction.js';
import { getAttachmentBlob } from './utils.js';

export const ATTACHMENT_HTML_VIEW_TAG = 'affine-attachment-html-view';

export const HTML_VIEW_MIN_WIDTH = 240;
export const HTML_VIEW_MIN_HEIGHT = 120;
const HTML_VIEW_MAX_HEIGHT = 2400;
const HTML_VIEW_HEIGHT_STEP = 24;

const stopEvent = (event: Event) => event.stopPropagation();

/**
 * An html attachment through the shared frame, as a thumbnail or as its embed
 * view. The bytes are read from the blob store and sent as text; the attachment's
 * `blob:` url, which has the app's origin, plays no part (ADR 0048).
 *
 * A page opens on a preview that lets the pointer through and runs no script.
 * Interacting is one state for the document (`html-interaction.ts`), never stored.
 *
 * Interact or full screen starts the scripts, and they do not stop with the
 * interaction: reloading the page would throw away what the reader did in it. A
 * reload of the document stops it, which is also what gets a reader out of a page
 * that froze once started.
 *
 * In a page, and in a note on a canvas, the height is the block's, in `xywh` like its
 * size on a canvas, and its handle shows when the reader is not interacting. A block
 * laid directly on a canvas is sized by the canvas.
 */
export class AttachmentHtmlView extends WithDisposable(LitElement) {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      /* A file that sets no background assumes white, in a dark theme too. */
      background: white;
    }

    /* A percentage height has no basis in a box sized by its min-height. */
    labre-html-frame {
      position: absolute;
      inset: 0;
    }

    /*
     * Above the mask of a canvas note (z-index 1 in the note's stacking context;
     * nothing between here and there makes one), so what this view claims takes
     * the pointer without entering the note first. The preview stays under it: a
     * press there still selects and drags the note (ADR 0048).
     */
    .controls,
    .height-handle,
    labre-html-frame[interactive] {
      z-index: 2;
    }

    .height-handle {
      position: absolute;
      left: 0;
      right: 0;
      bottom: 0;
      height: 12px;
      display: flex;
      align-items: flex-end;
      justify-content: center;
      cursor: ns-resize;
      touch-action: none;
    }

    .height-handle::after {
      content: '';
      width: 48px;
      height: 4px;
      margin-bottom: 4px;
      border-radius: 2px;
      background: var(--affine-border-color);
      box-shadow: 0 0 0 1px var(--affine-background-overlay-panel-color);
    }

    .height-handle:hover::after,
    .height-handle:focus-visible::after {
      background: var(--affine-primary-color);
    }

    .height-handle:focus-visible {
      outline: none;
    }

    @media (pointer: coarse) {
      .height-handle {
        height: 44px;
      }
    }

    .controls {
      position: absolute;
      top: 8px;
      right: 8px;
      display: flex;
      gap: 4px;
    }

    button {
      display: flex;
      align-items: center;
      gap: 4px;
      height: 28px;
      padding: 0 8px;
      border: 1px solid var(--affine-border-color);
      border-radius: 4px;
      background: var(--affine-background-overlay-panel-color);
      box-shadow: var(--affine-shadow-1);
      color: var(--affine-text-primary-color);
      font-family: var(--affine-font-family);
      font-size: var(--affine-font-xs);
      cursor: pointer;
    }

    button:hover {
      background: var(--affine-hover-color-filled);
    }

    button[aria-pressed='true'] {
      color: var(--affine-primary-color);
    }

    button:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: 1px;
    }

    @media (pointer: coarse) {
      button {
        height: 44px;
      }
    }
  `;

  private _interaction: HtmlInteraction | null = null;

  private _resizeFrom: { y: number; height: number; scale: number } | null =
    null;

  /** In the flow of a page or a note; a block on the surface, the canvas sizes it. */
  private get _inPage() {
    return !this.closest('affine-edgeless-attachment');
  }

  private get _interacting() {
    return this._interaction?.interacting ?? false;
  }

  /** The stored height, or the default of a block made before there was one. */
  private get _storedHeight() {
    return (
      Bound.deserialize(this.model.props.xywh$.value).h ||
      EMBED_CARD_HEIGHT.html
    );
  }

  private _clampHeight(height: number) {
    return Math.min(
      HTML_VIEW_MAX_HEIGHT,
      Math.max(HTML_VIEW_MIN_HEIGHT, Math.round(height))
    );
  }

  private _storeHeight(height: number) {
    const { model } = this;
    const bound = Bound.deserialize(model.props.xywh);
    bound.h = height;
    model.store.updateBlock(model, { xywh: bound.serialize() });
  }

  private readonly _onResizeStart = (event: PointerEvent) => {
    event.preventDefault();
    event.stopPropagation();
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
    this._resizeFrom = {
      y: event.clientY,
      height: this._storedHeight,
      // The pointer moves on screen, the height is stored in the block's own
      // pixels: a note on a canvas is drawn at its scale times the zoom.
      scale: this.getBoundingClientRect().height / this.offsetHeight || 1,
    };
  };

  private readonly _onResizeMove = (event: PointerEvent) => {
    if (!this._resizeFrom) return;
    event.stopPropagation();
    this._dragHeight = this._clampHeight(
      this._resizeFrom.height +
        (event.clientY - this._resizeFrom.y) / this._resizeFrom.scale
    );
  };

  private readonly _onResizeEnd = (event: PointerEvent) => {
    if (!this._resizeFrom) return;
    event.stopPropagation();
    this._resizeFrom = null;
    if (this._dragHeight !== null) this._storeHeight(this._dragHeight);
    this._dragHeight = null;
  };

  private readonly _onResizeKey = (event: KeyboardEvent) => {
    const step = { ArrowDown: 1, ArrowUp: -1 }[event.key];
    if (!step) return;
    event.preventDefault();
    event.stopPropagation();
    this._storeHeight(
      this._clampHeight(this._storedHeight + step * HTML_VIEW_HEIGHT_STEP)
    );
  };

  /** Called by the document's interaction: the reader's gesture reached this view. */
  startScripts() {
    this._started = true;
  }

  private readonly _syncFullscreen = () => {
    const root = this.getRootNode() as Document | ShadowRoot;
    this._fullscreen = root.fullscreenElement === this;
    if (this._fullscreen) this._started = true;
  };

  private readonly _toggleFullscreen = async () => {
    try {
      await (this._fullscreen
        ? document.exitFullscreen()
        : this.requestFullscreen());
    } catch (error) {
      console.error(error);
    }
  };

  private readonly _toggleInteractive = () => {
    this._interaction?.toggle();
  };

  private async _load() {
    const { sourceId$ } = this.model.props;
    const sourceId = sourceId$.peek();
    try {
      const blob = await getAttachmentBlob(this.model);
      if (sourceId$.peek() === sourceId) this._blob = blob;
    } catch (error) {
      console.error(error);
    }
  }

  private _renderControls() {
    const { std } = this;
    const fullscreenLabel = translateKey(
      std,
      ...(this._fullscreen
        ? ATTACHMENT_HTML_EXIT_FULLSCREEN
        : ATTACHMENT_HTML_FULLSCREEN)
    );
    return html`<div
      class="controls"
      @pointerdown=${stopEvent}
      @mousedown=${stopEvent}
      @click=${stopEvent}
      @dblclick=${stopEvent}
    >
      ${this._fullscreen
        ? nothing
        : html`<button
            type="button"
            data-testid="attachment-html-interact"
            aria-pressed=${this._interacting}
            @click=${this._toggleInteractive}
          >
            ${translateKey(
              std,
              ...(this._interacting
                ? ATTACHMENT_HTML_STOP_INTERACTING
                : ATTACHMENT_HTML_INTERACT)
            )}
          </button>`}
      ${document.fullscreenEnabled
        ? html`<button
            type="button"
            data-testid="attachment-html-fullscreen"
            aria-label=${fullscreenLabel}
            title=${fullscreenLabel}
            @click=${this._toggleFullscreen}
          >
            ${this._fullscreen ? ExpandCloseIcon() : ExpandFullIcon()}
          </button>`
        : nothing}
    </div>`;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.disposables.add(
      this.model.props.sourceId$.subscribe(() => void this._load())
    );
    this.disposables.addFromEvent(
      document,
      'fullscreenchange',
      this._syncFullscreen
    );
    this.disposables.add(
      this.model.props.xywh$.subscribe(() => this.requestUpdate())
    );
    if (this.embed) {
      this._interaction = htmlInteractionOf(this.model.store);
      this._interaction.add(this);
      this.disposables.add(() => this._interaction?.remove(this));
    }
  }

  private _renderHeightHandle() {
    if (!this._inPage || this._interacting || this._fullscreen) return nothing;
    if (this.model.store.readonly) return nothing;
    return html`<div
      class="height-handle"
      role="slider"
      tabindex="0"
      aria-orientation="vertical"
      aria-label=${translateKey(this.std, ...ATTACHMENT_HTML_RESIZE)}
      aria-valuemin=${HTML_VIEW_MIN_HEIGHT}
      aria-valuemax=${HTML_VIEW_MAX_HEIGHT}
      aria-valuenow=${this._dragHeight ?? this._storedHeight}
      data-testid="attachment-html-height"
      @pointerdown=${this._onResizeStart}
      @pointermove=${this._onResizeMove}
      @pointerup=${this._onResizeEnd}
      @pointercancel=${this._onResizeEnd}
      @mousedown=${stopEvent}
      @click=${stopEvent}
      @dblclick=${stopEvent}
      @keydown=${this._onResizeKey}
    ></div>`;
  }

  protected override willUpdate() {
    // The fullscreen element takes the whole screen: its height is not the block's.
    this.style.height =
      this.embed && this._inPage && !this._fullscreen
        ? `${this._dragHeight ?? this._storedHeight}px`
        : '';
  }

  override render() {
    return html`<labre-html-frame
        .html=${this._blob}
        .frameUrl=${this.frameUrl}
        .title=${this.model.props.name}
        ?thumbnail=${!this.embed}
        ?interactive=${this._interacting || this._fullscreen}
        ?scripts=${this._started}
      ></labre-html-frame>
      ${this.embed ? this._renderHeightHandle() : nothing}
      ${this.embed ? this._renderControls() : nothing}`;
  }

  @state()
  private accessor _blob: Blob | null = null;

  @state()
  private accessor _fullscreen = false;

  @state()
  private accessor _dragHeight: number | null = null;

  /** The reader's gesture has happened: the html's scripts may run. */
  @state()
  private accessor _started = false;

  /** The embed view, with its controls; otherwise a thumbnail. */
  @property({ type: Boolean, reflect: true })
  accessor embed = false;

  @property({ attribute: false })
  accessor frameUrl!: string;

  @property({ attribute: false })
  accessor model!: AttachmentBlockModel;

  @property({ attribute: false })
  accessor std!: BlockStdScope;
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-attachment-html-view': AttachmentHtmlView;
  }
}
