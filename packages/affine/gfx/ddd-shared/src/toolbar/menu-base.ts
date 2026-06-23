import { DefaultTool } from '@labre/affine-block-surface';
import { EmptyTool } from '@labre/affine-gfx-pointer';
import { TelemetryProvider } from '@labre/affine-shared/services';
import { EdgelessToolbarToolMixin } from '@labre/affine-widget-edgeless-toolbar';
import { css, LitElement } from 'lit';

/**
 * Shared base for the three DDD popover menus: the menu shell styles, the
 * "create then return to selection (palette stays open)" finish helper and
 * the telemetry track helper. Each subclass adds its own create* methods (built
 * from the shared prefab builders) and its own render().
 */
export abstract class DddMenuBase extends EdgelessToolbarToolMixin(LitElement) {
  static override styles = css`
    :host {
      display: flex;
      z-index: -1;
    }
    .menu-content {
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .button-group-container {
      display: flex;
      align-items: center;
      gap: 10px;
      fill: var(--affine-icon-color);
    }
    .button-group-container svg {
      width: 24px;
      height: 24px;
    }
  `;

  override type = EmptyTool;

  /** Framework id for telemetry. */
  protected abstract framework: 'event-storming' | 'core-domain' | 'context-map';

  protected get surface() {
    return this.gfx.surface;
  }

  protected get center() {
    const { centerX, centerY } = this.gfx.viewport;
    return { cx: centerX, cy: centerY };
  }

  protected finish(id: string) {
    const { gfx } = this;
    gfx.doc.captureSync();
    gfx.tool.setTool(DefaultTool);
    gfx.selection.set({ elements: [id], editing: false });
    // Palette stays open so several objects can be added in a row.
  }

  protected track(
    event: 'FrameworkElementAdded' | 'FrameworkToolPicked',
    element: string
  ) {
    this.edgeless.std.getOptional(TelemetryProvider)?.track(event, {
      framework: this.framework,
      element,
      page: 'whiteboard editor',
      segment: 'ddd toolbox',
      module: `${this.framework} menu`,
    });
  }
}
