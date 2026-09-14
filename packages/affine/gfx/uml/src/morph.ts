import {
  type MorphLabel,
  morphLabel,
  type MorphSpec,
} from '@labre/affine-block-surface';
import {
  GroupElementModel,
  TextElementModel,
  UmlNodeElementModel,
  type UmlNodeKind,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import { umlCommandIcons, umlCommands } from './commands.js';
import { GUILLEMET_CLOSE, GUILLEMET_OPEN, UML_NAME_SEED } from './keywords.js';
import { umlMorphClears, umlMorphProps } from './presets.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from './roles.js';

/**
 * What a UML artefact may BECOME — the declaration behind the "Change type"
 * dropdown on a selected component's contextual toolbar.
 *
 * ## One family, and five kinds that are alone
 *
 * A class, an interface and an enumeration are THE SAME PICTURE: §9.5.4 draws
 * one divided rectangle for all three and tells them apart by the keyword
 * written above the name — `«interface»`, `«enumeration»`, nothing at all. That
 * is the strongest statement of "the same artefact, said more precisely" any
 * notation in this library makes, and it is the whole of the reachable set.
 *
 * Everything else is declared alone, and each singleton is a REFUSAL written
 * down rather than an omission to be discovered later:
 *
 *  - an **object** is an InstanceSpecification (§11.6), a thing that exists at
 *    run time. A class is a type. Offering the swap would invite a diagram that
 *    confuses the two levels, and its name compartment is `object : Class`
 *    underlined — different words as well as a different meaning;
 *  - a **package** is a namespace (§12.2), not a classifier in it;
 *  - a **note** is a Comment (Annex A) and carries no semantics at all;
 *  - an **actor** and a **use case** belong to a behaviour diagram (§18.1) and
 *    are not structural classifiers.
 *
 * The declaration is therefore TOTAL over `UmlNodeKind` — every kind is named
 * exactly once — which is what lets the unit suite prove that a kind added to
 * the pack cannot be silently left out of this decision. The MENU is a different
 * question, and {@link UML_MORPH_SPEC} answers it: a family of one has nothing
 * to offer, so it is not offered.
 *
 * Families are DATA. Nothing derives them, and the role tree would have been the
 * wrong source in the same way it is for BPMN and C4: `roleIsA` makes
 * `uml:interface` a `uml:classifier` and thence reaches `uml:class`, but it says
 * nothing about whether a reader would ACCEPT the swap — which is the only
 * question this table answers.
 */
export const UML_MORPH_FAMILIES: readonly (readonly UmlNodeKind[])[] = [
  // Declaration order is menu order, and the family opens on the plain class:
  // an undecorated rectangle is the honest first draft, the keyword is the
  // refinement — the same call `commands.ts` makes about the senior sub-menu.
  ['class', 'interface', 'enumeration'],
  ['object'],
  ['package'],
  ['note'],
  ['actor'],
  ['use-case'],
];

/**
 * The families a MENU can be made of.
 *
 * A one-member family is a statement about the notation, not an affordance: a
 * dropdown offering a package the choice of becoming a package is a control that
 * cannot do anything, drawn on every package a user selects. The generic module
 * already refuses a kind in NO family, and this gives it the same answer for a
 * kind alone in one — so the table above stays total and readable while the
 * toolbar stays honest.
 */
const OFFERED_FAMILIES = UML_MORPH_FAMILIES.filter(family => family.length > 1);

/**
 * The creation command that draws each kind, keyed BY that kind.
 *
 * Derived from `telemetry.element`, which is where the kind is already written
 * down (`node:interface`) and is documented as a historical value that must not
 * be renamed. Deriving rather than restating is what stops a second table of
 * labels and icons drifting from the one the sub-menu and the catalogue read.
 */
const NODE_COMMANDS = new Map(
  umlCommands.flatMap(command => {
    const element = command.telemetry?.element;
    return element?.startsWith('node:')
      ? [[element.slice('node:'.length), command] as const]
      : [];
  })
);

/** A kind's wording: the creation command's own key and English. */
function labelOf(kind: UmlNodeKind): MorphLabel {
  const command = NODE_COMMANDS.get(kind);
  return {
    key: command?.labelKey,
    fallback: command?.labelFallback ?? kind,
  };
}

/** A kind's icon: the creation command's own, reused rather than redrawn. */
function iconOf(kind: UmlNodeKind): TemplateResult {
  const iconKey = NODE_COMMANDS.get(kind)?.iconKey;
  return (iconKey && umlCommandIcons[iconKey]) || umlCommandIcons['uml.class'];
}

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * The `umlNode` shape a selected GROUP is the component of — `undefined` when
 * the group is not one.
 *
 * A UML artefact is a native `group` holding the shape and its tiers of words
 * (`actions.ts`), so what a click selects is the group and what carries `kind`
 * is the shape. This is the whole of the indirection, and it is also the gate: a
 * plain group somebody lassoed round three rectangles, a C4 component (a group
 * of a shape and three lines) and a group of two UML classifiers all answer
 * `undefined`, so none of them is ever offered the menu.
 *
 * TWO shapes is a refusal rather than a first-wins pick. A group holding two
 * classifiers is a group somebody made of two classifiers — morphing "it" would
 * mean picking one of them by document order, and the honest answer to an
 * ambiguous selection is the same one the generic module gives to a mixed
 * family: nothing.
 *
 * ## Why this is not `component.ts`'s `umlNodeOfComponent`
 *
 * Because that one answers a different question with a different vocabulary: it
 * takes a RESOLVED `UmlComponent` — the pure, Yjs-free shape the exporter
 * and the renderer build out of ids and roles — and reads a field off it. This
 * one takes a live model and walks `childElements`, because that is what the
 * toolbar hands over and `instanceof` is what makes the refusals above real. The
 * two are deliberately not merged: one is the pure half of the pack and must
 * stay free of the model classes, and this one exists to touch them.
 */
export function umlNodeOfGroup(
  model: GfxPrimitiveElementModel
): UmlNodeElementModel | undefined {
  if (!(model instanceof GroupElementModel)) return undefined;

  let found: UmlNodeElementModel | undefined;
  for (const child of model.childElements) {
    if (!(child instanceof UmlNodeElementModel)) continue;
    if (found) return undefined;
    found = child;
  }
  return found;
}

/** One tier of a component, by the role it carries. */
function tierOf(model: GfxPrimitiveElementModel, role: string) {
  if (!(model instanceof GroupElementModel)) return undefined;
  return model.childElements.find(
    (child): child is TextElementModel =>
      child instanceof TextElementModel && child.role === role
  );
}

/**
 * Write one tier, in place, if the decision says to.
 *
 * `decide` reads the tier as it is STORED and answers with the whole text to
 * write, or `null` for "this is the author's, leave it". The comparison that
 * decides whether anything happens is against the TRIMMED text — the same string
 * `decide` was given — because a decision made on `'Payments  '` returns
 * `'«interface»\nPayments'`, and comparing that against the untrimmed original
 * would call a no-op a change and spend a transaction rewriting the padding
 * away.
 *
 * In place, in one transaction, and inside the caller's `captureSync`: the
 * `Y.Text` instance is what any bound editor holds, so it is mutated rather than
 * replaced, and the rewrite is part of the same single ctrl+z as the kind that
 * made it necessary.
 */
function rewriteTier(
  model: GfxPrimitiveElementModel,
  role: string,
  decide: (text: string) => string | null
) {
  const tier = tierOf(model, role);
  if (!tier || tier.isLocked()) return;

  const text = tier.text.toString().trim();
  const next = decide(text);
  if (next === null || next === text) return;

  tier.surface.store.transact(() => {
    tier.text.delete(0, tier.text.length);
    tier.text.insert(0, next);
  });
}

/* ── The keyword line ──────────────────────────────────────────────────── */

/**
 * The Annex C keyword a kind is ANNOUNCED by, or `undefined` for the kinds the
 * notation announces by their silhouette.
 *
 * Derived from {@link UML_NAME_SEED} rather than restated, for the reason every
 * derived table in this pack exists: the seed is what a fresh artefact actually
 * says, and a second list of keywords would agree with it on the day it was
 * written and drift on the first one that changed. A seed whose first line is a
 * guillemet pair IS the keyword line — that is what `«interface»\nInterface`
 * means — and a seed that has none declares a kind with none.
 */
const KEYWORD_OF_KIND: Readonly<Partial<Record<UmlNodeKind, string>>> =
  Object.fromEntries(
    (Object.keys(UML_NAME_SEED) as UmlNodeKind[]).flatMap(kind => {
      const first = UML_NAME_SEED[kind].split('\n')[0];
      return first.startsWith(GUILLEMET_OPEN) && first.endsWith(GUILLEMET_CLOSE)
        ? [[kind, first] as const]
        : [];
    })
  );

/**
 * The NAME line a fresh artefact of this kind carries — the seed minus its
 * keyword line.
 *
 * `Class`, `Interface`, `Enumeration`, `object : Class`. This is the string a
 * component NOBODY HAS NAMED still says, and the only name a morph is allowed to
 * rewrite.
 */
const SEEDED_NAME: Readonly<Record<UmlNodeKind, string>> = Object.fromEntries(
  (Object.keys(UML_NAME_SEED) as UmlNodeKind[]).map(kind => {
    const lines = UML_NAME_SEED[kind].split('\n');
    return [kind, KEYWORD_OF_KIND[kind] ? lines.slice(1).join('\n') : lines[0]];
  })
) as Record<UmlNodeKind, string>;

/**
 * What a name compartment should say once its shape has morphed — or `null` when
 * nothing about it is the notation's to change.
 *
 * ## Two rewrites, and the one rule they share
 *
 * The rule is the same for both and it is deliberately timid: rewrite ONLY what
 * the notation itself wrote, and never what an author typed. A morph is not
 * allowed to take away words somebody put on the picture.
 *
 * - **The keyword line.** `«interface»` is not a name, it is what makes the same
 *   rectangle mean a different metaclass (§9.5.4) — so a class morphed to an
 *   interface that kept an unmarked name compartment would be an interface drawn
 *   exactly as a class, which is to say not drawn at all. The SOURCE kind's own
 *   keyword is dropped and the target's is put in its place; a first line an
 *   author wrote themselves (`«service»`, `«entity»` — Annex C is explicit that
 *   not every word in guillemets is a keyword) is not the source kind's, so it
 *   survives and the new keyword is written above it.
 * - **The name.** Placeholder→placeholder and nothing else: the name is
 *   rewritten only when it is EXACTLY the source kind's own seed, which is what
 *   a classifier nobody has named still carries. A class called `Payments` is
 *   called that whatever keyword it ends up wearing, which is the PO's "the
 *   label is intact" for every name that is real content.
 *
 * Pure and total over every string, because the input is a canvas text element
 * somebody may have typed anything into.
 */
export function umlMorphedName(
  from: UmlNodeKind,
  to: UmlNodeKind,
  rawText: string | null | undefined
): string | null {
  const text = (rawText ?? '').trim();
  const lines = text.length ? text.split('\n') : [];

  // The keyword line, if the SOURCE kind wrote one and it is still there.
  const fromKeyword = KEYWORD_OF_KIND[from];
  const body =
    fromKeyword && lines[0]?.trim() === fromKeyword ? lines.slice(1) : lines;

  // The name, if it is still the source kind's own prompt.
  const named =
    body.join('\n').trim() === SEEDED_NAME[from] ? [SEEDED_NAME[to]] : body;

  const toKeyword = KEYWORD_OF_KIND[to];
  const next = (toKeyword ? [toKeyword, ...named] : named).join('\n');
  return next === text ? null : next;
}

/**
 * Keep the component's own words saying what the shape now is — the `afterMorph`
 * half of the UML spec.
 *
 * One tier, and it is the one the reader looks at: `uml:name`. The attributes
 * and operations compartments are the author's whole content and say nothing
 * about the metaclass, so nothing here touches them — an enumeration that used
 * to be a class keeps every feature somebody wrote on it, which is exactly what
 * makes the morph worth having.
 */
function rewriteName(
  model: GfxPrimitiveElementModel,
  from: UmlNodeKind,
  to: UmlNodeKind
) {
  rewriteTier(model, UML_ROLE.name, text => umlMorphedName(from, to, text));
}

/**
 * UML's morph declaration, handed to the generic `morphToolbarConfig`.
 *
 * `modelType` is the native `GroupElementModel` and not `UmlNodeElementModel`,
 * because the group is what a click on a component selects. Everything that
 * makes that safe is in {@link umlNodeOfGroup}: the toolbar's own homogeneity
 * test only proves that every selected element is A group, and the resolution
 * proves that every one of them is one of OURS.
 *
 * `propsOf` is the shipped creation builder minus `type` / `xywh` / `text`
 * ({@link umlMorphProps}), so the toolbox and the morph cannot disagree about
 * what an interface looks like; `clearOf` is empty on today's table and derived
 * rather than assumed so (`presets.ts`).
 */
export const UML_MORPH_SPEC: MorphSpec<UmlNodeKind> = {
  framework: 'uml',
  families: OFFERED_FAMILIES,
  modelType: GroupElementModel,
  resolveTarget: umlNodeOfGroup,
  kindOf: (model: GfxPrimitiveElementModel) =>
    model instanceof UmlNodeElementModel ? model.kind : undefined,
  // The SHAPE's role, which is the only role a UML artefact has: the group
  // carries none by design, and the tiers carry roles of their own (`uml:name`,
  // `uml:attributes`, `uml:operations`) that say which COMPARTMENT they are and
  // not what kind of box they belong to — so a morph never rewrites them.
  roleOf: kind => UML_ROLE_OF_KIND[kind],
  propsOf: umlMorphProps,
  clearOf: umlMorphClears,
  afterMorph: rewriteName,
  labelOf,
  iconOf,
  label: morphLabel('com.labre.morph.toolbar.label', 'Change type'),
};
