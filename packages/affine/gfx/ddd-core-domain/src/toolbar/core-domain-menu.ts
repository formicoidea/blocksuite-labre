import { EmptyTool } from '@labre/affine-gfx-pointer';
import { EdgelessCommandMenu } from '@labre/affine-widget-edgeless-toolbar';
import { css } from 'lit';

/**
 * Core Domain Chart palette, rendered from `coreDomainCommands` for the
 * `senior-menu` surface (`docs/adr/0008`). Keeps the DDD palettes' tighter gap.
 */
export class EdgelessDddCoreDomainMenu extends EdgelessCommandMenu {
  static override styles = [
    EdgelessCommandMenu.styles,
    css`
      :host {
        --labre-command-menu-gap: 10px;
      }
    `,
  ];

  protected override owner = 'ddd-core-domain' as const;

  override type = EmptyTool;
}
