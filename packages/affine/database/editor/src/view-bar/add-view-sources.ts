/**
 * The sources "+ view" offers (ADR 0035 §1, §9c, B11; one source list with a
 * view's settings › "Source", amendment of 2026-10-30).
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
 * `listed` is the data-source picker's (B12) list of this database's
 * sources, the one the view settings show: with it, those come first, in the
 * picker's order and under its titles, whether their schema is loaded or
 * not (labre recette of 2.3.1: a source no view reads does not resolve until
 * a view reads it, and was dropped), then the sources views read that the
 * picker does not list.
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
  listed?: readonly { id: string; title: string }[];
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
  const fromViews = [...bySchema.values()];
  if (!reader.listed) return fromViews;
  const listed: AddViewSource[] = reader.listed.map(source => ({
    sourceId: source.id,
    // Unloaded, its id stands for its schema: nothing else can match it.
    schemaId: reader.resolve(source.id)?.schemaId ?? source.id,
    title: source.title,
  }));
  const ids = new Set(listed.map(source => source.sourceId));
  const schemas = new Set(listed.map(source => source.schemaId));
  return [
    ...listed,
    ...fromViews.filter(
      source => !ids.has(source.sourceId) && !schemas.has(source.schemaId)
    ),
  ];
}
