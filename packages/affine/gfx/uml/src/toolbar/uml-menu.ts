import { EmptyTool } from '@labre/affine-gfx-pointer';
import { EdgelessCommandMenu } from '@labre/affine-widget-edgeless-toolbar';

/**
 * The popover above the toolbar for the UML toolbox. It declares nothing:
 * {@link EdgelessCommandMenu} renders `umlCommands` for the `senior-menu`
 * surface (`docs/adr/0008`).
 *
 * UML is past the fourteen-slot cap — twenty-one catalogue entries — so what
 * this popover actually renders is the arbitrated thirteen plus the permanent
 * "More artefacts…" button. That is the menu's own business, not this class's:
 * `selectSeniorMenuCommands` does the ranking, and `commands.ts` documents the
 * order it ranks from.
 */
export class EdgelessUmlMenu extends EdgelessCommandMenu {
  protected override owner = 'uml' as const;

  override type = EmptyTool;
}
