import { propertyType, t } from '@labre/affine-database-engine';
import { Text } from '@labre/store';
import * as Y from 'yjs';
import zod from 'zod';

import { getTextWithResolvedReferences } from '../../utils/title-doc.js';
import { DATABASE_TYPE_TEXT } from '../../translations.js';

export const richTextColumnType = propertyType('rich-text');
export type RichTextCellType = Text | Text['yText'];
export const toYText = (text?: RichTextCellType): undefined | Text['yText'] => {
  if (text instanceof Text) {
    return text.yText;
  }
  return text;
};

export const richTextPropertyModelConfig = richTextColumnType.modelConfig({
  name: DATABASE_TYPE_TEXT[1],
  nameWording: DATABASE_TYPE_TEXT,
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
    schema: zod
      .custom<RichTextCellType>(
        data => data instanceof Text || data instanceof Y.Text
      )
      .optional(),
    default: () => undefined,
    toString: ({ value, dataSource }) =>
      getTextWithResolvedReferences(value, dataSource),
    fromString: ({ value }) => {
      return {
        value: new Text(value),
      };
    },
    // An empty cell has always serialised as `null`, which the JSON schema
    // above (`zod.string()`) does not admit; the code before #742 reached it
    // through an `any`. Either side is a host contract held by
    // `zod-format-guard.unit.spec.ts` (an ADR, not a fix in passing), so the
    // mismatch stays as it was, spelled out.
    toJson: ({ value, dataSource }) =>
      value
        ? getTextWithResolvedReferences(value, dataSource)
        : (null as unknown as string),
    fromJson: ({ value }) =>
      typeof value !== 'string' ? undefined : new Text(value),
    onUpdate: ({ value, callback }) => {
      const yText = toYText(value);
      yText?.observe(callback);
      callback();
      return {
        dispose: () => {
          yText?.unobserve(callback);
        },
      };
    },
  },
});
