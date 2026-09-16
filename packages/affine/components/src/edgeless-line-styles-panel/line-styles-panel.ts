import { LineWidth, StrokeStyle } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { WithDisposable } from '@labre/global/lit';
import { BanIcon, DashLineIcon, StraightLineIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, html, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { repeat } from 'lit/directives/repeat.js';

import {
  LINE_STYLE_DASH,
  LINE_STYLE_NONE,
  LINE_STYLE_SOLID,
} from '../translations.js';

export type LineDetailType =
  | {
      type: 'size';
      value: LineWidth;
    }
  | {
      type: 'style';
      value: StrokeStyle;
    };

const LINE_STYLE_LIST = [
  {
    key: 'Solid',
    value: StrokeStyle.Solid,
    icon: StraightLineIcon(),
  },
  {
    key: 'Dash',
    value: StrokeStyle.Dash,
    icon: DashLineIcon(),
  },
  {
    key: 'None',
    value: StrokeStyle.None,
    icon: BanIcon(),
  },
];

const LINE_STYLE_WORDINGS: Readonly<Record<string, readonly [string, string]>> =
  {
    Solid: LINE_STYLE_SOLID,
    Dash: LINE_STYLE_DASH,
    None: LINE_STYLE_NONE,
  };

export class EdgelessLineStylesPanel extends WithDisposable(LitElement) {
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  static override styles = css`
    edgeless-line-width-panel {
      flex: 1;
    }
  `;

  select(detail: LineDetailType) {
    this.dispatchEvent(
      new CustomEvent('select', {
        detail,
        bubbles: true,
        composed: true,
        cancelable: true,
      })
    );
  }

  override render() {
    const { lineSize, lineStyle, lineStyles } = this;
    return html`
      <edgeless-line-width-panel
        .disabled=${lineStyle === StrokeStyle.None}
        .selectedSize=${lineSize}
        @select=${(e: CustomEvent<LineWidth>) => {
          e.stopPropagation();
          this.select({ type: 'size', value: e.detail });
        }}
      ></edgeless-line-width-panel>

      <editor-toolbar-separator></editor-toolbar-separator>

      ${repeat(
        LINE_STYLE_LIST.filter(item => lineStyles.includes(item.value)),
        item => item.value,
        ({ key, icon, value }) => {
          const active = lineStyle === value;
          const classInfo = {
            'line-style-button': true,
            [`mode-${value}`]: true,
          };
          if (active) classInfo['active'] = true;

          return html`
            <editor-icon-button
              class=${classMap(classInfo)}
              .tooltip="${this.std
                ? translateKey(this.std, ...LINE_STYLE_WORDINGS[key])
                : LINE_STYLE_WORDINGS[key][1]}"
              .withHover=${active}
              @click=${() => this.select({ type: 'style', value })}
            >
              ${icon}
            </editor-icon-button>
          `;
        }
      )}
    `;
  }

  @property({ attribute: false })
  accessor lineStyle!: StrokeStyle;

  @property({ attribute: false })
  accessor lineSize: LineWidth = LineWidth.Two;

  @property({ attribute: false })
  accessor lineStyles: StrokeStyle[] = [
    StrokeStyle.Solid,
    StrokeStyle.Dash,
    StrokeStyle.None,
  ];
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-line-styles-panel': EdgelessLineStylesPanel;
  }
}
