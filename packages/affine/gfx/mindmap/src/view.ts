import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';

import { effects } from './effects';
import { MindmapElementRendererExtension } from './element-renderer';
import { MindMapIndicatorOverlay } from './indicator-overlay';
import { MindMapDragExtension } from './interactivity';
import {
  mindmapToolbarExtension,
  shapeMindmapToolbarExtension,
} from './toolbar/config';
import {
  mediaSeniorTool,
  mindMapSeniorTool,
  textSeniorTool,
} from './toolbar/senior-tool';
import { mindmapTemplateCategory } from './templates';
import { MindMapInteraction, MindMapView } from './view/view';

/**
 * Mindmap rendering — ALWAYS registered, independent of any flag. Disabling the
 * `mindmap` / `other` flags hides only their senior buttons (see below); placed
 * mindmaps must still paint, stay editable, and Templates-panel insertion must
 * still render them.
 */
export class MindmapRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-mindmap-render-gfx';

  override effect(): void {
    super.effect();
    effects();
    extendTemplateCategory(mindmapTemplateCategory);
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(MindmapElementRendererExtension);
    context.register(mindmapToolbarExtension);
    context.register(shapeMindmapToolbarExtension);
    context.register(MindMapView);
    context.register(MindMapDragExtension);
    context.register(MindMapIndicatorOverlay);
    context.register(MindMapInteraction);
  }
}

/** The dedicated "Mind Map" senior button — flag-gated (`mindmap`). */
export class MindmapToolViewExtension extends ViewExtensionProvider {
  override name = 'affine-mindmap-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(mindMapSeniorTool);
    }
  }
}

/**
 * Standalone "Text" senior button (formerly inside the "Others" submenu) —
 * flag-gated (`edgeless-text`).
 */
export class TextToolViewExtension extends ViewExtensionProvider {
  override name = 'affine-edgeless-text-tool-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(textSeniorTool);
    }
  }
}

/**
 * Standalone "Add file" senior button (formerly inside the "Others" submenu) —
 * flag-gated (`edgeless-media`).
 */
export class MediaToolViewExtension extends ViewExtensionProvider {
  override name = 'affine-edgeless-media-tool-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(mediaSeniorTool);
    }
  }
}
