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
 * The condition of a colour rule: a filter group, the very shape a view
 * stores as its `filter` (`FilterGroup` of `@labre/data-view`, which reads
 * and evaluates it). Opaque here: the model does not know the filter
 * functions.
 */
export type DatabaseViewColorRuleFilter = {
  type: 'group';
  op: 'and' | 'or';
  conditions: unknown[];
};

/**
 * One conditional colour of a view (ADR 0036): rows (table, list) and cards
 * (board, gallery) that match `filter` take `color` as a light background.
 * `color` is a colour of the select options' palette, stored as an option
 * stores it; a value this build does not know paints nothing. `id` names
 * the rule for the editor, so a peer's reorder never retargets an edit.
 */
export type DatabaseViewColorRule = {
  id: string;
  color: string;
  filter: DatabaseViewColorRuleFilter;
};

/**
 * The stored shape every view in `props.views` shares; each mode adds its own
 * data on top. `sourceId` and `openIn` arrived in 0.49 (ADR 0035 §8, red
 * zone): optional, `undefined` by default and never written on load, so a
 * view stored by 0.48 or earlier is still a valid view and a 0.48 client
 * ignores them. `sourceId` absent means the block's own implicit source.
 * `colorRules` arrived in 0.50 (ADR 0036, red zone), on the same terms: absent
 * until a gesture adds a rule, ordered (the first rule that matches a row
 * wins), ignored by a 0.49 client, which keeps it through its own writes
 * (`updateView` merges into the stored view).
 * `databaseId` arrived in 2.4 (ADR 0035 amendment of 2026-10-30, red zone):
 * the database the view's source belongs to, written only when it is not
 * the block's own (`externalSourceId`), so a view may read a source of
 * another database. Absent means the block's database: every view stored
 * before 2.4 reads exactly as it did, and nothing writes it on load. A 2.3
 * client ignores it and looks for `sourceId` in the block's database (where
 * a host whose source ids are unique finds none: "Source not found"), and
 * keeps it through its own writes, as for `colorRules`.
 * Held by `view-basic-data.unit.spec.ts`.
 */
export type ViewBasicDataType = {
  id: string;
  name: string;
  mode: string;
  sourceId?: string;
  databaseId?: string;
  openIn?: DatabaseViewOpenIn;
  colorRules?: DatabaseViewColorRule[];
};
