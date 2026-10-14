export interface ColumnDataType<
  Data extends Record<string, unknown> = Record<string, unknown>,
> {
  id: string;
  type: string;
  name: string;
  data: Data;
}

export type ColumnUpdater<T extends ColumnDataType = ColumnDataType> = (
  data: T
) => Partial<T>;
export type CellDataType<ValueType = unknown> = {
  columnId: ColumnDataType['id'];
  value: ValueType;
};

export type SerializedCells = Record<string, Record<string, CellDataType>>;
/**
 * Where a row of a view opens (ADR 0035 §8). Append-only: a stored value is
 * never renamed or removed. An absent `openIn` reads `side`.
 */
export const DATABASE_VIEW_OPEN_IN = ['side', 'center', 'full'] as const;
export type DatabaseViewOpenIn = (typeof DATABASE_VIEW_OPEN_IN)[number];

/**
 * The stored shape every view in `props.views` shares; each mode adds its own
 * data on top. `sourceId` and `openIn` arrived in 0.49 (ADR 0035 §8, red
 * zone): optional, `undefined` by default and never written on load, so a
 * view stored by 0.48 or earlier is still a valid view and a 0.48 client
 * ignores them. `sourceId` absent means the block's own implicit source.
 * Held by `view-basic-data.unit.spec.ts`.
 */
export type ViewBasicDataType = {
  id: string;
  name: string;
  mode: string;
  sourceId?: string;
  openIn?: DatabaseViewOpenIn;
};
