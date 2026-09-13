import { EditorChevronDown } from '@labre/affine-components/toolbar';
import { NoteDisplayMode } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { ShadowlessElement } from '@labre/std';
import { html } from 'lit';
import { property } from 'lit/decorators.js';

import {
  NOTE_DISPLAY_MODE_BOTH,
  NOTE_DISPLAY_MODE_EDGELESS,
  NOTE_DISPLAY_MODE_LABEL,
  NOTE_DISPLAY_MODE_PAGE,
  NOTE_DISPLAY_MODE_SHOW_IN,
} from '../translations.js';

const DisplayModeMap = {
  [NoteDisplayMode.DocAndEdgeless]: 'Both',
  [NoteDisplayMode.EdgelessOnly]: 'Edgeless',
  [NoteDisplayMode.DocOnly]: 'Page',
} as const satisfies Record<NoteDisplayMode, string>;

const DisplayModeWording = {
  [NoteDisplayMode.DocAndEdgeless]: NOTE_DISPLAY_MODE_BOTH,
  [NoteDisplayMode.EdgelessOnly]: NOTE_DISPLAY_MODE_EDGELESS,
  [NoteDisplayMode.DocOnly]: NOTE_DISPLAY_MODE_PAGE,
} as const;

export class EdgelessNoteDisplayModeDropdownMenu extends ShadowlessElement {
  get mode() {
    return DisplayModeMap[this.displayMode];
  }

  select(detail: NoteDisplayMode) {
    this.dispatchEvent(new CustomEvent('select', { detail }));
  }

  override render() {
    const { displayMode, std } = this;
    const modeLabel = translateKey(std, ...DisplayModeWording[displayMode]);

    return html`
      <span class="display-mode-button-label"
        >${translateKey(std, ...NOTE_DISPLAY_MODE_SHOW_IN)}</span
      >
      <editor-menu-button
        .contentPadding=${'8px'}
        .button=${html`
          <editor-icon-button
            aria-label=${translateKey(std, ...NOTE_DISPLAY_MODE_LABEL)}
            .tooltip="${translateKey(std, ...NOTE_DISPLAY_MODE_LABEL)}"
            .justify="${'space-between'}"
            .labelHeight="${'20px'}"
          >
            <span class="label">${modeLabel}</span>
            ${EditorChevronDown}
          </editor-icon-button>
        `}
      >
        <note-display-mode-panel
          .std=${std}
          .displayMode=${displayMode}
          .onSelect=${(newMode: NoteDisplayMode) => this.select(newMode)}
        >
        </note-display-mode-panel>
      </editor-menu-button>
    `;
  }

  @property({ attribute: false })
  accessor displayMode!: NoteDisplayMode;

  /** Threaded from the surface toolbar's `content(ctx)` (`../configs/toolbar.ts`). */
  @property({ attribute: false })
  accessor std!: BlockStdScope;
}

declare global {
  interface HTMLElementTagNameMap {
    'edgeless-note-display-mode-dropdown-menu': EdgelessNoteDisplayModeDropdownMenu;
  }
}
