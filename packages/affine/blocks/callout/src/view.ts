import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { TextConversionEntryExtension } from '@labre/affine-rich-text';
import { ToolbarModuleExtension } from '@labre/affine-shared/services';
import { SlashMenuConfigExtension } from '@labre/affine-widget-slash-menu';
import {
  BlockFlavourIdentifier,
  BlockViewExtension,
  FlavourExtension,
} from '@labre/std';
import { literal } from 'lit/static-html.js';

import { CalloutKeymapExtension } from './callout-keymap';
import { calloutSlashMenuConfig } from './configs/slash-menu';
import { calloutToolbarConfig } from './configs/toolbar.js';
import { calloutTurnIntoEntry } from './configs/turn-into.js';
import { effects } from './effects';

/**
 * Callout rendering — ALWAYS registered, independent of the `callout` flag
 * (ADR 0009, #418). A document that already holds callouts must paint them,
 * let them be edited and let them be turned back into text whatever the flag
 * says: until 2026-10-11 the whole view sat behind the flag, and
 * `{ callout: false }` left every stored callout rendered as nothing.
 *
 * What lives here is what an EXISTING callout needs, the mirror of
 * `WardleyRenderViewExtension`:
 * - `effects()` whole: `affine-callout` paints the block, and
 *   `affine-emoji-menu` opens from a rendered callout's icon — both are
 *   render-side, so unlike the frameworks' this `effects()` is not tooling;
 * - the flavour and the block view, the lookup `lit-host` performs;
 * - the keymap: Enter and Backspace inside a callout edit stored content, they
 *   create nothing;
 * - the block toolbar (#468): Turn into text, copy, duplicate, delete — the
 *   way OUT of a stored callout, as the Wardley contextual toolbar stays with
 *   a stored map.
 */
export class CalloutRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-callout-render-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension('affine:callout'),
      BlockViewExtension('affine:callout', literal`affine-callout`),
      CalloutKeymapExtension,
      ToolbarModuleExtension({
        id: BlockFlavourIdentifier('affine:callout'),
        config: calloutToolbarConfig,
      }),
    ]);
  }
}

/**
 * Callout creation tooling — flag-gated (`callout`, ADR 0009): the slash-menu
 * item and the "Turn into → Callout" entry, the two ways to CREATE a callout.
 * With the flag off no new callout can be made; the ones already written keep
 * rendering through {@link CalloutRenderViewExtension}.
 */
export class CalloutViewExtension extends ViewExtensionProvider {
  override name = 'affine-callout-block';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      SlashMenuConfigExtension('affine:callout', calloutSlashMenuConfig),
      TextConversionEntryExtension(calloutTurnIntoEntry),
    ]);
  }
}
