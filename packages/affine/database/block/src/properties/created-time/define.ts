import { propertyType, t } from '@labre/affine-database-engine';
import { format } from 'date-fns/format';
import zod from 'zod';
import { DATABASE_TYPE_CREATED_TIME } from '../../translations.js';

export const createdTimeColumnType = propertyType('created-time');
export const createdTimePropertyModelConfig = createdTimeColumnType.modelConfig(
  {
    name: DATABASE_TYPE_CREATED_TIME[1],
    nameWording: DATABASE_TYPE_CREATED_TIME,
    propertyData: {
      schema: zod.object({}),
      default: () => ({}),
    },
    jsonValue: {
      schema: zod.number().nullable(),
      isEmpty: () => false,
      type: () => t.date.instance(),
    },
    rawValue: {
      schema: zod.number().nullable(),
      default: () => null,
      toString: ({ value }) =>
        value != null ? format(value, 'yyyy-MM-dd HH:mm:ss') : '',
      fromString: () => {
        return { value: null };
      },
      toJson: ({ value }) => value,
      setValue: () => {},
    },
  }
);
