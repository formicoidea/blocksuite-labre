import { QuickToolMixin } from '@labre/affine-widget-edgeless-toolbar';
import { UndoIcon } from '@blocksuite/icons/lit';
import { css, html, LitElement } from 'lit';

/**
 * Edgeless quick-tool "undo" button. It took over the slot of the former link
 * quick tool (see `undo-tool.ts`). It is an action, not a tool mode, so `type`
 * is empty (the button never renders as "active").
 *
 * ponytail: always clickable; the click is a no-op when there is nothing to
 * undo. A reactive disabled state would need the history `canUndo$` signal,
 * which `Store` does not expose today — not worth wiring for this button.
 */
export class EdgelessUndoToolButton extends QuickToolMixin(LitElement) {
  static override styles = css`
    .undo-icon,
    .undo-icon > svg {
      width: 24px;
      height: 24px;
    }
  `;

  override type = [];

  private _onClick() {
    const { store } = this.edgeless;
    if (store.canUndo) store.undo();
  }

  override render() {
    return html`<edgeless-tool-icon-button
      .iconContainerPadding="${6}"
      .tooltip="${'Undo'}"
      .tooltipOffset=${17}
      class="edgeless-undo-tool-button"
      @click=${this._onClick}
    >
      <span class="undo-icon">${UndoIcon()}</span>
    </edgeless-tool-icon-button>`;
  }
}
