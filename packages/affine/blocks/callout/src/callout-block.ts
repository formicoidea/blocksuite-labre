import { CaptionedBlockComponent } from '@labre/affine-components/caption';
import {
  type IconPickerSelectDetail,
  type IconPickerTab,
  IconType,
} from '@labre/affine-components/icon-picker';
import { createLitPortal } from '@labre/affine-components/portal';
import { DefaultInlineManagerExtension } from '@labre/affine-inline-preset';
import { type CalloutBlockModel } from '@labre/affine-model';
import { focusTextModel } from '@labre/affine-rich-text';
import { EDGELESS_TOP_CONTENTEDITABLE_SELECTOR } from '@labre/affine-shared/consts';
import { DocModeProvider } from '@labre/affine-shared/services';
import { unsafeCSSVarV2 } from '@labre/affine-shared/theme';
import type { BlockComponent } from '@labre/std';
import { flip, offset } from '@floating-ui/dom';
import { css, html } from 'lit';
import { query } from 'lit/decorators.js';
import { styleMap } from '@labre/global/lit';

import { getCalloutEmojiMarginTop } from './emoji-margin.js';

/**
 * The callout stores an emoji and nothing else (`CalloutProps.emoji`, a
 * string), so its picker offers the Emoji tab alone: an icon picked there
 * would have nowhere to go. Storing an icon is a new optional prop, hence an
 * ADR first (stored format).
 */
const CALLOUT_PICKER_TABS: readonly IconPickerTab[] = ['emoji'];

export class CalloutBlockComponent extends CaptionedBlockComponent<CalloutBlockModel> {
  static override styles = css`
    :host {
      display: block;
      margin: 8px 0;
    }

    .affine-callout-block-container {
      display: flex;
      align-items: flex-start;
      padding: 5px 10px;
      border-radius: 8px;
      background-color: ${unsafeCSSVarV2('block/callout/background/grey')};
    }

    .affine-callout-emoji-container {
      user-select: none;
      font-size: 1.2em;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      /* margin-top is set per render: it depends on the first child's type. */
      margin-bottom: 10px;
      flex-shrink: 0;
    }
    .affine-callout-emoji:hover {
      cursor: pointer;
      opacity: 0.7;
    }

    .affine-callout-children {
      flex: 1;
      min-width: 0;
      padding-left: 10px;
    }
  `;

  private _emojiMenuAbortController: AbortController | null = null;
  private readonly _toggleEmojiMenu = () => {
    // The picker exists to write `props.emoji`: a read-only document opens
    // none, and a pick that lands after the document turned read-only is
    // dropped below.
    if (this.store.readonly) return;
    if (this._emojiMenuAbortController) {
      this._emojiMenuAbortController.abort();
    }
    this._emojiMenuAbortController = new AbortController();

    createLitPortal({
      template: html`<affine-icon-picker
        .tabs=${CALLOUT_PICKER_TABS}
        .activeTab=${'emoji'}
        .showRemove=${false}
        @select=${(event: CustomEvent<IconPickerSelectDetail>) => {
          if (this.store.readonly) return;
          const icon = event.detail;
          if (icon?.type !== IconType.Emoji) return;
          this.model.props.emoji = icon.unicode;
        }}
      ></affine-icon-picker>`,
      portalStyles: {
        zIndex: 'var(--affine-z-index-popover)',
      },
      container: this.host,
      computePosition: {
        referenceElement: this._emojiButton,
        placement: 'bottom-start',
        middleware: [flip(), offset(4)],
        autoUpdate: { animationFrame: true },
      },
      abortController: this._emojiMenuAbortController,
      closeOnClickAway: true,
    });
  };

  /**
   * A callout with no children has no text to click into, so the click lands on
   * the container and nothing happens — the block looks inert. Give it a
   * paragraph and put the caret in it.
   */
  private readonly _handleBlockClick = (event: MouseEvent) => {
    const target = event.target as HTMLElement;
    if (target.closest('.affine-callout-emoji-container')) return;

    if (this.model.children.length > 0) return;

    event.stopPropagation();

    focusTextModel(
      this.std,
      this.store.addBlock('affine:paragraph', {}, this.model)
    );
  };

  get attributeRenderer() {
    return this.inlineManager.getRenderer();
  }

  get attributesSchema() {
    return this.inlineManager.getSchema();
  }

  get embedChecker() {
    return this.inlineManager.embedChecker;
  }

  get inlineManager() {
    return this.std.get(DefaultInlineManagerExtension.identifier);
  }

  @query('.affine-callout-emoji')
  private accessor _emojiButton!: HTMLElement;

  override get topContenteditableElement() {
    if (this.std.get(DocModeProvider).getEditorMode() === 'edgeless') {
      return this.closest<BlockComponent>(
        EDGELESS_TOP_CONTENTEDITABLE_SELECTOR
      );
    }
    return this.rootComponent;
  }

  override renderBlock() {
    const emoji = this.model.props.emoji$.value;
    return html`
      <div
        class="affine-callout-block-container"
        @click=${this._handleBlockClick}
      >
        <div
          @click=${this._toggleEmojiMenu}
          contenteditable="false"
          class="affine-callout-emoji-container"
          style=${styleMap({
            display: emoji.length === 0 ? 'none' : undefined,
            marginTop: getCalloutEmojiMarginTop(this.model),
          })}
        >
          <span class="affine-callout-emoji">${emoji}</span>
        </div>
        <div class="affine-callout-children">
          ${this.renderChildren(this.model)}
        </div>
      </div>
    `;
  }
}
