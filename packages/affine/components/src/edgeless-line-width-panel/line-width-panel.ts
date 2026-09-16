import { BRUSH_LINE_WIDTHS, LineWidth } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { WithDisposable } from '@labre/global/lit';
import type { BlockStdScope } from '@labre/std';
import { stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';

import type { SliderSelectEvent } from '../slider';
import { LINE_WIDTH_THICKNESS } from '../translations.js';

export class EdgelessLineWidthPanel extends WithDisposable(LitElement) {
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  private _onSelect(lineWidth: number) {
    this.dispatchEvent(
      new CustomEvent('select', {
        detail: lineWidth,
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
  }

  override render() {
    return html`<affine-slider
      ?disabled=${this.disabled}
      .range=${{ points: this.lineWidths }}
      .value=${this.selectedSize}
      .tooltip=${this.hasTooltip
        ? this.std
          ? translateKey(this.std, ...LINE_WIDTH_THICKNESS)
          : LINE_WIDTH_THICKNESS[1]
        : undefined}
      @select=${(e: SliderSelectEvent) => {
        e.stopPropagation();
        this._onSelect(e.detail.value);
      }}
    ></affine-slider>`;
  }

  @property({ attribute: false })
  accessor disabled = false;

  @property({ attribute: false })
  accessor hasTooltip = true;

  @property({ attribute: false })
  accessor lineWidths: number[] = BRUSH_LINE_WIDTHS;

  @property({ attribute: false })
  accessor selectedSize: number = LineWidth.Two;
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-line-width-panel': EdgelessLineWidthPanel;
  }
}
