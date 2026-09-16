import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { PropTypes, requiredProperties, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { css, LitElement } from 'lit';
import { property } from 'lit/decorators.js';
import { html } from 'lit-html';

import { DOC_TITLE_ARIA } from '../translations.js';

@requiredProperties({
  title: PropTypes.string,
  open: PropTypes.instanceOf(Function),
})
export class DocTitle extends LitElement {
  @consume({ context: stdContext })
  accessor std!: BlockStdScope;

  static override styles = css`
    editor-icon-button .label {
      min-width: 60px;
      max-width: 140px;
      display: inline-block;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
      user-select: none;
      cursor: pointer;
      color: var(--affine-link-color);
      font-feature-settings:
        'clig' off,
        'liga' off;
      font-family: var(--affine-font-family);
      font-size: var(--affine-font-sm);
      font-style: normal;
      font-weight: 400;
      text-decoration: none;
      text-wrap: nowrap;
    }
  `;

  @property({ attribute: false })
  override accessor title!: string;

  @property({ attribute: false })
  accessor open!: (event: MouseEvent) => void;

  override render() {
    const { title, open } = this;

    return html`
      <editor-icon-button
        aria-label="${this.std
          ? translateKey(this.std, ...DOC_TITLE_ARIA)
          : DOC_TITLE_ARIA[1]}"
        .hover=${false}
        .labelHeight="${'20px'}"
        .tooltip=${title}
        @click=${(event: MouseEvent) => open(event)}
      >
        <span class="label">${title}</span>
      </editor-icon-button>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'affine-linked-doc-title': DocTitle;
  }
}
