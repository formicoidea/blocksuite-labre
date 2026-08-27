import type { C4NodeKind } from '@labre/affine-model';

/**
 * The middle tier of a C4 element's label — `[Person]`, `[Software System]`,
 * `[Container: Java]` — DERIVED from the kind, never stored.
 *
 * Derived because the two can then never disagree: the kind is what the renderer
 * paints and what the exporter maps, so a stored type line would be a second
 * copy of the same statement, free to drift the moment somebody changes one of
 * them. The author's only say in this line is the technology, which is the one
 * half the notation actually leaves to them.
 */

/**
 * The base word each kind is announced by, verbatim from the stencil's own
 * `<desc>` strings (`C4Model_default.svg`, the PO's reference model).
 *
 * Two readings are worth spelling out, because both look like mistakes:
 *
 * - `database` says **Container**, not "Database". The stencil labels the
 *   cylinder `[Container: technology]` exactly as it labels the plain box: a
 *   database is a CONTAINER, and the cylinder is a picture of one, not a fourth
 *   level. (The mermaid export still emits `ContainerDb` — that is the one
 *   specialisation mermaid's own grammar draws, and it is a different question
 *   from what the box says on the canvas.)
 * - an `-ext` variant says the same word as the kind it is external to. What
 *   "external" changes is the COLOUR — grey — and the stencil's gray sheet
 *   carries the identical `[Person]` / `[Software System]` wording.
 *
 * `Record<C4NodeKind, …>` and therefore compile-total: a kind added to the model
 * without a word to announce it fails the build here.
 */
export const C4_TYPE_WORD: Record<C4NodeKind, string> = {
  person: 'Person',
  'person-ext': 'Person',
  system: 'Software System',
  'system-ext': 'Software System',
  container: 'Container',
  database: 'Container',
  mobile: 'Container',
  browser: 'Container',
  component: 'Component',
};

/**
 * The type line as it is drawn, brackets included.
 *
 * The technology is appended only when the author actually set one — an empty
 * box, or one holding nothing but spaces, is not a technology and must not
 * produce a dangling `[Container: ]`. Whitespace runs collapse for the same
 * reason they do in the mermaid sanitizer: the line is one line.
 *
 * Pure, total and `std`-free, so the renderer, the exporter and a test can all
 * ask the same question and get the same answer.
 */
export function c4TypeLine(kind: C4NodeKind, technology?: string): string {
  const word = C4_TYPE_WORD[kind];
  const techn = (technology ?? '').replaceAll(/\s+/g, ' ').trim();
  return techn ? `[${word}: ${techn}]` : `[${word}]`;
}
