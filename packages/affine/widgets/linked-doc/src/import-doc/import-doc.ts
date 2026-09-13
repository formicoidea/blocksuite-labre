import {
  CloseIcon,
  ExportToHTMLIcon,
  ExportToMarkdownIcon,
  HelpIcon,
  NewIcon,
  NotionIcon,
} from '@labre/affine-components/icons';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import { openFilesWith, openSingleFileWith } from '@labre/affine-shared/utils';
import { WithDisposable } from '@labre/global/lit';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType, Schema, Workspace } from '@labre/store';
import { html, LitElement, type PropertyValues } from 'lit';
import { query, state } from 'lit/decorators.js';

import { HtmlTransformer } from '../transformers/html.js';
import { MarkdownTransformer } from '../transformers/markdown.js';
import { NotionHtmlTransformer } from '../transformers/notion-html.js';
import {
  LINKED_DOC_IMPORT,
  LINKED_DOC_IMPORT_COMING_SOON,
  LINKED_DOC_IMPORT_FEEDBACK_LINK,
  LINKED_DOC_IMPORT_FORMAT_NOTION,
  LINKED_DOC_IMPORT_INTRO,
  LINKED_DOC_IMPORT_LOADING,
  LINKED_DOC_IMPORT_NOTION_HELP_TOOLTIP,
  LINKED_DOC_IMPORT_NOTION_MARKDOWN_DEPRECATED,
  LINKED_DOC_FORMAT_HTML,
  LINKED_DOC_FORMAT_MARKDOWN,
} from '../translations.js';
import { styles } from './styles.js';

export type OnSuccessHandler = (
  pageIds: string[],
  options: { isWorkspaceFile: boolean; importedCount: number }
) => void;

export type OnFailHandler = (message: string) => void;

const SHOW_LOADING_SIZE = 1024 * 200;

export class ImportDoc extends WithDisposable(LitElement) {
  static override styles = styles;

  constructor(
    private readonly collection: Workspace,
    private readonly schema: Schema,
    private readonly extensions: ExtensionType[],
    private readonly onSuccess?: OnSuccessHandler,
    private readonly onFail?: OnFailHandler,
    private readonly abortController = new AbortController(),
    /** Set by the caller that has one (`config.ts`'s `showImportModal` call) —
     * optional so this dialog still renders (in English) when created with
     * none. */
    private readonly std?: BlockStdScope
  ) {
    super();

    this._loading = false;

    this.x = 0;
    this.y = 0;
    this._startX = 0;
    this._startY = 0;

    this._onMouseMove = this._onMouseMove.bind(this);
  }

  /** `translateKey(std, ...wording)` when `std` is available, else the literal. */
  private _t(wording: ChromeWording): string {
    return this.std ? translateKey(this.std, ...wording) : wording[1];
  }

  private async _importHtml() {
    const files = await openFilesWith('Html');
    if (!files) return;
    const pageIds: string[] = [];
    for (const file of files) {
      const text = await file.text();
      const needLoading = file.size > SHOW_LOADING_SIZE;
      const fileName = file.name.split('.').slice(0, -1).join('.');
      if (needLoading) {
        this.hidden = false;
        this._loading = true;
      } else {
        this.abortController.abort();
      }
      const pageId = await HtmlTransformer.importHTMLToDoc({
        collection: this.collection,
        schema: this.schema,
        extensions: this.extensions,
        html: text,
        fileName,
      });
      needLoading && this.abortController.abort();
      if (pageId) {
        pageIds.push(pageId);
      }
    }
    this._onImportSuccess(pageIds);
  }

  private async _importMarkDown() {
    const files = await openFilesWith('Markdown');
    if (!files) return;
    const pageIds: string[] = [];
    for (const file of files) {
      const text = await file.text();
      const fileName = file.name.split('.').slice(0, -1).join('.');
      const needLoading = file.size > SHOW_LOADING_SIZE;
      if (needLoading) {
        this.hidden = false;
        this._loading = true;
      } else {
        this.abortController.abort();
      }
      const pageId = await MarkdownTransformer.importMarkdownToDoc({
        collection: this.collection,
        schema: this.schema,
        markdown: text,
        fileName,
        extensions: this.extensions,
      });
      needLoading && this.abortController.abort();
      if (pageId) {
        pageIds.push(pageId);
      }
    }
    this._onImportSuccess(pageIds);
  }

  private async _importNotion() {
    const file = await openSingleFileWith('Zip');
    if (!file) return;
    const needLoading = file.size > SHOW_LOADING_SIZE;
    if (needLoading) {
      this.hidden = false;
      this._loading = true;
    } else {
      this.abortController.abort();
    }
    const { entryId, pageIds, isWorkspaceFile, hasMarkdown } =
      await NotionHtmlTransformer.importNotionZip({
        collection: this.collection,
        schema: this.schema,
        imported: file,
        extensions: this.extensions,
      });
    needLoading && this.abortController.abort();
    if (hasMarkdown) {
      this._onFail(this._t(LINKED_DOC_IMPORT_NOTION_MARKDOWN_DEPRECATED));
      return;
    }
    this._onImportSuccess([entryId], {
      isWorkspaceFile,
      importedCount: pageIds.length,
    });
  }

  private _onCloseClick(event: MouseEvent) {
    event.stopPropagation();
    this.abortController.abort();
  }

  private _onFail(message: string) {
    this.onFail?.(message);
  }

  private _onImportSuccess(
    pageIds: string[],
    options: { isWorkspaceFile?: boolean; importedCount?: number } = {}
  ) {
    const {
      isWorkspaceFile = false,
      importedCount: pagesImportedCount = pageIds.length,
    } = options;
    this.onSuccess?.(pageIds, {
      isWorkspaceFile,
      importedCount: pagesImportedCount,
    });
  }

  private _onMouseDown(event: MouseEvent) {
    this._startX = event.clientX - this.x;
    this._startY = event.clientY - this.y;
    window.addEventListener('mousemove', this._onMouseMove);
  }

  private _onMouseMove(event: MouseEvent) {
    this.x = event.clientX - this._startX;
    this.y = event.clientY - this._startY;
  }

  private _onMouseUp() {
    window.removeEventListener('mousemove', this._onMouseMove);
  }

  private _openLearnImportLink(event: MouseEvent) {
    event.stopPropagation();
    window.open(
      'https://affine.pro/blog/import-your-data-from-notion-into-affine',
      '_blank'
    );
  }

  override render() {
    if (this._loading) {
      return html`
        <div class="overlay-mask"></div>
        <div class="container">
          <header
            class="loading-header"
            @mousedown="${this._onMouseDown}"
            @mouseup="${this._onMouseUp}"
          >
            <div>${this._t(LINKED_DOC_IMPORT)}</div>
            <loader-element .width=${'50px'}></loader-element>
          </header>
          <div>${this._t(LINKED_DOC_IMPORT_LOADING)}</div>
        </div>
      `;
    }
    return html`
      <div
        class="overlay-mask"
        @click="${() => this.abortController.abort()}"
      ></div>
      <div class="container">
        <header @mousedown="${this._onMouseDown}" @mouseup="${this._onMouseUp}">
          <icon-button height="28px" @click="${this._onCloseClick}">
            ${CloseIcon}
          </icon-button>
          <div>${this._t(LINKED_DOC_IMPORT)}</div>
        </header>
        <div>
          ${this._t(LINKED_DOC_IMPORT_INTRO)}
          <a
            href="https://community.affine.pro/c/feature-requests/import-export"
            target="_blank"
            >${this._t(LINKED_DOC_IMPORT_FEEDBACK_LINK)}</a
          >
        </div>
        <div class="button-container">
          <icon-button
            class="button-item"
            text="${this._t(LINKED_DOC_FORMAT_MARKDOWN)}"
            @click="${this._importMarkDown}"
          >
            ${ExportToMarkdownIcon}
          </icon-button>
          <icon-button
            class="button-item"
            text="${this._t(LINKED_DOC_FORMAT_HTML)}"
            @click="${this._importHtml}"
          >
            ${ExportToHTMLIcon}
          </icon-button>
        </div>
        <div class="button-container">
          <icon-button
            class="button-item"
            text="${this._t(LINKED_DOC_IMPORT_FORMAT_NOTION)}"
            @click="${this._importNotion}"
          >
            ${NotionIcon}
            <div
              slot="suffix"
              class="button-suffix"
              @click="${this._openLearnImportLink}"
            >
              ${HelpIcon}
              <affine-tooltip>
                ${this._t(LINKED_DOC_IMPORT_NOTION_HELP_TOOLTIP)}
              </affine-tooltip>
            </div>
          </icon-button>
          <icon-button
            class="button-item"
            text="${this._t(LINKED_DOC_IMPORT_COMING_SOON)}"
            disabled
          >
            ${NewIcon}
          </icon-button>
        </div>
      </div>
    `;
  }

  override updated(changedProps: PropertyValues) {
    if (changedProps.has('x') || changedProps.has('y')) {
      this.containerEl.style.transform = `translate(${this.x}px, ${this.y}px)`;
    }
  }

  @state()
  accessor _loading = false;

  @state()
  accessor _startX = 0;

  @state()
  accessor _startY = 0;

  @query('.container')
  accessor containerEl!: HTMLElement;

  @state()
  accessor x = 0;

  @state()
  accessor y = 0;
}
