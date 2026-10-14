import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { AddViewMenuExtension } from '@labre/data-view';

import { effects } from './effects.js';
import { databaseAddViewMenu } from './view-bar/add-view-menu.js';

export { DatabasePageHost } from './database-page/database-page.js';
export {
  type AddViewSourcePicker,
  databaseAddViewMenu,
} from './view-bar/add-view-menu.js';

/**
 * The database editing chrome a stored database shows whatever the flags say
 * (ADR 0035 §1, §4): the full-page database host (`<affine-database-page>`,
 * B13) and, with B10, the library's properties panel element. Always
 * registered, like a framework's `…RenderViewExtension`; the
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
 * §4, §5): "+ view" with its source choice (B11), and with B12 the entries
 * that call the data-source picker seam. No new flag key: `{ database: false }`
 * removes these with core's own creation tooling and leaves every stored
 * database rendering.
 *
 * ponytail: "+ view" gets no picker until B12's `DataSourcePickerExtension`
 * lands; it then adapts it to `AddViewSourcePicker` here, which brings "With
 * a new source" and the sources no view reads yet.
 */
export class DatabaseEditorToolingViewExtension extends ViewExtensionProvider {
  override name = 'affine-database-editor-tooling';

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register(AddViewMenuExtension(databaseAddViewMenu(() => null)));
  }
}
