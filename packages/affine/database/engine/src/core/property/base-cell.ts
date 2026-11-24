import {
  type ChromeWording,
  fillPlaceholders,
  translateKey,
  type TranslationParams,
} from '@labre/affine-shared/services';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import { type BlockStdScope, ShadowlessElement, stdContext } from '@labre/std';
import { consume } from '@lit/context';
import { computed, type ReadonlySignal } from '@preact/signals-core';
import type { PropertyValues } from 'lit';
import { property } from 'lit/decorators.js';

import type { Cell } from '../view-manager/cell.js';
import type { CellRenderProps, DataViewCellLifeCycle } from './manager.js';

export abstract class BaseCellRenderer<
    RawValue = unknown,
    JsonValue = unknown,
    Data extends Record<string, unknown> = Record<string, unknown>,
  >
  extends SignalWatcher(WithDisposable(ShadowlessElement))
  implements DataViewCellLifeCycle, CellRenderProps<Data, RawValue, JsonValue>
{
  get expose() {
    return this;
  }

  @property({ attribute: false })
  accessor cell!: Cell<RawValue, JsonValue, Data>;

  /**
   * The editor the cell renders in, for its chrome wordings only; absent
   * outside one (a test, a detached mount), and then every wording is its
   * English fallback. Not `std`: database cells already read theirs from
   * the data source's host.
   */
  @consume({ context: stdContext })
  accessor chromeStd!: BlockStdScope;

  /**
   * A wording resolved here, while the cell is in the editor's DOM: the
   * popups a cell opens (the tag menu, the date picker) render outside it
   * and receive the resolved text.
   */
  readonly wording = (
    wording: ChromeWording,
    params?: TranslationParams
  ): string =>
    this.chromeStd
      ? translateKey(this.chromeStd, ...wording, params)
      : fillPlaceholders(wording[1], params);

  readonly$ = computed(() => {
    return this.cell.property.readonly$.value;
  });

  value$ = computed(() => {
    return this.cell.value$.value;
  });

  get property() {
    return this.cell.property;
  }

  get readonly() {
    return this.readonly$.value;
  }

  get row() {
    return this.cell.row;
  }

  get value() {
    return this.value$.value;
  }

  get view() {
    return this.cell.view;
  }

  beforeEnterEditMode(): boolean {
    return true;
  }

  blurCell() {
    return true;
  }

  type: string | undefined;

  protected override shouldUpdate(_changedProperties: PropertyValues): boolean {
    return this.cell.property.type$.value === this.type;
  }

  override connectedCallback() {
    super.connectedCallback();
    this.type = this.cell.property.type$.value;
    this.dataset.testid = this.type;
    this.style.width = '100%';
    this._disposables.addFromEvent(this, 'click', e => {
      if (this.isEditing$.value) {
        e.stopPropagation();
      }
    });

    this._disposables.addFromEvent(this, 'copy', e => {
      if (!this.isEditing$.value) return;
      e.stopPropagation();
      this.onCopy(e);
    });

    this._disposables.addFromEvent(this, 'cut', e => {
      if (!this.isEditing$.value) return;
      e.stopPropagation();
      this.onCut(e);
    });

    this._disposables.addFromEvent(this, 'paste', e => {
      if (!this.isEditing$.value) return;
      e.stopPropagation();
      this.onPaste(e);
    });
  }

  focusCell() {
    return true;
  }

  forceUpdate(): void {
    this.requestUpdate();
  }

  /**
   * The write `valueSetNextTick` deferred to the next frame, until that
   * frame runs or the cell leaves the DOM. Every editor that defers (number,
   * text, date, progress, link) does so from `beforeExitEditingMode`, which
   * the views call inside their selection change (a subscription, or an
   * `effect` on mobile) while they still flip `isEditing$` and blur: the
   * frame keeps the store write, and the re-render and undo capture it
   * starts, out of that synchronous exit. But an exit followed by the
   * editor's teardown in the same task (a click elsewhere then a navigation,
   * a host closing the document) left the frame behind: the write ran after
   * the editor was gone, and after the store was released it threw and the
   * edit was lost (#746, ADR 0057). The cell now flushes it as it leaves the
   * DOM, where no exit of its own is in progress.
   */
  private _pendingWrite: { value: RawValue | undefined; frame: number } | null =
    null;

  private _cancelPendingWrite() {
    if (!this._pendingWrite) return;
    cancelAnimationFrame(this._pendingWrite.frame);
    this._pendingWrite = null;
  }

  /** A deferred write lands later: the store may have turned readonly. */
  private _writeDeferred(value: RawValue | undefined) {
    if (this.cell.property.readonly$.peek()) return;
    this.cell.valueSet(value);
  }

  valueSetImmediate(value: RawValue | undefined): void {
    // A newer value: the pending, older one must not land after it.
    this._cancelPendingWrite();
    this.cell.valueSet(value);
  }

  valueSetNextTick(value: RawValue | undefined) {
    this._cancelPendingWrite();
    // Out of the DOM, no frame will come before the store may be released.
    if (!this.isConnected) {
      this._writeDeferred(value);
      return;
    }
    const frame = requestAnimationFrame(() => {
      this._pendingWrite = null;
      this._writeDeferred(value);
    });
    this._pendingWrite = { value, frame };
  }

  /** Write now what `valueSetNextTick` left pending, once. */
  flushPendingWrite() {
    const pending = this._pendingWrite;
    if (!pending) return;
    this._cancelPendingWrite();
    this._writeDeferred(pending.value);
  }

  override disconnectedCallback() {
    // Runs after a subclass's own teardown commit (each calls `super`
    // last): that commit, an immediate write, already cancelled a pending
    // older value.
    this.flushPendingWrite();
    super.disconnectedCallback();
  }

  onCopy(_e: ClipboardEvent) {}

  onCut(_e: ClipboardEvent) {}

  afterEnterEditingMode(): void {
    // do nothing
  }

  beforeExitEditingMode() {
    // do nothing
  }

  onPaste(_e: ClipboardEvent) {}

  @property({ attribute: false })
  accessor isEditing$!: ReadonlySignal<boolean>;

  @property({ attribute: false })
  accessor selectCurrentCell!: (editing: boolean) => void;
}
