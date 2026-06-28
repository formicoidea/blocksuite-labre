import { QuickToolExtension } from '@labre/affine-widget-edgeless-toolbar';
import { html } from 'lit';

import { buildUndoDenseMenu } from './toolbar/undo-dense-menu';

/**
 * Undo quick tool. It replaces the former link quick tool in the edgeless
 * toolbar (same slot, next to `frame`). Wired to the store undo command, the
 * same one the Ctrl/Cmd-Z shortcut uses.
 */
export const undoQuickTool = QuickToolExtension('undo', ({ block, gfx }) => {
  return {
    content: html`<edgeless-undo-tool-button
      .edgeless=${block}
    ></edgeless-undo-tool-button>`,
    menu: buildUndoDenseMenu(block, gfx),
    enable: !block.store.readonly,
  };
});
