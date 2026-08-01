import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';

import { BrushTool } from './brush-tool';
import { effects } from './effects';
import { BrushElementRendererExtension } from './element-renderer';
import { EraserTool } from './eraser-tool';
import { HighlighterTool } from './highlighter-tool';
import {
  brushToolbarExtension,
  highlighterToolbarExtension,
} from './toolbar/configs';
import { penSeniorTool } from './toolbar/senior-tool';

/**
 * Brush / highlighter rendering — ALWAYS registered, independent of any flag.
 * Disabling `brush` hides only the pen senior button and the tools it opens
 * (see {@link BrushViewExtension}); strokes already drawn must still paint,
 * stay selectable and keep their contextual toolbar. See `docs/adr/0009`.
 */
export class BrushRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-brush-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(BrushElementRendererExtension);
    context.register(brushToolbarExtension);
    context.register(highlighterToolbarExtension);
  }
}

/**
 * Pen creation tooling — flag-gated (`brush`): the senior toolbar button and
 * the brush / highlighter / eraser tools it opens.
 */
export class BrushViewExtension extends ViewExtensionProvider {
  override name = 'affine-brush-gfx';

  override effect(): void {
    super.effect();
    // Defines the pen/eraser tool buttons and the pen menu — tooling only.
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(BrushTool);
    context.register(EraserTool);
    context.register(HighlighterTool);
    context.register(penSeniorTool);
  }
}
