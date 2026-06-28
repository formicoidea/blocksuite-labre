import { menu } from '@labre/affine-components/context-menu';
import type { DenseMenuBuilder } from '@labre/affine-widget-edgeless-toolbar';
import { UndoIcon } from '@blocksuite/icons/lit';

/** Dense-mode (narrow / mobile toolbar) entry for the undo action. */
export const buildUndoDenseMenu: DenseMenuBuilder = edgeless =>
  menu.action({
    name: 'Undo',
    prefix: UndoIcon(),
    select: () => {
      const { store } = edgeless;
      if (store.canUndo) store.undo();
    },
  });
