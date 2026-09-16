import { getEmbedCardIcons } from '@labre/affine-block-embed';
import { LoadingIcon, WebIcon16 } from '@labre/affine-components/icons';
import { ImageProxyService } from '@labre/affine-shared/adapters';
import {
  CHROME_LOADING,
  ThemeProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { getHostName } from '@labre/affine-shared/utils';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { OpenInNewIcon } from '@blocksuite/icons/lit';
import { isGfxBlockComponent, ShadowlessElement } from '@labre/std';
import { html } from 'lit';
import { property } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';

import type { BookmarkBlockComponent } from '../bookmark-block.js';
import { styles } from '../styles.js';
import {
  BOOKMARK_ALT_BANNER,
  BOOKMARK_ALT_ICON,
  BOOKMARK_LINK_CARD_FALLBACK,
  BOOKMARK_RETRIEVE_FAILED,
} from '../translations.js';

export class BookmarkCard extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = styles;

  override connectedCallback(): void {
    super.connectedCallback();

    this.disposables.add(
      this.bookmark.model.propsUpdated.subscribe(() => {
        this.requestUpdate();
      })
    );

    this.disposables.add(
      this.bookmark.std
        .get(ThemeProvider)
        .theme$.subscribe(() => this.requestUpdate())
    );
  }

  override render() {
    const { url, style } = this.bookmark.model.props;
    const { icon, title, description, image } =
      this.bookmark.linkPreview$.value;

    const cardClassMap = classMap({
      loading: this.loading,
      error: this.error,
      [style]: true,
      selected: this.bookmark.selected$.value,
      edgeless: isGfxBlockComponent(this.bookmark),
      'comment-highlighted': this.bookmark.isCommentHighlighted,
    });

    const domainName = url.match(
      /^(?:https?:\/\/)?(?:[^@\n]+@)?(?:www\.)?([^:/\n]+)/im
    )?.[1];

    const { std } = this.bookmark;

    const titleText = this.loading
      ? translateKey(std, ...CHROME_LOADING)
      : !title
        ? this.error
          ? (domainName ?? translateKey(std, ...BOOKMARK_LINK_CARD_FALLBACK))
          : ''
        : title;

    const theme = this.bookmark.std.get(ThemeProvider).theme;
    const { EmbedCardBannerIcon } = getEmbedCardIcons(theme);
    const imageProxyService = this.bookmark.store.get(ImageProxyService);

    const iconAlt = translateKey(std, ...BOOKMARK_ALT_ICON);
    const bannerAlt = translateKey(std, ...BOOKMARK_ALT_BANNER);

    const titleIcon = this.loading
      ? LoadingIcon()
      : icon
        ? html`<img src=${imageProxyService.buildUrl(icon)} alt=${iconAlt} />`
        : WebIcon16;

    const descriptionText = this.loading
      ? ''
      : !description
        ? this.error
          ? translateKey(std, ...BOOKMARK_RETRIEVE_FAILED)
          : url
        : (description ?? '');

    const bannerImage =
      !this.loading && image
        ? html`<img
            src=${imageProxyService.buildUrl(image)}
            alt=${bannerAlt}
          />`
        : EmbedCardBannerIcon;

    return html`
      <div
        class="affine-bookmark-card ${cardClassMap}"
        @click=${this.bookmark.handleClick}
        @dblclick=${this.bookmark.handleDoubleClick}
      >
        <div class="affine-bookmark-content">
          <div class="affine-bookmark-content-title">
            <div class="affine-bookmark-content-title-icon">${titleIcon}</div>
            <div class="affine-bookmark-content-title-text">${titleText}</div>
          </div>
          <div class="affine-bookmark-content-description">
            ${descriptionText}
          </div>
          <div class="affine-bookmark-content-url-wrapper">
            <div
              class="affine-bookmark-content-url"
              @click=${this.bookmark.open}
            >
              <span>${getHostName(url)}</span>
              <div class="affine-bookmark-content-url-icon">
                ${OpenInNewIcon({ width: '12', height: '12' })}
              </div>
            </div>
          </div>
        </div>
        <div class="affine-bookmark-banner">${bannerImage}</div>
      </div>
    `;
  }

  @property({ attribute: false })
  accessor bookmark!: BookmarkBlockComponent;

  @property({ attribute: false })
  accessor error!: boolean;

  @property({ attribute: false })
  accessor loading!: boolean;
}

declare global {
  interface HTMLElementTagNameMap {
    'bookmark-card': BookmarkCard;
  }
}
