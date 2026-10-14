import { PresentationIcon } from '@blocksuite/icons/lit';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { CommandExtension } from '@labre/std';

import { frameCommands } from './commands.js';
import { EdgelessClipboardFrameConfig } from './edgeless-clipboard-config';
import { frameQuickTool } from './edgeless-toolbar';
import { effects } from './effects';
import { FrameBlockInteraction } from './frame-block';
import { FrameHighlightManager } from './frame-highlight-manager';
import { FrameBlockSpec } from './frame-spec';
import { FrameTemplateWatcher } from './frame-template';
import { FrameTool } from './frame-tool';
import { frameToolbarExtension } from './frame-toolbar';
import { edgelessNavigatorBgWidget } from './present/navigator-bg-widget';
import { PresentTool } from './present-tool';

export class FrameViewExtension extends ViewExtensionProvider {
  override name = 'affine-frame-block';

  override effect(): void {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext): void {
    super.setup(context);
    context.register(FrameBlockSpec);
    if (this.isEdgeless(context.scope)) {
      context.register(FrameHighlightManager);
      context.register(FrameTool);
      context.register(PresentTool);
      context.register(frameQuickTool);
      context.register(frameToolbarExtension);
      context.register(edgelessNavigatorBgWidget);
      context.register(EdgelessClipboardFrameConfig);
      context.register(FrameBlockInteraction);
      // One watcher per editor a viewer edits in: a preview mounted on the
      // same store would report the same deletion a second time.
      if (!this.isPreview(context.scope)) {
        context.register(FrameTemplateWatcher);
      }
      // The presentation order's one write (ADR 0034). The frame panel also
      // mounts in page mode: it runs the imported descriptor, not this
      // registration, so its reorder works in both modes. `canvas.present`
      // rides along: a host's view menu lists it in edgeless mode, and a
      // `frame: false` assembly loses it with the rest of the frame tooling.
      context.register(
        CommandExtension(frameCommands, {
          'canvas.present': PresentationIcon(),
        })
      );
    }
  }
}
