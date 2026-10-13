import {
  CodeBlockModel,
  ListBlockModel,
  NoteBlockModel,
  NoteDisplayMode,
  ParagraphBlockModel,
  type RootBlockModel,
} from '@labre/affine-model';
import { focusTextModel, type RichText } from '@labre/affine-rich-text';
import { TitleBandProvider, translateKey } from '@labre/affine-shared/services';
import { matchModels } from '@labre/affine-shared/utils';
import { WithDisposable } from '@labre/global/lit';
import { ShadowlessElement } from '@labre/std';
import type { Store } from '@labre/store';
import { effect } from '@preact/signals-core';
import { css, html, nothing } from 'lit';
import { property, query, state } from 'lit/decorators.js';

import { DOC_TITLE_PLACEHOLDER } from './translations';

const DOC_BLOCK_CHILD_PADDING = 24;

export class DocTitle extends WithDisposable(ShadowlessElement) {
  static override styles = css`
    /*
     * The page title's family is a host's to choose (labre ADR-0049 §5: the
     * Labre app sets Cabinet Grotesk); headings H1 to H6 stay in the body
     * family. Unset, the title keeps the body family, DESIGN.md's One Family
     * Rule.
     */
    .doc-title-container {
      box-sizing: border-box;
      font-family: var(
        --labre-doc-title-font-family,
        var(--affine-font-family)
      );
      font-size: var(--affine-font-base);
      line-height: var(--affine-line-height);
      color: var(--affine-text-primary-color);
      font-size: 40px;
      line-height: 50px;
      font-weight: 700;
      outline: none;
      resize: none;
      border: 0;
      width: 100%;
      max-width: var(--affine-editor-width);
      margin-left: auto;
      margin-right: auto;
      padding: 38px 0;

      padding-left: var(
        --affine-editor-side-padding,
        ${DOC_BLOCK_CHILD_PADDING}px
      );
      padding-right: var(
        --affine-editor-side-padding,
        ${DOC_BLOCK_CHILD_PADDING}px
      );
    }

    /* Extra small devices (phones, 640px and down) */
    @container viewport (width <= 640px) {
      .doc-title-container {
        padding-left: ${DOC_BLOCK_CHILD_PADDING}px;
        padding-right: ${DOC_BLOCK_CHILD_PADDING}px;
      }
    }

    .doc-title-container.doc-title-container-with-band {
      padding-bottom: 8px;
    }

    .doc-title-band {
      box-sizing: border-box;
      width: 100%;
      max-width: var(--affine-editor-width);
      margin-left: auto;
      margin-right: auto;
      padding: 0 var(--affine-editor-side-padding, ${DOC_BLOCK_CHILD_PADDING}px)
        24px;
    }

    @container viewport (width <= 640px) {
      .doc-title-band {
        padding-left: ${DOC_BLOCK_CHILD_PADDING}px;
        padding-right: ${DOC_BLOCK_CHILD_PADDING}px;
      }
    }

    .doc-title-container-empty::before {
      content: attr(data-placeholder);
      color: var(--affine-placeholder-color);
      position: absolute;
      opacity: 0.5;
      pointer-events: none;
    }

    .doc-title-container:disabled {
      background-color: transparent;
    }
  `;

  private _getOrCreateFirstPageVisibleNote() {
    const note = this._rootModel?.children.find(
      (child): child is NoteBlockModel =>
        matchModels(child, [NoteBlockModel]) &&
        child.props.displayMode !== NoteDisplayMode.EdgelessOnly
    );
    if (note) return note;

    const noteId = this.doc.addBlock('affine:note', {}, this._rootModel, 0);
    return this.doc.getBlock(noteId)?.model as NoteBlockModel;
  }

  private readonly _onTitleKeyDown = (event: KeyboardEvent) => {
    if (event.isComposing || this.doc.readonly) return;
    if (!this._std) return;

    if (event.key === 'Enter') {
      this._std.event.active = true;
      event.preventDefault();
      event.stopPropagation();

      const inlineRange = this.inlineEditor?.getInlineRange();
      if (inlineRange) {
        const rightText = this._rootModel?.props.title.split(inlineRange.index);
        const newFirstParagraphId = this.doc.addBlock(
          'affine:paragraph',
          { text: rightText },
          this._getOrCreateFirstPageVisibleNote(),
          0
        );
        if (this._std) focusTextModel(this._std, newFirstParagraphId);
      }
    } else if (event.key === 'ArrowDown') {
      this._std.event.active = true;
      event.preventDefault();
      event.stopPropagation();

      const note = this._getOrCreateFirstPageVisibleNote();
      const firstText = note?.children.find(block =>
        matchModels(block, [
          ParagraphBlockModel,
          ListBlockModel,
          CodeBlockModel,
        ])
      );
      if (firstText) {
        if (this._std) focusTextModel(this._std, firstText.id);
      } else {
        const newFirstParagraphId = this.doc.addBlock(
          'affine:paragraph',
          {},
          note,
          0
        );
        if (this._std) focusTextModel(this._std, newFirstParagraphId);
      }
    } else if (event.key === 'Tab') {
      event.preventDefault();
      event.stopPropagation();
    }
  };

  private readonly _updateTitleInMeta = () => {
    if (!this._rootModel) return;
    this.doc.workspace.meta.setDocMeta(this.doc.id, {
      title: this._rootModel.props.title.toString(),
    });
  };

  private get _std() {
    return this._viewport?.querySelector('editor-host')?.std;
  }

  private get _placeholder() {
    return this._std
      ? translateKey(this._std, ...DOC_TITLE_PLACEHOLDER)
      : DOC_TITLE_PLACEHOLDER[1];
  }

  private get _rootModel() {
    return this.doc.root as RootBlockModel | null;
  }

  private get _viewport() {
    return (
      this.closest<HTMLElement>('.affine-page-viewport') ??
      this.closest<HTMLElement>('.affine-edgeless-viewport')
    );
  }

  get inlineEditor() {
    return this._richTextElement.inlineEditor;
  }

  get inlineEditorContainer() {
    return this._richTextElement.inlineEditorContainer;
  }

  override connectedCallback() {
    super.connectedCallback();

    this._isReadonly = this.doc.readonly;
    this._disposables.add(
      effect(() => {
        if (this._isReadonly !== this.doc.readonly) {
          this._isReadonly = this.doc.readonly;
          this.requestUpdate();
        }
      })
    );

    this._disposables.addFromEvent(this, 'keydown', this._onTitleKeyDown);

    // Workaround for inline editor skips composition event
    this._disposables.addFromEvent(
      this,
      'compositionstart',
      () => (this._isComposing = true)
    );

    this._disposables.addFromEvent(
      this,
      'compositionend',
      () => (this._isComposing = false)
    );

    const updateMetaTitle = () => {
      this._updateTitleInMeta();
      this.requestUpdate();
    };

    if (this._rootModel) {
      const rootModel = this._rootModel;
      rootModel.props.title.yText.observe(updateMetaTitle);
      this._disposables.add(() => {
        rootModel.props.title.yText.unobserve(updateMetaTitle);
      });
    }
  }

  /**
   * The `std` the title band reads its seams from, when the band belongs
   * here: in the page view, never inside a note on the canvas, where
   * `edgeless-page-block-title` draws the band itself (ADR 0035 §11), so a
   * host that renders this title in the note header does not get two.
   */
  private get _bandStd() {
    if (this.closest('edgeless-page-block-title')) return null;
    const std = this._std;
    return std?.getOptional(TitleBandProvider) ? std : null;
  }

  override firstUpdated() {
    // `<doc-title>` sits beside the editor host, not inside it: on the first
    // frame the host may not carry its `std` yet, and without one the band
    // cannot read its seam. One more render once it has mounted.
    if (this._std) return;
    const frame = requestAnimationFrame(() => this.requestUpdate());
    this._disposables.add(() => cancelAnimationFrame(frame));
  }

  override render() {
    const isEmpty = !this._rootModel?.props.title.length && !this._isComposing;
    const bandStd = this._bandStd;

    return html`
      <div
        class="doc-title-container ${isEmpty
          ? 'doc-title-container-empty'
          : ''} ${bandStd ? 'doc-title-container-with-band' : ''}"
        data-block-is-title="true"
        data-placeholder=${this._placeholder}
      >
        <rich-text
          .yText=${this._rootModel?.props.title.yText}
          .undoManager=${this.doc.history.undoManager}
          .verticalScrollContainerGetter=${() => this._viewport}
          .readonly=${this.doc.readonly}
          .enableFormat=${false}
          .wrapText=${this.wrapText}
        ></rich-text>
      </div>
      ${bandStd
        ? html`<div class="doc-title-band">
            <labre-title-band
              .std=${bandStd}
              .docId=${this.doc.id}
              .surface=${'page'}
            ></labre-title-band>
          </div>`
        : nothing}
    `;
  }

  @state()
  private accessor _isComposing = false;

  @state()
  private accessor _isReadonly = false;

  @query('rich-text')
  private accessor _richTextElement!: RichText;

  @property({ attribute: false })
  accessor doc!: Store;

  @property({ attribute: false })
  accessor wrapText = true;
}
