import { panelBaseStyle } from '@labre/affine-shared/styles';
import { stopPropagation } from '@labre/affine-shared/utils';
import { WithDisposable } from '@labre/global/lit';
import { css, html, LitElement } from 'lit';

export class EditorToolbar extends WithDisposable(LitElement) {
  static override styles = css`
    ${panelBaseStyle(':host')}
    :host {
      /* ONE line, always: the toolbar's height never depends on the selection,
         so it never moves under the cursor. When the row runs out of room the
         widget spends its entries — icon only first, then into the "⋮" menu —
         rather than growing a second row (PO arbitration of 02/08/2026). */
      height: 36px;
      box-sizing: content-box;
      flex-wrap: nowrap;
    }

    :host([data-without-bg]) {
      border-color: transparent;
      background: transparent;
      box-shadow: none;
    }

    ::slotted(*) {
      display: flex;
      height: 100%;
      /* Entries keep their natural width: squashing them into the row would
         hide the overflow the widget has to measure, and a button squeezed to
         half a word is worse than the same button in the "⋮" menu. */
      flex-shrink: 0;
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
