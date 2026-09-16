import { ShapeStyle } from '@labre/affine-model';
import {
  STYLE_GENERAL,
  STYLE_SCRIBBLED,
  translateKey,
} from '@labre/affine-shared/services';
import { StyleGeneralIcon, StyleScribbleIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

const SHAPE_STYLE_LIST = [
  {
    value: ShapeStyle.General,
    icon: StyleGeneralIcon(),
    wording: STYLE_GENERAL,
  },
  {
    value: ShapeStyle.Scribbled,
    icon: StyleScribbleIcon(),
    wording: STYLE_SCRIBBLED,
  },
];

export class EdgelessShapeStylePanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
  `;

  private _onSelect(value: ShapeStyle) {
    this.value = value;
    if (this.onSelect) {
      this.onSelect(value);
    }
  }

  override render() {
    return repeat(
      SHAPE_STYLE_LIST,
      item => item.value,
      ({ value, icon, wording }) => {
        const label = this.std
          ? translateKey(this.std, ...wording)
          : wording[1];
        return html`<edgeless-tool-icon-button
          .tipPosition=${'top'}
          .activeMode=${'background'}
          aria-label=${label}
          .tooltip=${label}
          .active=${this.value === value}
          .iconSize=${'20px'}
          @click=${() => this._onSelect(value)}
        >
          ${icon}
        </edgeless-tool-icon-button>`;
      }
    );
  }

  @property({ attribute: false })
  accessor onSelect: undefined | ((value: ShapeStyle) => void) = undefined;

  @property({ attribute: false })
  accessor value!: ShapeStyle;

  /** Set by a caller that has one — optional so this panel still renders (in
   * English) when created with none, as it is today. */
  @property({ attribute: false })
  accessor std: BlockStdScope | undefined = undefined;
}
