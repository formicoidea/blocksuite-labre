import { panelBaseStyle } from '@labre/affine-shared/styles';
import { stopPropagation } from '@labre/affine-shared/utils';
import { WithDisposable } from '@labre/global/lit';
import { css, html, LitElement } from 'lit';

export class EditorToolbar extends WithDisposable(LitElement) {
  static override styles = css`
    ${panelBaseStyle(':host')}
    :host {
      min-height: 36px;
      box-sizing: content-box;
      /* ponytail: wrap to a second row instead of overflowing on mobile. The
         width is capped to availableWidth by floating-ui's size middleware;
         wrapping (not scrolling) keeps the "More" dropdown clickable — it is a
         descendant of this toolbar, so an overflow container would clip it. */
      flex-wrap: wrap;
      row-gap: 4px;
    }

    :host([data-without-bg]) {
      border-color: transparent;
      background: transparent;
      box-shadow: none;
    }

    ::slotted(*) {
      display: flex;
      /* fixed row height (not 100%) so each item stays one row tall when the
         toolbar wraps to multiple rows */
      height: 36px;
      justify-content: center;
      align-items: center;
      gap: 8px;
      color: var(--affine-text-primary-color);
      fill: currentColor;
    }
  `;

  override connectedCallback() {
    super.connectedCallback();

    this._disposables.addFromEvent(this, 'pointerdown', (e: PointerEvent) => {
      e.stopPropagation();
      e.preventDefault();
    });
    this._disposables.addFromEvent(this, 'wheel', stopPropagation, {
      passive: false,
    });
  }

  override render() {
    return html`<slot></slot>`;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'editor-toolbar': EditorToolbar;
  }
}
