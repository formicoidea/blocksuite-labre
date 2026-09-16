import { TextUtils } from '@labre/affine-block-surface';
import {
  FontFamily,
  FontFamilyMap,
  FontStyle,
  FontWeight,
} from '@labre/affine-model';
import {
  type ChromeWording,
  FONT_STYLE_ITALIC,
  FONT_WEIGHT_LIGHT,
  FONT_WEIGHT_REGULAR,
  FONT_WEIGHT_SEMIBOLD,
  translateKey,
} from '@labre/affine-shared/services';
import { DoneIcon } from '@blocksuite/icons/lit';
import type { BlockStdScope } from '@labre/std';
import { css, html, LitElement, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { join } from 'lit/directives/join.js';
import { repeat } from 'lit/directives/repeat.js';

const FONT_WEIGHT_CHOOSE: [FontWeight, ChromeWording][] = [
  [FontWeight.Light, FONT_WEIGHT_LIGHT],
  [FontWeight.Regular, FONT_WEIGHT_REGULAR],
  [FontWeight.SemiBold, FONT_WEIGHT_SEMIBOLD],
];

export class EdgelessFontWeightAndStylePanel extends LitElement {
  static override styles = css`
    :host {
      display: flex;
      align-items: start;
      flex-direction: column;
      min-width: 124px;
    }

    edgeless-tool-icon-button {
      width: 100%;
    }
  `;

  private _isActive(
    fontWeight: FontWeight,
    fontStyle: FontStyle = FontStyle.Normal
  ) {
    return this.fontWeight === fontWeight && this.fontStyle === fontStyle;
  }

  private _isDisabled(
    fontWeight: FontWeight,
    fontStyle: FontStyle = FontStyle.Normal
  ) {
    // Compatible with old data
    if (!(this.fontFamily in FontFamilyMap)) return false;

    const fontFace = TextUtils.getFontFaces()
      .filter(TextUtils.isSameFontFamily(this.fontFamily))
      .find(
        fontFace =>
          fontFace.weight === fontWeight && fontFace.style === fontStyle
      );

    return !fontFace;
  }

  private _onSelect(
    fontWeight: FontWeight,
    fontStyle: FontStyle = FontStyle.Normal
  ) {
    this.fontWeight = fontWeight;
    this.fontStyle = fontStyle;
    if (this.onSelect) {
      this.onSelect(fontWeight, fontStyle);
    }
  }

  /** The wording for a font weight — translated when `std` is available. */
  private _weightLabel(weight: FontWeight) {
    const wording = FONT_WEIGHT_CHOOSE.find(([w]) => w === weight)?.[1];
    if (!wording) return '';
    return this.std ? translateKey(this.std, ...wording) : wording[1];
  }

  private get _italicLabel() {
    return this.std
      ? translateKey(this.std, ...FONT_STYLE_ITALIC)
      : FONT_STYLE_ITALIC[1];
  }

  override render() {
    let fontFaces = TextUtils.getFontFacesByFontFamily(this.fontFamily);
    // Compatible with old data
    if (fontFaces.length === 0) {
      fontFaces = TextUtils.getFontFacesByFontFamily(FontFamily.Inter);
    }
    const fontFacesWithNormal = fontFaces.filter(
      fontFace => fontFace.style === FontStyle.Normal
    );
    const fontFacesWithItalic = fontFaces.filter(
      fontFace => fontFace.style === FontStyle.Italic
    );

    return join(
      [
        fontFacesWithNormal.length > 0
          ? repeat(
              fontFacesWithNormal,
              fontFace => fontFace.weight,
              fontFace => {
                const active = this._isActive(fontFace.weight as FontWeight);
                return html`
                  <edgeless-tool-icon-button
                    data-weight="${fontFace.weight}"
                    .iconContainerPadding=${[4, 8]}
                    .justify=${'space-between'}
                    .disabled=${this._isDisabled(fontFace.weight as FontWeight)}
                    .active=${active}
                    .iconSize=${'20px'}
                    @click=${() =>
                      this._onSelect(fontFace.weight as FontWeight)}
                  >
                    ${this._weightLabel(fontFace.weight as FontWeight)}
                    ${active ? DoneIcon() : nothing}
                  </edgeless-tool-icon-button>
                `;
              }
            )
          : nothing,
        fontFacesWithItalic.length > 0
          ? repeat(
              fontFacesWithItalic,
              fontFace => fontFace.weight,
              fontFace => {
                const active = this._isActive(
                  fontFace.weight as FontWeight,
                  FontStyle.Italic
                );
                return html`
                  <edgeless-tool-icon-button
                    data-weight="${fontFace.weight} italic"
                    .iconContainerPadding=${[4, 8]}
                    .justify=${'space-between'}
                    .disabled=${this._isDisabled(
                      fontFace.weight as FontWeight,
                      FontStyle.Italic
                    )}
                    .active=${active}
                    @click=${() =>
                      this._onSelect(
                        fontFace.weight as FontWeight,
                        FontStyle.Italic
                      )}
                  >
                    ${this._weightLabel(fontFace.weight as FontWeight)}
                    ${this._italicLabel} ${active ? DoneIcon() : nothing}
                  </edgeless-tool-icon-button>
                `;
              }
            )
          : nothing,
      ].filter(item => item !== nothing),
      () => html`
        <edgeless-menu-divider
          data-orientation="horizontal"
        ></edgeless-menu-divider>
      `
    );
  }

  @property({ attribute: false })
  accessor fontFamily = FontFamily.Inter;

  @property({ attribute: false })
  accessor fontStyle = FontStyle.Normal;

  @property({ attribute: false })
  accessor fontWeight = FontWeight.Regular;

  @property({ attribute: false })
  accessor onSelect:
    | ((fontWeight: FontWeight, fontStyle: FontStyle) => void)
    | undefined;

  /** Set by the caller that has one (`gfx/text`'s `createTextActions`) —
   * optional so this panel still renders (in English) when created with
   * none. */
  @property({ attribute: false })
  accessor std: BlockStdScope | undefined = undefined;
}
