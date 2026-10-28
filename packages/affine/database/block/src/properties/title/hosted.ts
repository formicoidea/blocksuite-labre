import {
  createIcon,
  type PropertyMetaConfig,
  t,
} from '@labre/affine-database-engine';
import { propertyPresets } from '@labre/affine-database-engine/property-presets';
import zod from 'zod';

import { titleColumnType, titlePropertyModelConfig } from './define.js';

/**
 * The title column of a hosted source whose rows are documents (ADR 0035
 * §9f, issue B15): the row's title as a plain string from the source's own
 * store, so drawing a base never loads a row's document.
 *
 * The same `title` type as the inline title column, so a stored column, a
 * view's `header.titleColumn` and the fixed-property rules read it unchanged;
 * only its value is a string instead of the row block's `Text`. Drawn and
 * edited by data-view's plain-text cell, the table's own (no second drawing);
 * a committed edit reaches the source's `cellValueChange` as a string, and the
 * source writes it to its store. A source answers it from `propertyMetaGet`
 * when `rowsAreDocuments` (`HostedDataSourceBase`).
 */
export const hostedTitlePropertyModelConfig = titleColumnType.modelConfig({
  // One wording and one data shape with the inline title column.
  name: titlePropertyModelConfig.config.name,
  propertyData: titlePropertyModelConfig.config.propertyData,
  jsonValue: {
    schema: zod.string(),
    type: () => t.string.instance(),
    isEmpty: ({ value }) => !value,
  },
  rawValue: {
    schema: zod.string(),
    default: () => '',
    toString: ({ value }) => value ?? '',
    fromString: ({ value }) => ({ value }),
    toJson: ({ value }) => value ?? '',
    fromJson: ({ value }) => value,
  },
  fixed: titlePropertyModelConfig.config.fixed,
});

// Typed as the meta a source's `propertyMetaGet` returns, so a host returns
// it as is.
export const hostedTitleColumnConfig =
  hostedTitlePropertyModelConfig.createPropertyMeta({
    icon: createIcon('TitleIcon'),
    cellRenderer: propertyPresets.textPropertyConfig.renderer.cellRenderer,
  }) as PropertyMetaConfig;
