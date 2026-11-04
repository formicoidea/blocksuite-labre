import { EmbedHtmlModel } from '@labre/affine-model';
import {
  ActionPlacement,
  TOOLBAR_DELETE,
  type ToolbarModuleConfig,
  ToolbarModuleExtension,
} from '@labre/affine-shared/services';
import { DeleteIcon } from '@blocksuite/icons/lit';
import { BlockFlavourIdentifier } from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * A retired block can only go (ADR 0048, amendment of 2026-11-04). On a canvas the
 * generic toolbar already deletes it; its duplicate asks the clipboard, which no
 * longer has a config for this flavour and writes nothing.
 */
const retiredHtmlToolbar = {
  actions: [
    {
      placement: ActionPlacement.More,
      id: 'c.delete',
      labelWording: TOOLBAR_DELETE,
      icon: DeleteIcon(),
      variant: 'destructive',
      run(ctx) {
        const model = ctx.getCurrentModelByType(EmbedHtmlModel);
        if (!model) return;

        ctx.store.deleteBlock(model);

        ctx.select('note');
        ctx.reset();
      },
    },
  ],

  when: ctx => Boolean(ctx.getCurrentModelByType(EmbedHtmlModel)),
} as const satisfies ToolbarModuleConfig;

export const retiredHtmlToolbarExtension = (flavour: string): ExtensionType =>
  ToolbarModuleExtension({
    id: BlockFlavourIdentifier(flavour),
    config: retiredHtmlToolbar,
  });
