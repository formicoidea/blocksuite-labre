/**
 * Reading and writing the level-3 qualification carried by
 * {@link GfxPrimitiveElementModel.tags} (ADR 0007 § 4).
 *
 * The persisted shape is a nested `Y.Map<string[]>` keyed by tag def id, so two
 * people qualifying one element on two DIFFERENT tags both keep their work.
 * Everything that reads it wants a plain object, and everything that writes it
 * has exactly three cases to get right (create the map, mutate it in place,
 * remove the key when the last tag goes). Both live here so no call site has to
 * remember either.
 *
 * Nothing in this module knows what a tag MEANS. Definitions are runtime
 * configuration owned by the host (`UniverseTagDefsProvider`) and are never
 * persisted: a value whose def has vanished still loads, and is displayed as its
 * raw id.
 */
import * as Y from 'yjs';

import type { GfxPrimitiveElementModel } from './element-model.js';

/** The `@field()` key. Spelled once. */
export const ELEMENT_TAGS_FIELD = 'tags';

/**
 * A flattened snapshot of an element's qualification: tag def id → value ids.
 * The transport shape — `OccurrenceMaterialityPatch.tags` is exactly this — and
 * deliberately NOT the persisted one.
 */
export type ElementTags = Record<string, string[]>;

/**
 * Value ids, cleaned: strings only, no blanks, no duplicates, order preserved.
 *
 * Persisted values are plain `string`s and are never narrowed, because a
 * document may legitimately carry an id whose def was removed, renamed or never
 * seeded in this deployment — and it must still open. What this rejects is not
 * an unknown id but a non-value: `null`, a number, an object, the empty string.
 */
function cleanValues(values: unknown): string[] {
  if (!Array.isArray(values)) return [];
  const seen = new Set<string>();
  const cleaned: string[] = [];
  for (const value of values) {
    if (typeof value !== 'string' || value.length === 0) continue;
    if (seen.has(value)) continue;
    seen.add(value);
    cleaned.push(value);
  }
  return cleaned;
}

const sameValues = (a: string[], b: string[]) =>
  a.length === b.length && a.every((value, i) => value === b[i]);

/**
 * Every tag on the element, as plain JSON. `{}` when unqualified — absent and
 * empty are the same fact, and no caller should have to distinguish them.
 *
 * Defensive by construction: the map is a document value, so a client of any
 * vintage may have written something else into it. A malformed entry is skipped,
 * never thrown on. A board that cannot be read is worse than a tag that is not.
 */
export function readElementTags(element: GfxPrimitiveElementModel): ElementTags {
  const map = element.tags;
  if (!(map instanceof Y.Map)) return {};

  const tags: ElementTags = {};
  for (const [tagId, values] of map.entries()) {
    if (typeof tagId !== 'string' || tagId.length === 0) continue;
    const cleaned = cleanValues(values);
    if (cleaned.length) tags[tagId] = cleaned;
  }
  return tags;
}

/** The value ids selected for one tag, `[]` when it carries none. */
export function elementTagValues(
  element: GfxPrimitiveElementModel,
  tagId: string
): string[] {
  const map = element.tags;
  return map instanceof Y.Map ? cleanValues(map.get(tagId)) : [];
}

/** Whether the element carries `valueId` under `tagId`. */
export function hasElementTagValue(
  element: GfxPrimitiveElementModel,
  tagId: string,
  valueId: string
): boolean {
  return elementTagValues(element, tagId).includes(valueId);
}

/**
 * Set (or, with an empty `values`, remove) ONE tag on ONE element. Returns
 * whether anything was written — a gesture that changes nothing must not cost an
 * undo step and must not be reported.
 *
 * The caller owns `store.captureSync()`, and owes it BEFORE this call: the undo
 * manager is built with no `captureTimeout`, so a qualification issued within
 * 500 ms of a drag would otherwise be undone together with the drag — making a
 * promotion look like it moved geometry, which is exactly what the ladder's
 * invariants forbid.
 *
 * ## The three cases, and why the middle one is the point
 *
 * - **No map yet** — one is created and assigned through `updateElement`, which
 *   is what attaches it to the document and starts the nested observer.
 * - **A map already** — the entry is set IN PLACE. Replacing the whole map
 *   instead would restore whole-blob last-write-wins and silently drop a
 *   concurrent edit on a different tag, which is the single reason the field is
 *   a nested map at all.
 * - **The last tag removed** — the key is removed with `clearField` rather than
 *   left holding an empty map: an element qualified and then un-qualified goes
 *   back to costing nothing, exactly like one that never was.
 */
export function setElementTag(
  element: GfxPrimitiveElementModel,
  tagId: string,
  values: readonly string[]
): boolean {
  if (typeof tagId !== 'string' || tagId.length === 0) return false;

  const next = cleanValues(values);
  const current = element.tags;
  const existing = current instanceof Y.Map ? cleanValues(current.get(tagId)) : [];
  if (sameValues(existing, next)) return false;

  if (next.length === 0) {
    if (!(current instanceof Y.Map)) return false;
    element.surface.store.transact(() => {
      current.delete(tagId);
    });
    if (current.size === 0) element.clearField(ELEMENT_TAGS_FIELD);
    return true;
  }

  if (current instanceof Y.Map) {
    element.surface.store.transact(() => {
      current.set(tagId, next);
    });
    return true;
  }

  const created = new Y.Map<string[]>();
  created.set(tagId, next);
  element.surface.updateElement(element.id, { tags: created });
  return true;
}

/**
 * Rebuild `tags` as a `Y.Map` when it arrives as plain JSON.
 *
 * Called by `SurfaceBlockModel._propsToY` for EVERY element type, because the
 * field is declared on the base class and per-class `propsToY` hooks are not.
 * Without it, paste / duplicate / alt-drag clone would each store the copy's
 * qualification as one opaque plain object — indistinguishable from a correct
 * copy until two people edited it and one of them lost their tag.
 *
 * `element.serialize()` is `yMap.toJSON()`, so the nested map reaches every one
 * of those paths as a plain object with no wrapper; the snapshot path arrives
 * already converted by the `SURFACE_YMAP_UNIQ_IDENTIFIER` branch above the call
 * and is passed through untouched. An empty (or unusable) value drops the key
 * entirely rather than writing a tombstone.
 */
export function tagsPropToY(props: Record<string, unknown>): void {
  if (!(ELEMENT_TAGS_FIELD in props)) return;

  const value = props[ELEMENT_TAGS_FIELD];
  if (value instanceof Y.AbstractType) return;

  if (value === null || typeof value !== 'object') {
    delete props[ELEMENT_TAGS_FIELD];
    return;
  }

  const entries = Object.entries(value)
    .filter(([tagId]) => tagId.length > 0)
    .map(([tagId, values]) => [tagId, cleanValues(values)] as const)
    .filter(([, cleaned]) => cleaned.length > 0);

  if (entries.length === 0) {
    delete props[ELEMENT_TAGS_FIELD];
    return;
  }

  const map = new Y.Map<string[]>();
  for (const [tagId, cleaned] of entries) map.set(tagId, cleaned);
  // The entry count is taken from the array above and NOT from `map.size`: a
  // `Y.Map` that has not been integrated into a document yet holds its content
  // in `_prelimContent`, so `size` reads 0 and logs "Add Yjs type to a document
  // before reading data". Silently dropping every pasted qualification is
  // exactly the failure this whole conversion exists to prevent.
  props[ELEMENT_TAGS_FIELD] = map;
}
