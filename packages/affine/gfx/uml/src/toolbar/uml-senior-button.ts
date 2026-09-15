import { DddSeniorButtonBase } from '@labre/affine-gfx-ddd-shared';

import { umlToolbarIcon } from './icons.js';

/**
 * Main toolbar button (the class-box-and-ellipse tile) that opens the UML
 * toolbox sub-menu above the toolbar.
 *
 * It reuses the shared senior-button base rather than restating the
 * toggle/popper wiring a seventh time. The base lives in `ddd-shared` because
 * the three DDD buttons were the first to need it and it was lifted out of them
 * — the class itself knows nothing about DDD: it is a glyph, a tooltip key and
 * a menu tag, which is the entirety of what a senior button is.
 */
export class EdgelessUmlSeniorButton extends DddSeniorButtonBase {
  protected override menuTag = 'edgeless-uml-menu' as const;

  protected override label = 'UML';

  protected override labelKey = 'com.labre.framework.uml';

  protected override icon = umlToolbarIcon;
}
