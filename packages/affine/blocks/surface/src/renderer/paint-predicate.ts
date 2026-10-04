/**
 * The one question every renderer site asks before it paints an element:
 * "is this painted?".
 *
 * Four sites asked it inline, with the same expression copied four times — the
 * canvas renderer's layer bound and its bound pass, the DOM renderer's full
 * and incremental passes. ADR 0031 adds two more visibilities beside the two
 * this reads (a viewer's local hide, a stored "hide for everyone"), and a
 * fifth copy of a three-term conjunction is how one site ends up painting
 * what the others skip. So the expression lives here, once.
 *
 * - `display` is the text editor's session flag (`edgeless-text-editor.ts`
 *   sets it to `false` while it edits); `undefined` means painted.
 * - `hidden` is stored, and owned by mindmap collapse alone (ADR 0031 §1).
 * - `visibility` is what this viewer does not see (`gfx.localVisibility`, ADR
 *   0031 §8): their own local hide, and the stored "hide for everyone" that
 *   `GfxController` registers into the same hook (§7). The exports paint
 *   through the same renderer, so both are left out of an SVG or PNG too:
 *   what you see is what you export.
 *
 * Painting only. Picking does not read this: the stored `hidden` is already
 * skipped by `grid.search`, the local hide by `getElementByPoint`, and
 * `display` is deliberately still clickable.
 */
export function isPainted<
  T extends {
    display?: boolean;
    hidden?: boolean;
  },
>(
  element: T,
  visibility?: { isHidden(element: NoInfer<T>): boolean }
): boolean {
  return (
    (element.display ?? true) &&
    !element.hidden &&
    !(visibility?.isHidden(element) ?? false)
  );
}
