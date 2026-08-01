import type { GfxElementModelView } from '@labre/std/gfx';
import { GfxViewInteractionExtension } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

/**
 * Resize gating for a framework background: the handles stay hidden until
 * `resizeEnabled` is true. `beforeResize` is re-evaluated every time the
 * allowed handles are computed, so toggling the prop from the toolbar updates
 * the handles reactively. Moving and selecting stay available throughout.
 *
 * The runtime half of {@link BackgroundGeometry.resizable}: the declaration
 * says what a FRESH background offers, this says what the element currently
 * allows.
 */
export function FrameworkBackgroundInteractionExtension(
  type: string
): ExtensionType {
  return GfxViewInteractionExtension<GfxElementModelView>(type, {
    handleResize({ model }) {
      return {
        beforeResize({ set }) {
          if (!(model as unknown as { resizeEnabled?: boolean }).resizeEnabled) {
            set({ allowedHandlers: [] });
          }
        },
      };
    },
  });
}
