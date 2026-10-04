import {
  type FilterableListItem,
  type FilterableListOptions,
  showPopFilterableList,
} from '@labre/affine-components/filterable-list';
import { ArrowDownIcon } from '@labre/affine-components/icons';
import {
  DocModeProvider,
  TelemetryProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { noop } from '@labre/global/utils';
import { css, LitElement, nothing } from 'lit';
import { property, query } from 'lit/decorators.js';
import { styleMap } from 'lit/directives/style-map.js';
import { html } from 'lit/static-html.js';

import type { CodeBlockComponent } from '../..';
import {
  CODE_PLAIN_TEXT_LANGUAGE,
  CODE_SEARCH_FOR_LANGUAGE,
} from '../../translations.js';

/**
 * The list name of the Plain Text entry, which stands for `language: null`
 * (#417). A colon never appears in a shiki language id, so it cannot collide
 * with one, and no query starting with a letter matches it by name. It lives
 * in the list and its persisted order only, never in the model.
 */
const PLAIN_TEXT_ITEM_NAME = ':plain-text';

function languageOf(item: FilterableListItem): string | null {
  return item.name === PLAIN_TEXT_ITEM_NAME ? null : item.name;
}

export class LanguageListButton extends WithDisposable(
  SignalWatcher(LitElement)
) {
  static override styles = css`
    .lang-button {
      display: flex;
      gap: 4px;
      padding: 2px 4px;
      height: 28px;
    }

    .lang-button:hover {
      background: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
    }

    .lang-button[hover] {
      background: ${unsafeCSSVarV2('layer/background/hoverOverlay')};
    }

    .lang-button-icon {
      display: flex;
      align-items: center;
      color: ${unsafeCSSVarV2('icon/primary')};

      svg {
        height: 16px;
        width: 16px;
      }
    }
  `;

  private _abortController?: AbortController;

  private readonly _clickLangBtn = () => {
    if (this.blockComponent.store.readonly) return;
    if (this._abortController) {
      // Close the language list if it's already opened.
      this._abortController.abort();
      return;
    }
    this._abortController = new AbortController();
    this._abortController.signal.addEventListener('abort', () => {
      this.onActiveStatusChange(false);
      this._abortController = undefined;
    });
    this.onActiveStatusChange(true);

    const options: FilterableListOptions = {
      placeholder: translateKey(
        this.blockComponent.std,
        ...CODE_SEARCH_FOR_LANGUAGE
      ),
      onSelect: item => {
        const sortedBundledLanguages = this._sortedBundledLanguages;
        const index = sortedBundledLanguages.indexOf(item);
        if (index !== -1) {
          sortedBundledLanguages.splice(index, 1);
          sortedBundledLanguages.unshift(item);
        }
        this.blockComponent.store.transact(() => {
          this.blockComponent.model.props.language$.value = languageOf(item);
        });

        const std = this.blockComponent.std;
        const mode =
          std.getOptional(DocModeProvider)?.getEditorMode() ?? 'page';
        const telemetryService = std.getOptional(TelemetryProvider);
        if (!telemetryService) return;
        telemetryService.track('codeBlockLanguageSelect', {
          page: mode,
          segment: 'code block',
          module: 'language selector',
          control: item.name,
        });
      },
      active: item =>
        languageOf(item) === this.blockComponent.model.props.language,
      items: this._sortedBundledLanguages,
    };

    showPopFilterableList({
      options,
      referenceElement: this._langButton,
      container: this.blockComponent.host,
      abortController: this._abortController,
      // stacking-context(editor-host)
      portalStyles: {
        zIndex: 'var(--affine-z-index-popover)',
      },
    });
  };

  private _sortedBundledLanguages: FilterableListItem[] = [];

  override connectedCallback(): void {
    super.connectedCallback();

    const langList = localStorage.getItem('blocksuite:code-block:lang-list');
    const languages: FilterableListItem[] = langList
      ? JSON.parse(langList)
      : this.blockComponent.langs.map(lang => ({
          label: lang.name,
          name: lang.id,
          aliases: lang.aliases,
        }));

    // A list persisted before the entry existed lacks it, and a persisted
    // label is in the locale of the session that wrote it: keep the entry's
    // recently-used position, refresh its words.
    const plainText: FilterableListItem = {
      label: translateKey(this.blockComponent.std, ...CODE_PLAIN_TEXT_LANGUAGE),
      name: PLAIN_TEXT_ITEM_NAME,
      aliases: ['plain', 'text', 'none'],
    };
    const index = languages.findIndex(
      item => item.name === PLAIN_TEXT_ITEM_NAME
    );
    if (index === -1) {
      languages.unshift(plainText);
    } else {
      languages[index] = plainText;
    }
    this._sortedBundledLanguages = languages;

    this.disposables.add(() => {
      localStorage.setItem(
        'blocksuite:code-block:lang-list',
        JSON.stringify(this._sortedBundledLanguages)
      );
    });
  }

  override render() {
    const textStyles = styleMap({
      fontFamily: 'Inter',
      fontSize: 'var(--affine-font-xs)',
      fontStyle: 'normal',
      fontWeight: '500',
      lineHeight: '20px',
      padding: '0 4px',
    });

    return html`<icon-button
      class="lang-button"
      data-testid="lang-button"
      width="auto"
      .text=${html`<div style=${textStyles}>
        ${this.blockComponent.languageName$.value}
      </div>`}
      height="24px"
      @click=${this._clickLangBtn}
      ?disabled=${this.blockComponent.store.readonly}
    >
      <span class="lang-button-icon" slot="suffix">
        ${!this.blockComponent.store.readonly ? ArrowDownIcon : nothing}
      </span>
    </icon-button> `;
  }

  @query('.lang-button')
  private accessor _langButton!: HTMLElement;

  @property({ attribute: false })
  accessor blockComponent!: CodeBlockComponent;

  @property({ attribute: false })
  accessor onActiveStatusChange: (active: boolean) => void = noop;
}
