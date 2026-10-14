import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { SlashMenuConfigExtension } from '@labre/affine-widget-slash-menu';

import { effects } from './effects.js';
import { linkedViewSlashMenuConfig } from './linked-view-slash-menu.js';

/**
 * The database editing chrome a stored database shows whatever the flags say
 * (ADR 0035 §1, §4): the Notion view bar, the full-page database host and the
 * library's properties panel element. Always registered, like a framework's
 * `…RenderViewExtension`; the `affine:database` block itself, its presets and
 * its cells stay in core, so a host without this package loses no content.
 *
 * The properties panel element (B10) is defined here; a host mounts it.
 *
 * ponytail: B11 and B13 add their `setup`.
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
 * B12: "Linked view of a database", drawn only when the host fills the
 * data-source picker.
 *
 * ponytail: B11 adds "+ view" here.
 */
export class DatabaseEditorToolingViewExtension extends ViewExtensionProvider {
  override name = 'affine-database-editor-tooling';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(
      SlashMenuConfigExtension(
        'affine:database-linked-view',
        linkedViewSlashMenuConfig
      )
    );
  }
}

export {
  type DataSourceChoice,
  dataSourcePickerItems,
  type DataSourcePickerOptions,
  popDataSourcePicker,
} from './data-source-picker.js';
export { linkedViewSlashMenuConfig } from './linked-view-slash-menu.js';
export {
  DatabasePropertiesPanel,
  type DatabasePropertiesPanelSourceRequest,
  propertiesPanelView,
} from './properties-panel/properties-panel.js';
