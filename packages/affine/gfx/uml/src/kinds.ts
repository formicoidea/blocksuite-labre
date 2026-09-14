import type { UmlDiagramKind } from '@labre/affine-model';

/**
 * The KIND a diagram frame declares, as the picker offers it — DATA, like
 * everything else this framework contributes.
 *
 * A UML diagram is one kind of diagram, and Annex A writes which in the frame's
 * own heading: `class Orders`, `uc Checkout`. So the kind is not a label on the
 * side of the sheet the way a C4 board's level is — it is HALF THE HEADING, and
 * picking one changes what the frame says about itself.
 *
 * ## The name stays the author's
 *
 * Choosing a kind RENAMES NOTHING. The heading is derived
 * (`UmlDiagramElementModel.heading`) from the kind and the name together, and
 * the picker writes one field: a use case diagram of the checkout flow is still
 * called whatever its author called it, and the tag simply reads `uc` in front
 * of it.
 *
 * ## Why there is no "none", unlike C4's Free sketch
 *
 * A C4 board's level is a CLAIM about the model that an author may decline to
 * make, so its absence means "a working surface". A UML frame's kind is part of
 * its NOTATION: Annex A's heading is `<kind> <name>`, and a frame with no kind
 * has no heading to draw. The model makes it required with `class` as the
 * default — the diagram an architect reaches for first, and the one kind Annex A
 * gives no abbreviation for — so every option here writes a value and none of
 * them clears the field.
 *
 * ## Four now, more later, and nothing to migrate
 *
 * Phase 1 offers the four structural diagrams the pack can draw. Phase 2 appends
 * `cmp`, `dep`, `act` and `stm`, phase 3 appends `sd`, each as a new option over
 * a new VALUE of the same string field (ADR 0017). A frame carrying a kind this
 * build has never heard of still paints its own heading, verbatim — see
 * {@link UmlDiagramElementModel.heading} — and the picker below simply shows no
 * current option rather than silently rewriting it to `class`.
 */
export interface UmlDiagramKindOption {
  /** What gets written on the frame. Never `undefined`: see the header. */
  kind: UmlDiagramKind;
  /** i18n key of the entry's words; resolved by the host. */
  labelKey: string;
  /** The framework's own wording, for a host that ships no catalogue. */
  labelFallback: string;
}

/** i18n key stem: `class` → `com.labre.uml.kind.class`. */
const kindKey = (name: string) => `com.labre.uml.kind.${name}`;

/**
 * The picker, whole: its own heading and its four entries, in the order UML
 * itself teaches them — the classifiers first, then what groups them, then their
 * instances, then what the system is for.
 *
 * One object rather than a loose array plus a stray heading constant, because
 * the manifest walks DECLARATIONS: `umlTranslationEntries` hands this value to
 * `collectTranslationKeys` and every key below reaches a host's catalogue with
 * nothing restated anywhere.
 */
export const UML_DIAGRAM_KIND_MENU: {
  labelKey: string;
  labelFallback: string;
  options: readonly UmlDiagramKindOption[];
} = {
  labelKey: kindKey('section'),
  labelFallback: 'Diagram',
  options: [
    {
      kind: 'class',
      labelKey: kindKey('class'),
      labelFallback: 'Class diagram',
    },
    {
      kind: 'pkg',
      labelKey: kindKey('pkg'),
      labelFallback: 'Package diagram',
    },
    {
      // Not an Annex A frame kind: the standard treats an object diagram as a
      // class diagram showing instances. `obj` is the TOOL CONVENTION every
      // drawing tool uses and every architect expects — recorded as a choice in
      // `UmlDiagramKind`, and offered here for the same reason.
      kind: 'obj',
      labelKey: kindKey('obj'),
      labelFallback: 'Object diagram',
    },
    {
      kind: 'uc',
      labelKey: kindKey('uc'),
      labelFallback: 'Use case diagram',
    },
  ],
};
