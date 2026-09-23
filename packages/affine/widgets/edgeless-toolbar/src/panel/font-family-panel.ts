import { TextUtils } from '@labre/affine-block-surface';
import { FontFamily, FontFamilyList } from '@labre/affine-model';
import {
  fillPlaceholders,
  FontConfigIdentifier,
  translateKey,
} from '@labre/affine-shared/services';
import { DoneIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { css, html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';

import { EDGELESS_TOOLBAR_FONT_FAMILY_UNAVAILABLE } from '../translations.js';

export class EdgelessFontFamilyPanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: start;
      flex-direction: column;
      min-width: 136px;
    }

    edgeless-tool-icon-button {
      width: 100%;
    }
  `;

  /**
   * The families the host configured: those with at least one face in its
   * `FontConfig` (#396). Read from the config itself rather than from
   * `document.fonts`, which the font loader fills a few seconds late for every
   * non-critical family.
   *
   * `null` when no config is registered (the seam is absent, or empty, which
   * the font loader also treats as absent): every family is offered, as before
   * the seam narrowed the list. None of them has a file then, so each paints
   * with the same fallback anyway.
   */
  private _configuredFamilies(): Set<string> | null {
    const config = this.std?.getOptional(FontConfigIdentifier);
    if (!config || config.length === 0) return null;
    return new Set(config.map(face => face.font));
  }

  private _onSelect(value: FontFamily) {
    this.value = value;
    if (this.onSelect) {
      this.onSelect(value);
    }
  }

  private _unavailableLabel(name: string) {
    return this.std
      ? translateKey(this.std, ...EDGELESS_TOOLBAR_FONT_FAMILY_UNAVAILABLE, {
          name,
        })
      : fillPlaceholders(EDGELESS_TOOLBAR_FONT_FAMILY_UNAVAILABLE[1], { name });
  }

  override render() {
    const configured = this._configuredFamilies();
    // The current family stays listed even when the host no longer ships it:
    // the element keeps it (and paints the fallback), so the picker names it
    // rather than pretend the text has none. Greyed and never picked from
    // here, so nothing rewrites the stored value behind the user's back.
    const families = FontFamilyList.filter(
      ([font]) => !configured || configured.has(font) || font === this.value
    );

    return repeat(
      families,
      item => item[0],
      ([font, name]) => {
        const unavailable = !!configured && !configured.has(font);
        const current = this.value === font;
        return html`
          <edgeless-tool-icon-button
            data-font="${name}"
            style="font-family: ${TextUtils.wrapFontFamily(font)}"
            .iconContainerPadding=${[4, 8]}
            .justify=${'space-between'}
            .active=${current && !unavailable}
            .disabled=${unavailable}
            .iconSize=${'20px'}
            @click=${unavailable ? nothing : () => this._onSelect(font)}
          >
            ${unavailable ? this._unavailableLabel(name) : name}
            ${current ? DoneIcon() : nothing}
          </edgeless-tool-icon-button>
        `;
      }
    );
  }

  @property({ attribute: false })
  accessor onSelect: ((value: FontFamily) => void) | undefined = undefined;

  /** Set by the caller that has one (`gfx/text`'s `createTextActions`): it
   * carries the host's `FontConfig` and translations. Optional, so the panel
   * still renders (every family, in English) when created with none. */
  @property({ attribute: false })
  accessor std: BlockStdScope | undefined = undefined;

  @property({ attribute: false })
  accessor value: FontFamily = FontFamily.Inter;
}
