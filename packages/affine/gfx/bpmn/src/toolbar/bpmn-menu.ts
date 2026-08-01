import { EmptyTool } from '@labre/affine-gfx-pointer';
import { EdgelessCommandMenu } from '@labre/affine-widget-edgeless-toolbar';

/**
 * The popover above the toolbar for the BPMN toolbox. Since PF3 it declares
 * nothing: {@link EdgelessCommandMenu} renders `bpmnCommands` for the
 * `senior-menu` surface (`docs/adr/0008`).
 */
export class EdgelessBpmnMenu extends EdgelessCommandMenu {
  protected override owner = 'bpmn' as const;

  override type = EmptyTool;
}
