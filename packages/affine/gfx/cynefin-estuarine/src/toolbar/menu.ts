import { EmptyTool } from '@labre/affine-gfx-pointer';
import { EdgelessCommandMenu } from '@labre/affine-widget-edgeless-toolbar';

/**
 * The popover above the toolbar hosting both frameworks. Since PF3 it declares
 * nothing: {@link EdgelessCommandMenu} renders `cynefinEstuarineCommands` for
 * the `senior-menu` surface (`docs/adr/0008`).
 */
export class EdgelessCynefinEstuarineMenu extends EdgelessCommandMenu {
  protected override owner = 'cynefin-estuarine' as const;

  override type = EmptyTool;
}
