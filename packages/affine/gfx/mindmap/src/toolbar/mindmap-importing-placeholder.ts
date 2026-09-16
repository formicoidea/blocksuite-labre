import { LoadingIcon } from '@labre/affine-components/icons';
import { translateKey } from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import type { BlockStdScope } from '@labre/std';
import { ShadowlessElement } from '@labre/std';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

import { MINDMAP_IMPORTING_PLACEHOLDER } from '../translations.js';
import { importMindMapIcon } from './icons.js';

export class MindMapPlaceholder extends ShadowlessElement {
  /** Set by the caller that has one (`mindmap-menu.ts`) — optional so this
   * element still renders (in English) when created with none. */
  @property({ attribute: false })
  accessor std: BlockStdScope | undefined = undefined;
  static override styles = css`
    mindmap-import-placeholder {
      display: flex;
      flex-direction: column;

      padding: 28px 12px 12px;
      box-sizing: border-box;
      width: 200px;
      height: 122px;

      border-radius: 12px;
      gap: 12px;

      background-color: ${unsafeCSSVarV2('layer/background/secondary')};
      border: 1px solid ${unsafeCSSVarV2('layer/insideBorder/border')};
      color: ${unsafeCSSVarV2('text/placeholder')};

      box-shadow: 0px 0px 4px 0px rgba(66, 65, 73, 0.14);
    }

    mindmap-import-placeholder .preview-icon {
      text-align: center;
    }

    mindmap-import-placeholder .description {
      display: flex;
      gap: 8px;

      color: ${unsafeCSSVarV2('text/placeholder')};
      font-size: 14px;
      line-height: 22px;

      align-items: center;
    }
  `;

  override render() {
    return html`<div class="placeholder-container">
      <div class="preview-icon">${importMindMapIcon}</div>
      <div class="description">
        ${LoadingIcon()}
        <span
          >${this.std
            ? translateKey(this.std, ...MINDMAP_IMPORTING_PLACEHOLDER)
            : MINDMAP_IMPORTING_PLACEHOLDER[1]}</span
        >
      </div>
    </div>`;
  }
}
