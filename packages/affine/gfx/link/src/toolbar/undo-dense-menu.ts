import { menu } from '@labre/affine-components/context-menu';
import { TOOLBAR_UNDO, translateKey } from '@labre/affine-shared/services';
import type { DenseMenuBuilder } from '@labre/affine-widget-edgeless-toolbar';
import { UndoIcon } from '@blocksuite/icons/lit';

/** Dense-mode (narrow / mobile toolbar) entry for the undo action. */
export const buildUndoDenseMenu: DenseMenuBuilder = edgeless =>
  menu.action({
    name: translateKey(edgeless.std, ...TOOLBAR_UNDO),
    prefix: UndoIcon(),
    select: () => {
      const { store } = edgeless;
      if (store.canUndo) store.undo();
    },
  });
