import { css, html, LitElement, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { styleMap } from 'lit/directives/style-map.js';

export type HtmlFrameContent = string | Blob;

export const HTML_FRAME_TAG = 'labre-html-frame';

/** What the host's page posts to its parent when it can take the html (ADR 0047). */
export const HTML_FRAME_READY = 'labre:embed-html-ready';

/**
 * Sandbox of the page a host names (ADR 0047). That page is the host's own code
 * and holds no block content, it hands the html to a frame it isolates itself.
 * It must keep its origin: with `allow-scripts` alone it turns opaque, and a
 * frame whose response says `frame-ancestors 'self'` refuses to load in it
 * (measured in Chromium, Firefox and WebKit).
 */
export const HOST_PAGE_SANDBOX = 'allow-same-origin allow-scripts';

/**
 * Sandbox granted to an arbitrary url: the generic provider, or no provider at
 * all. Without `allow-same-origin` the frame runs on an opaque origin.
 */
export const UNTRUSTED_SANDBOX = 'allow-scripts';

/** The width a thumbnail lays its page out at, before it is scaled down. */
const THUMBNAIL_LAYOUT_WIDTH = 1280;
const THUMBNAIL_ROOT_MARGIN = '200px';

/**
 * Only a page the host serves. A `blob:` url has the origin of the app, the
 * origin of the reader's tokens; `data:` and `javascript:` have no place here.
 */
function hostPage(frameUrl: string | null | undefined) {
  if (!frameUrl) return null;
  try {
    const { protocol } = new URL(frameUrl, location.href);
    return protocol === 'https:' || protocol === 'http:' ? frameUrl : null;
  } catch {
    return null;
  }
}

/**
 * Runs html in a frame. The one place the library does: the html attachment and a
 * host's own library mount this (ADR 0048). No object, no right, no quota here: it
 * takes what to show and how.
 *
 * It loads `frameUrl`, waits for that page to announce itself and answers with
 * `{ html, scripts, scroll }`, to that window and no other. Without a page, nothing
 * renders: a `srcdoc` would inherit the host's Content-Security-Policy.
 *
 * No script of the html runs without a reader's gesture: `scripts` is off unless
 * the host turns it on, and a thumbnail never has it (ADR 0048).
 */
export class HtmlFrame extends LitElement {
  static override styles = css`
    :host {
      display: block;
      position: relative;
      width: 100%;
      height: 100%;
      overflow: hidden;
    }

    iframe {
      display: block;
      width: 100%;
      height: 100%;
      border: none;
    }

    iframe[inert] {
      pointer-events: none;
    }
  `;

  private _awaitingText = false;

  private _resizeObserver: ResizeObserver | null = null;

  private _visibilityObserver: IntersectionObserver | null = null;

  private _writtenText: string | null = null;

  private readonly _answerFrame = (event: MessageEvent) => {
    const frame = this.iframe?.contentWindow;
    if (!frame || event.source !== frame) return;
    if (event.data?.type !== HTML_FRAME_READY) return;
    if (this._text === null) {
      this._awaitingText = true;
      return;
    }
    // A closed document cannot ask, only a refresh to the page can: answering
    // again would reload it forever. It stays empty instead.
    if (!this._runsScripts && this._writtenText === this._text) return;
    this._post(frame, this._text);
  };

  private get _inert() {
    return !this.interactive || this.thumbnail;
  }

  private get _runsScripts() {
    return this.scripts && !this.thumbnail;
  }

  private get _thumbnailStyle() {
    if (!this.thumbnail) return nothing;
    const scale = this._width / THUMBNAIL_LAYOUT_WIDTH;
    return styleMap({
      width: `${THUMBNAIL_LAYOUT_WIDTH}px`,
      height: `${this._height / scale}px`,
      transform: `scale(${scale})`,
      transformOrigin: '0 0',
    });
  }

  private _post(frame: Window, text: string) {
    this._writtenText = text;
    // '*' because the host's page is the host's business, and may be opaque. A
    // script of the block that gets a window here only ever gets its own html.
    frame.postMessage(
      {
        html: text,
        scripts: this._runsScripts,
        // The page decides for the frame it holds: a thumbnail never scrolls.
        scroll: !this.thumbnail,
      },
      '*'
    );
  }

  private async _read(blob: Blob) {
    this._text = null;
    try {
      const text = await blob.text();
      if (this.html !== blob) return;
      this._text = text;
      const frame = this.iframe?.contentWindow;
      if (this._awaitingText && frame) {
        this._awaitingText = false;
        this._post(frame, text);
      }
    } catch (error) {
      console.error(error);
    }
  }

  private _stopWatchingThumbnail() {
    this._resizeObserver?.disconnect();
    this._resizeObserver = null;
    this._visibilityObserver?.disconnect();
    this._visibilityObserver = null;
  }

  private _watchThumbnail() {
    if (!this.thumbnail) {
      this._stopWatchingThumbnail();
      return;
    }
    if (this._resizeObserver) return;

    const measure = () => {
      this._width = this.clientWidth;
      this._height = this.clientHeight;
    };
    measure();
    this._resizeObserver = new ResizeObserver(measure);
    this._resizeObserver.observe(this);

    if (this._seen) return;
    this._visibilityObserver = new IntersectionObserver(
      entries => {
        if (!entries.some(entry => entry.isIntersecting)) return;
        this._seen = true;
        this._visibilityObserver?.disconnect();
        this._visibilityObserver = null;
      },
      { rootMargin: THUMBNAIL_ROOT_MARGIN }
    );
    this._visibilityObserver.observe(this);
  }

  override connectedCallback() {
    super.connectedCallback();
    window.addEventListener('message', this._answerFrame);
    // A frame moved in the DOM loads again, and asks again.
    this._writtenText = null;
    if (this.hasUpdated) this._watchThumbnail();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    window.removeEventListener('message', this._answerFrame);
    this._stopWatchingThumbnail();
  }

  override render() {
    if (this.html === null) return nothing;

    const page = hostPage(this.frameUrl);
    if (!page) return nothing;
    if (this.thumbnail && !(this._seen && this._width && this._height)) {
      return nothing;
    }

    // Keyed: what a document may run is fixed when it loads, so a change of mind
    // takes a new frame. A sandbox attribute alone only applies on navigation.
    return keyed(
      this._runsScripts,
      html`<iframe
        sandbox=${HOST_PAGE_SANDBOX}
        scrolling=${this.thumbnail ? 'no' : nothing}
        src=${page}
        loading="lazy"
        title=${this.title || nothing}
        tabindex=${this._inert ? -1 : nothing}
        style=${this._thumbnailStyle}
        ?inert=${this._inert}
      ></iframe>`
    );
  }

  protected override updated(changed: PropertyValues) {
    if (changed.has('thumbnail')) this._watchThumbnail();

    // The page wrote its document once and for all: new html needs a new one.
    const page = hostPage(this.frameUrl);
    if (
      page &&
      this.iframe &&
      this._text !== null &&
      this._writtenText !== null &&
      this._writtenText !== this._text
    ) {
      this._writtenText = null;
      this.iframe.src = page;
    }
  }

  protected override willUpdate(changed: PropertyValues) {
    if (changed.has('frameUrl') || changed.has('scripts')) {
      this._writtenText = null;
    }
    if (!changed.has('html')) return;
    if (typeof this.html === 'string' || this.html === null) {
      this._text = this.html;
      return;
    }
    void this._read(this.html);
  }

  @state()
  private accessor _height = 0;

  /** A thumbnail's frame exists only once it has been in view, and stays. */
  @state()
  private accessor _seen = false;

  @state()
  private accessor _text: string | null = null;

  @state()
  private accessor _width = 0;

  /** The html to run. A `Blob` is read as text: it never becomes a url. */
  @property({ attribute: false })
  accessor html: HtmlFrameContent | null = null;

  /** The page the host serves to run the html (ADR 0047). Not http(s): ignored. */
  @property({ attribute: 'frame-url' })
  accessor frameUrl: string | null = null;

  /** The frame takes pointers and focus. Off by default; a thumbnail never does. */
  @property({ type: Boolean })
  accessor interactive = false;

  @query('iframe')
  accessor iframe: HTMLIFrameElement | null = null;

  /**
   * The html's scripts may run. Off by default, and only a reader's gesture may
   * turn it on: a file or a block can be written without going through any screen,
   * and a page it freezes would freeze for everyone who opens it. A thumbnail never
   * runs them.
   */
  @property({ type: Boolean })
  accessor scripts = false;

  /**
   * A real preview, laid out at 1280 px and scaled to the box, mounted only once
   * it has been in view. No capture is stored and no server renders it.
   */
  @property({ type: Boolean })
  accessor thumbnail = false;
}

/** Safe to call more than once: the editor and a host may both call it. */
export function registerHtmlFrame() {
  if (customElements.get(HTML_FRAME_TAG)) return;
  customElements.define(HTML_FRAME_TAG, HtmlFrame);
}

declare global {
  interface HTMLElementTagNameMap {
    'labre-html-frame': HtmlFrame;
  }
}
