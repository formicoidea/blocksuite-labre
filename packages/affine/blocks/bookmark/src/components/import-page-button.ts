import { LoadingIcon } from '@labre/affine-components/icons';
import type { BookmarkBlockModel } from '@labre/affine-model';
import {
  type ToolbarContext,
  translateKey,
} from '@labre/affine-shared/services';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { ShadowlessElement } from '@labre/std';
import { DownloadIcon } from '@blocksuite/icons/lit';
import { css, html } from 'lit';
import { property } from 'lit/decorators.js';

import { importPage, isImportingPage } from '../import-page';
import { BOOKMARK_IMPORT_PAGE } from '../translations';

export const BOOKMARK_IMPORT_BUTTON_TAG = 'affine-bookmark-import-button';

/** The card's import button. Disabled with a spinner while the host reads the page,
 *  and only reachable when the host provides the import (`canImportPage`). */
export class BookmarkImportButton extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  // On a phone the words would push the rest of the row off the screen; the icon
  // keeps its accessible name.
  static override styles = css`
    @media (max-width: 480px) {
      affine-bookmark-import-button .label {
        display: none;
      }
    }
  `;

  private readonly _onClick = async () => {
    const { ctx, model } = this;
    try {
      const id = await importPage(ctx.std, model);
      if (!id) return;
      ctx.track('SelectedView', {
        category: 'bookmark',
        type: 'embed view',
        control: 'import page',
      });
    } catch (error) {
      console.error(error);
    }
  };

  override render() {
    const importing = isImportingPage(this.model).value;
    const label = translateKey(this.ctx.std, ...BOOKMARK_IMPORT_PAGE);
    return html`<editor-icon-button
      aria-label=${label}
      data-testid="bookmark-import-page"
      .disabled=${importing}
      .showTooltip=${false}
      @click=${this._onClick}
    >
      ${importing
        ? LoadingIcon({ size: '20px' })
        : DownloadIcon({ width: '20px', height: '20px' })}
      <span class="label">${label}</span>
    </editor-icon-button>`;
  }

  @property({ attribute: false })
  accessor ctx!: ToolbarContext;

  @property({ attribute: false })
  accessor model!: BookmarkBlockModel;
}

declare global {
  interface HTMLElementTagNameMap {
    [BOOKMARK_IMPORT_BUTTON_TAG]: BookmarkImportButton;
  }
}
