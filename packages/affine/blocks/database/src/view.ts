import type { MenuOptions } from '@labre/affine-components/context-menu';
import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { DatabaseBlockModel } from '@labre/affine-model';
import { SlashMenuConfigExtension } from '@labre/affine-widget-slash-menu';
import { StandaloneCellMetaExtension } from '@labre/data-view';
import { BlockViewExtension, FlavourExtension } from '@labre/std';
import { literal } from 'lit/static-html.js';
import { z } from 'zod';

import { DatabaseConfigExtension } from './config';
import { databaseSlashMenuConfig } from './configs/slash-menu.js';
import { effects } from './effects';
import { linkColumnConfig } from './properties/link/cell-renderer.js';

const optionsSchema = z.object({
  configure: z
    .function()
    .args(z.instanceof(DatabaseBlockModel), z.custom<MenuOptions>())
    .returns(z.custom<MenuOptions>()),
});

export type DatabaseViewExtensionOptions = z.infer<typeof optionsSchema>;

export class DatabaseViewExtension extends ViewExtensionProvider<DatabaseViewExtensionOptions> {
  override name = 'affine-database-block';

  override schema = optionsSchema;

  override effect() {
    super.effect();
    effects();
  }

  override setup(
    context: ViewExtensionContext,
    options?: DatabaseViewExtensionOptions
  ) {
    super.setup(context);
    context.register([
      FlavourExtension('affine:database'),
      BlockViewExtension('affine:database', literal`affine-database`),
      SlashMenuConfigExtension('affine:database', databaseSlashMenuConfig),
      // The title band draws a `link` / `url` property with the table's link
      // cell; it sits below this package and cannot import it (ADR 0035 §11).
      StandaloneCellMetaExtension(linkColumnConfig),
    ]);
    if (options) {
      context.register(
        DatabaseConfigExtension({ configure: options.configure })
      );
    }
  }
}
