import { SignalWatcher } from '@labre/global/lit';
import { ContextConsumer } from '@lit/context';
import type { ReadonlySignal } from '@preact/signals-core';
import { css, html, LitElement, nothing, unsafeCSS } from 'lit';
import { property } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';

import { stdContext } from '../../view/element/lit-host.js';
import {
  INLINE_ROOT_ATTR,
  SHOW_INVISIBLES_ATTR,
  ZERO_WIDTH_FOR_EMPTY_LINE,
} from '../consts.js';
import type { InlineRootElement } from '../inline-editor.js';
import {
  type InvisibleCharacterKind,
  InvisibleCharactersDisplayIdentifier,
  segmentInvisibleCharacters,
} from '../utils/invisible-characters.js';

const textStyle = styleMap({
  'word-break': 'break-word',
  'text-wrap': 'wrap',
  'white-space-collapse': 'break-spaces',
});

/**
 * The marks of "show special characters". Each mark is drawn by an
 * absolutely positioned `::before` over a span that still holds the original
 * character: the layout, the offsets, a copy and the IME see the text as it is.
 * Line ends are drawn per `v-line` from the attribute the editor sets on its
 * host, so they need no element of their own. Colours are theme tokens.
 */
const invisiblesStyles = css`
  [data-v-invisible] {
    position: relative;
  }
  [data-v-invisible]::before {
    position: absolute;
    left: 0;
    right: 0;
    text-align: center;
    pointer-events: none;
    user-select: none;
    color: var(--affine-text-disable-color, currentColor);
    font-weight: normal;
    font-style: normal;
  }
  [data-v-invisible='space']::before {
    content: '·';
  }
  [data-v-invisible='tab']::before {
    content: '→';
  }
  [data-v-invisible='nbsp']::before {
    content: '°';
  }
  [data-v-invisible='invisible']::before {
    content: '';
    left: -1px;
    right: auto;
    top: 10%;
    bottom: 10%;
    border-left: 2px solid var(--affine-error-color, currentColor);
  }
  [${unsafeCSS(SHOW_INVISIBLES_ATTR)}] v-line::after {
    position: absolute;
    pointer-events: none;
    user-select: none;
    color: var(--affine-text-disable-color, currentColor);
  }
  [${unsafeCSS(SHOW_INVISIBLES_ATTR)}] v-line:not(:last-of-type)::after {
    content: '↵';
  }
  [${unsafeCSS(SHOW_INVISIBLES_ATTR)}] v-line:last-of-type::after {
    content: '¶';
  }
`;

/**
 * One `[data-v-text]` span holding one text node. We need to avoid 

 * appearing before and after the span element, which will cause the sync
 * problem about the cursor position.
 */
function renderRun(
  text: string,
  kind: InvisibleCharacterKind | undefined,
  empty = false
) {
  return html`<span
    style=${textStyle}
    data-v-text="true"
    data-v-empty=${empty ? 'true' : nothing}
    data-v-invisible=${kind ?? nothing}
    >${text}</span
  >`;
}

const styledRoots = new WeakSet<Document | ShadowRoot>();

/**
 * Adopt the marks' stylesheet once per document or shadow root, the first
 * time a mark is rendered there: `v-text` renders in light DOM, so a static
 * `styles` would never apply.
 */
function adoptInvisiblesStyles(node: Node) {
  const root = node.getRootNode();
  if (!(root instanceof Document || root instanceof ShadowRoot)) return;
  if (styledRoots.has(root)) return;
  const sheet = invisiblesStyles.styleSheet;
  if (!sheet) return;
  styledRoots.add(root);
  root.adoptedStyleSheets = [...root.adoptedStyleSheets, sheet];
}

export class VText extends SignalWatcher(LitElement) {
  // Resolved once, on connect: the editor host provides `std`, and `std` the
  // viewer's choice. Outside a host (the document title, a standalone inline
  // editor) there is none, and nothing is ever marked.
  private readonly _std = new ContextConsumer(this, { context: stdContext });

  private _showInvisibles$: ReadonlySignal<boolean> | null = null;

  override createRenderRoot() {
    return this;
  }

  override connectedCallback() {
    super.connectedCallback();
    this._showInvisibles$ =
      this._std.value?.getOptional(InvisibleCharactersDisplayIdentifier)
        ?.showInvisibles$ ?? null;
  }

  private _segments() {
    if (!this._showInvisibles$?.value || this.empty) return null;
    // An embed's placeholder is one character of the model drawn as
    // something else: never a mark on it.
    if (this.closest('[data-v-embed="true"]')) return null;
    // Re-cutting the text under an IME composition would tear the
    // composition apart: the plain run stays until the next render.
    const root = this.closest<InlineRootElement>(`[${INLINE_ROOT_ATTR}]`);
    if (root?.inlineEditor?.isComposing) return null;
    return segmentInvisibleCharacters(this.str);
  }

  override render() {
    const segments = this._segments();
    if (!segments) return renderRun(this.str, undefined, this.empty);
    adoptInvisiblesStyles(this);
    // Several `[data-v-text]` spans, one text node each: offsets add the
    // text nodes of every span (`getTextNodesFromElement`), so the caret and
    // the selection map exactly as for one span.
    return segments.map(segment => renderRun(segment.text, segment.kind));
  }

  /**
   * A placeholder, not text of the model: the zero-width character an empty
   * line or an embed gap renders so the caret has somewhere to go. Counted as
   * length 0 by the offsets (`calculateTextLength`), whatever its content —
   * a zero-width space the USER stored is text and keeps its length.
   */
  @property({ type: Boolean })
  accessor empty = false;

  @property({ attribute: false })
  accessor str: string = ZERO_WIDTH_FOR_EMPTY_LINE;
}

declare global {
  interface HTMLElementTagNameMap {
    'v-text': VText;
  }
}
