import { EmptyTool } from '@labre/affine-gfx-pointer';
import { EdgelessCommandMenu } from '@labre/affine-widget-edgeless-toolbar';
import { css } from 'lit';

/**
 * Event Storming palette. Since PF3 it declares nothing:
 * {@link EdgelessCommandMenu} renders `eventStormingCommands` for the
 * `senior-menu` surface, and `DddMenuBase` — shell, finish helper and `track`
 * helper — is gone with the duplication it carried (`docs/adr/0008`).
 *
 * The DDD palettes keep their tighter gap: they carry more buttons than the
 * other frameworks (Context Map: 12).
 */
export class EdgelessDddEventStormingMenu extends EdgelessCommandMenu {
  static override styles = [
    EdgelessCommandMenu.styles,
    css`
      :host {
        --labre-command-menu-gap: 10px;
      }
    `,
  ];

  protected override owner = 'ddd-event-storming' as const;

  override type = EmptyTool;
}
