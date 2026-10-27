import type { C4NodeKind } from '@labre/affine-model';

// The English words of the type line, editor-free: the toolbox
// (`toolbox.ts`, `docs/adr/0045`) seeds a component with them from the
// `./interchange` graph, which must not load the services that resolve a
// word in the host's language (`type-line.ts` does that).

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
 * Which kinds announce a technology in their type line AT ALL.
 *
 * The notation's own division and not mermaid's, though the two agree: a person
 * is not built with a technology and a software system's is a level down, so
 * both are written `[Person]` / `[Software System]` full stop. Every container
 * — the cylinder, the phone and the browser window included — and every
 * component carries `[Word: technology]`, because at those two levels "what is
 * it built with" is the question the diagram exists to answer.
 *
 * This decides the PLACEHOLDER only. An author who types a technology onto a
 * person gets it drawn, exactly as `c4TypeLine` has always drawn it: the
 * notation is a prompt here, not a validator.
 */
export const C4_TYPE_TAKES_TECHNOLOGY: Record<C4NodeKind, boolean> = {
  person: false,
  'person-ext': false,
  system: false,
  'system-ext': false,
  container: true,
  database: true,
  mobile: true,
  browser: true,
  component: true,
};

/**
 * The word a fresh type line prompts the author with, in the technology's slot.
 *
 * The stencil's own: its container reads `[Container: technology]` before
 * anybody fills it in. A prompt rather than a value — see
 * {@link C4_TYPE_PLACEHOLDER}.
 */
export const TYPE_TECHNOLOGY_PLACEHOLDER = 'technology';

/** `[Word]`, or `[Word: technology]` when one is set (see `c4TypeLine`). */
export function typeLineOf(word: string, technology?: string): string {
  const techn = (technology ?? '').replaceAll(/\s+/g, ' ').trim();
  return techn ? `[${word}: ${techn}]` : `[${word}]`;
}

/**
 * The type line a freshly created element is born carrying, per kind.
 *
 * Every tier of a C4 component exists from the moment it is drawn (PO
 * arbitration, 28/08/2026), so the author meets three lines of stencil rather
 * than a box and two invisible slots they have to be told about. What they meet
 * is what the official stencil shows: `[Person]`, `[Software System]`,
 * `[Container: technology]`, `[Component: technology]`.
 *
 * A PROMPT, not a value: {@link C4_TYPE_PLACEHOLDER} is what the exporter
 * compares against to decide the author has stated nothing yet, so an untouched
 * element exports as `Container(alias, "Container")` rather than as one built
 * with a technology literally called "technology".
 */
export const C4_TYPE_PLACEHOLDER = Object.fromEntries(
  (Object.keys(C4_TYPE_WORD) as C4NodeKind[]).map(kind => [
    kind,
    typeLineOf(
      C4_TYPE_WORD[kind],
      C4_TYPE_TAKES_TECHNOLOGY[kind] ? TYPE_TECHNOLOGY_PLACEHOLDER : undefined
    ),
  ])
) as Record<C4NodeKind, string>;
