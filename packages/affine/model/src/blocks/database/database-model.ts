import type { Text } from '@labre/store';
import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@labre/store';

import type {
  ColumnDataType,
  SerializedCells,
  ViewBasicDataType,
} from './types.js';

export type DatabaseBlockProps = {
  views: ViewBasicDataType[];
  title: Text;
  cells: SerializedCells;
  columns: Array<ColumnDataType>;
  comments?: Record<string, boolean>;
  // Optional id of a host-provided external data source. When set and a
  // DatabaseDataSourceProvider is registered, the block renders via the
  // injected source instead of the inline blob source. Default undefined =
  // identical to legacy behavior.
  externalSourceId?: string;
};

export class DatabaseBlockModel extends BlockModel<DatabaseBlockProps> {}

export const DatabaseBlockSchema = defineBlockSchema({
  flavour: 'affine:database',
  props: (internal): DatabaseBlockProps => ({
    views: [],
    title: internal.Text(),
    cells: Object.create(null),
    columns: [],
    comments: undefined,
    externalSourceId: undefined,
  }),
  metadata: {
    role: 'hub',
    version: 4,
    parent: ['affine:note'],
    children: ['affine:paragraph', 'affine:list'],
  },
  toModel: () => new DatabaseBlockModel(),
});

export const DatabaseBlockSchemaExtension =
  BlockSchemaExtension(DatabaseBlockSchema);
