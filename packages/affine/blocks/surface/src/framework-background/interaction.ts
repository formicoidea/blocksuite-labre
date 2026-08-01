import type { GfxElementModelView } from '@labre/std/gfx';
import { GfxViewInteractionExtension } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

import type { FrameworkBackgroundDef } from './def.js';
import { backgroundResizeAllowed } from './def.js';

/**
 * Resize gating for a framework background, driven by its declaration.
 *
 * `beforeResize` is re-evaluated every time the allowed handles are computed,
 * so toggling `resizeEnabled` from the toolbar updates the handles reactively.
 * An element carrying no such prop falls back to the declaration's
 * `geometry.resizable` — which is what makes that field live data rather than
 * documentation. Moving and selecting stay available throughout.
 */
export function FrameworkBackgroundInteractionExtension(
  def: FrameworkBackgroundDef
): ExtensionType {
  return GfxViewInteractionExtension<GfxElementModelView>(def.type, {
    handleResize({ model }) {
      return {
        beforeResize({ set }) {
          const allowed = backgroundResizeAllowed(
            def,
            model as unknown as { resizeEnabled?: boolean }
          );
          if (!allowed) set({ allowedHandlers: [] });
        },
      };
    },
  });
}
