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
 * The **degraded shape**: `tags` stored as a plain object rather than a
 * `Y.Map`.
 *
 * This is not a hypothetical. A client that predates this field does not
 * DECLARE it, so on the five element-creation-from-props paths (paste,
 * duplicate, alt-drag clone, turn-into-linked-doc, `updateElement` with an
 * undeclared key) `_assignElementProp` routes it down the unknown-key branch —
 * and that branch's encodability guard accepts the serialized form of the
 * nested map perfectly, because it IS flat JSON: an object of arrays of
 * strings. So the value is written verbatim, as a plain object.
 *
 * The unknown-key branch is doing exactly its job — preserving a key it does
 * not understand. It is THIS side that has to meet it halfway, and in this
 * release rather than a later one: the whole point of shipping the declaration
 * before anything writes the field is that the fleet floor tolerates the key,
 * and tolerance that cannot read the only other shape in existence is not
 * tolerance.
 *
 * Reading normalizes it (below); the first write CONVERTS it
 * ({@link setElementTag}), so the degraded shape is transitional per element
 * and never persists past a qualification gesture.
 */
function isDegradedTags(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' &&
    value !== null &&
    !(value instanceof Y.AbstractType) &&
    !Array.isArray(value) &&
    !(value instanceof Uint8Array)
  );
}

/**
 * The element's tags as `[tagId, rawValues]` pairs, whichever shape they are
 * stored in. One place normalizes the two vintages so no reader has to know
 * that there are two.
 */
function tagEntries(element: GfxPrimitiveElementModel): [string, unknown][] {
  const stored: unknown = element.tags;
  if (stored instanceof Y.Map) return [...stored.entries()];
  if (isDegradedTags(stored)) return Object.entries(stored);
  return [];
}

/**
 * Every tag on the element, as plain JSON. `{}` when unqualified — absent and
 * empty are the same fact, and no caller should have to distinguish them.
 *
 * Defensive by construction: the map is a document value, so a client of any
 * vintage may have written something else into it. Both shapes a real client
 * can produce are read ({@link isDegradedTags}); a malformed entry is skipped,
 * never thrown on. A board that cannot be read is worse than a tag that is not.
 */
export function readElementTags(
  element: GfxPrimitiveElementModel
): ElementTags {
  const tags: ElementTags = {};
  for (const [tagId, values] of tagEntries(element)) {
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
  const stored: unknown = element.tags;
  if (stored instanceof Y.Map) return cleanValues(stored.get(tagId));
  if (isDegradedTags(stored)) return cleanValues(stored[tagId]);
  return [];
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
 * ## The cases, and why the first one is the point
 *
 * - **A `Y.Map` already** — the entry is set IN PLACE. Replacing the whole map
 *   instead would restore whole-blob last-write-wins and silently drop a
 *   concurrent edit on a different tag, which is the single reason the field is
 *   a nested map at all. Removing the last entry removes the key with
 *   `clearField` rather than leaving an empty map behind: an element qualified
 *   and then un-qualified goes back to costing nothing, like one that never was.
 * - **Nothing yet** — a map is created and assigned through `updateElement`,
 *   which is what attaches it to the document and starts the nested observer.
 * - **The degraded shape** ({@link isDegradedTags}) — the map is created from
 *   what is ALREADY there, plus the change. This is the one case where
 *   replacing wholesale is right, because a plain object was never mergeable in
 *   the first place; what would be wrong, and was, is replacing it with a map
 *   holding only the new tag. A colleague's qualification, written by a client
 *   that predates this field, would leave without a word.
 *
 * ## Read-only
 *
 * A read-only store is a no-op with a warning, not a throw and not a write.
 * This is exported from `@labre/std/gfx`, so a host can call it directly, and
 * the three write paths below reach the document three different ways: an
 * in-place `store.transact` and `clearField` carry no read-only guard of their
 * own (they would silently succeed), while `updateElement` throws. Three
 * behaviours for one refusal is not a contract; one guard here is.
 */
export function setElementTag(
  element: GfxPrimitiveElementModel,
  tagId: string,
  values: readonly string[]
): boolean {
  if (typeof tagId !== 'string' || tagId.length === 0) return false;

  if (element.surface.store.readonly) {
    console.warn(
      `Refusing to qualify element "${element.id}" with "${tagId}": the document is read-only.`
    );
    return false;
  }

  const next = cleanValues(values);
  const stored: unknown = element.tags;
  if (sameValues(elementTagValues(element, tagId), next)) return false;

  // The native shape: merge per tag, which is the whole design.
  if (stored instanceof Y.Map) {
    if (next.length === 0) {
      element.surface.store.transact(() => {
        stored.delete(tagId);
      });
      if (stored.size === 0) element.clearField(ELEMENT_TAGS_FIELD);
    } else {
      element.surface.store.transact(() => {
        stored.set(tagId, next);
      });
    }
    return true;
  }

  // Absent, or the degraded shape. `readElementTags` normalizes both, so the
  // conversion preserves whatever a pre-declaration client left behind.
  const merged = readElementTags(element);
  if (next.length === 0) delete merged[tagId];
  else merged[tagId] = next;

  const entries = Object.entries(merged);
  if (entries.length === 0) {
    // A degraded value emptied by this call: remove the key rather than write
    // an empty map. (Absent-and-empty returned above, at `sameValues`.)
    element.clearField(ELEMENT_TAGS_FIELD);
    return true;
  }

  const created = new Y.Map<string[]>();
  for (const [id, cleaned] of entries) created.set(id, cleaned);
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
