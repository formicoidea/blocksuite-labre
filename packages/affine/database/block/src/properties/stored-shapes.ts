/**
 * Stored cell shapes a column's `rawValue.schema` refuses but a reader of
 * that column type still reads, by code written for them.
 *
 * A data source reads a stored value its column rejects as the column's
 * default (#656): a value nobody can read must not reach the views raw. A
 * shape a renderer or a conversion still reads is not that: read as the
 * default, the cell's first edit or the column's first type change writes
 * the default over it, and its content is lost. The stored format is
 * forever, so such a shape is read as stored.
 *
 * - `rich-text`, a plain string (an older document, a snapshot or an import
 *   writing plain text): the cell's editor turns it into a `Text` keeping its
 *   content (`RichTextCell.beforeEnterEditMode`), `toString` and every
 *   conversion from rich-text (`converts.ts`) read it through `toString()`.
 *
 * A reader that merely coerces (a number column printing a string, a
 * checkbox reading any truthy value as ticked, a date built with
 * `new Date(value)`) is not code for a stored shape: those stay defaulted.
 */
const READABLE_STORED_SHAPES: Record<string, (value: unknown) => boolean> =
  Object.assign(Object.create(null), {
    'rich-text': (value: unknown) => typeof value === 'string',
  });

/** Whether `value`, refused by its column's schema, is still read as stored. */
export function storedShapeIsReadable(type: string, value: unknown): boolean {
  return READABLE_STORED_SHAPES[type]?.(value) ?? false;
}
