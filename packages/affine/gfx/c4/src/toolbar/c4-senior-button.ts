import { DddSeniorButtonBase } from '@labre/affine-gfx-ddd-shared';

import { c4ToolbarIcon } from './icons';

/**
 * Main toolbar button (the coloured C4 tile) that opens the C4 toolbox
 * sub-menu above the toolbar.
 *
 * It reuses the shared senior-button base rather than restating the
 * toggle/popper wiring a fifth time. The base lives in `ddd-shared` because the
 * three DDD buttons were the first to need it and it was lifted out of them —
 * the class itself knows nothing about DDD: it is a glyph, a tooltip key and a
 * menu tag, which is the entirety of what a senior button is. Copying ninety
 * lines of identical CSS and popper handling here to avoid the package name
 * would be the worst of both.
 */
export class EdgelessC4SeniorButton extends DddSeniorButtonBase {
  protected override menuTag = 'edgeless-c4-menu' as const;

  protected override label = 'C4 model';

  protected override labelKey = 'com.labre.framework.c4';

  protected override icon = c4ToolbarIcon;
}
