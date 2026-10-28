import {
  type ViewExtensionContext,
  ViewExtensionProvider,
} from '@labre/affine-ext-loader';
import { BlockViewExtension, FlavourExtension } from '@labre/std';
import { literal } from 'lit/static-html.js';

import { DataViewBlockSchema } from './data-view-model';
import { effects } from './effects';

const flavour = DataViewBlockSchema.model.flavour;

/**
 * Data-view block rendering — ALWAYS registered, independent of the
 * `data-view` flag (ADR 0009, ADR 0035 §5, issue B4): `effects()`, the
 * flavour and the block view, so a stored `affine:data-view` block draws
 * whatever the flags say. Until 0.48 all of it sat behind `data-view`.
 */
export class DataViewRenderViewExtension extends ViewExtensionProvider {
  override name = 'affine-data-view-render-block';

  override effect() {
    super.effect();
    effects();
  }

  override setup(context: ViewExtensionContext) {
    super.setup(context);
    context.register([
      FlavourExtension(flavour),
      BlockViewExtension(flavour, literal`affine-data-view`),
    ]);
  }
}

/**
 * Data-view creation tooling — flag-gated (`data-view`). It registers nothing
 * today: the block's only creation path, `dataViewSlashMenuConfig`, was never
 * registered (it also waits on `enable_block_query`). The class keeps the
 * render / tooling split of every other block, so a creation entry lands here
 * the day one ships, and a host that names it keeps compiling.
 */
export class DataViewViewExtension extends ViewExtensionProvider {
  override name = 'affine-data-view-block';
}
