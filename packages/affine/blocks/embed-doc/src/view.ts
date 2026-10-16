import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';

import { effects } from './effects';
import {
  EdgelessClipboardEmbedLinkedDocConfig,
  EmbedLinkedDocInteraction,
  EmbedLinkedDocViewExtensions,
} from './embed-linked-doc-block';
import {
  EdgelessClipboardEmbedSyncedDocConfig,
  EmbedSyncedDocViewExtensions,
} from './embed-synced-doc-block';
import { EmbedSyncedDocInteraction } from './embed-synced-doc-block/configs/edgeless-interaction';
import { PageDropWatcher } from './page-drop/page-drop';

export class EmbedDocViewExtension extends ViewExtensionProvider {
  override name = 'affine-embed-doc-block';

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(EmbedLinkedDocViewExtensions);
    context.register(EmbedSyncedDocViewExtensions);
    // Pages dragged in from the host (PageDropProvider), both views.
    context.register(PageDropWatcher);
    const isEdgeless = this.isEdgeless(context.scope);
    if (isEdgeless) {
      context.register([
        EdgelessClipboardEmbedLinkedDocConfig,
        EdgelessClipboardEmbedSyncedDocConfig,
        EmbedLinkedDocInteraction,
        EmbedSyncedDocInteraction,
      ]);
    }
  }
}
