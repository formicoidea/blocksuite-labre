import zod from 'zod';

import { t } from '../../core/index.js';
import { propertyType } from '../../core/property/property-config.js';
import { DATA_VIEW_TYPE_PLAIN_TEXT } from '../../translations.js';
export const textPropertyType = propertyType('text');

export const textPropertyModelConfig = textPropertyType.modelConfig({
  name: DATA_VIEW_TYPE_PLAIN_TEXT[1],
  nameWording: DATA_VIEW_TYPE_PLAIN_TEXT,
  propertyData: {
    schema: zod.object({}),
    default: () => ({}),
  },
  jsonValue: {
    schema: zod.string(),
    type: () => t.string.instance(),
    isEmpty: ({ value }) => !value,
  },
  rawValue: {
    schema: zod.string(),
    default: () => '',
    toString: ({ value }) => value,
    fromString: ({ value }) => {
      return { value: value };
    },
    toJson: ({ value }) => value,
    fromJson: ({ value }) => value,
  },
  hide: true,
});
