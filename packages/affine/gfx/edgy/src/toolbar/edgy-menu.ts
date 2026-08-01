import { EmptyTool } from '@labre/affine-gfx-pointer';
import { EdgelessCommandMenu } from '@labre/affine-widget-edgeless-toolbar';

/**
 * The popover above the toolbar for the EDGY toolbox. Since PF3 it declares
 * nothing: {@link EdgelessCommandMenu} renders `edgyCommands` for the
 * `senior-menu` surface, and the same seven artefacts are now reachable from
 * Settings › Shortcuts, which never saw them before (`docs/adr/0008`).
 */
export class EdgelessEdgyMenu extends EdgelessCommandMenu {
  protected override owner = 'edgy' as const;

  override type = EmptyTool;
}
