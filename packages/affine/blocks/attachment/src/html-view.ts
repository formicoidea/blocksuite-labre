import type { AttachmentBlockModel } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { WithDisposable } from '@labre/global/lit';
import type { BlockStdScope } from '@labre/std';
import { ExpandCloseIcon, ExpandFullIcon } from '@blocksuite/icons/lit';
import { css, html, LitElement, nothing } from 'lit';
import { property, state } from 'lit/decorators.js';

import {
  ATTACHMENT_HTML_EXIT_FULLSCREEN,
  ATTACHMENT_HTML_FULLSCREEN,
  ATTACHMENT_HTML_INTERACT,
  ATTACHMENT_HTML_STOP_INTERACTING,
} from './translations.js';
import { getAttachmentBlob } from './utils.js';

export const ATTACHMENT_HTML_VIEW_TAG = 'affine-attachment-html-view';

const stopEvent = (event: Event) => event.stopPropagation();

/**
 * An html attachment through the shared frame, as a thumbnail or as its embed
 * view. The bytes are read from the blob store and sent as text; the attachment's
 * `blob:` url, which has the app's origin, plays no part (ADR 0048).
 *
 * Whether the reader is interacting is state of this view, never stored: a page
 * opens on a preview that lets the pointer through, and a press outside ends it.
 * The frame cannot report a press inside it, which is what keeps it going.
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

    :host([embed]) {
      min-height: 480px;
    }

    /* A percentage height has no basis in a box sized by its min-height. */
    labre-html-frame {
      position: absolute;
      inset: 0;
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

  private readonly _endInteractionOnOutsidePress = (event: Event) => {
    if (!this._interactive || event.composedPath().includes(this)) return;
    this._interactive = false;
  };

  private readonly _syncFullscreen = () => {
    const root = this.getRootNode() as Document | ShadowRoot;
    this._fullscreen = root.fullscreenElement === this;
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
    this._interactive = !this._interactive;
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
            aria-pressed=${this._interactive}
            @click=${this._toggleInteractive}
          >
            ${translateKey(
              std,
              ...(this._interactive
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
    this.disposables.addFromEvent(
      document,
      'pointerdown',
      this._endInteractionOnOutsidePress,
      { capture: true }
    );
  }

  override render() {
    return html`<labre-html-frame
        .html=${this._blob}
        .frameUrl=${this.frameUrl}
        .title=${this.model.props.name}
        ?thumbnail=${!this.embed}
        ?interactive=${this._interactive || this._fullscreen}
      ></labre-html-frame>
      ${this.embed ? this._renderControls() : nothing}`;
  }

  @state()
  private accessor _blob: Blob | null = null;

  @state()
  private accessor _fullscreen = false;

  @state()
  private accessor _interactive = false;

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
