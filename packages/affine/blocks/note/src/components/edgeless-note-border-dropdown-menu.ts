import { EditorChevronDown } from '@labre/affine-components/toolbar';
import { LineWidth, type StrokeStyle } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { LineStyleIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { ShadowlessElement } from '@labre/std';
import { html } from 'lit';
import { property } from 'lit/decorators.js';

import { NOTE_BORDER_STYLE_LABEL } from '../translations.js';

export class EdgelessNoteBorderDropdownMenu extends ShadowlessElement {
  override render() {
    const { lineSize, lineStyle, std } = this;
    const label = std
      ? translateKey(std, ...NOTE_BORDER_STYLE_LABEL)
      : NOTE_BORDER_STYLE_LABEL[1];

    return html`
      <editor-menu-button
        .button=${html`
          <editor-icon-button aria-label=${label} .tooltip="${label}">
            ${LineStyleIcon()} ${EditorChevronDown}
          </editor-icon-button>
        `}
      >
        <edgeless-line-styles-panel
          .lineSize=${lineSize}
          .lineStyle=${lineStyle}
        ></edgeless-line-styles-panel>
      </editor-menu-button>
    `;
  }

  @property({ attribute: false })
  accessor lineStyle!: StrokeStyle;

  @property({ attribute: false })
  accessor lineSize: LineWidth = LineWidth.Two;

  /**
   * Optional: this component is registered but currently has no renderer in
   * this repo that instantiates it, so there is no call site to thread `std`
   * from yet. When one appears, passing `.std=${ctx.std}` translates the
   * label; without it, the English fallback keeps showing, same as before
   * this wording existed.
   */
  @property({ attribute: false })
  accessor std: BlockStdScope | undefined = undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-note-border-dropdown-menu': EdgelessNoteBorderDropdownMenu;
  }
}
