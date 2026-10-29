import { propertyType, t } from '@labre/affine-database-engine';
import zod from 'zod';
import { DATABASE_TYPE_LINK } from '../../translations.js';
export const linkColumnType = propertyType('link');
export const linkPropertyModelConfig = linkColumnType.modelConfig({
  name: DATABASE_TYPE_LINK[1],
  nameWording: DATABASE_TYPE_LINK,
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
});
