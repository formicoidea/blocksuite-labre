import { EdgelessFrameManager, frameCommands } from '@labre/affine-block-frame';
import type { FrameBlockModel } from '@labre/affine-model';
import {
  DocModeProvider,
  EditPropsStore,
  translateKey,
} from '@labre/affine-shared/services';
import {
  createPanelReorderDrag,
  type PanelDragPoint,
  type PanelReorderDrag,
} from '@labre/affine-shared/utils';
import { DisposableGroup } from '@labre/global/disposable';
import { Bound } from '@labre/global/gfx';
import { SignalWatcher, WithDisposable } from '@labre/global/lit';
import {
  type AnyCommandDescriptor,
  type CommandInvocation,
  type EditorHost,
  runCommand,
  ShadowlessElement,
} from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';
import type { Store } from '@labre/store';
import { css, html, nothing, type PropertyValues } from 'lit';
import { property, query, state } from 'lit/decorators.js';
import { keyed } from 'lit/directives/keyed.js';
import { repeat } from 'lit/directives/repeat.js';

import {
  type DragEvent,
  type FitViewEvent,
  FrameCard,
  type SelectEvent,
} from '../card/frame-card.js';
import { FRAME_PANEL_EMPTY_PLACEHOLDER } from '../translations.js';

const compare = EdgelessFrameManager.framePresentationComparator;

/**
 * How the panel invokes the registry: from the editor's chrome, on the cards
 * it names, like the selection pane's rows.
 */
const PANEL_INVOCATION: CommandInvocation = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
};

function reorderCommand(): AnyCommandDescriptor {
  const command = frameCommands.find(c => c.id === 'canvas.frame.reorder');
  if (!command) throw new Error('frame panel: no canvas.frame.reorder');
  return command;
}

/**
 * Where a release would land the dragged cards: before the frame `before`
 * (`null` = at the end), the line drawn at `lineY` in the list's box, at the
 * gap `gap` of the cards.
 */
type FrameDrop = { gap: number; before: string | null; lineY: number };

type FrameListItem = {
  frame: FrameBlockModel;

  // frame index
  frameIndex: string;

  // card index
  cardIndex: number;
};

const styles = css`
  .frame-list-container {
    display: flex;
    align-items: start;
    box-sizing: border-box;
    flex-direction: column;
    width: 100%;
    gap: 16px;
    position: relative;
    margin: 0 8px;
  }

  .no-frame-container {
    display: flex;
    flex-direction: column;
    width: 100%;
    min-width: 300px;
  }

  .no-frame-placeholder {
    margin-top: 240px;
    align-self: center;
    width: 230px;
    height: 48px;
    color: var(--affine-text-secondary-color, #8e8d91);
    text-align: center;

    /* light/base */
    font-size: 15px;
    font-style: normal;
    font-weight: 400;
    line-height: 24px;
  }

  .insert-indicator {
    height: 2px;
    border-radius: 1px;
    background-color: var(--affine-blue-600);
    position: absolute;
    contain: layout size;
    width: 284px;
    left: 0;
  }

  /*
    The drag mask, created by the drag controller (createPanelReorderDrag):
    over the whole viewport for the length of the drag, so its cursor — set
    inline by the controller, "grabbing" or "not-allowed" — speaks wherever
    the pointer is. The dragged cards are appended after it, so they paint
    over it.
  */
  .frame-panel-drag-mask {
    position: fixed;
    inset: 0;
    z-index: calc(var(--affine-z-index-popover, 0) + 3);
  }
`;

export const AFFINE_FRAME_PANEL_BODY = 'affine-frame-panel-body';

export class FramePanelBody extends SignalWatcher(
  WithDisposable(ShadowlessElement)
) {
  static override styles = styles;

  private readonly _clearDocDisposables = () => {
    this._docDisposables?.dispose();
    this._docDisposables = null;
  };

  /**
   * click at blank area to clear selection
   */
  private readonly _clickBlank = (e: MouseEvent) => {
    e.stopPropagation();
    // check if click at frame-card, if not, set this._selected to empty
    if (
      (e.target as HTMLElement).closest('frame-card') ||
      this._selected.length === 0
    ) {
      return;
    }

    this._selected = [];
    this._gfx.selection.set({
      elements: this._selected,
      editing: false,
    });
  };

  private _docDisposables: DisposableGroup | null = null;

  private _frameItems: FrameListItem[] = [];

  /** The side panels' one reorder gesture (ADR 0034), made on connect. */
  private _reorder: PanelReorderDrag | null = null;

  /** The card a press landed on: what a pick-up picks up. */
  private _pressed: { card: FrameCard; shiftKey: boolean } | null = null;

  /** The dragged cards' copies following the pointer, top one last. */
  private _ghosts: FrameCard[] = [];

  /** The list's `gap`, read once at the pick-up: the drop line sits in it. */
  private _listGap = 0;

  private _indicatorTranslateY = 0;

  private _lastEdgelessRootId = '';

  private get _gfx() {
    return this.editorHost.std.get(GfxControllerIdentifier);
  }

  private readonly _selectFrame = (e: SelectEvent) => {
    // A drag ends with a click on the card it started on; that click is not one.
    if (this._reorder?.consumeSwallowedClick()) return;
    const { selected, id, multiselect } = e.detail;

    if (!selected) {
      // de-select frame
      this._selected = this._selected.filter(frameId => frameId !== id);
    } else if (multiselect) {
      this._selected = [...this._selected, id];
    } else {
      this._selected = [id];
    }

    this._gfx.selection.set({
      elements: this._selected,
      editing: false,
    });
  };

  private readonly _updateFrameItems = () => {
    this._frameItems = this.frames.map((frame, idx) => ({
      frame,
      frameIndex: frame.props.presentationIndex ?? frame.props.index,
      cardIndex: idx,
    }));
  };

  get frames() {
    const frames = this.editorHost.store
      .getBlocksByFlavour('affine:frame')
      .map(block => block.model as FrameBlockModel);
    return frames.sort(compare);
  }

  get viewportPadding(): [number, number, number, number] {
    return this.fitPadding
      ? ([0, 0, 0, 0].map((val, idx) =>
          Number.isFinite(this.fitPadding[idx]) ? this.fitPadding[idx] : val
        ) as [number, number, number, number])
      : [0, 0, 0, 0];
  }

  /* ── Drag to reorder ────────────────────────────────────────────────── */

  /*
   * The gesture is the side panels' one controller (`createPanelReorderDrag`,
   * `@labre/affine-shared/utils`, ADR 0034), shared with the selection pane:
   * pointer events, the 5px threshold, the read-only refusal, the mask and
   * its cursor, Escape and `pointercancel` as cancels, the swallowed click.
   * What is the panel's own is below: the selected cards move together, their
   * copies follow the pointer, a line marks the gap, and the write is
   * `canvas.frame.reorder`.
   */

  private _createReorderDrag(): PanelReorderDrag {
    return createPanelReorderDrag<FrameDrop>({
      readonly: () => this.editorHost.store.readonly,
      rows: () => this._cards(),
      bounds: () => this,
      onPickUp: press => this._pickUp(press),
      dropAt: gap => this._dropAt(gap),
      onMove: (drop, point) => {
        for (const ghost of this._ghosts) {
          ghost.pos = { x: point.clientX, y: point.clientY };
        }
        this._indicatorTranslateY = drop?.lineY ?? 0;
        this.insertIndex = drop?.gap;
        this.requestUpdate();
      },
      onDrop: drop => this._reorderFrames(this._selected.slice(), drop.before),
      onEnd: () => {
        this._ghosts.forEach(ghost => ghost.remove());
        this._ghosts = [];
        this._pressed = null;
        this._dragging = false;
        this.insertIndex = undefined;
        this._updateFrames();
      },
      mask: {
        host: () => this,
        className: 'frame-panel-drag-mask',
        testId: 'frame-panel-drag-mask',
      },
    });
  }

  /** The cards on screen, in presentation order. */
  private _cards(): FrameCard[] {
    const list = this.frameListContainer;
    if (!list) return [];
    return Array.from(
      list.querySelectorAll<FrameCard>(':scope > affine-frame-card')
    );
  }

  /** A press on a card: the controller decides whether it becomes a drag. */
  private _drag(e: DragEvent) {
    const { event } = e.detail;
    this._pressed = {
      card: e.currentTarget as FrameCard,
      shiftKey: event.shiftKey,
    };
    this._reorder?.press(event);
  }

  /**
   * The press became a drag. The pressed card is selected if it was not
   * (shift adds it to the selection), and every selected card moves: their
   * copies — the last two, the top one counting them — follow the pointer,
   * and the cards themselves stay in place as placeholders.
   */
  private _pickUp(press: PanelDragPoint) {
    const card = this._pressed?.card;
    if (!card?.frame) return;
    const id = card.frame.id;
    if (!this._selected.includes(id)) {
      this._selected = this._pressed?.shiftKey ? [...this._selected, id] : [id];
      this._gfx.selection.set({ elements: this._selected, editing: false });
    }

    const list = this.frameListContainer;
    this._listGap = list ? parseFloat(getComputedStyle(list).gap) || 0 : 0;

    const items = new Map(this._frameItems.map(item => [item.frame.id, item]));
    const dragged = this._selected.flatMap(selected => {
      const item = items.get(selected);
      return item ? [item] : [];
    });
    const width =
      this.renderRoot.querySelector<FrameCard>(
        `[data-frame-id="${dragged[0]?.frame.id}"]`
      )?.clientWidth ?? card.clientWidth;

    this._ghosts = dragged.slice(-2).map((item, idx, arr) => {
      const ghost = new FrameCard();
      ghost.frame = item.frame;
      ghost.cardIndex = item.cardIndex;
      ghost.frameIndex = item.frameIndex;
      ghost.status = 'dragging';
      ghost.stackOrder = arr.length - 1 - idx;
      ghost.pos = { x: press.clientX, y: press.clientY };
      ghost.width = width;
      ghost.std = this.editorHost.std;
      if (ghost.stackOrder === 0) {
        ghost.dataset.testid = 'frame-panel-drag-ghost';
        if (dragged.length > 1) ghost.draggingCardNumber = dragged.length;
      }
      return ghost;
    });
    this.renderRoot.append(...this._ghosts);
    this._dragging = true;
  }

  /**
   * A release at the gap `gap` puts the selected cards right before the first
   * card at or after it that does not move, or at the end. The line sits in
   * the middle of the list's gap: above the card under the gap, or under the
   * last card — the frame panel's own drag used to draw that last one at 0.
   */
  private _dropAt(gap: number): FrameDrop | null {
    const cards = this._cards();
    const last = cards[cards.length - 1];
    if (!last) return null;
    const moving = new Set(this._selected);
    const before =
      cards
        .slice(gap)
        .map(card => card.frame?.id)
        .find(id => id !== undefined && !moving.has(id)) ?? null;
    const half = this._listGap / 2;
    const under = cards[gap];
    const lineY = under
      ? under.offsetTop - half
      : last.offsetTop + last.offsetHeight + half;
    return { gap, before, lineY };
  }

  private _fitToElement(e: FitViewEvent) {
    const { block } = e.detail;
    const bound = Bound.deserialize(block.xywh);
    const docModeProvider = this.editorHost.std.get(DocModeProvider);

    if (docModeProvider.getEditorMode() !== 'edgeless') {
      // When click frame card in page mode
      // Should switch to edgeless mode and set viewport to the frame
      const viewport = {
        xywh: block.xywh,
        referenceId: block.id,
        padding: this.viewportPadding as [number, number, number, number],
      };

      this.editorHost.std.get(EditPropsStore).setStorage('viewport', viewport);
      this.editorHost.std.get(DocModeProvider).setEditorMode('edgeless');
    } else {
      this._gfx.viewport.setViewportByBound(bound, this.viewportPadding, true);
    }
  }

  private _renderEmptyContent() {
    const emptyContent = html` <div class="no-frame-container">
      <div class="no-frame-placeholder">
        ${translateKey(this.editorHost.std, ...FRAME_PANEL_EMPTY_PLACEHOLDER)}
      </div>
    </div>`;

    return emptyContent;
  }

  private _renderFrameList() {
    const selectedFrames = new Set(this._selected);
    const frameCards = html`${repeat(this._frameItems, frameItem => {
      const { frame, frameIndex, cardIndex } = frameItem;
      return keyed(
        frame,
        html`<affine-frame-card
          data-frame-id=${frame.id}
          .frame=${frame}
          .std=${this.editorHost.std}
          .cardIndex=${cardIndex}
          .frameIndex=${frameIndex}
          .status=${selectedFrames.has(frame.id)
            ? this._dragging
              ? 'placeholder'
              : 'selected'
            : 'none'}
          @select=${this._selectFrame}
          @fitview=${this._fitToElement}
          @drag=${this._drag}
        ></affine-frame-card>`
      );
    })}`;

    const frameList = html` <div class="frame-list-container">
      ${this.insertIndex !== undefined
        ? html`<div
            class="insert-indicator"
            data-testid="frame-panel-drop-indicator"
            style=${`transform: translateY(${this._indicatorTranslateY}px)`}
          ></div>`
        : nothing}
      ${frameCards}
    </div>`;
    return frameList;
  }

  /**
   * Move the selected cards, as one block, right before the frame `before`
   * (`null` = at the end; `_dropAt` picks it). The write is
   * `canvas.frame.reorder` (ADR 0034): the read-only refusal, the no-op check
   * and the one undo step live in its action, run through the imported
   * descriptor so the panel reorders in page mode too, where the command is
   * not registered.
   */
  private _reorderFrames(selected: string[], before: string | null) {
    if (!selected.length) return;
    runCommand(this.editorHost.std, reorderCommand(), PANEL_INVOCATION, {
      ids: selected,
      before,
    });
    this._updateFrames();
  }

  private _setDocDisposables(doc: Store) {
    this._clearDocDisposables();
    this._docDisposables = new DisposableGroup();
    this._docDisposables.add(
      doc.slots.blockUpdated.subscribe(({ type, flavour }) => {
        if (flavour === 'affine:frame' && type !== 'update') {
          requestAnimationFrame(() => {
            this._updateFrames();
          });
        }
      })
    );
  }

  private _updateFrames() {
    if (this._dragging) return;

    if (!this.frames.length) {
      this._selected = [];
      this._frameItems = [];
      return;
    }

    const frameItems: FramePanelBody['_frameItems'] = [];
    const oldSelectedSet = new Set(this._selected);
    const newSelected: string[] = [];
    const frames = this.frames.sort(compare);
    frames.forEach((frame, idx) => {
      const frameItem = {
        frame,
        frameIndex: frame.props.presentationIndex ?? frame.props.index,
        cardIndex: idx,
      };

      frameItems.push(frameItem);
      if (oldSelectedSet.has(frame.id)) {
        newSelected.push(frame.id);
      }
    });

    this._frameItems = frameItems;
    this._selected = newSelected;
    this.requestUpdate();
  }

  override connectedCallback() {
    super.connectedCallback();
    this._updateFrameItems();
    this._reorder = this._createReorderDrag();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._clearDocDisposables();
    this._reorder?.dispose();
    this._reorder = null;
  }

  override firstUpdated() {
    const disposables = this.disposables;
    disposables.addFromEvent(this, 'click', this._clickBlank);
  }

  override render() {
    this._updateFrameItems();
    return html` ${this._frameItems.length
      ? this._renderFrameList()
      : this._renderEmptyContent()}`;
  }

  override updated(_changedProperties: PropertyValues) {
    if (_changedProperties.has('editorHost') && this.editorHost) {
      this._setDocDisposables(this.editorHost.store);
      // after switch to edgeless mode, should update the selection
      if (this.editorHost.store.id === this._lastEdgelessRootId) {
        this._gfx.selection.set({
          elements: this._selected,
          editing: false,
        });
      } else {
        this._selected = this._selected.length ? [] : this._selected;
      }
      this._lastEdgelessRootId = this.editorHost.store.id;
    }
  }

  @state()
  private accessor _dragging = false;

  // Store the ids of the selected frames
  @state()
  private accessor _selected: string[] = [];

  @property({ attribute: false })
  accessor editorHost!: EditorHost;

  @property({ attribute: false })
  accessor fitPadding!: number[];

  @query('.frame-list-container')
  accessor frameListContainer!: HTMLElement;

  @property({ attribute: false })
  accessor insertIndex: number | undefined = undefined;
}

declare global {
  interface HTMLElementTagNameMap {
    [AFFINE_FRAME_PANEL_BODY]: FramePanelBody;
  }
}
