import type {
  EditableBackgroundLabel,
  FrameworkBackgroundDef,
} from '@labre/affine-block-surface';
import {
  DeclaredBackgroundView,
  FrameworkBackgroundInteractionExtension,
} from '@labre/affine-block-surface';
import type { WardleyBackgroundElementModel } from '@labre/affine-model';

import { isWardleyLabelProp, WARDLEY_BACKGROUND } from './background';

/**
 * The Wardley map's view: the shared background gesture, aimed by the
 * `WARDLEY_BACKGROUND` declaration.
 *
 * The in-place rename shipped here first and has moved to
 * `DeclaredBackgroundView` (`@labre/affine-block-surface`) so that every
 * framework background gets it rather than the two that got round to copying
 * it — see issue #355. Nothing about the map's behaviour changed: the hit test
 * reads the same declaration, through the same catalogue, and the guard below
 * is the one thing this framework adds to it.
 */
export class WardleyView extends DeclaredBackgroundView<WardleyBackgroundElementModel> {
  static override type: string = 'wardley';

  protected override get def(): FrameworkBackgroundDef {
    return WARDLEY_BACKGROUND;
  }

  /**
   * The declaration names the prop; this decides whether it may be WRITTEN.
   *
   * A closed list, because since #73 an element preserves keys it does not
   * declare: a typo in the declaration would otherwise persist a junk key onto
   * every map it was double-clicked on.
   */
  protected override labelAt(
    lx: number,
    ly: number,
    w: number,
    h: number
  ): EditableBackgroundLabel | null {
    const hit = super.labelAt(lx, ly, w, h);
    return hit && isWardleyLabelProp(hit.prop) ? hit : null;
  }
}

/**
 * Resize gating, from the primitive: the handles stay hidden until
 * `resizeEnabled` is true — the runtime half of the declaration's
 * `geometry.resizable`.
 */
export const WardleyInteraction =
  FrameworkBackgroundInteractionExtension(WARDLEY_BACKGROUND);
