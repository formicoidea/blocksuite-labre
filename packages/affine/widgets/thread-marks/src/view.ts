import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';

import { effects } from './effects.js';
import { threadMarksWidget } from './index.js';
import { threadDiscussToolbarExtensions } from './toolbar.js';

/**
 * The "has a thread" seam's view side (ADR 0038): the marks widget and the
 * "Discuss" toolbar module, in both views. Registered unconditionally: the
 * seam, not a flag, decides whether anything shows (no flag gates a
 * discussion, labre P5).
 */
export class ThreadMarksViewExtension extends ViewExtensionProvider {
  override name = 'affine-thread-marks-widget';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(threadMarksWidget);
    context.register(threadDiscussToolbarExtensions);
  }
}
