import { EmptyTool } from '@labre/affine-gfx-pointer';
import { EdgelessCommandMenu } from '@labre/affine-widget-edgeless-toolbar';

/**
 * The popover that opens above the toolbar for the Wardley toolbox.
 *
 * Since PF3 it holds no artefact list of its own: {@link EdgelessCommandMenu}
 * renders whatever `wardleyCommands` declares for the `senior-menu` surface, so
 * the menu and the shortcut manifest can no longer drift (they did: 13 vs 7).
 */
export class EdgelessWardleyMenu extends EdgelessCommandMenu {
  protected override owner = 'wardley' as const;

  override type = EmptyTool;
}
