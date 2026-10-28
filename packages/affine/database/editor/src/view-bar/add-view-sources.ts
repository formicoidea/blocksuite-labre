/**
 * The sources "+ view" offers (ADR 0035 §1, §9c, B11; labre ADR-0046 §5:
 * "+ view has three entries: on an existing source, with a new source, import
 * a view from another database").
 *
 * Pure, so the list is held by a unit spec without a DOM. "Existing" means
 * the sources the block's views already read, in the order of the views,
 * each once: the seams table's "without the picker, '+ view' offers only the
 * sources the block already shows". Two views reading one schema block (one
 * naming it, one stored before 0.49 with no `sourceId`, which the host
 * resolves to its first source) are one source; the named id wins, so a
 * view added there names its source. A view whose source does not resolve is
 * skipped: nothing can be added on a source that is not there.
 *
 * `extraSourceIds` is for the data-source picker (B12): the sources of this
 * database that no view reads yet, appended after the shown ones,
 * deduplicated the same way.
 */
export interface AddViewSource {
  /** What the new view stores as its `sourceId`; `undefined` stores none. */
  sourceId: string | undefined;
  /** The source's schema block id, the identity used to deduplicate. */
  schemaId: string;
  /** The source's name as its schema block's title holds it; may be empty. */
  title: string;
}

export interface AddViewSourceReader {
  /** Each stored view's `sourceId`, in the order of the views. */
  viewSourceIds: readonly (string | undefined)[];
  /** Resolves a `sourceId` to its schema block, `null` when none. */
  resolve: (
    sourceId: string | undefined
  ) => { schemaId: string; title: string } | null;
  extraSourceIds?: readonly string[];
}

export function existingSources(reader: AddViewSourceReader): AddViewSource[] {
  const bySchema = new Map<string, AddViewSource>();
  const add = (sourceId: string | undefined) => {
    const resolved = reader.resolve(sourceId);
    if (!resolved) return;
    const known = bySchema.get(resolved.schemaId);
    if (known) {
      if (known.sourceId === undefined && sourceId !== undefined) {
        known.sourceId = sourceId;
      }
      return;
    }
    bySchema.set(resolved.schemaId, {
      sourceId,
      schemaId: resolved.schemaId,
      title: resolved.title,
    });
  };
  reader.viewSourceIds.forEach(add);
  reader.extraSourceIds?.forEach(add);
  return [...bySchema.values()];
}
