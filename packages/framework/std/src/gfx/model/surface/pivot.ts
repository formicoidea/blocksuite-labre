/**
 * Backlinks over `pivotDocId` — **computed, never persisted** (MF1, ADR 0005 § 5).
 *
 * The library ships one pure, synchronous collector and nothing else: no index,
 * no reverse map, no cache, and nothing written back into the document. That is
 * not an optimisation left for later, it is the invariant: "which boards
 * mention this component" is a recomputation, always, so it can never drift
 * from the document and can never be corrupted by a bad write — because there
 * is no write.
 *
 * Cross-document aggregation ("every board where this component appears") is
 * the host's job, built from per-document calls to
 * {@link collectPivotOccurrences}. The repository has no backlink
 * infrastructure and this module deliberately does not introduce one.
 */
import type { GfxPrimitiveElementModel } from './element-model.js';
import type { SurfaceBlockModel } from './surface-model.js';

/** One element that is an occurrence of one pivot record. */
export type PivotOccurrence = {
  /** The bound pivot record. */
  pivotDocId: string;
  /** The surface element that is an occurrence of it. */
  elementId: string;
  /** Element type, e.g. `'shape'`, `'wardleyNode'`, `'edgyNode'`. */
  elementType: string;
};

/** A surface element whose binding is known to be present. */
export type PivotBoundElement = GfxPrimitiveElementModel & {
  pivotDocId: string;
};

/**
 * Whether the element carries a binding. Narrowing type guard, so a caller that
 * has checked does not have to re-assert the string.
 *
 * An empty string is NOT a binding: `@field()` writes whatever it is given, and
 * a host that passes `''` means "none". Treating it as a record id would send
 * the provider looking for a document that cannot exist.
 */
export function isPivotBound(
  el: GfxPrimitiveElementModel
): el is PivotBoundElement {
  return typeof el.pivotDocId === 'string' && el.pivotDocId.length > 0;
}

/**
 * Every occurrence on one surface, in element order. O(n) over the surface's
 * elements; allocates nothing persistent.
 *
 * @param pivotDocId Restrict to one record. Omitted, every bound element is
 *   returned — which is what a host rebuilding its derived state wants
 *   (ADR 0006 § 4.2: the element is always the source of truth).
 */
export function collectPivotOccurrences(
  surface: SurfaceBlockModel,
  pivotDocId?: string
): PivotOccurrence[] {
  const occurrences: PivotOccurrence[] = [];

  for (const element of surface.elementModels) {
    if (!isPivotBound(element)) continue;
    if (pivotDocId !== undefined && element.pivotDocId !== pivotDocId) continue;

    occurrences.push({
      pivotDocId: element.pivotDocId,
      elementId: element.id,
      elementType: element.type,
    });
  }

  return occurrences;
}
