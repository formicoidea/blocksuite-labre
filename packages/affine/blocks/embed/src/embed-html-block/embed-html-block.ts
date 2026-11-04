import type { EmbedHtmlModel, EmbedHtmlStyles } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { BlockSelection } from '@labre/std';
import { html, type PropertyValues } from 'lit';
import { query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { type StyleInfo, styleMap } from 'lit/directives/style-map.js';

import { EmbedBlockComponent } from '../common/embed-block-element.js';
import { HOST_PAGE_SANDBOX } from '../common/iframe-sandbox.js';
import { EMBED_HTML_EMPTY } from '../translations.js';
import { EmbedHtmlConfigExtension } from './embed-html-config.js';
import { HtmlIcon, styles } from './styles.js';

const FRAME_READY = 'labre:embed-html-ready';

export class EmbedHtmlBlockComponent extends EmbedBlockComponent<EmbedHtmlModel> {
  static override styles = styles;

  override _cardStyle: (typeof EmbedHtmlStyles)[number] = 'html';

  close = () => {
    document.exitFullscreen().catch(console.error);
  };

  protected embedHtmlStyle: StyleInfo = {};

  open = () => {
    this.iframeWrapper?.requestFullscreen().catch(console.error);
  };

  refreshData = () => {};

  private _writtenHtml: string | null = null;

  private readonly _answerFrame = (event: MessageEvent) => {
    const frame = this.iframe?.contentWindow;
    if (!frame || event.source !== frame) return;
    if (event.data?.type !== FRAME_READY) return;
    this._writtenHtml = this._htmlSrc;
    // '*' because the host's page is the host's business, and may be opaque. A
    // script of the block that gets a window here only ever gets its own html.
    frame.postMessage({ html: this._writtenHtml }, '*');
  };

  private get _frameUrl() {
    return this.std.getOptional(EmbedHtmlConfigExtension.identifier)?.frameUrl;
  }

  private get _htmlSrc() {
    return `
      <style>
        body {
          margin: 0;
        }
      </style>
      ${this.model.props.html}
    `;
  }

  private _handleDoubleClick(event: MouseEvent) {
    event.stopPropagation();
    this.open();
  }

  private _selectBlock() {
    const selectionManager = this.host.selection;
    const blockSelection = selectionManager.create(BlockSelection, {
      blockId: this.blockId,
    });
    selectionManager.setGroup('note', [blockSelection]);
  }

  protected _handleClick(event: MouseEvent) {
    event.stopPropagation();
    this._selectBlock();
  }

  override connectedCallback() {
    super.connectedCallback();
    this._cardStyle = this.model.props.style;
    if (this._frameUrl) {
      this.disposables.addFromEvent(window, 'message', this._answerFrame);
    }
  }

  protected override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    // The frame wrote its document once and for all: new html needs a new one.
    const frameUrl = this._frameUrl;
    if (
      frameUrl &&
      this.iframe &&
      this._writtenHtml !== null &&
      this._writtenHtml !== this._htmlSrc
    ) {
      this._writtenHtml = null;
      this.iframe.src = frameUrl;
    }
  }

  override renderBlock(): unknown {
    const titleText = 'Basic HTML Page Structure';
    const frameUrl = this._frameUrl;

    return this.renderEmbed(() => {
      if (!this.model.props.html) {
        return html`
          <div class="affine-html-empty">
            ${translateKey(this.std, ...EMBED_HTML_EMPTY)}
          </div>
        `;
      }
      return html`
        <div
          class=${classMap({
            'affine-embed-html-block': true,
            selected: this.selected$.value,
          })}
          style=${styleMap(this.embedHtmlStyle)}
          @click=${this._handleClick}
          @dblclick=${this._handleDoubleClick}
        >
          <div class="affine-embed-html">
            <div class="affine-embed-html-iframe-container">
              <div class="embed-html-block-iframe-wrapper" allowfullscreen>
                ${frameUrl
                  ? html`<iframe
                      class="embed-html-block-iframe"
                      sandbox=${HOST_PAGE_SANDBOX}
                      scrolling="no"
                      src=${frameUrl}
                      loading="lazy"
                    ></iframe>`
                  : html`<iframe
                      class="embed-html-block-iframe"
                      sandbox="allow-scripts"
                      scrolling="no"
                      .srcdoc=${this._htmlSrc}
                      loading="lazy"
                    ></iframe>`}
                <embed-html-fullscreen-toolbar
                  .embedHtml=${this}
                ></embed-html-fullscreen-toolbar>
              </div>

              <!-- overlay to prevent the iframe from capturing pointer events -->
              <div
                class=${classMap({
                  'affine-embed-html-iframe-overlay': true,
                  hide: !this.showOverlay$.value,
                })}
              ></div>
            </div>
          </div>

          <div class="affine-embed-html-title">
            <div class="affine-embed-html-title-icon">${HtmlIcon}</div>

            <div class="affine-embed-html-title-text">${titleText}</div>
          </div>
        </div>
      `;
    });
  }

  @query('.embed-html-block-iframe')
  accessor iframe: HTMLIFrameElement | null = null;

  @query('.embed-html-block-iframe-wrapper')
  accessor iframeWrapper!: HTMLDivElement;
}
