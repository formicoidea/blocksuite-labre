import { ViewExtensionProvider } from '@labre/affine-ext-loader';

import { effects } from './effects.js';

/**
 * The database editing chrome a stored database shows whatever the flags say
 * (ADR 0035 §1, §4): the Notion view bar, the full-page database host and the
 * library's properties panel element. Always registered, like a framework's
 * `…RenderViewExtension`; the `affine:database` block itself, its presets and
 * its cells stay in core, so a host without this package loses no content.
 *
 * ponytail: registers nothing yet; B10, B11 and B13 add their `setup`.
 */
export class DatabaseEditorViewExtension extends ViewExtensionProvider {
  override name = 'affine-database-editor';

  override effect() {
    super.effect();
    effects();
  }
}

/**
 * The database creation entries, under core's own `database` flag (ADR 0035
 * §4, §5): "+ view" with its source choice and the entries that call the
 * data-source picker seam. No new flag key: `{ database: false }` removes
 * these with core's own creation tooling and leaves every stored database
 * rendering.
 *
 * ponytail: registers nothing yet; B11 and B12 add their `setup`.
 */
export class DatabaseEditorToolingViewExtension extends ViewExtensionProvider {
  override name = 'affine-database-editor-tooling';
}
