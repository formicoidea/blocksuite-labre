import { ColorScheme } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { DeleteIcon } from '@blocksuite/icons/lit';
import { type BlockStdScope, ShadowlessElement } from '@labre/std';
import { type GfxModel } from '@labre/std/gfx';
import { css, html, nothing } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import { DarkDeletedSmallBanner, LightDeletedSmallBanner } from '../icons';
import {
  SURFACE_REF_PLACEHOLDER_NOT_AVAILABLE,
  SURFACE_REF_TYPE_SENTENCE_WORDINGS,
} from '../translations';
import { getReferenceModelTitle, TYPE_ICON_MAP } from '../utils';

export class SurfaceRefPlaceHolder extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = css`
    .surface-ref-placeholder {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding: 12px;
    }

    .surface-ref-placeholder.not-found {
      background: ${unsafeCSSVarV2('layer/background/secondary', '#F5F5F5')};
    }

    .surface-ref-placeholder-heading {
      position: relative;
      display: flex;
      align-items: center;
      gap: 8px;
      align-self: stretch;

      font-size: 14px;
      font-weight: 500;
      line-height: 22px;

      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;

      color: ${unsafeCSSVarV2('text/primary', '#141414')};
    }

    .surface-ref-placeholder-body {
      position: relative;
      font-size: 12px;
      font-weight: 400;
      line-height: 20px;
      text-overflow: ellipsis;
      white-space: nowrap;
      overflow: hidden;
      color: ${unsafeCSSVarV2('text/disable', '#7a7a7a')};
    }

    .surface-ref-not-found-background {
      position: absolute;
      right: 12px;
      bottom: -5px;
    }
  `;

  @property({ attribute: false })
  accessor referenceModel: GfxModel | null = null;

  @property({ attribute: false })
  accessor refFlavour = '';

  @property({ attribute: false })
  accessor inEdgeless = false;

  @property({ attribute: false })
  accessor theme: ColorScheme = ColorScheme.Light;

  @property({ attribute: false })
  accessor std!: BlockStdScope;

  override render() {
    const { referenceModel, refFlavour, inEdgeless, std } = this;

    // When surface ref is in page mode and reference exists, don't render placeholder
    if (referenceModel && !inEdgeless) return nothing;

    const modelNotFound = !referenceModel;
    const matchedType = TYPE_ICON_MAP[refFlavour] ?? TYPE_ICON_MAP['edgeless'];
    const matchedTypeName = translateKey(std, ...matchedType.wording);
    const sentences =
      SURFACE_REF_TYPE_SENTENCE_WORDINGS[refFlavour] ??
      SURFACE_REF_TYPE_SENTENCE_WORDINGS['edgeless'];

    const title =
      (referenceModel && getReferenceModelTitle(referenceModel)) ??
      matchedTypeName;

    const notFoundBackground =
      this.theme === ColorScheme.Light
        ? LightDeletedSmallBanner
        : DarkDeletedSmallBanner;

    return html`
      <div
        class=${classMap({
          'surface-ref-placeholder': true,
          'not-found': modelNotFound,
        })}
      >
        ${modelNotFound
          ? html`<div class="surface-ref-not-found-background">
              ${notFoundBackground}
            </div>`
          : nothing}
        <div class="surface-ref-placeholder-heading">
          ${modelNotFound ? DeleteIcon() : matchedType.icon}
          <span class="surface-ref-title">
            ${modelNotFound
              ? translateKey(std, ...SURFACE_REF_PLACEHOLDER_NOT_AVAILABLE, {
                  type: matchedTypeName,
                })
              : `${title}`}
          </span>
        </div>
        <div class="surface-ref-placeholder-body">
          <span class="surface-ref-text">
            ${modelNotFound
              ? translateKey(std, ...sentences.deleted)
              : translateKey(std, ...sentences.cannotDisplay)}
          </span>
        </div>
      </div>
    `;
  }
}

declare global {
  interface HTMLElementTagNameMap {
    'surface-ref-placeholder': SurfaceRefPlaceHolder;
  }
}
