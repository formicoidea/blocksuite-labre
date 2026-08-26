import { EmptyTool } from '@labre/affine-gfx-pointer';
import { EdgelessCommandMenu } from '@labre/affine-widget-edgeless-toolbar';
import { css } from 'lit';

/**
 * Context Map palette, rendered from `contextMapCommands` for the
 * `senior-menu` surface (`docs/adr/0008`). Keeps the DDD palettes' tighter gap
 * — it is the widest one, at 13 buttons.
 */
export class EdgelessDddContextMapMenu extends EdgelessCommandMenu {
  static override styles = [
    EdgelessCommandMenu.styles,
    css`
      :host {
        --labre-command-menu-gap: 10px;
      }
    `,
  ];

  protected override owner = 'ddd-context-map' as const;

  override type = EmptyTool;
}
