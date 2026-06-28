import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';

import { effects } from './effects';
import { undoQuickTool } from './undo-tool';

// This gfx package historically shipped the edgeless "link" quick tool; it now
// ships the "undo" quick tool, which took over that toolbar slot (see #27).
export class LinkViewExtension extends ViewExtensionProvider {
  override name = 'affine-link-gfx';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(undoQuickTool);
    }
  }
}
