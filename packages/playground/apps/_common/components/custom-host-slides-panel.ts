import { PresentTool } from '@labre/affine/blocks/frame';
import {
  createFramePreview,
  createPanelReorderDrag,
  fitToModel,
  frameCommands,
  frameList,
  type PanelReorderDrag,
  runCommand,
  selectionPaneCommands,
  selectModels,
} from '@labre/affine/host-panels';
import { DocModeProvider } from '@labre/affine/shared/services';
import { GfxControllerIdentifier } from '@labre/affine/std/gfx';
import type { TestAffineEditorContainer } from '@labre/integration-test';
import { PresentationIcon } from '@blocksuite/icons/lit';
import { effect } from '@preact/signals-core';
import { css, html, LitElement, nothing } from 'lit';
import { customElement, property, state } from 'lit/decorators.js';

/**
 * A HOST slide panel, built only on `@labre/affine/host-panels` (ADR 0034,
 * docs/integrate/08-host-panels.md): what the Labre app's own slide list will
 * do, drawn here so the product owner can test the façade without the app.
 *
 * It deliberately imports no widget or fragment package and no Lit base class
 * of the library — a plain `LitElement` with its own shadow DOM, the way a host
 * panel sits outside the editor. Every write is `canvas.frame.reorder` run
 * through `runCommand` with the descriptor from `frameCommands`, never the
 * registry: the registry lists it in edgeless only, and this panel stays open
 * in page mode.
 *
 * What the Labre app's slide list asked for at recette 1 (P0-1.2 to P0-1.6),
 * shown here with the façade alone: each preview takes the panel's width and
 * the frame's proportions (`createFramePreview(…, { fluid: true })`), the
 * order changes by dragging a card (`createPanelReorderDrag`, the library
 * panels' own gesture: read-only refused at the press, Escape cancels), a
 * double-click on a name renames the frame in place (`canvas.frame.rename`
 * from `selectionPaneCommands`, committed once: Enter or blur saves, Escape
 * cancels) and a double-click on a preview frames it on the canvas. Present
 * carries the library's `PresentationIcon`, the one the Labre header's
 * Present button draws.
 *
 * Docked at the right edge like every playground panel. While it is open it
 * marks `body[data-host-slides]`, which pushes the library's frame panel
 * (`custom-frame-panel`) 336px to the left, so the two orders can be compared
 * side by side without an empty strip when this panel is open alone.
 */
@customElement('custom-host-slides-panel')
export class CustomHostSlidesPanel extends LitElement {
  static override styles = css`
    .container {
      position: absolute;
      top: 0;
      right: 0;
      width: 320px;
      height: 100vh;
      box-sizing: border-box;
      padding: 16px 12px;
      border: 1px solid var(--affine-border-color, #e3e2e4);
      background-color: var(--affine-background-primary-color, #fff);
      font-family: var(--affine-font-family, sans-serif);
      font-size: 14px;
      overflow-y: auto;
      z-index: 1;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 8px;
      font-weight: 600;
    }
    .readonly {
      margin-bottom: 8px;
      color: var(--affine-error-color, #c00);
      font-size: 12px;
    }
    .header button {
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .list {
      position: relative;
    }
    .row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      padding: 6px 4px;
      border-radius: 4px;
      cursor: pointer;
    }
    .row.moving {
      opacity: 0.5;
    }
    .preview {
      flex-basis: 100%;
      border: 1px solid var(--affine-border-color, #e3e2e4);
      border-radius: 4px;
      overflow: hidden;
      background: var(--affine-background-primary-color, #fff);
    }
    .rename {
      flex: 1;
      min-width: 0;
      font: inherit;
    }
    .drop-line {
      position: absolute;
      left: 4px;
      right: 4px;
      height: 2px;
      background: var(--affine-primary-color, #1e96eb);
      pointer-events: none;
    }
    .drag-mask {
      position: fixed;
      inset: 0;
      z-index: 2;
    }
    .row:hover {
      background: var(--affine-hover-color, rgba(0, 0, 0, 0.04));
    }
    .rank {
      width: 20px;
      color: var(--affine-text-secondary-color, #888);
    }
    .title {
      flex: 1;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }
    .empty {
      color: var(--affine-text-secondary-color, #888);
    }
  `;

  private readonly _reorder = frameCommands.find(
    c => c.id === 'canvas.frame.reorder'
  )!;

  private readonly _rename = selectionPaneCommands.find(
    c => c.id === 'canvas.frame.rename'
  )!;

  private _drag: PanelReorderDrag | null = null;

  /** The card a press landed on: what a drag moves. */
  private _pressed: string | null = null;

  private _disposeEffect: (() => void) | null = null;

  override connectedCallback() {
    super.connectedCallback();
    // Re-read on a new std (mode switch, doc switch), on the store's readonly
    // signal (read in `refresh`, so tracked) and on every block update of its
    // store: a reorder writes `presentationIndex`, which no signal of the
    // façade exposes.
    this._disposeEffect = effect(() => {
      const std = this.editor?.std;
      if (!std) return;
      // A new std means new previews: the old ones held the old editor.
      this._previews.clear();
      const refresh = () => {
        this._frames = frameList(std).map(frame => ({
          id: frame.id,
          title: frame.props.title.toString(),
          // The live preview the library's own card shows, through the façade;
          // one mini editor per card, kept across renders.
          preview:
            this._previews.get(frame.id) ??
            this._previews
              .set(frame.id, createFramePreview(std, frame, { fluid: true }))
              .get(frame.id)!,
        }));
        this._readonly = std.store.readonly;
      };
      refresh();
      const subscription = std.store.slots.blockUpdated.subscribe(refresh);
      return () => subscription.unsubscribe();
    });
    this._drag = createPanelReorderDrag<{ before: string | null; y: number }>({
      readonly: () => this.editor.std.store.readonly,
      rows: () => this._rows(),
      bounds: () => this._list(),
      onPickUp: () => {
        this._moving = this._pressed;
      },
      dropAt: gap => {
        const rows = this._rows();
        const last = rows[rows.length - 1];
        if (!last) return null;
        const before =
          rows
            .slice(gap)
            .map(row => row.dataset.frameId ?? null)
            .find(id => id !== this._moving) ?? null;
        const under = rows[gap];
        const y = under ? under.offsetTop : last.offsetTop + last.offsetHeight;
        return { before, y };
      },
      onMove: drop => {
        this._lineY = drop?.y ?? null;
      },
      onDrop: drop => {
        if (!this._moving) return;
        runCommand(
          this.editor.std,
          this._reorder,
          { surface: 'contextual-toolbar', source: 'toolbar:general' },
          { ids: [this._moving], before: drop.before }
        );
      },
      onEnd: () => {
        this._moving = null;
        this._pressed = null;
        this._lineY = null;
      },
      mask: {
        host: () => this.renderRoot,
        className: 'drag-mask',
        testId: 'host-slides-drag-mask',
      },
    });
  }

  private _list() {
    return this.renderRoot.querySelector<HTMLElement>('.list');
  }

  private _rows() {
    return Array.from(
      this.renderRoot.querySelectorAll<HTMLElement>('.list > .row')
    );
  }

  private _press(e: PointerEvent, id: string) {
    if (e.button !== 0 || this._renaming) return;
    this._pressed = id;
    this._drag?.press(e);
  }

  private _commitRename(id: string, input: HTMLInputElement) {
    if (this._renaming !== id) return;
    this._renaming = null;
    runCommand(
      this.editor.std,
      this._rename,
      { surface: 'contextual-toolbar', source: 'toolbar:general' },
      { id, title: input.value }
    );
  }

  private _onRenameKeydown(e: KeyboardEvent, id: string) {
    e.stopPropagation();
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      this._commitRename(id, e.currentTarget as HTMLInputElement);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this._renaming = null;
    }
  }

  override updated() {
    const input = this.renderRoot.querySelector<HTMLInputElement>('.rename');
    if (input && this.shadowRoot?.activeElement !== input) {
      input.focus();
      input.select();
    }
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._disposeEffect?.();
    this._disposeEffect = null;
    this._drag?.dispose();
    this._drag = null;
    this._previews.clear();
    delete document.body.dataset.hostSlides;
  }

  private readonly _previews = new Map<string, HTMLElement>();

  /**
   * Page mode has no canvas: switch first, then act on the edgeless std the
   * switch mounts (`fitToModel` never switches mode, by contract).
   */
  private async _inEdgeless(action: () => void) {
    const modes = this.editor.std.get(DocModeProvider);
    if (modes.getEditorMode() !== 'edgeless') {
      modes.setEditorMode('edgeless');
      await this.editor.updateComplete;
      // ponytail: one frame for the edgeless viewport to measure itself; a
      // host with a mode-ready signal waits on that instead.
      await new Promise(resolve => requestAnimationFrame(resolve));
    }
    action();
  }

  private _focus(id: string) {
    this._inEdgeless(() => {
      const std = this.editor.std;
      selectModels(std, [id]);
      // Right padding clears this panel AND the frame panel beside it.
      fitToModel(std, id, [50, 700, 50, 50]);
    }).catch(console.error);
  }

  private _present() {
    this._inEdgeless(() => {
      this.editor.std
        .get(GfxControllerIdentifier)
        .tool.setTool(PresentTool, { mode: 'fit' });
    }).catch(console.error);
  }

  private _renderName(frame: { id: string; title: string }) {
    if (this._renaming !== frame.id) {
      return html`<span
        class="title"
        data-testid="host-slides-title"
        @dblclick=${(e: MouseEvent) => {
          e.stopPropagation();
          if (!this.editor.std.store.readonly) this._renaming = frame.id;
        }}
        >${frame.title}</span
      >`;
    }
    return html`<input
      class="rename"
      data-testid="host-slides-rename"
      .value=${frame.title}
      @click=${(e: MouseEvent) => e.stopPropagation()}
      @keydown=${(e: KeyboardEvent) => this._onRenameKeydown(e, frame.id)}
      @blur=${(e: FocusEvent) =>
        this._commitRename(frame.id, e.target as HTMLInputElement)}
    />`;
  }

  override render() {
    if (!this._show) return nothing;
    const frames = this._frames;
    return html`<div class="container" data-testid="host-slides-panel">
      <div class="header">
        <span>Slides (host)</span>
        <button @click=${this._present}>
          ${PresentationIcon({ width: '16px', height: '16px' })}Present
        </button>
      </div>
      ${this._readonly
        ? html`<div class="readonly">
            read-only: writes are refused by the command
          </div>`
        : nothing}
      ${frames.length === 0
        ? html`<div class="empty">No frame on the canvas.</div>`
        : html`<div class="list">
            ${frames.map(
              (frame, index) =>
                html`<div
                  class="row ${this._moving === frame.id ? 'moving' : ''}"
                  data-frame-id=${frame.id}
                  @pointerdown=${(e: PointerEvent) => this._press(e, frame.id)}
                  @click=${() => {
                    if (this._drag?.consumeSwallowedClick()) return;
                    this._focus(frame.id);
                  }}
                >
                  <span class="rank">${index + 1}</span>
                  ${this._renderName(frame)}
                  <div class="preview">${frame.preview}</div>
                </div>`
            )}
            ${this._lineY === null
              ? nothing
              : html`<div
                  class="drop-line"
                  data-testid="host-slides-drop-line"
                  style="top: ${this._lineY - 1}px"
                ></div>`}
          </div>`}
    </div>`;
  }

  toggleDisplay() {
    this._show = !this._show;
    if (this._show) document.body.dataset.hostSlides = 'open';
    else delete document.body.dataset.hostSlides;
  }

  @state()
  private accessor _frames: {
    id: string;
    title: string;
    preview: HTMLElement;
  }[] = [];

  @state()
  private accessor _lineY: number | null = null;

  @state()
  private accessor _moving: string | null = null;

  @state()
  private accessor _readonly = false;

  @state()
  private accessor _renaming: string | null = null;

  @state()
  private accessor _show = false;

  @property({ attribute: false })
  accessor editor!: TestAffineEditorContainer;
}

declare global {
  interface HTMLElementTagNameMap {
    'custom-host-slides-panel': CustomHostSlidesPanel;
  }
}
