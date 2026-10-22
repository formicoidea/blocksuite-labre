import { selectionPaneCommands } from '@labre/affine-block-surface';
import type { FrameBlockModel } from '@labre/affine-model';
import { TOOLBAR_RENAME, translateKey } from '@labre/affine-shared/services';
import { DisposableGroup } from '@labre/global/disposable';
import { WithDisposable } from '@labre/global/lit';
import {
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandInvocation,
  runCommand,
  ShadowlessElement,
} from '@labre/std';
import { css, html, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import type * as Y from 'yjs';

const styles = css`
  .frame-card-title-container {
    display: flex;
    white-space: nowrap;
    display: flex;
    justify-content: start;
    align-items: center;
    width: 100%;
    height: 20px;
    box-sizing: border-box;
    gap: 6px;
    font-size: var(--affine-font-sm);
    cursor: default;
    position: relative;
  }

  .frame-card-title-container .card-index {
    display: flex;
    align-self: center;
    align-items: center;
    justify-content: center;
    min-width: 18px;
    height: 18px;
    box-sizing: border-box;
    border-radius: 2px;
    background: var(--affine-black);
    margin-left: 2px;

    color: var(--affine-white);
    text-align: center;
    font-weight: 500;
    line-height: 18px;
  }

  .frame-card-title-container .card-title {
    height: 20px;
    color: var(--affine-text-primary-color);
    font-weight: 400;
    line-height: 20px;

    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .frame-card-title-container .card-title-input {
    flex: 1;
    min-width: 0;
    height: 20px;
    box-sizing: border-box;
    padding: 0 4px;
    border: 1px solid var(--affine-primary-color);
    border-radius: 4px;
    background: var(--affine-background-primary-color);
    box-shadow: var(--affine-active-shadow);
    color: var(--affine-text-primary-color);
    font: inherit;
    line-height: 18px;
    outline: none;
  }
`;

export const AFFINE_FRAME_CARD_TITLE = 'affine-frame-card-title';

/** How the panel invokes the registry, like its reorder and the pane's rows. */
const PANEL_INVOCATION: CommandInvocation = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
};

function renameCommand(): AnyCommandDescriptor {
  const command = selectionPaneCommands.find(
    c => c.id === 'canvas.frame.rename'
  );
  if (!command) throw new Error('frame panel: no canvas.frame.rename');
  return command;
}

/**
 * A card's number and name. A double-click on the name renames the frame in
 * place (recette 1, P0-1.4): Enter or leaving the field saves, Escape cancels.
 *
 * The field is a plain input committed once, through `canvas.frame.rename`
 * (the selection pane's own rename): the read-only refusal, the empty and
 * unchanged no-ops and the one undo step are the command's. It used to be a
 * rich text bound live to the stored title, which wrote on every key — an
 * Escape could not take a keystroke back. The descriptor is imported, not
 * looked up in the registry, so the rename works in page mode too.
 */
export class FrameCardTitle extends WithDisposable(ShadowlessElement) {
  static override styles = styles;

  private readonly _clearTitleDisposables = () => {
    this._titleDisposables?.dispose();
    this._titleDisposables = null;
  };

  private _titleDisposables: DisposableGroup | null = null;

  private readonly _updateElement = () => {
    this.requestUpdate();
  };

  private readonly _startEditing = (e: MouseEvent) => {
    e.stopPropagation();
    if (this.std.store.readonly) return;
    this._editing = true;
  };

  private _commit(input: HTMLInputElement) {
    if (!this._editing) return;
    this._editing = false;
    runCommand(this.std, renameCommand(), PANEL_INVOCATION, {
      id: this.frame.id,
      title: input.value,
    });
  }

  private readonly _onKeydown = (e: KeyboardEvent) => {
    // The canvas and the host's panel bind keys (Backspace, Escape closes a
    // panel): a key typed into the name reaches neither.
    e.stopPropagation();
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this._commit(e.currentTarget as HTMLInputElement);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._editing = false;
    }
  };

  private _setFrameDisposables(title: Y.Text) {
    this._clearTitleDisposables();
    title.observe(this._updateElement);
    this._titleDisposables = new DisposableGroup();
    this._titleDisposables.add({
      dispose: () => {
        title.unobserve(this._updateElement);
      },
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._clearTitleDisposables();
  }

  private _renderName() {
    const name = this.frame.props.title.toString();
    if (!this._editing) {
      return html`<div
        class="card-title"
        data-testid="frame-card-title"
        title=${name}
        @click=${(e: MouseEvent) => e.stopPropagation()}
        @dblclick=${this._startEditing}
      >
        ${name}
      </div>`;
    }
    return html`<input
      class="card-title-input"
      data-testid="frame-card-title-input"
      aria-label=${translateKey(this.std, ...TOOLBAR_RENAME)}
      .value=${name}
      @click=${(e: MouseEvent) => e.stopPropagation()}
      @dblclick=${(e: MouseEvent) => e.stopPropagation()}
      @select=${(e: Event) => {
        // The field's own text selection bubbles a native select event, which
        // the card's own select listener would read as a frame pick.
        e.stopPropagation();
      }}
      @keydown=${this._onKeydown}
      @blur=${(e: FocusEvent) => this._commit(e.target as HTMLInputElement)}
    />`;
  }

  override render() {
    return html`<div class="frame-card-title-container">
      <div
        class="card-index"
        @click=${(e: MouseEvent) => e.stopPropagation()}
        @dblclick=${(e: MouseEvent) => e.stopPropagation()}
      >
        ${this.cardIndex + 1}
      </div>
      ${this._renderName()}
    </div>`;
  }

  override updated(_changedProperties: PropertyValues) {
    if (_changedProperties.has('frame')) {
      this._setFrameDisposables(this.frame.props.title.yText);
    }
    if (_changedProperties.has('_editing') && this._editing) {
      this._input?.focus();
      this._input?.select();
    }
  }

  @state()
  private accessor _editing = false;

  @query('.card-title-input')
  private accessor _input: HTMLInputElement | null = null;

  @property({ attribute: false })
  accessor cardIndex!: number;

  @property({ attribute: false })
  accessor frame!: FrameBlockModel;

  @property({ attribute: false })
  accessor std!: BlockStdScope;
}

declare global {
  interface HTMLElementTagNameMap {
    [AFFINE_FRAME_CARD_TITLE]: FrameCardTitle;
  }
}
