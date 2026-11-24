import { propertyType, t } from '@labre/affine-database-engine';
import { Text } from '@labre/store';
import { Doc } from 'yjs';
import zod from 'zod';

import { getTextWithResolvedReferences } from '../../utils/title-doc.js';
import { DATABASE_TYPE_TITLE } from '../../translations.js';

export const titleColumnType = propertyType('title');

export const titlePropertyModelConfig = titleColumnType.modelConfig({
  name: DATABASE_TYPE_TITLE[1],
  nameWording: DATABASE_TYPE_TITLE,
  propertyData: {
    schema: zod.object({}),
    default: () => ({}),
  },
  jsonValue: {
    schema: zod.string(),
    type: () => t.richText.instance(),
    isEmpty: ({ value }) => !value,
  },
  rawValue: {
    schema: zod.custom<Text>(data => data instanceof Text).optional(),
    default: () => undefined,
    toString: ({ value, dataSource }) =>
      getTextWithResolvedReferences(value, dataSource),
    fromString: ({ value }) => {
      return { value: new Text(value) };
    },
    toJson: ({ value, dataSource }) =>
      getTextWithResolvedReferences(value, dataSource),
    fromJson: ({ value }) => new Text(value),
    onUpdate: ({ value, callback }) => {
      value?.yText.observe(callback);
      callback();
      return {
        dispose: () => {
          value?.yText.unobserve(callback);
        },
      };
    },
    setValue: ({ value, newValue }) => {
      if (value == null) {
        return;
      }
      const v = newValue as unknown;
      if (v == null) {
        value.replace(0, value.length, '');
        return;
      }
      if (typeof v === 'string') {
        value.replace(0, value.length, v);
        return;
      }
      if (newValue instanceof Text) {
        new Doc().getMap('root').set('text', newValue.yText);
        value.clear();
        value.applyDelta(newValue.toDelta());
        return;
      }
    },
  },
  fixed: {
    defaultData: {},
    defaultShow: true,
  },
});
