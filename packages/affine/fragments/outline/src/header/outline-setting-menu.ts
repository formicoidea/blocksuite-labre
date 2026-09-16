import { translateKey } from '@labre/affine-shared/services';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { ShadowlessElement } from '@labre/std';
import { consume } from '@lit/context';
import { html } from 'lit';

import { type TocContext, tocContext } from '../config';
import {
  OUTLINE_SETTINGS_LABEL,
  OUTLINE_SHOW_TYPE_ICON,
} from '../translations';
import * as styles from './outline-setting-menu.css';

export const AFFINE_OUTLINE_NOTE_PREVIEW_SETTING_MENU =
  'affine-outline-note-preview-setting-menu';

export class OutlineNotePreviewSettingMenu extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  override render() {
    const showPreviewIcon = this._context.showIcons$.value;
    const std = this._context.editor$.value.std;

    return html`<div
      class=${styles.notePreviewSettingMenuContainer}
      @click=${(e: MouseEvent) => e.stopPropagation()}
    >
      <div class=${styles.notePreviewSettingMenuItem}>
        <div class=${styles.settingLabel}>
          ${translateKey(std, ...OUTLINE_SETTINGS_LABEL)}
        </div>
      </div>
      <div class="${styles.notePreviewSettingMenuItem} ${styles.action}">
        <div class=${styles.actionLabel}>
          ${translateKey(std, ...OUTLINE_SHOW_TYPE_ICON)}
        </div>
        <div class=${styles.toggleButton}>
          <toggle-switch
            .on=${showPreviewIcon}
            .onChange=${() => {
              this._context.showIcons$.value = !showPreviewIcon;
            }}
          ></toggle-switch>
        </div>
      </div>
    </div>`;
  }

  @consume({ context: tocContext })
  private accessor _context!: TocContext;
}

declare global {
  interface HTMLElementTagNameMap {
    [AFFINE_OUTLINE_NOTE_PREVIEW_SETTING_MENU]: OutlineNotePreviewSettingMenu;
  }
}
