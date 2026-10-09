import { PresentTool } from '@labre/affine/blocks/frame';
import {
  fitToModel,
  frameCommands,
  frameList,
  runCommand,
  selectModels,
} from '@labre/affine/host-panels';
import { DocModeProvider } from '@labre/affine/shared/services';
import { GfxControllerIdentifier } from '@labre/affine/std/gfx';
import type { TestAffineEditorContainer } from '@labre/integration-test';
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
 * in page mode. A read-only document keeps the buttons enabled on purpose: the
 * refusal is the command's, and the tester must SEE that nothing moves.
 *
 * Offset to `right: 336px` so it sits beside the library's frame panel
 * (`custom-frame-panel`, `right: 0`) when both are open, for side-by-side
 * comparison of the order.
 */
@customElement('custom-host-slides-panel')
export class CustomHostSlidesPanel extends LitElement {
  static override styles = css`
    .container {
      position: absolute;
      top: 0;
      right: 336px;
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
    .row {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 4px;
      border-radius: 4px;
      cursor: pointer;
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

  // ponytail: ▲/▼ buttons, not a drag — the façade's write is the same
  // command either way; a host wanting drag-to-reorder computes `before` from
  // its own drop target and calls the same `runCommand`.
  private readonly _reorder = frameCommands.find(
    c => c.id === 'canvas.frame.reorder'
  )!;

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
      const refresh = () => {
        this._frames = frameList(std).map(frame => ({
          id: frame.id,
          title: frame.props.title.toString(),
        }));
        this._readonly = std.store.readonly;
      };
      refresh();
      const subscription = std.store.slots.blockUpdated.subscribe(refresh);
      return () => subscription.unsubscribe();
    });
  }

  override disconnectedCallback() {
    super.disconnectedCallback();
    this._disposeEffect?.();
    this._disposeEffect = null;
  }

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

  private _move(index: number, delta: -1 | 1) {
    const frames = this._frames;
    const target = index + delta;
    if (target < 0 || target >= frames.length) return;
    // `before` = the frame the moved one lands in front of; moving down by
    // one lands in front of the frame two places below (or at the end).
    const before =
      delta === -1 ? frames[target].id : (frames[index + 2]?.id ?? null);
    runCommand(
      this.editor.std,
      this._reorder,
      { surface: 'contextual-toolbar', source: 'toolbar:general' },
      { ids: [frames[index].id], before }
    );
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

  override render() {
    if (!this._show) return nothing;
    const frames = this._frames;
    return html`<div class="container" data-testid="host-slides-panel">
      <div class="header">
        <span>Slides (host)</span>
        <button @click=${this._present}>Present</button>
      </div>
      ${this._readonly
        ? html`<div class="readonly">
            read-only: writes are refused by the command
          </div>`
        : nothing}
      ${frames.length === 0
        ? html`<div class="empty">No frame on the canvas.</div>`
        : frames.map(
            (frame, index) =>
              html`<div class="row" @click=${() => this._focus(frame.id)}>
                <span class="rank">${index + 1}</span>
                <span class="title">${frame.title}</span>
                <button
                  title="Move up"
                  ?disabled=${index === 0}
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    this._move(index, -1);
                  }}
                >
                  ▲
                </button>
                <button
                  title="Move down"
                  ?disabled=${index === frames.length - 1}
                  @click=${(e: MouseEvent) => {
                    e.stopPropagation();
                    this._move(index, 1);
                  }}
                >
                  ▼
                </button>
              </div>`
          )}
    </div>`;
  }

  toggleDisplay() {
    this._show = !this._show;
  }

  @state()
  private accessor _frames: { id: string; title: string }[] = [];

  @state()
  private accessor _readonly = false;

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
