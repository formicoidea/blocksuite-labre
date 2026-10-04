import {
  EDITOR_ANCHORED_PANEL_Z_INDEX,
  filterSelectionPaneTree,
  type SelectionPaneNode,
  SelectionPaneModel,
  selectionPaneCommands,
  selectionPaneFilterMembers,
  selectionPaneFilterTargets,
  selectionPaneTree,
} from '@labre/affine-block-surface';
import {
  menu,
  popMenu,
  popupTargetFromElement,
} from '@labre/affine-components/context-menu';
import type { RootBlockModel } from '@labre/affine-model';
import { TOUCH_TARGET_MIN_PX } from '@labre/affine-shared/consts';
import {
  TOOLBAR_LOCK,
  TOOLBAR_RENAME,
  translateKey,
} from '@labre/affine-shared/services';
import {
  type AnyCommandDescriptor,
  type CommandInvocation,
  runCommand,
  WidgetComponent,
  WidgetViewExtension,
} from '@labre/std';
import { GfxControllerIdentifier, type GfxModel } from '@labre/std/gfx';
import {
  ArrowDownSmallIcon,
  ArrowRightSmallIcon,
  FilterIcon,
  InvisibleIcon,
  LockIcon,
  UnlockIcon,
  ViewIcon,
} from '@blocksuite/icons/lit';
import { css, html, nothing, unsafeCSS } from 'lit';
import { state } from 'lit/decorators.js';
import { repeat } from 'lit/directives/repeat.js';
import { styleMap } from 'lit/directives/style-map.js';
import { literal, unsafeStatic } from 'lit/static-html.js';

import {
  SELECTION_PANE_CLOSE,
  SELECTION_PANE_COLLAPSE,
  SELECTION_PANE_EMPTY,
  SELECTION_PANE_EXPAND,
  SELECTION_PANE_FILTER,
  SELECTION_PANE_FILTER_ALL,
  SELECTION_PANE_FILTER_BOARD,
  SELECTION_PANE_FILTER_FRAME,
  SELECTION_PANE_TITLE,
  SELECTION_PANE_HIDE,
  SELECTION_PANE_SHOW,
  SELECTION_PANE_UNLOCK,
} from '../translations.js';
import { selectionPaneRowIcon, selectionPaneRowLabel } from './labels.js';

export const EDGELESS_SELECTION_PANE_WIDGET = 'edgeless-selection-pane-widget';

/** The catalogue's measure: an icon, a label and a toggle, never most of a phone. */
const PANEL_WIDTH = 'min(320px, 85vw)';

/** Indent per nesting level, in px. */
const INDENT_PX = 16;

/** Pointer travel before a press on a row becomes a drag rather than a click. */
const DRAG_THRESHOLD_PX = 4;

/**
 * How the pane invokes the registry. The pane is not one of the registry's
 * surfaces (a designed panel, not an enumeration of commands): like the
 * contextual toolbar it acts on ONE element, the row's, and `source` says it
 * came from the editor's chrome.
 */
const PANE_INVOCATION: CommandInvocation = {
  surface: 'contextual-toolbar',
  source: 'toolbar:general',
};

function paneCommand(id: string): AnyCommandDescriptor {
  const command = selectionPaneCommands.find(c => c.id === id);
  if (!command) throw new Error(`selection pane: no command ${id}`);
  return command;
}

/** One visible row: the node, and how deep it sits. */
interface PaneRow {
  node: SelectionPaneNode;
  depth: number;
  /** Its siblings in the FULL tree, top first — what a drop is computed in. */
  siblings: readonly SelectionPaneNode[];
}

interface DragState {
  id: string;
  groupId: string | undefined;
  siblings: readonly SelectionPaneNode[];
  x: number;
  y: number;
  dragging: boolean;
}

/**
 * The **selection pane** (ADR 0031, stage 2): the canvas elements by z-order,
 * top first, the library's own panel behind `SelectionPaneProvider`.
 *
 * ## Docked like the artefact catalogue
 *
 * A full-height column down the left edge of the editor, inside it — the
 * geometry, layer, zero-width host and wheel capture are the catalogue's, for
 * the catalogue's reasons (see `artefact-catalogue-widget.ts`). What differs
 * is the dismissal: the pane is a place you WORK from, its selection mirrors
 * the canvas both ways, so a click on the canvas does not put it away. × and
 * Escape (with the pointer or focus in the pane) do.
 *
 * ## Rows
 *
 * Drawn from `selectionPaneTree(std)` — the same headless tree a host pane
 * would draw — and labelled at render time ({@link selectionPaneRowLabel}).
 * A group or a mindmap is a collapsible row; collapse is this panel's state,
 * never stored. Hover highlights the element on the canvas, click selects it
 * (shift / ctrl / cmd adds or removes it, like on the canvas), the padlock
 * locks that row alone, a double-click renames a group, and a drag moves a row
 * among its siblings. Every write goes through `runCommand`, so the read-only
 * refusal and the undo step live in one place.
 */
export class EdgelessSelectionPaneWidget extends WidgetComponent<RootBlockModel> {
  static override styles = css`
    :host {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 0;
      z-index: ${unsafeCSS(EDITOR_ANCHORED_PANEL_Z_INDEX)};
      pointer-events: none;
      font-family: var(--affine-font-family);
    }

    .selection-pane-panel {
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: ${unsafeCSS(PANEL_WIDTH)};
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      background: var(--affine-background-overlay-panel-color, #fff);
      border-right: 1px solid var(--affine-border-color);
      box-shadow: var(--affine-shadow-2);
      color: var(--affine-text-primary-color);
      font-size: 14px;
      line-height: 1.4;
      pointer-events: auto;
      user-select: none;
    }

    .selection-pane-panel:focus-visible {
      outline: 2px solid var(--affine-primary-color);
      outline-offset: -2px;
    }

    .selection-pane-head {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 8px 8px 8px 16px;
      border-bottom: 1px solid var(--affine-border-color);
      font-weight: 600;
    }

    .selection-pane-title {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .selection-pane-head-button {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: ${unsafeCSS(TOUCH_TARGET_MIN_PX)}px;
      height: ${unsafeCSS(TOUCH_TARGET_MIN_PX)}px;
      border: none;
      border-radius: 8px;
      background: transparent;
      color: var(--affine-icon-color);
      font-family: inherit;
      font-size: 20px;
      line-height: 1;
      cursor: pointer;
    }

    .selection-pane-head-button svg {
      width: 20px;
      height: 20px;
    }

    .selection-pane-head-button[data-active='true'] {
      color: var(--affine-primary-color);
    }

    .selection-pane-head-button:hover,
    .selection-pane-head-button:focus-visible {
      background: var(--affine-hover-color);
    }

    .selection-pane-filter-label {
      padding: 6px 16px;
      border-bottom: 1px solid var(--affine-border-color);
      color: var(--affine-text-secondary-color);
      font-size: 12px;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .selection-pane-body {
      flex: 1;
      min-height: 0;
      overflow-y: auto;
      overflow-x: hidden;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
      padding: 4px 0 16px;
    }

    .selection-pane-empty {
      padding: 16px;
      color: var(--affine-text-secondary-color);
    }

    .selection-pane-row {
      display: flex;
      align-items: center;
      gap: 4px;
      min-height: 32px;
      box-sizing: border-box;
      padding-right: 8px;
      border-top: 2px solid transparent;
      border-bottom: 2px solid transparent;
      cursor: pointer;
    }

    @media (hover: hover) {
      .selection-pane-row:hover {
        background: var(--affine-hover-color);
      }
    }

    .selection-pane-row[data-selected] {
      background: var(--affine-hover-color);
      color: var(--affine-primary-color);
    }

    .selection-pane-row[data-drop='above'] {
      border-top-color: var(--affine-primary-color);
    }

    .selection-pane-row[data-drop='below'] {
      border-bottom-color: var(--affine-primary-color);
    }

    .selection-pane-row[data-dragging] {
      opacity: 0.5;
    }

    .selection-pane-chevron,
    .selection-pane-eye,
    .selection-pane-lock {
      flex: none;
      display: flex;
      align-items: center;
      justify-content: center;
      width: 24px;
      height: 24px;
      padding: 0;
      border: none;
      border-radius: 4px;
      background: transparent;
      color: var(--affine-icon-color);
      cursor: pointer;
    }

    .selection-pane-chevron svg,
    .selection-pane-eye svg,
    .selection-pane-lock svg,
    .selection-pane-icon svg {
      width: 16px;
      height: 16px;
    }

    .selection-pane-chevron:hover,
    .selection-pane-eye:hover,
    .selection-pane-lock:hover {
      background: var(--affine-hover-color);
    }

    .selection-pane-chevron[hidden] {
      visibility: hidden;
    }

    /*
      Off states show on hover only, like PowerPoint's pane: a column of open
      eyes and open padlocks on every row would be noise. A hidden or locked
      row keeps its mark visible, which is what makes it findable.
    */
    .selection-pane-eye[aria-pressed='false'],
    .selection-pane-lock[aria-pressed='false'] {
      opacity: 0;
    }

    .selection-pane-row:hover .selection-pane-eye,
    .selection-pane-row:hover .selection-pane-lock,
    .selection-pane-eye:focus-visible,
    .selection-pane-lock:focus-visible {
      opacity: 1;
    }

    .selection-pane-row[data-hidden-local] .selection-pane-label,
    .selection-pane-row[data-hidden-local] .selection-pane-icon {
      opacity: 0.5;
    }

    .selection-pane-lock:disabled {
      cursor: default;
      color: var(--affine-text-disable-color);
    }

    .selection-pane-icon {
      flex: none;
      display: flex;
      align-items: center;
      color: var(--affine-icon-color);
    }

    .selection-pane-label {
      flex: 1;
      min-width: 0;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    .selection-pane-rename {
      flex: 1;
      min-width: 0;
      padding: 2px 6px;
      border: 1px solid var(--affine-border-color);
      border-radius: 4px;
      background: var(--affine-background-primary-color);
      color: inherit;
      font: inherit;
      outline: none;
    }

    .selection-pane-rename:focus {
      box-shadow: var(--affine-active-shadow);
      border-color: var(--affine-primary-color);
    }
  `;

  @state()
  private accessor _open = false;

  /** Group rows the user folded. UI state, never stored. */
  @state()
  private accessor _collapsed: ReadonlySet<string> = new Set();

  /** The frame or board the list is narrowed to, or `null`. */
  @state()
  private accessor _filter: string | null = null;

  /** The group row being renamed, or `null`. */
  @state()
  private accessor _renaming: string | null = null;

  /** Where the dragged row would land. */
  @state()
  private accessor _drop: {
    id: string;
    position: 'above' | 'below';
  } | null = null;

  /** Bumped when the canvas selection changes, so the rows repaint. */
  @state()
  private accessor _selectionRevision = 0;

  private _drag: DragState | null = null;

  /** A drag ends with a click on the row it started on; that click is not one. */
  private _swallowNextClick = false;

  get paneOpen() {
    return this._open;
  }

  private get _gfx() {
    return this.std.get(GfxControllerIdentifier);
  }

  private _setOpen(open: boolean) {
    this._open = open;
    const model = this.std.getOptional(SelectionPaneModel);
    if (model) model.open$.value = open;
    if (!open) {
      this._renaming = null;
      this._clearHighlight();
    }
  }

  /** Show the pane. Called through `SelectionPaneProvider` only. */
  openPanel() {
    this._setOpen(true);
  }

  /** Put the pane away. Writes nothing but its own state. */
  readonly closePanel = () => {
    this._setOpen(false);
  };

  private readonly _swallow = (event: Event) => {
    event.stopPropagation();
  };

  private readonly _onHostKeydown = (event: KeyboardEvent) => {
    if (!this._open || event.key !== 'Escape') return;
    if (!event.composedPath().includes(this)) return;
    if (this._renaming) return;
    event.stopPropagation();
    this.closePanel();
  };

  /** Same capture as the catalogue: a wheel over the pane scrolls the pane. */
  private readonly _onHostWheel = (event: WheelEvent) => {
    if (!this._open) return;
    if (!event.composedPath().includes(this)) return;
    event.stopPropagation();
  };

  private _wire() {
    const host = this.std.host;
    host.addEventListener('keydown', this._onHostKeydown, true);
    host.addEventListener('wheel', this._onHostWheel, true);
    const subscription = this._gfx.selection.slots.updated.subscribe(() => {
      this._selectionRevision++;
    });
    this._disposables.add(() => {
      host.removeEventListener('keydown', this._onHostKeydown, true);
      host.removeEventListener('wheel', this._onHostWheel, true);
      subscription.unsubscribe();
      this._endDrag();
    });
  }

  override connectedCallback() {
    super.connectedCallback();
    if (this.hasUpdated) this._wire();
  }

  override firstUpdated() {
    this._wire();
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    const model = this.std.getOptional(SelectionPaneModel);
    if (model) model.open$.value = false;
  }

  /* ── Canvas mirrors ─────────────────────────────────────────────────── */

  private _highlight(id: string) {
    this._gfx.highlightElements([id], { duration: 0 });
  }

  private _clearHighlight() {
    this._gfx.highlight.clear();
  }

  private _select(event: MouseEvent, node: SelectionPaneNode) {
    const { selection } = this._gfx;
    if (event.shiftKey || event.metaKey || event.ctrlKey) {
      const ids = new Set(selection.selectedIds);
      if (ids.has(node.id)) ids.delete(node.id);
      else ids.add(node.id);
      selection.set({ elements: [...ids], editing: false });
      return;
    }
    selection.set({ elements: [node.id], editing: false });
  }

  private _run(id: string, params: unknown) {
    runCommand(this.std, paneCommand(id), PANE_INVOCATION, params);
  }

  /* ── Rows ───────────────────────────────────────────────────────────── */

  private _rows(nodes: readonly SelectionPaneNode[]): PaneRow[] {
    const rows: PaneRow[] = [];
    const walk = (list: readonly SelectionPaneNode[], depth: number) => {
      for (const node of list) {
        rows.push({ node, depth, siblings: list });
        if (node.children && !this._collapsed.has(node.id)) {
          walk(node.children, depth + 1);
        }
      }
    };
    walk(nodes, 0);
    return rows;
  }

  private _toggleCollapsed(id: string) {
    const next = new Set(this._collapsed);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    this._collapsed = next;
  }

  private _onRowClick(event: MouseEvent, node: SelectionPaneNode) {
    if (this._swallowNextClick) {
      this._swallowNextClick = false;
      return;
    }
    this._select(event, node);
  }

  private _onRowDblClick(node: SelectionPaneNode) {
    if (node.type !== 'group' || this.std.store.readonly) return;
    this._renaming = node.id;
  }

  private _onLockClick(event: MouseEvent, node: SelectionPaneNode) {
    event.stopPropagation();
    this._run(node.locked ? 'canvas.element.unlock' : 'canvas.element.lock', {
      ids: [node.id],
    });
  }

  /**
   * Hide this row for this viewer, or show it again. Not refused on a
   * read-only document: nothing reaches the document (ADR 0031 §8).
   */
  private _onEyeClick(event: MouseEvent, node: SelectionPaneNode) {
    event.stopPropagation();
    this._run('canvas.visibility.hideLocal', {
      ids: [node.id],
      hidden: !node.hiddenLocal,
    });
  }

  private _commitRename(id: string, input: HTMLInputElement) {
    if (this._renaming !== id) return;
    this._renaming = null;
    this._run('canvas.group.rename', { id, title: input.value });
  }

  private readonly _onRenameKeydown = (event: KeyboardEvent, id: string) => {
    // The canvas behind binds Backspace, Delete and every letter: a key typed
    // into the title must never reach it.
    event.stopPropagation();
    if (event.isComposing) return;
    if (event.key === 'Enter') {
      event.preventDefault();
      this._commitRename(id, event.currentTarget as HTMLInputElement);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      this._renaming = null;
    }
  };

  /* ── Drag to reorder ────────────────────────────────────────────────── */

  private _onRowPointerDown(event: PointerEvent, row: PaneRow) {
    if (event.button !== 0 || this.std.store.readonly) return;
    const target = event.target as HTMLElement;
    if (target.closest('button, input')) return;
    this._drag = {
      id: row.node.id,
      groupId: row.node.groupId,
      siblings: row.siblings,
      x: event.clientX,
      y: event.clientY,
      dragging: false,
    };
    document.addEventListener('pointermove', this._onDocumentPointerMove, true);
    document.addEventListener('pointerup', this._onDocumentPointerUp, true);
  }

  /** The sibling row under `clientY`, and which half of it. */
  private _dropAt(clientY: number): typeof this._drop {
    const drag = this._drag;
    if (!drag) return null;
    const rows =
      this.shadowRoot?.querySelectorAll<HTMLElement>(
        '[data-testid="selection-pane-row"]'
      ) ?? [];
    for (const element of rows) {
      const rect = element.getBoundingClientRect();
      if (clientY < rect.top || clientY > rect.bottom) continue;
      const id = element.dataset.id;
      if (!id || id === drag.id) return null;
      // Only among siblings: a row never leaves its group by a drag here.
      if (!drag.siblings.some(node => node.id === id)) return null;
      return {
        id,
        position: clientY < rect.top + rect.height / 2 ? 'above' : 'below',
      };
    }
    return null;
  }

  private readonly _onDocumentPointerMove = (event: PointerEvent) => {
    const drag = this._drag;
    if (!drag) return;
    if (!drag.dragging) {
      const travel = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
      if (travel < DRAG_THRESHOLD_PX) return;
      drag.dragging = true;
      this.requestUpdate();
    }
    this._drop = this._dropAt(event.clientY);
  };

  private readonly _onDocumentPointerUp = (event: PointerEvent) => {
    const drag = this._drag;
    if (drag?.dragging) {
      this._swallowNextClick = true;
      // A click only follows when the press and the release land on the same
      // row; otherwise nothing would ever clear the flag.
      setTimeout(() => (this._swallowNextClick = false), 0);
      const drop = this._dropAt(event.clientY);
      if (drop) this._commitDrop(drag, drop);
    }
    this._endDrag();
  };

  /**
   * "Above row X" is directly above X in the stack. "Below row X" is directly
   * above whatever sits right under X — read in the FULL sibling list, so a
   * filtered view never computes a neighbour it is not showing.
   */
  private _commitDrop(drag: DragState, drop: NonNullable<typeof this._drop>) {
    let above: string | null = drop.id;
    if (drop.position === 'below') {
      const rest = drag.siblings.filter(node => node.id !== drag.id);
      const at = rest.findIndex(node => node.id === drop.id);
      above = rest[at + 1]?.id ?? null;
    }
    this._run('canvas.element.reorder', { id: drag.id, above });
  }

  private _endDrag() {
    document.removeEventListener(
      'pointermove',
      this._onDocumentPointerMove,
      true
    );
    document.removeEventListener('pointerup', this._onDocumentPointerUp, true);
    const wasDragging = this._drag?.dragging;
    this._drag = null;
    this._drop = null;
    if (wasDragging) this.requestUpdate();
  }

  /* ── Filter ─────────────────────────────────────────────────────────── */

  private _filterName(id: string): string {
    const model = this._gfx.getElementById(id) as GfxModel | null;
    return model ? selectionPaneRowLabel(this.std, model) : id;
  }

  private _filterWording(id: string, kind: 'frame' | 'board'): string {
    const wording =
      kind === 'frame'
        ? SELECTION_PANE_FILTER_FRAME
        : SELECTION_PANE_FILTER_BOARD;
    return translateKey(this.std, ...wording, { name: this._filterName(id) });
  }

  private readonly _openFilterMenu = (event: MouseEvent) => {
    const targets = selectionPaneFilterTargets(this.std);
    popMenu(popupTargetFromElement(event.currentTarget as HTMLElement), {
      options: {
        items: [
          menu.action({
            name: translateKey(this.std, ...SELECTION_PANE_FILTER_ALL),
            isSelected: this._filter === null,
            select: () => {
              this._filter = null;
            },
          }),
          ...targets.map(target =>
            menu.action({
              name: this._filterWording(target.id, target.kind),
              isSelected: this._filter === target.id,
              select: () => {
                this._filter = target.id;
              },
            })
          ),
        ],
      },
    });
  };

  /* ── Render ─────────────────────────────────────────────────────────── */

  private _renderRow(row: PaneRow) {
    const { node, depth } = row;
    const std = this.std;
    const model = this._gfx.getElementById(node.id) as GfxModel | null;
    if (!model) return nothing;

    const label = selectionPaneRowLabel(std, model);
    const selected = this._gfx.selection.has(node.id);
    const container = node.children !== undefined;
    const collapsed = this._collapsed.has(node.id);
    const readonly = std.store.readonly;
    const drop = this._drop?.id === node.id ? this._drop.position : undefined;
    const dragging = this._drag?.dragging && this._drag.id === node.id;

    return html`<div
      class="selection-pane-row"
      role="treeitem"
      data-testid="selection-pane-row"
      data-id=${node.id}
      data-type=${node.type}
      aria-level=${depth + 1}
      aria-selected=${selected ? 'true' : 'false'}
      aria-expanded=${container ? (collapsed ? 'false' : 'true') : nothing}
      ?data-selected=${selected}
      ?data-locked=${node.locked}
      ?data-hidden-local=${node.hiddenLocal}
      ?data-dragging=${dragging}
      data-drop=${drop ?? nothing}
      style=${styleMap({ paddingLeft: `${8 + depth * INDENT_PX}px` })}
      @click=${(event: MouseEvent) => this._onRowClick(event, node)}
      @dblclick=${() => this._onRowDblClick(node)}
      @pointerenter=${() => this._highlight(node.id)}
      @pointerdown=${(event: PointerEvent) =>
        this._onRowPointerDown(event, row)}
    >
      <button
        class="selection-pane-chevron"
        type="button"
        data-testid="selection-pane-collapse"
        ?hidden=${!container}
        aria-label=${translateKey(
          std,
          ...(collapsed ? SELECTION_PANE_EXPAND : SELECTION_PANE_COLLAPSE)
        )}
        @click=${(event: MouseEvent) => {
          event.stopPropagation();
          this._toggleCollapsed(node.id);
        }}
      >
        ${collapsed ? ArrowRightSmallIcon() : ArrowDownSmallIcon()}
      </button>
      <span class="selection-pane-icon"
        >${selectionPaneRowIcon(node.type)}</span
      >
      ${this._renaming === node.id
        ? html`<input
            class="selection-pane-rename"
            data-testid="selection-pane-rename"
            aria-label=${translateKey(std, ...TOOLBAR_RENAME)}
            .value=${label}
            @click=${this._swallow}
            @dblclick=${this._swallow}
            @keydown=${(event: KeyboardEvent) =>
              this._onRenameKeydown(event, node.id)}
            @blur=${(event: FocusEvent) =>
              this._commitRename(node.id, event.target as HTMLInputElement)}
          />`
        : html`<span class="selection-pane-label" title=${label}
            >${label}</span
          >`}
      <button
        class="selection-pane-eye"
        type="button"
        data-testid="selection-pane-eye"
        aria-pressed=${node.hiddenLocal ? 'true' : 'false'}
        aria-label=${translateKey(
          std,
          ...(node.hiddenLocal ? SELECTION_PANE_SHOW : SELECTION_PANE_HIDE)
        )}
        @click=${(event: MouseEvent) => this._onEyeClick(event, node)}
      >
        ${node.hiddenLocal ? InvisibleIcon() : ViewIcon()}
      </button>
      <button
        class="selection-pane-lock"
        type="button"
        data-testid="selection-pane-lock"
        aria-pressed=${node.locked ? 'true' : 'false'}
        aria-label=${translateKey(
          std,
          ...(node.locked ? SELECTION_PANE_UNLOCK : TOOLBAR_LOCK)
        )}
        ?disabled=${readonly}
        @click=${(event: MouseEvent) => this._onLockClick(event, node)}
      >
        ${node.locked ? LockIcon() : UnlockIcon()}
      </button>
    </div>`;
  }

  override updated() {
    const input = this.shadowRoot?.querySelector<HTMLInputElement>(
      '[data-testid="selection-pane-rename"]'
    );
    if (input && this.shadowRoot?.activeElement !== input) {
      input.focus();
      input.select();
    }
  }

  override render() {
    if (!this._open) return nothing;
    // Read for its dependency: the rows repaint when the canvas selection does.
    this._selectionRevision;

    let tree = selectionPaneTree(this.std).value;
    let filterLabel: string | null = null;
    if (this._filter !== null) {
      const members = selectionPaneFilterMembers(this.std, this._filter);
      const target = selectionPaneFilterTargets(this.std).find(
        candidate => candidate.id === this._filter
      );
      if (members && target) {
        tree = filterSelectionPaneTree(tree, members);
        filterLabel = this._filterWording(target.id, target.kind);
      }
    }
    const rows = this._rows(tree);
    const title = translateKey(this.std, ...SELECTION_PANE_TITLE);

    return html`<div
      class="selection-pane-panel"
      role="dialog"
      tabindex="-1"
      aria-label=${title}
      data-testid="selection-pane-panel"
      @pointerdown=${this._swallow}
      @pointerup=${this._swallow}
      @click=${this._swallow}
      @dblclick=${this._swallow}
    >
      <div class="selection-pane-head">
        <span class="selection-pane-title">${title}</span>
        <button
          class="selection-pane-head-button"
          type="button"
          data-testid="selection-pane-filter"
          data-active=${filterLabel !== null ? 'true' : 'false'}
          aria-label=${translateKey(this.std, ...SELECTION_PANE_FILTER)}
          @click=${this._openFilterMenu}
        >
          ${FilterIcon()}
        </button>
        <button
          class="selection-pane-head-button"
          type="button"
          data-testid="selection-pane-close"
          aria-label=${translateKey(this.std, ...SELECTION_PANE_CLOSE)}
          @click=${this.closePanel}
        >
          ×
        </button>
      </div>
      ${filterLabel !== null
        ? html`<div
            class="selection-pane-filter-label"
            data-testid="selection-pane-filter-label"
          >
            ${filterLabel}
          </div>`
        : nothing}
      <div
        class="selection-pane-body"
        role="tree"
        aria-label=${title}
        data-testid="selection-pane-body"
        @pointerleave=${() => this._clearHighlight()}
      >
        ${rows.length
          ? repeat(
              rows,
              row => row.node.id,
              row => this._renderRow(row)
            )
          : html`<div class="selection-pane-empty">
              ${translateKey(this.std, ...SELECTION_PANE_EMPTY)}
            </div>`}
      </div>
    </div>`;
  }
}

export const edgelessSelectionPaneWidget = WidgetViewExtension(
  'affine:page',
  EDGELESS_SELECTION_PANE_WIDGET,
  literal`${unsafeStatic(EDGELESS_SELECTION_PANE_WIDGET)}`
);
