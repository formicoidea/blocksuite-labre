import { IS_MAC } from '@labre/global/env';
import { html } from 'lit';
import { query } from 'lit/decorators.js';

import { BaseCellRenderer } from '../../core/property/index.js';
import { createFromBaseCellRenderer } from '../../core/property/renderer.js';
import { stopPropagation } from '../../core/utils/event.js';
import { createIcon } from '../../core/utils/uni-icon.js';
import { TypingCommit } from '../typing-commit.js';
import { numberInputStyle, numberStyle } from './cell-renderer-css.js';
import { numberPropertyModelConfig } from './define.js';
import type { NumberPropertyDataType } from './types.js';
import {
  formatNumber,
  type NumberFormat,
  parseNumber,
} from './utils/formatter.js';

export class NumberCell extends BaseCellRenderer<
  number,
  number,
  NumberPropertyDataType
> {
  @query('input')
  private accessor _inputEle!: HTMLInputElement;

  private _getFormattedString(value: number | undefined = this.value) {
    const enableNewFormatting =
      this.view.featureFlags$.value.enable_number_formatting;
    const decimals = this.property.data$.value.decimal ?? 0;
    const formatMode = (this.property.data$.value.format ??
      'number') as NumberFormat;

    return value != undefined
      ? enableNewFormatting
        ? formatNumber(value, formatMode, decimals)
        : value.toString()
      : '';
  }

  private readonly _keydown = (e: KeyboardEvent) => {
    const ctrlKey = IS_MAC ? e.metaKey : e.ctrlKey;

    if (e.key.toLowerCase() === 'z' && ctrlKey) {
      e.stopPropagation();
      return;
    }

    if (e.key === 'Enter' && !e.isComposing) {
      requestAnimationFrame(() => {
        this.selectCurrentCell(false);
      });
    }
  };

  /**
   * The formatted text the input opened with, bound while editing: a value
   * committed while typing must not reformat the input under the caret
   * (`1,` typed, `1` committed, the comma kept).
   */
  private _opened: string | undefined;

  /** The number the editor opened with, then the last one committed: a
   *  commit writes only a change (recette 3, P3-5). */
  private _base: number | undefined;

  private _baseSet = false;

  private readonly _typing = new TypingCommit(() => this._commitTyped());

  /** Parsed input; `null` for text that is not a number yet. */
  private _parse(str: string): number | undefined | null {
    if (!str) return undefined;
    const enableNewFormatting =
      this.view.featureFlags$.value.enable_number_formatting;
    const value = enableNewFormatting ? parseNumber(str) : parseFloat(str);
    return isNaN(value) ? null : value;
  }

  private _changed(value: number | undefined): boolean {
    const base = this._baseSet ? this._base : this.value;
    if (value === base) return false;
    this._base = value;
    this._baseSet = true;
    return true;
  }

  /** While typing: a number commits, a half-typed one waits, the input is
   *  left as typed. */
  private _commitTyped() {
    this._typing.cancel();
    const input = this._inputEle;
    if (!input) return;
    const value = this._parse(input.value);
    if (value === null || !this._changed(value)) return;
    this.valueSetImmediate(value);
  }

  private readonly _setValue = (
    str: string | undefined = this._inputEle?.value
  ) => {
    this._typing.cancel();
    // No input, nothing typed: never read as a cleared value.
    if (str === undefined) return;
    const value = this._parse(str);
    if (value === null) {
      if (this._inputEle) {
        this._inputEle.value = this.value
          ? this._getFormattedString(this.value)
          : '';
      }
      return;
    }

    if (this._inputEle && value !== undefined) {
      this._inputEle.value = this._getFormattedString(value);
    }
    if (this._changed(value)) this.valueSetNextTick(value);
  };

  focusEnd = () => {
    if (!this._inputEle) return;

    const end = this._inputEle.value.length;
    this._inputEle.focus();
    this._inputEle.setSelectionRange(end, end);
  };

  _blur() {
    this.selectCurrentCell(false);
  }

  _focus() {
    if (!this.isEditing$.value) {
      this.selectCurrentCell(true);
    }
  }

  override afterEnterEditingMode() {
    this.focusEnd();
  }

  override beforeExitEditingMode() {
    this._setValue();
  }

  override disconnectedCallback() {
    if (this.isEditing$?.peek()) this._commitTyped();
    this._typing.cancel();
    super.disconnectedCallback();
  }

  override render() {
    if (this.isEditing$.value) {
      this._opened ??= this.value ? this._getFormattedString(this.value) : '';

      return html`<input
        type="text"
        autocomplete="off"
        .value="${this._opened}"
        @keydown="${this._keydown}"
        @input="${() => this._typing.schedule()}"
        @blur="${this._blur}"
        @focus="${this._focus}"
        class="${numberInputStyle} number"
        @pointerdown="${stopPropagation}"
      />`;
    } else {
      this._opened = undefined;
      this._base = undefined;
      this._baseSet = false;
      return html` <div class="${numberStyle} number">
        ${this._getFormattedString()}
      </div>`;
    }
  }
}

export const numberPropertyConfig =
  numberPropertyModelConfig.createPropertyMeta({
    icon: createIcon('NumberIcon'),
    cellRenderer: {
      view: createFromBaseCellRenderer(NumberCell),
    },
  });
