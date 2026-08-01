import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { NoteBlockSchema } from '@labre/affine-model';
import {
  ToolbarModuleExtension,
  ViewportElementExtension,
} from '@labre/affine-shared/services';
import {
  BlockFlavourIdentifier,
  BlockViewExtension,
  FlavourExtension,
  CommandExtension,
  ShortcutKeymapExtension,
} from '@labre/std';
import { literal } from 'lit/static-html.js';

import { PageClipboard, ReadOnlyClipboard } from './clipboard';
import { builtinToolbarConfig } from './configs/toolbar';
import { EdgelessClipboardController, EdgelessRootService } from './edgeless';
import { EdgelessElementToolbarExtension } from './edgeless/configs/toolbar';
import { EdgelessLocker } from './edgeless/edgeless-root-spec';
import { AltCloneExtension } from './edgeless/interact-extensions/clone-ext';
import { effects } from './effects';
import { fallbackKeymap } from './keyboard/keymap';
import { coreCommands } from './keyboard/commands';

export class RootViewExtension extends ViewExtensionProvider {
  override name = 'affine-root-block';

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension('affine:page'),
      fallbackKeymap,
      // Enumerable, host-overridable commands. Core undo/redo live here; the
      // registration also derives their shortcut descriptors, and the
      // installer binds the effective keymap (see `@labre/std` shortcut.ts).
      CommandExtension(coreCommands),
      ShortcutKeymapExtension('global'),
      ToolbarModuleExtension({
        id: BlockFlavourIdentifier(NoteBlockSchema.model.flavour),
        config: builtinToolbarConfig,
      }),
    ]);
    if (
      context.scope === 'preview-page' ||
      context.scope === 'preview-edgeless'
    ) {
      context.register(ReadOnlyClipboard);
    }
    if (this.isEdgeless(context.scope)) {
      this._setupEdgeless(context);
      return;
    }
    this._setupPage(context);
  }

  private readonly _setupPage = (context: ViewExtensionContext) => {
    context.register(ViewportElementExtension('.affine-page-viewport'));
    if (context.scope === 'preview-page') {
      context.register(
        BlockViewExtension('affine:page', literal`affine-preview-root`)
      );
      return;
    }
    context.register(
      BlockViewExtension('affine:page', literal`affine-page-root`)
    );
    context.register(PageClipboard);
    // Page-scoped shortcuts only exist while a page editor is mounted.
    context.register(ShortcutKeymapExtension('page'));
  };

  private readonly _setupEdgeless = (context: ViewExtensionContext) => {
    context.register([
      EdgelessRootService,
      ViewportElementExtension('.affine-edgeless-viewport'),
    ]);
    if (context.scope === 'preview-edgeless') {
      context.register([
        BlockViewExtension(
          'affine:page',
          literal`affine-edgeless-root-preview`
        ),
        EdgelessLocker,
      ]);
      return;
    }
    context.register([
      BlockViewExtension('affine:page', literal`affine-edgeless-root`),
      EdgelessClipboardController,
      AltCloneExtension,
    ]);
    context.register(EdgelessElementToolbarExtension);
    // Edgeless-scoped shortcuts (e.g. framework chords) only exist while an
    // edgeless editor is mounted.
    context.register(ShortcutKeymapExtension('edgeless'));
  };
}
