import type { MenuOptions } from '@labre/affine-components/context-menu';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { DatabaseBlockModel } from '@labre/affine-model';
import { SlashMenuConfigExtension } from '@labre/affine-widget-slash-menu';
import { StandaloneCellMetaExtension } from '@labre/affine-database-engine';
import { BlockViewExtension, FlavourExtension } from '@labre/std';
import { literal } from 'lit/static-html.js';
import { z } from 'zod';

import { DatabaseConfigExtension } from './config';
import { databaseSlashMenuConfig } from './configs/slash-menu.js';
import { effects } from './effects';
import { linkColumnConfig } from './properties/link/cell-renderer.js';
import { DatabaseViewCreationExtension } from './view-creation.js';

const optionsSchema = z.object({
  configure: z
    .function()
    .args(z.instanceof(DatabaseBlockModel), z.custom<MenuOptions>())
    .returns(z.custom<MenuOptions>()),
});

export type DatabaseViewExtensionOptions = z.infer<typeof optionsSchema>;

/**
 * Database rendering — ALWAYS registered, independent of the `database` and
 * `data-view` flags (ADR 0009, ADR 0035 §5, issue B4). A document that holds a
 * database must show it, let its cells be edited and its rows be opened
 * whatever the flags say: until 0.48 the whole view sat behind `database`, and
 * `{ database: false }` left every stored database rendered as nothing.
 *
 * What lives here is what an EXISTING database needs, the mirror of
 * `CalloutRenderViewExtension`:
 * - `effects()` whole: every element it defines draws a stored database (the
 *   block, its title, the cells, the row detail and its peek);
 * - the flavour and the block view, the lookup `lit-host` performs; the block
 *   brings the presets, the cells and the row opening with it;
 * - the link cell for the title band (ADR 0035 §11): a `link` value already
 *   stored on a page is drawn with it.
 */
export class DatabaseRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-database-render-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension('affine:database'),
      BlockViewExtension('affine:database', literal`affine-database`),
      // The title band draws a `link` / `url` property with the table's link
      // cell; it sits below this package and cannot import it (ADR 0035 §11).
      StandaloneCellMetaExtension(linkColumnConfig),
    ]);
  }
}

/**
 * Database creation tooling — flag-gated (`database`, ADR 0009, ADR 0035 §5):
 * the slash-menu entries that insert a database, the "+ view" of a rendered
 * one (`DatabaseViewCreationIdentifier`, `./view-creation.ts`), and the host's additions to
 * the block's "⋯" menu (`configure`, kept on this class so a host's
 * `viewManager.configure(DatabaseViewExtension, …)` still compiles and its
 * entries follow the flag). With the flag off no database and no view can be
 * made; the stored ones keep rendering through
 * {@link DatabaseRenderViewExtension}.
 */
export class DatabaseViewExtension extends ViewExtensionProvider<DatabaseViewExtensionOptions> {
  override name = 'affine-database-block';

  override schema = optionsSchema;

  override setup(
    context: ViewExtensionContext,
    options?: DatabaseViewExtensionOptions
  ) {
    super.setup(context);
    context.register([
      SlashMenuConfigExtension('affine:database', databaseSlashMenuConfig),
      DatabaseViewCreationExtension,
    ]);
    if (options) {
      context.register(
        DatabaseConfigExtension({ configure: options.configure })
      );
    }
  }
}
