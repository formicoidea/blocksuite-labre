import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { DataSourcePickerProvider } from '@labre/affine-shared/services';
import { SlashMenuConfigExtension } from '@labre/affine-widget-slash-menu';
import {
  AddViewMenuExtension,
  ViewSettingsMenuExtension,
} from '@labre/data-view';

import { effects } from './effects.js';
import { linkedViewSlashMenuConfig } from './linked-view-slash-menu.js';
import {
  addViewSourcePicker,
  databaseAddViewMenu,
} from './view-bar/add-view-menu.js';
import { databaseViewSettingsMenu } from './view-settings/source-entry.js';

/**
 * The database editing chrome a stored database shows whatever the flags say
 * (ADR 0035 §1, §4): the full-page database host (`<affine-database-page>`,
 * B13) and the library's properties panel element (B10), which a host
 * mounts. Always registered, like a framework's `…RenderViewExtension`; the
 * `affine:database` block itself, its presets, its cells and its view bar
 * (tabs and "N more", B11) stay in core, so a host without this package loses
 * no content.
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
 * §4, §5): "+ view" with its source choice (B11), fed by the host's
 * data-source picker when there is one, and "Linked view of a database"
 * (B12), drawn only when the host fills the picker, and the view settings'
 * "Source" (ADR 0035 amendment of 2026-10-28), drawn only on a database
 * whose views name their source, with the picker. No new flag key:
 * `{ database: false }` removes these with core's own creation tooling and
 * leaves every stored database rendering.
 */
export class DatabaseEditorToolingViewExtension extends ViewExtensionProvider {
  override name = 'affine-database-editor-tooling';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      AddViewMenuExtension(
        databaseAddViewMenu(({ std }) => {
          const picker = std?.getOptional(DataSourcePickerProvider);
          return picker ? addViewSourcePicker(picker) : null;
        })
      ),
      ViewSettingsMenuExtension(databaseViewSettingsMenu()),
      SlashMenuConfigExtension(
        'affine:database-linked-view',
        linkedViewSlashMenuConfig
      ),
    ]);
  }
}

export {
  type DataSourceChoice,
  dataSourcePickerItems,
  type DataSourcePickerOptions,
  popDataSourcePicker,
} from './data-source-picker.js';
export { DatabasePageHost } from './database-page/database-page.js';
export { linkedViewSlashMenuConfig } from './linked-view-slash-menu.js';
export {
  DatabasePropertiesPanel,
  type DatabasePropertiesPanelSourceRequest,
  propertiesPanelView,
} from './properties-panel/properties-panel.js';
export {
  type AddViewSourcePicker,
  addViewSourcePicker,
  databaseAddViewMenu,
} from './view-bar/add-view-menu.js';
