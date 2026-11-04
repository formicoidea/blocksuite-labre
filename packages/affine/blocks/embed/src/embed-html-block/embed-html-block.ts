import type { EmbedHtmlModel, EmbedHtmlStyles } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import { BlockSelection } from '@labre/std';
import { FileIconHtmlIcon } from '@blocksuite/icons/lit';
import { html } from 'lit';
import { classMap } from 'lit/directives/class-map.js';

import { EmbedBlockComponent } from '../common/embed-block-element.js';
import {
  EMBED_HTML_RETIRED_DESCRIPTION,
  EMBED_HTML_RETIRED_TITLE,
} from '../translations.js';
import { EMBED_HTML_CARD_HEIGHT, styles } from './styles.js';

/**
 * A stored `affine:embed-html` block, which runs nothing any more (ADR 0048,
 * amendment of 2026-11-04). Its schema stays registered, since the store throws on
 * a flavour it does not know and a document must stay readable: this card is what
 * is left of it. The `html` prop stays in the document and is never read here.
 */
export class EmbedHtmlBlockComponent extends EmbedBlockComponent<EmbedHtmlModel> {
  static override styles = styles;

  override _cardStyle: (typeof EmbedHtmlStyles)[number] = 'html';

  // The page's flow: the box of the old preview would be 544 px of nothing.
  override get _cardHeight() {
    return EMBED_HTML_CARD_HEIGHT;
  }

  protected _handleClick(event: MouseEvent) {
    event.stopPropagation();
    const selection = this.host.selection;
    selection.setGroup('note', [
      selection.create(BlockSelection, { blockId: this.blockId }),
    ]);
  }

  override renderBlock(): unknown {
    return this.renderEmbed(
      () => html`
        <div
          class=${classMap({
            'affine-embed-html-retired': true,
            selected: this.selected$.value,
          })}
          @click=${this._handleClick}
        >
          <div class="affine-embed-html-retired-icon">
            ${FileIconHtmlIcon({ width: '24px', height: '24px' })}
          </div>
          <div class="affine-embed-html-retired-text">
            <div class="affine-embed-html-retired-title">
              ${translateKey(this.std, ...EMBED_HTML_RETIRED_TITLE)}
            </div>
            <div class="affine-embed-html-retired-description">
              ${translateKey(this.std, ...EMBED_HTML_RETIRED_DESCRIPTION)}
            </div>
          </div>
        </div>
      `
    );
  }
}
