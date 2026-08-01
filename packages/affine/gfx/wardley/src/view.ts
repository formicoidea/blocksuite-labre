import { ValidationRuleExtension } from '@labre/affine-block-surface';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { extendTemplateCategory } from '@labre/affine-gfx-template';
import { ShortcutExtension } from '@labre/std';

import { effects } from './effects';
import { WARDLEY_RULES } from './rules';
import { wardleyShortcuts } from './shortcuts';
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
 * validation rules. Rules are tooling: a map drawn while the flag was on keeps
 * rendering when it goes off, it just stops being checked.
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
      context.register(wardleySeniorTool);
      // Edgeless-scoped chords (w+c, w+l, ...). Registering here inherits
      // both the wardley flag gating and the edgeless-only availability;
      // the installer is ShortcutKeymapExtension('edgeless') in root.
      context.register(ShortcutExtension(wardleyShortcuts));
    }
  }
}
