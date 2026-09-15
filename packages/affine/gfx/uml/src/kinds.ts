import type { UmlDiagramKind } from '@labre/affine-model';

/**
 * The combined fragment's OPERATOR picker, re-exported.
 *
 * It lives in `operators.ts` — a fragment's operator is a different field on a
 * different element, and thirteen entries beside the diagram kinds would make
 * this file two tables under one name. It is re-exported here all the same,
 * because a reader looking for "the pickers this framework declares" looks
 * first at the file named after one of them, and because both spellings were
 * already in use by the time the second picker landed.
 */
export {
  UML_FRAGMENT_OPERATOR_MENU,
  type UmlFragmentOperatorOption,
} from './operators.js';

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
 * ## Eight now, more later, and nothing to migrate
 *
 * Phase 1 offered four structural diagrams; phase 2 appended `cmp` and `dep`,
 * then the two behaviour frames `act` and `stm`; phase 3 appends `sd`. Each arrives as a new
 * option over a new VALUE of the same string field (ADR 0017). A frame carrying
 * a kind this
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
 * The picker, whole: its own heading and its entries, in the order UML itself
 * teaches them — the classifiers first, then what groups them, then their
 * instances, then what the system is for, then what it is built of and where it
 * runs.
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
    // Phase 2. Both are Annex A frame kinds with Annex A's own abbreviations,
    // and they come after the phase-1 four rather than in alphabetical order:
    // the list teaches the notation in the sequence an architect meets it, and
    // what a system is BUILT of comes after what it is made of.
    {
      kind: 'cmp',
      labelKey: kindKey('cmp'),
      labelFallback: 'Component diagram',
    },
    {
      kind: 'dep',
      labelKey: kindKey('dep'),
      labelFallback: 'Deployment diagram',
    },
    // Phase 2, the behaviour frames. Last in the list because they are what a
    // system DOES, and the list teaches the notation in the order an architect
    // meets it: what the system is made of, what it is built of, where it runs,
    // and only then how it behaves.
    {
      kind: 'act',
      labelKey: kindKey('act'),
      labelFallback: 'Activity diagram',
    },
    {
      kind: 'stm',
      labelKey: kindKey('stm'),
      labelFallback: 'State machine diagram',
    },
    // Phase 3, the interaction frame (§17.2.4). Last, and last for the reason
    // the behaviour frames came after the structural ones: a sequence diagram
    // is what the parts a reader has already met SAY to each other, so it only
    // means anything once they have been drawn.
    {
      kind: 'sd',
      labelKey: kindKey('sd'),
      labelFallback: 'Sequence diagram',
    },
  ],
};
