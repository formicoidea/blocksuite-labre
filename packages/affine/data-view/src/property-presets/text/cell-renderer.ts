import { html } from 'lit';
import { query } from 'lit/decorators.js';

import { BaseCellRenderer } from '../../core/property/index.js';
import { createFromBaseCellRenderer } from '../../core/property/renderer.js';
import { createIcon } from '../../core/utils/uni-icon.js';
import { TypingCommit } from '../typing-commit.js';
import { textInputStyle, textStyle } from './cell-renderer-css.js';
import { textPropertyModelConfig } from './define.js';

/**
 * The plain-text cell (a hosted source's text and title columns, the title
 * band's text). What is typed is committed while typing (after a pause),
 * when the input loses the focus, when the cell leaves the DOM and when the
 * cell exits editing (Enter, Escape, Tab, another cell): leaving by a path
 * no view reports, a click outside the editor, lost the edit (recette 3,
 * P3-5, `text-cell-commit.unit.spec.ts`). Escape commits too: what was typed
 * is kept, as in the table before. A commit writes only what changed since
 * the editor opened or last committed, so an exit without typing writes
 * nothing and a value another peer wrote meanwhile is not overwritten.
 */
export class TextCell extends BaseCellRenderer<string, string> {
  @query('input')
  private accessor _inputEle!: HTMLInputElement;

  /**
   * The text the input opened with, bound while editing: a value the
   * source echoes back mid-typing (a commit while typing, a remote write)
   * must not rewrite the input under the caret.
   */
  private _opened: string | undefined;

  /** The last text handed to the source in this edit session. */
  private _sent: string | undefined;

  private readonly _typing = new TypingCommit(() => this._commit(false));

  private readonly _keydown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.isComposing) {
      // Leaving commits, through `beforeExitEditingMode`. Resetting the
      // input here as well made the exit write the old value back over the
      // new one (standalone-cell.unit.spec.ts).
      setTimeout(() => {
        this.selectCurrentCell(false);
      });
    }
  };

  private readonly _onBlur = () => {
    if (this.isEditing$.peek()) this._commit(false);
  };

  private _commit(nextTick: boolean) {
    this._typing.cancel();
    const input = this._inputEle;
    if (!input) return;
    const str = input.value;
    const base = this._sent ?? this._opened ?? `${this.value ?? ''}`;
    if (str === base) return;
    this._sent = str;
    if (nextTick) this.valueSetNextTick(str);
    else this.valueSetImmediate(str);
  }

  focusEnd = () => {
    if (!this._inputEle) return;

    const end = this._inputEle.value.length;
    this._inputEle.focus();
    this._inputEle.setSelectionRange(end, end);
  };

  override afterEnterEditingMode() {
    this.focusEnd();
  }

  override beforeExitEditingMode() {
    this._commit(true);
  }

  override disconnectedCallback() {
    if (this.isEditing$?.peek()) this._commit(false);
    this._typing.cancel();
    super.disconnectedCallback();
  }

  override render() {
    if (this.isEditing$.value) {
      this._opened ??= `${this.value ?? ''}`;
      return html`<input
        .value="${this._opened}"
        @keydown="${this._keydown}"
        @input="${() => this._typing.schedule()}"
        @blur="${this._onBlur}"
        class="${textInputStyle}"
      />`;
    }
    this._opened = undefined;
    this._sent = undefined;
    return html`<div class="${textStyle}">${this.value ?? ''}</div>`;
  }
}

export const textPropertyConfig = textPropertyModelConfig.createPropertyMeta({
  icon: createIcon('TextIcon'),

  cellRenderer: {
    view: createFromBaseCellRenderer(TextCell),
  },
});
