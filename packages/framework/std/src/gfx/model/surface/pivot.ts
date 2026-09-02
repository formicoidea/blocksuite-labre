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
 *
 * Beside the collector sit the two READ predicates over the same field —
 * {@link isPivotBound}, the strict one, and {@link resolvePivotBinding}, the
 * one that tolerates a binding carried by a composite. Both are pure functions
 * of the document, and neither writes.
 */
import { GfxPrimitiveElementModel } from './element-model.js';
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
 * The binding that governs an element — **a READING tolerance, and the only
 * one** (PO arbitration of 02/09/2026).
 *
 * Returns the element itself when it carries a binding, otherwise the first
 * bound element in its chain of ancestor groups, otherwise `undefined`.
 *
 * ## Why a chain at all
 *
 * ADR 0005/0006 put the binding ON THE ELEMENT, and that has not changed. What
 * the format never said is WHICH element of a COMPOSITE carries it — and every
 * business framework draws its artefacts as composites: a Wardley component is
 * a `group` holding the `wardleyNode` circle and a free `text` label, a C4
 * component is a shape plus three texts. Two different elements can therefore
 * legitimately be "the component":
 *
 * - the one carrying the ROLE (`wardley:component`), which is what the reading
 *   engine and the toolbar resolve to, through the group;
 * - the one a plain click SELECTS, which is the GROUP — and therefore what a
 *   host's own "link this to a record" gesture naturally stamps.
 *
 * A reader that only looked at the role-carrying element reported "Not linked
 * to a record" on a component the host had bound by the group, with the link
 * plainly there in the document. That is the bug this function exists for. It
 * is a filter on the way IN, never a rule about where a binding belongs: the
 * WRITE contract is untouched — `pivot.bind` and the panel's "Link to a record"
 * still stamp the role-carrying element.
 *
 * ## Why the child wins
 *
 * The most SPECIFIC binding wins, so an element bound in its own right is never
 * shadowed by the group it happens to sit in. Deliberately asymmetric with the
 * ancestor walk: a group that gathers two bound components is a container, not
 * an occurrence of either, and each child keeps answering for itself.
 *
 * ## Scope
 *
 * Reading only. `collectPivotOccurrences` and the host-facing seam
 * (materiality patches, backlinks) stay strictly element-by-element: they are
 * the ADR 0006 contract the host builds its own derived state on, and widening
 * them would change what "an occurrence" means without a decision.
 *
 * Cheap and allocation-light: the chain is at most a handful of groups deep and
 * the visited set is only built when the element has an ancestor at all. The
 * guard is not decoration — a corrupted document can hold a cycle in the group
 * relation (`SurfaceBlockModel.getGroups` carries the same guard), and a reader
 * on the render path must degrade to `undefined`, never hang.
 */
export function resolvePivotBinding(
  element: GfxPrimitiveElementModel
): PivotBoundElement | undefined {
  if (isPivotBound(element)) return element;

  const visited = new Set<string>([element.id]);
  let ancestor = element.group;

  while (ancestor && !visited.has(ancestor.id)) {
    visited.add(ancestor.id);
    // A group may be a BLOCK (a frame): only a canvas element declares
    // `pivotDocId`, so anything else can never be bound — the walk steps over
    // it rather than stopping, because what sits above it still can be.
    if (
      ancestor instanceof GfxPrimitiveElementModel &&
      isPivotBound(ancestor)
    ) {
      return ancestor;
    }
    ancestor = ancestor.group;
  }

  return undefined;
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
