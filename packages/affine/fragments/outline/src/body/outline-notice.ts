import { NoteDisplayMode } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { CloseIcon, SortIcon } from '@blocksuite/icons/lit';
import { ShadowlessElement } from '@labre/std';
import { consume } from '@lit/context';
import { effect, signal } from '@preact/signals-core';
import { html, nothing } from 'lit';

import { type TocContext, tocContext } from '../config';
import {
  OUTLINE_NOTICE_HIDDEN_LABEL,
  OUTLINE_NOTICE_HIDDEN_TEXT,
  OUTLINE_NOTICE_ORGANIZE,
} from '../translations';
import { getNotesFromStore } from '../utils/query';
import * as styles from './outline-notice.css';

export const AFFINE_OUTLINE_NOTICE = 'affine-outline-notice';

export class OutlineNotice extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  private readonly _visible$ = signal(false);

  override connectedCallback(): void {
    super.connectedCallback();
    this.disposables.add(
      effect(() => {
        const enableSorting = this._context.enableSorting$.value;

        if (enableSorting) {
          if (this._visible$.peek()) {
            this._visible$.value = false;
          }
          return;
        }

        const shouldShowNotice =
          getNotesFromStore(this._context.editor$.value.store, [
            NoteDisplayMode.DocOnly,
          ]).length > 0;

        if (shouldShowNotice && !this._visible$.peek()) {
          this._visible$.value = true;
        }
      })
    );
  }

  override render() {
    if (!this._visible$.value) {
      return nothing;
    }

    const std = this._context.editor$.value.std;

    return html`
      <div data-testid=${AFFINE_OUTLINE_NOTICE} class=${styles.outlineNotice}>
        <div class=${styles.outlineNoticeHeader}>
          <span class=${styles.outlineNoticeLabel}
            >${translateKey(std, ...OUTLINE_NOTICE_HIDDEN_LABEL)}</span
          >
          <span
            data-testid="outline-notice-close-button"
            class=${styles.outlineNoticeCloseButton}
            @click=${() => {
              this._visible$.value = false;
            }}
            >${CloseIcon({ width: '16px', height: '16px' })}</span
          >
        </div>
        <div class=${styles.outlineNoticeBody}>
          <div class="${styles.notice}">
            ${translateKey(std, ...OUTLINE_NOTICE_HIDDEN_TEXT)}
          </div>
          <div
            data-testid="outline-notice-sort-button"
            class="${styles.button}"
            @click=${() => {
              this._context.enableSorting$.value = true;
              this._visible$.value = false;
            }}
          >
            <span class=${styles.buttonSpan}
              >${SortIcon({ width: '20px', height: '20px' })}</span
            >
            <span class=${styles.buttonSpan}
              >${translateKey(std, ...OUTLINE_NOTICE_ORGANIZE)}</span
            >
          </div>
        </div>
      </div>
    `;
  }

  @consume({ context: tocContext })
  private accessor _context!: TocContext;
}

declare global {
  interface HTMLElementTagNameMap {
    [AFFINE_OUTLINE_NOTICE]: OutlineNotice;
  }
}
