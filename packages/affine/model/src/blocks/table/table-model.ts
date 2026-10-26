import type { DeltaInsert, Text } from '@labre/store';
import {
  BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
} from '@labre/store';

import type { BlockMeta } from '../../utils/types';

export type TableCell = {
  text: Text;
};

export interface TableRow {
  rowId: string;
  order: string;
  backgroundColor?: string;
}

export interface TableColumn {
  columnId: string;
  order: string;
  backgroundColor?: string;
  width?: number;
}

export interface TableBlockProps extends BlockMeta {
  rows: Record<string, TableRow>;
  columns: Record<string, TableColumn>;
  // key = `${rowId}:${columnId}`
  cells: Record<string, TableCell>;
  comments?: Record<string, boolean>;
  // The first row in display order is a header. `true` or absent, never
  // `false`: turning it off deletes the key (ADR 0043).
  headerRow?: true;
  // The first column in display order is a header; same rule (ADR 0043).
  headerColumn?: true;
}

export interface TableCellSerialized {
  text: {
    delta: DeltaInsert[];
  };
}

export interface TableBlockPropsSerialized {
  rows: Record<string, TableRow>;
  columns: Record<string, TableColumn>;
  cells: Record<string, TableCellSerialized>;
  headerRow?: true;
  headerColumn?: true;
}

export class TableBlockModel extends BlockModel<TableBlockProps> {}
export const TableModelFlavour = 'affine:table';
export const TableBlockSchema = defineBlockSchema({
  flavour: TableModelFlavour,
  props: (): TableBlockProps => ({
    rows: {},
    columns: {},
    cells: {},
    comments: undefined,
    // `undefined`, never `false`: a defined default is written into every
    // table the first time a document opens (ADR 0043).
    headerRow: undefined,
    headerColumn: undefined,
    'meta:createdAt': undefined,
    'meta:createdBy': undefined,
    'meta:updatedAt': undefined,
    'meta:updatedBy': undefined,
  }),
  metadata: {
    isFlatData: true,
    role: 'content',
    version: 1,
    parent: ['affine:note'],
    children: [],
  },
  toModel: () => new TableBlockModel(),
});

export const TableBlockSchemaExtension = BlockSchemaExtension(TableBlockSchema);
