import { EmptyTool } from '@labre/affine-gfx-pointer';
import { EdgelessCommandMenu } from '@labre/affine-widget-edgeless-toolbar';

/**
 * The popover above the toolbar for the C4 toolbox. It declares nothing:
 * {@link EdgelessCommandMenu} renders `c4Commands` for the `senior-menu`
 * surface (`docs/adr/0008`).
 */
export class EdgelessC4Menu extends EdgelessCommandMenu {
  protected override owner = 'c4' as const;

  override type = EmptyTool;
}
