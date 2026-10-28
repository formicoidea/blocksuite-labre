import type { PropertyMetaConfig } from '@labre/affine-database-engine';
import { propertyPresets } from '@labre/affine-database-engine/property-presets';

import { richTextPropertyModelConfig } from '../rich-text/define.js';

const { textPropertyConfig } = propertyPresets;

/**
 * The text column of a hosted source whose values are plain JSON (ADR 0035
 * amendment of 2026-10-14): data-view's plain-text preset, type `text`, value
 * a string, drawn and edited by the table's plain-text cell (no second
 * drawing), offered by "+ property" and "Type".
 *
 * The preset itself stays `hide: true` and out of `databaseBlockProperties`:
 * the inline database's Text is `rich-text` (a `Text` per cell), and offering
 * both would put two "Text" types in its menus and let it store a column type
 * a 0.48 client does not draw. Only a source that lists this meta in its
 * `getPropertyMetas` and answers it from `propertyMetaGet('text')` offers it.
 * Named as the inline Text column: one wording for one notion.
 */
export const hostedTextColumnConfig = {
  ...textPropertyConfig,
  config: {
    ...textPropertyConfig.config,
    name: richTextPropertyModelConfig.config.name,
    hide: false,
  },
} as PropertyMetaConfig;
