import {
  validationToolbarConfig,
  ValidationProfileExtension,
  ValidationRuleExtension,
} from '@labre/affine-block-surface';
import { ToolbarModuleExtension } from '@labre/affine-shared/services';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';
import { BlockFlavourIdentifier, CommandExtension } from '@labre/std';

import { wardleyCommandIcons, wardleyCommands } from './commands';
import { effects } from './effects';
import { WARDLEY_PROFILES } from './profiles';
import { WARDLEY_RULES } from './rules';
import { wardleyTemplateCategory } from './templates';
import { WardleyElementRendererExtension } from './element-renderer';
import { WardleyInteraction, WardleyView } from './element-view';
import { WardleyNodeRendererExtension } from './node/node-renderer';
import { WardleyNodeView } from './node/node-view';
import { wardleyNodeToolbarExtension } from './toolbar/node-config';
import { wardleyToolbarExtension } from './toolbar/config';
import { wardleySeniorTool } from './toolbar/senior-tool';

/**
 * Wardley rendering — ALWAYS registered, independent of any flag. Disabling
 * `wardley` hides only the creation tooling (see {@link WardleyViewExtension});
 * maps already drawn must still paint, stay selectable, stay editable and keep
 * their contextual toolbar. See `docs/adr/0009`.
 */
export class WardleyRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-wardley-render-gfx';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(WardleyView);
    context.register(WardleyElementRendererExtension);
    context.register(WardleyNodeView);
    context.register(WardleyNodeRendererExtension);
    if (this.isEdgeless(context.scope)) {
      context.register(WardleyInteraction);
      context.register(wardleyToolbarExtension);
      context.register(wardleyNodeToolbarExtension);
    }
  }
}

/**
 * Wardley creation tooling — flag-gated (`wardley`): the senior toolbar button,
 * its templates category, the edgeless chords (w+c, w+l, ...) and the
 * validation rules and profiles. Both are tooling: a map drawn while the flag
 * was on keeps rendering when it goes off, it just stops being checked — and
 * the profile it was put on stays written, unread, until the flag comes back.
 */
export class WardleyViewExtension extends ViewExtensionProvider {
  override name = 'affine-wardley-gfx';

  override effect(): void {
    super.effect();
    // Defines the senior button and its menu — tooling-only custom elements.
    effects();
    extendTemplateCategory(wardleyTemplateCategory);
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    if (this.isEdgeless(context.scope)) {
      context.register(ValidationRuleExtension(WARDLEY_RULES));
      context.register(ValidationProfileExtension(WARDLEY_PROFILES));
      // The Validation dropdown on a selected map's contextual toolbar. A
      // SECOND module on the same element, through the `custom:` flavour slot
      // (the pattern `gfx/mindmap` uses on `custom:affine:surface:shape`):
      // `wardleyToolbarExtension` is registered always-on because a stored map
      // must keep its axes and labels, while choosing how hard to check it is
      // tooling and belongs here. The config itself names no framework — it
      // reads roles and profiles — so a second framework registers the very
      // same object on its own flavour.
      context.register(
        ToolbarModuleExtension({
          id: BlockFlavourIdentifier('custom:affine:surface:wardley'),
          config: validationToolbarConfig,
        })
      );
      context.register(wardleySeniorTool);
      // The 13 Wardley commands, ONE registration for both faces: the
      // enumerable registry the sub-menu renders from, and — through
      // `toShortcutDescriptor` — the edgeless chords (w+c, w+l, ...).
      // Registering here inherits both the wardley flag gating and the
      // edgeless-only availability; the keymap installer is
      // ShortcutKeymapExtension('edgeless') in root.
      context.register(CommandExtension(wardleyCommands, wardleyCommandIcons));
    }
  }
}
