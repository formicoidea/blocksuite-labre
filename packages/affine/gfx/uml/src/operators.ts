import type { UmlFragmentOperator } from '@labre/affine-model';

/**
 * The INTERACTION OPERATOR a combined fragment declares, as the picker offers
 * it — DATA, exactly like `UML_DIAGRAM_KIND_MENU` in `kinds.ts`, and shaped the
 * same way for the same reason: the manifest walks declarations, so every key
 * below reaches a host's catalogue without being restated anywhere.
 *
 * ## The operator is the whole of what a fragment says
 *
 * §17.6.4 draws every combined fragment as the same rectangle with the same
 * cut-corner pentagon in its corner. An `alt` and a `loop` are one picture and
 * two entirely different statements, and the only thing that separates them is
 * the word in the tag — so picking one here changes what the box MEANS, not how
 * it looks. That is why this is a picker on a stored field and not a morph
 * between elements (`morph.ts` is for artefacts that are drawn differently).
 *
 * ## Thirteen, and the thirteenth is not an operator
 *
 * Twelve of these are §17.6.4's own `InteractionOperatorKind`. `ref` is
 * §17.7.4's InteractionUse — a different metaclass, drawn as the same rectangle
 * with the same pentagon — and it is offered from the same menu because that is
 * where every tool puts it and where every architect looks for it. The model's
 * own union records the same choice.
 *
 * ## The order
 *
 * The four an architect actually draws first (`alt`, `opt`, `loop`, `par`),
 * then `ref`, which is the next most reached for; then the rest of §17.6.4 in
 * its own order. A menu that listed twelve operators alphabetically would put
 * `assert` above `alt`, which is a list sorted for a machine.
 */
export interface UmlFragmentOperatorOption {
  /** What gets written in the pentagon. Never `undefined`: the field is required. */
  operator: UmlFragmentOperator;
  /** i18n key of the entry's words; resolved by the host. */
  labelKey: string;
  /** The framework's own wording, for a host that ships no catalogue. */
  labelFallback: string;
}

/** i18n key stem: `alt` → `com.labre.uml.operator.alt`. */
const operatorKey = (name: string) => `com.labre.uml.operator.${name}`;

/** The picker, whole: its heading and its thirteen entries. */
export const UML_FRAGMENT_OPERATOR_MENU: {
  labelKey: string;
  labelFallback: string;
  options: readonly UmlFragmentOperatorOption[];
} = {
  labelKey: operatorKey('section'),
  labelFallback: 'Operator',
  options: [
    {
      operator: 'alt',
      labelKey: operatorKey('alt'),
      labelFallback: 'Alternatives',
    },
    {
      operator: 'opt',
      labelKey: operatorKey('opt'),
      labelFallback: 'Option',
    },
    {
      operator: 'loop',
      labelKey: operatorKey('loop'),
      labelFallback: 'Loop',
    },
    {
      operator: 'par',
      labelKey: operatorKey('par'),
      labelFallback: 'Parallel',
    },
    {
      // §17.7.4, not §17.6.4 — see the header on why it is in this menu.
      operator: 'ref',
      labelKey: operatorKey('ref'),
      labelFallback: 'Interaction use',
    },
    {
      operator: 'break',
      labelKey: operatorKey('break'),
      labelFallback: 'Break',
    },
    {
      operator: 'critical',
      labelKey: operatorKey('critical'),
      labelFallback: 'Critical region',
    },
    {
      operator: 'seq',
      labelKey: operatorKey('seq'),
      labelFallback: 'Weak sequencing',
    },
    {
      operator: 'strict',
      labelKey: operatorKey('strict'),
      labelFallback: 'Strict sequencing',
    },
    {
      operator: 'neg',
      labelKey: operatorKey('neg'),
      labelFallback: 'Negative',
    },
    {
      operator: 'assert',
      labelKey: operatorKey('assert'),
      labelFallback: 'Assertion',
    },
    {
      operator: 'ignore',
      labelKey: operatorKey('ignore'),
      labelFallback: 'Ignore',
    },
    {
      operator: 'consider',
      labelKey: operatorKey('consider'),
      labelFallback: 'Consider',
    },
  ],
};
