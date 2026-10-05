import {
  SelectionPaneModel,
  selectionPaneCommands,
} from '@labre/affine-block-surface';
import {
  SelectionPaneProvider,
  translateKey,
} from '@labre/affine-shared/services';
import { menu } from '@labre/affine-components/context-menu';
import { SignalWatcher } from '@labre/global/lit';
import { type BlockStdScope, runCommand } from '@labre/std';
import { LayerIcon } from '@blocksuite/icons/lit';
import { css, html, LitElement } from 'lit';

import { QuickToolExtension } from '../extension/index.js';
import { QuickToolMixin } from '../mixins/index.js';
import { SELECTION_PANE_TITLE } from '../translations.js';

export const SELECTION_PANE_TOOL_BUTTON = 'edgeless-selection-pane-tool-button';

/**
 * The button and its "more tools" entry both run `canvas.selectionPane.toggle`
 * rather than calling the seam, so `SelectionPaneOpened` is emitted in ONE
 * place whichever surface opened the pane.
 */
function toggleSelectionPane(std: BlockStdScope) {
  const toggle = selectionPaneCommands.find(
    command => command.id === 'canvas.selectionPane.toggle'
  );
  if (!toggle) return;
  runCommand(std, toggle, {
    surface: 'contextual-toolbar',
    source: 'toolbar:general',
  });
}

/**
 * The edgeless toolbar's entry to the selection pane: a quick tool, placed and
 * styled like the undo and frame ones. An action, not a tool mode, so `type`
 * is empty; it reads as active while the library's own pane is open.
 */
export class EdgelessSelectionPaneToolButton extends QuickToolMixin(
  SignalWatcher(LitElement)
) {
  static override styles = css`
    .selection-pane-icon,
    .selection-pane-icon > svg {
      width: 24px;
      height: 24px;
    }
  `;

  override type = [];

  private _onClick() {
    toggleSelectionPane(this.edgeless.std);
  }

  override render() {
    const { std } = this.edgeless;
    const open = std.getOptional(SelectionPaneModel)?.open$.value ?? false;
    return html`<edgeless-tool-icon-button
      .iconContainerPadding="${6}"
      .tooltip="${translateKey(std, ...SELECTION_PANE_TITLE)}"
      .tooltipOffset=${17}
      .active=${open}
      class="edgeless-selection-pane-tool-button"
      data-testid="selection-pane-tool-button"
      @click=${this._onClick}
    >
      <span class="selection-pane-icon">${LayerIcon()}</span>
    </edgeless-tool-icon-button>`;
  }
}

/**
 * Shown only while `SelectionPaneProvider` answers: `SelectionPaneExtension(null)`
 * removes the button with the pane, because a control that opens nothing is a
 * lie. Not hidden on a read-only document — the pane is how a reader finds
 * what is on it.
 *
 * The `menu` entry is what the toolbar moves into its "more tools" menu when a
 * narrow editor leaves no room for the button; a quick tool without one is
 * dropped there, which is how the pane once went missing below ~800 px.
 */
export const selectionPaneQuickTool = QuickToolExtension(
  'selection-pane',
  ({ block }) => ({
    content: html`<edgeless-selection-pane-tool-button
      .edgeless=${block}
    ></edgeless-selection-pane-tool-button>`,
    menu: menu.action({
      name: translateKey(block.std, ...SELECTION_PANE_TITLE),
      prefix: LayerIcon(),
      select: () => toggleSelectionPane(block.std),
    }),
    enable: !!block.std.getOptional(SelectionPaneProvider),
  })
);
