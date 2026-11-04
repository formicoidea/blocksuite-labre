import { CaptionedBlockComponent } from '@labre/affine-components/caption';
import { TOGGLE_BUTTON_PARENT_CLASS } from '@labre/affine-components/toggle-button';
import { DefaultInlineManagerExtension } from '@labre/affine-inline-preset';
import type { ParagraphBlockModel } from '@labre/affine-model';
import type { RichText } from '@labre/affine-rich-text';
import {
  BLOCK_CHILDREN_CONTAINER_PADDING_LEFT,
  EDGELESS_TOP_CONTENTEDITABLE_SELECTOR,
} from '@labre/affine-shared/consts';
import {
  BlockCommentManager,
  CitationProvider,
  DocModeProvider,
  translateKey,
} from '@labre/affine-shared/services';
import {
  calculateCollapsedSiblings,
  getNearestHeadingBefore,
  getViewportElement,
} from '@labre/affine-shared/utils';
import type { BlockComponent } from '@labre/std';
import { TextSelection } from '@labre/std';
import {
  getInlineRangeProvider,
  type InlineRangeProvider,
} from '@labre/std/inline';
import { computed, effect, signal } from '@preact/signals-core';
import { html, nothing, type PropertyValues, type TemplateResult } from 'lit';
import { query } from 'lit/decorators.js';
import { classMap } from 'lit/directives/class-map.js';
import { styleMap } from 'lit/directives/style-map.js';

import { ParagraphBlockConfigExtension } from './paragraph-block-config.js';
import { COLLAPSED_SIBLING_ATTR, paragraphBlockStyles } from './styles.js';
import { PARAGRAPH_PLACEHOLDER_WORDINGS } from './translations.js';

/**
 * Counts rather than flags: under a collapsed h1, a collapsed h2 folds the same
 * sibling, and opening the h1 must leave it folded.
 */
function changeFoldCount(view: BlockComponent, delta: 1 | -1) {
  const count = Number(view.getAttribute(COLLAPSED_SIBLING_ATTR) ?? 0) + delta;
  if (count > 0) {
    view.setAttribute(COLLAPSED_SIBLING_ATTR, String(count));
  } else {
    view.removeAttribute(COLLAPSED_SIBLING_ATTR);
  }
}

export class ParagraphBlockComponent extends CaptionedBlockComponent<ParagraphBlockModel> {
  static override styles = paragraphBlockStyles;

  focused$ = computed(() => {
    const selection = this.std.selection.value.find(
      selection => selection.blockId === this.model?.id
    );
    if (!selection) return false;
    return selection.is(TextSelection);
  });

  private readonly _composing = signal(false);

  private readonly _displayPlaceholder = signal(false);

  /**
   * The collapse state a READER holds locally. A readonly document must never
   * be written, so the chevron cannot touch `model.props.collapsed`; this
   * signal carries the reader's own expansion instead. It is a signal rather
   * than a Lit `@state()` so BlockSuite effects can depend on it as well.
   */
  private readonly _readonlyCollapsed = signal(false);

  private _inlineRangeProvider: InlineRangeProvider | null = null;

  /** The sibling views this heading holds folded. */
  private readonly _foldedViews = new Set<BlockComponent>();

  private get _collapsed() {
    return this.store.readonly
      ? this._readonlyCollapsed.value
      : this.model.props.collapsed;
  }

  private readonly _isInDatabase = () => {
    let parent = this.parentElement;
    while (parent && parent !== document.body) {
      if (parent.tagName.toLowerCase() === 'affine-database') {
        return true;
      }
      parent = parent.parentElement;
    }
    return false;
  };

  private get _placeholder() {
    const raw = this.std
      .get(ParagraphBlockConfigExtension.identifier)
      ?.getPlaceholder(this.model);
    if (!raw) return raw;
    const wording = PARAGRAPH_PLACEHOLDER_WORDINGS[raw];
    return wording ? translateKey(this.std, ...wording) : raw;
  }

  /**
   * A sibling's id comes from the document, which any writer fills as it likes:
   * the heading marks the view itself, so no id ever reaches an HTML or CSS
   * parser. An attribute and a static rule rather than an inline `display`,
   * because some blocks write their own inline `display` on their host.
   */
  private _syncFoldedViews() {
    const folding =
      this.viewType === 'display' &&
      this.model.props.type$.value.startsWith('h') &&
      this._collapsed;
    const next = new Set(
      folding
        ? this.collapsedSiblings.flatMap(
            sibling => this.std.view.getBlock(sibling.id) ?? []
          )
        : []
    );
    for (const view of this._foldedViews) {
      if (next.has(view)) continue;
      this._foldedViews.delete(view);
      changeFoldCount(view, -1);
    }
    for (const view of next) {
      if (this._foldedViews.has(view)) continue;
      this._foldedViews.add(view);
      changeFoldCount(view, 1);
    }
  }

  private _setReadonlyCollapsed(collapsed: boolean) {
    this._readonlyCollapsed.value = collapsed;
    this.requestUpdate();
  }

  get citationService() {
    return this.std.get(CitationProvider);
  }

  get attributeRenderer() {
    return this.inlineManager.getRenderer();
  }

  get attributesSchema() {
    return this.inlineManager.getSchema();
  }

  get collapsedSiblings() {
    return calculateCollapsedSiblings(this.model);
  }

  get embedChecker() {
    return this.inlineManager.embedChecker;
  }

  get inEdgelessText() {
    return (
      this.topContenteditableElement?.tagName.toLowerCase() ===
      'affine-edgeless-text'
    );
  }

  get inlineEditor() {
    return this._richTextElement?.inlineEditor;
  }

  get inlineManager() {
    return this.std.get(DefaultInlineManagerExtension.identifier);
  }

  get hasCitationSiblings() {
    return this.collapsedSiblings.some(sibling =>
      this.citationService.isCitationModel(sibling)
    );
  }

  get isCommentHighlighted() {
    return (
      this.std
        .getOptional(BlockCommentManager)
        ?.isBlockCommentHighlighted(this.model) ?? false
    );
  }

  override get topContenteditableElement() {
    if (this.std.get(DocModeProvider).getEditorMode() === 'edgeless') {
      return this.closest<BlockComponent>(
        EDGELESS_TOP_CONTENTEDITABLE_SELECTOR
      );
    }
    return this.rootComponent;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.handleEvent(
      'compositionStart',
      () => {
        this._composing.value = true;
      },
      { flavour: true }
    );
    this.handleEvent(
      'compositionEnd',
      () => {
        this._composing.value = false;
      },
      { flavour: true }
    );

    this._inlineRangeProvider = getInlineRangeProvider(this);

    this.disposables.add(
      effect(() => {
        const composing = this._composing.value;
        if (composing || this.store.readonly) {
          this._displayPlaceholder.value = false;
          return;
        }
        const textSelection = this.host.selection.find(TextSelection);
        const isCollapsed = textSelection?.isCollapsed() ?? false;
        if (!this.focused$.value || !isCollapsed) {
          this._displayPlaceholder.value = false;
          return;
        }

        this.updateComplete
          .then(() => {
            if (
              (this.inlineEditor?.yTextLength ?? 0) > 0 ||
              this._isInDatabase()
            ) {
              this._displayPlaceholder.value = false;
              return;
            }
            this._displayPlaceholder.value = true;
            return;
          })
          .catch(console.error);
      })
    );

    this.disposables.add(
      effect(() => {
        const type = this.model.props.type$.value;
        if (!type.startsWith('h') && this.model.props.collapsed) {
          this.model.props.collapsed = false;
        }
      })
    );

    // Entering readonly mode (and any later change of the persisted value)
    // seeds the reader's local state. Deliberately NOT re-run on every
    // selection change: this effect must not depend on the selection, or the
    // reader's own expansion would be overwritten mid-drag.
    this.disposables.add(
      effect(() => {
        if (this.store.readonly$.value) {
          this._setReadonlyCollapsed(this.model.props.collapsed$.value);
        }
      })
    );

    this.disposables.add(
      effect(() => {
        const collapsed = this.store.readonly
          ? this._readonlyCollapsed.value
          : this.model.props.collapsed$.value;

        // reset text selection when selected block is collapsed
        if (this.model.props.type$.value.startsWith('h') && collapsed) {
          const collapsedSiblings = this.collapsedSiblings;
          const textSelection = this.host.selection.find(TextSelection);

          if (
            textSelection &&
            collapsedSiblings.some(
              sibling => sibling.id === textSelection.blockId
            )
          ) {
            this.host.selection.clear(['text']);
          }
        }
      })
    );

    // A block mounted after this heading's last update (pasted, received from
    // a peer, rebuilt by a flavour change) is folded by the next one.
    this.disposables.add(
      this.std.view.viewUpdated.subscribe(({ type, method }) => {
        if (type === 'block' && method === 'add' && this._collapsed) {
          this.requestUpdate();
        }
      })
    );

    // > # 123
    // # 456
    //
    // we need to update collapsed state of 123 when 456 converted to text
    let beforeType = this.model.props.type$.peek();
    this.disposables.add(
      effect(() => {
        const type = this.model.props.type$.value;
        if (beforeType !== type && !type.startsWith('h')) {
          const nearestHeading = getNearestHeadingBefore(this.model);
          if (
            nearestHeading &&
            nearestHeading.props.type.startsWith('h') &&
            nearestHeading.props.collapsed &&
            !this.store.readonly
          ) {
            nearestHeading.props.collapsed = false;
          }
        }
        beforeType = type;
      })
    );
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    for (const view of this._foldedViews) changeFoldCount(view, -1);
    this._foldedViews.clear();
  }

  protected override updated(changedProperties: PropertyValues) {
    super.updated(changedProperties);
    this._syncFoldedViews();
  }

  override async getUpdateComplete() {
    const result = await super.getUpdateComplete();
    await this._richTextElement?.updateComplete;
    return result;
  }

  override renderBlock(): TemplateResult<1> {
    const { type$ } = this.model.props;
    const collapsed = this._collapsed;
    const collapsedSiblings = this.collapsedSiblings;

    const childrenId = `heading-children-${this.model.id}`;
    const children = html`<div
      id=${childrenId}
      class="affine-block-children-container"
      style=${styleMap({
        paddingLeft: `${BLOCK_CHILDREN_CONTAINER_PADDING_LEFT}px`,
        display: collapsed ? 'none' : undefined,
      })}
    >
      ${this.renderChildren(this.model)}
    </div>`;

    return html`
      <style>
        .affine-paragraph-block-container[data-has-collapsed-siblings='false']
          affine-paragraph-heading-icon
          .heading-icon {
          transform: translateX(-48px);
        }
      </style>
      <div
        class=${classMap({
          'affine-paragraph-block-container': true,
          'highlight-comment': this.isCommentHighlighted,
        })}
        data-has-collapsed-siblings="${collapsedSiblings.length > 0}"
      >
        <div
          class=${classMap({
            'affine-paragraph-rich-text-wrapper': true,
            [type$.value]: true,
            [TOGGLE_BUTTON_PARENT_CLASS]: true,
          })}
        >
          ${this.model.props.type$.value.startsWith('h')
            ? html`
                <affine-paragraph-heading-icon
                  .model=${this.model}
                ></affine-paragraph-heading-icon>
              `
            : nothing}
          ${this.model.props.type$.value.startsWith('h') &&
          collapsedSiblings.length > 0
            ? html`
                <blocksuite-toggle-button
                  .collapsed=${collapsed}
                  .controls=${childrenId}
                  .updateCollapsed=${(value: boolean) => {
                    if (this.store.readonly) {
                      this._setReadonlyCollapsed(value);
                    } else {
                      this.store.captureSync();
                      this.store.updateBlock(this.model, {
                        collapsed: value,
                      });
                    }

                    if (this.hasCitationSiblings) {
                      this.citationService.trackEvent('Expand', {
                        control: 'Source Button',
                        type: value ? 'Hide' : 'Show',
                      });
                    }
                  }}
                ></blocksuite-toggle-button>
              `
            : nothing}
          <rich-text
            .yText=${this.model.props.text.yText}
            .inlineEventSource=${this.topContenteditableElement ?? nothing}
            .undoManager=${this.store.history.undoManager}
            .attributesSchema=${this.attributesSchema}
            .attributeRenderer=${this.attributeRenderer}
            .markdownMatches=${this.inlineManager?.markdownMatches}
            .embedChecker=${this.embedChecker}
            .readonly=${this.store.readonly}
            .inlineRangeProvider=${this._inlineRangeProvider}
            .enableClipboard=${false}
            .enableUndoRedo=${false}
            .verticalScrollContainerGetter=${() =>
              getViewportElement(this.host)}
          ></rich-text>
          ${this.inEdgelessText
            ? nothing
            : html`
                <div
                  contenteditable="false"
                  class=${classMap({
                    'affine-paragraph-placeholder': true,
                    visible: this._displayPlaceholder.value,
                  })}
                >
                  ${this._placeholder}
                </div>
              `}
        </div>

        ${children}
      </div>
    `;
  }

  @query('rich-text')
  private accessor _richTextElement: RichText | null = null;

  override accessor blockContainerStyles = {
    margin: 'var(--affine-paragraph-margin, 10px 0)',
  };
}
