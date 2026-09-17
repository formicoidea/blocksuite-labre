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
import { type UmlFitSurface, umlFitComponent } from './node/fit.js';
import { umlMorphClears, umlMorphProps } from './presets.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from './roles.js';

/**
 * What a UML artefact may BECOME — the declaration behind the "Change type"
 * dropdown on a selected component's contextual toolbar.
 *
 * ## Six families, and the kinds that are alone
 *
 * A class, an interface and an enumeration are THE SAME PICTURE: §9.5.4 draws
 * one divided rectangle for all three and tells them apart by the keyword
 * written above the name — `«interface»`, `«enumeration»`, nothing at all. That
 * is the strongest statement of "the same artefact, said more precisely" any
 * notation in this library makes.
 *
 * Phase 2 adds the second, and it is the same statement in a different clause:
 * a **node**, a **device** and an **execution environment** are ONE 3D box
 * (§19.4.4), told apart by `«device»` / `«executionEnvironment»` above the name
 * and by nothing else. A deployment diagram is drawn coarse and then made
 * precise — "this runs on a server", then "on that server's application
 * container" — so the swap is the modelling act itself rather than a repair.
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
 *    are not structural classifiers;
 *  - a **component** is a Class (§11.6) and would in principle join the first
 *    family, but it is the one classifier the notation draws with a MARK of its
 *    own — the two-tab icon in the corner — rather than with a keyword, and a
 *    component diagram is a different conversation from a class diagram. Left
 *    alone until a PO asks for the swap;
 *  - an **artifact** is a physical file (§19.3) — a `.war`, a script, a
 *    document. Offering to turn one into a class would invite a diagram that
 *    confuses what a thing IS with what it is deployed AS, which is the very
 *    distinction the `«manifest»` arrow exists to draw;
 *  - a **port** is a property of its owner (§11.3), not a classifier standing
 *    beside it, and it is the only artefact in the pack whose position is part
 *    of its meaning: it sits ON a border;
 *  - a **provided interface** and a **required interface** are the ball and the
 *    socket of §10.4.4 — two DIFFERENT drawings, unlike every family above, and
 *    a phase-2 pack should not decide by itself that a modeller who drew one
 *    meant the other. The pair is the obvious candidate for a third family and
 *    is deliberately left for a product decision.
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
  /* ── Phase 2: components and deployment ──────────────────────────────── */
  // The second family, and it opens on the plain NODE for the same reason the
  // first opens on the plain class: §19.4.4's keyword is the refinement.
  ['node', 'device', 'execution-environment'],
  ['component'],
  ['artifact'],
  ['port'],
  ['provided-interface'],
  ['required-interface'],
  /* ── Phase 2: activities and state machines ──────────────────────────── */
  // Four families, and every one of them is a PAIR the notation draws as one
  // picture with one mark changed — which is the only test a family has to
  // pass here, because a swap inside one must move nothing (the suite proves
  // the footprint and the silhouette are shared).
  //
  //  - §16.3.4 / §16.10.4: a send signal and an accept event are the SAME
  //    pentagon with its angled edge on the other side, and "did this step send
  //    the message or wait for it" is the single most common thing to get
  //    backwards on an activity diagram;
  //  - §15.3.4: an activity final ends the whole activity, a flow final ends
  //    ONE token — two circles, a bullseye and a cross, and the distinction is
  //    a refinement an author makes after the fact;
  //  - §14.2.4: a shallow history restores the region's last sub-state, a deep
  //    history restores the whole nested configuration — `H` and `H*`, one
  //    asterisk apart;
  //  - §14.2.4: an entry point and an exit point are the circle on a composite
  //    state's border, hollow or crossed.
  ['send-signal', 'accept-event'],
  ['activity-final', 'flow-final'],
  ['shallow-history', 'deep-history'],
  ['entry-point', 'exit-point'],
  // The rest are declared alone, and each refusal is an argument:
  //
  //  - an **action** is a rounded rectangle the shape layer draws (§15.2.4),
  //    where the two signal shapes are pentagons this pack paints itself: a
  //    family must be silhouette-preserving, and this pair is not. It is the
  //    obvious candidate for a fifth family the day the three share a drawing;
  //  - an **initial** node is the one control node with no counterpart — there
  //    is exactly one per region (§15.3.4), and the swap a modeller wants from
  //    it is a deletion;
  //  - a **decision** and a **fork** are a diamond and a bar. §15.3.4 draws
  //    them differently because they MEAN differently — one token down one
  //    branch, versus one token down every branch — and a dropdown between two
  //    different pictures would be this pack inventing an equivalence;
  //  - a **choice** is the decision's diamond on a state machine and a
  //    **junction** its filled dot (§14.2.4); neither belongs with the activity
  //    node it is drawn like, because they are never on the same sheet;
  //  - an **object node** (§15.4.4) is data, not a step; a **time event**
  //    (§16.10.4) is the hourglass and nothing else is drawn as one;
  //  - a **state** is the rounded box of §14.2.4 and a **final state** the
  //    bullseye that ends it — a named thing and an unnamed one;
  //  - a **terminate** pseudostate is the cross that kills the machine
  //    (§14.2.4): there is nothing it is a more precise version of.
  ['action'],
  ['initial'],
  ['decision'],
  ['fork'],
  ['object-node'],
  ['time-event'],
  ['state'],
  ['final-state'],
  ['choice'],
  ['junction'],
  ['terminate'],
  /* ── Phase 3: the sequence vocabulary (§17.2.4) ──────────────────────── */
  // Three more singletons, and the three refusals are the plainest in the
  // table: these are not variations on one picture, they are the three
  // different things an interaction is drawn with.
  //
  //  - a **lifeline** is the participant itself — a head with a spine, and the
  //    only element on the sheet a message may attach to. There is nothing it
  //    is a more precise version of, and turning one into anything else would
  //    orphan every message drawn on it;
  //  - an **execution** is a bar ON a spine and a **destruction** is a cross on
  //    one. Both are marks, both are positioned by geometry, and what they mean
  //    is where they sit (§17.2.4) — "this participant is busy here" and "this
  //    participant ends here". A dropdown between them would be offering to
  //    turn a stretch of activity into an ending, which is not a refinement of
  //    anything: it is a different fact about a different moment.
  ['lifeline'],
  ['execution'],
  ['destruction'],
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
 *
 * ENGLISH, and knowingly so: since the creation sites resolve their seeds
 * through the translation seam (`umlSeedKey`), an artefact placed in a
 * translated host arrives carrying that host's word, which this table does not
 * recognise. The morph then treats the name as the author's and leaves it —
 * the timid half of the rule below, never the destructive one. Resolving it
 * would mean handing `afterMorph` the `std` it is not given, which is the
 * generic `MorphSpec`'s shape and not this pack's; C4's `c4MorphedName` carries
 * exactly the same limitation, against the same seam.
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

  // The keyword line(s), if the SOURCE kind wrote one and it is still there.
  // Plural for the same reason the target's loop below is: a document may
  // arrive with the word already stacked.
  const fromKeyword = KEYWORD_OF_KIND[from];
  let body = lines;
  while (fromKeyword && body[0]?.trim() === fromKeyword) body = body.slice(1);

  const toKeyword = KEYWORD_OF_KIND[to];
  // …and the TARGET's, if it is ALREADY there. A keyword is written once: the
  // line below puts `toKeyword` back on top, and without this a compartment that
  // already opened with it would come out wearing it twice —
  // `«interface»\n«interface»\nLigne`, then three, then four. The PO's recette of
  // 14/09/2026 saw the stack; it is reachable whenever the shape's `kind` and
  // its name compartment disagree, which an import, a paste from a tool that
  // writes the keyword itself, or an author typing it by hand all produce.
  //
  // Only the target's own keyword is dropped. A first line the author wrote —
  // `«service»`, `«entity»`, which Annex C is explicit are not keywords — is not
  // one of ours to take away, so it survives and the new keyword goes above it.
  // A LOOP, not one slice: a document that already stacked the keyword twice —
  // an import, a paste from a tool that writes it itself, a morph run before
  // this line existed — has two to take off, and taking one off left the other
  // in place. The rewrite then came out identical to the text it started from
  // and `umlMorphedName` answered `null`, so the stack was permanent.
  while (toKeyword && body[0]?.trim() === toKeyword) body = body.slice(1);

  // The name, if it is still the source kind's own prompt.
  const named =
    body.join('\n').trim() === SEEDED_NAME[from] ? [SEEDED_NAME[to]] : body;

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
 *
 * ## …and then re-fit the box, because the keyword is a LINE
 *
 * §9.5.4 writes `«interface»` ABOVE the name, so morphing a class called `Ligne`
 * turns a one-line name compartment into a two-line one. Nothing used to re-lay
 * the component for it — `UmlCompartmentWatcher` fires on an editing selection
 * closing, and a morph opens no editor — so the keyword was written and the name
 * under it was painted straight through the rule into the attributes
 * compartment. That is the PO's "le titre va accumuler «interface» \n Class
 * ligne" of 14/09/2026, measured: two lines needing 38 units in a 22.4-unit
 * compartment, on a node that stayed 120 tall.
 *
 * So the same fit the watcher runs is run here, INSIDE the caller's checkpoint
 * (`capture: false`): `applyMorph` has already opened one, and the re-layout
 * belongs in the same single ctrl+z as the kind that made it necessary — which
 * is exactly what {@link rewriteTier} promises about the words themselves.
 */
function rewriteName(
  model: GfxPrimitiveElementModel,
  from: UmlNodeKind,
  to: UmlNodeKind
) {
  rewriteTier(model, UML_ROLE.name, text => umlMorphedName(from, to, text));

  const node = umlNodeOfGroup(model);
  if (!node) return;
  umlFitComponent(
    node.surface as unknown as UmlFitSurface,
    node.surface.store,
    node.id,
    // The morph's own checkpoint, not a second one.
    { capture: false }
  );
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
  // ↓ everything from here down is SHARED with {@link UML_BARE_MORPH_SPEC}.
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

/**
 * The SAME dropdown, on a UML shape that is not inside a group.
 *
 * ## Why a second spec exists at all
 *
 * Because phase 2 made the pack's own rule about composites untrue for a third
 * of its artefacts. Until then every UML artefact was a `group` — a shape and
 * the canvas texts grouped with it — so `modelType: GroupElementModel` was the
 * whole selection filter. The behaviour vocabulary is not: §15.3.4 and §14.2.4
 * name none of their routing marks, so a bullseye, a bar, a diamond and a
 * crossed circle are created as the SHAPE alone (`actions.ts`), and what a
 * click selects for them is a `umlNode`, never a group.
 *
 * `umlNodeOfGroup` refuses a bare shape by design — it is the gate that keeps a
 * plain lasso and another framework's component out of the menu — so the group
 * spec resolves nothing for them and three whole families (`activity-final` /
 * `flow-final`, `shallow-history` / `deep-history`, `entry-point` /
 * `exit-point`) had a dropdown nobody could ever open.
 *
 * ## Why not one spec with a widened `modelType`
 *
 * Because the selection filter is not the only thing that differs: the two
 * specs are registered under two DIFFERENT toolbar flavours. A bare `umlNode`'s
 * contextual row is `affine:surface:umlNode`'s (the widget derives the flavour
 * from `model.type`), and a grouped artefact's is `affine:surface:group`'s.
 * Widening `modelType` to the abstract base would leave the group registration
 * answering for shapes it will never be handed, and would make its homogeneity
 * gate — the thing that refuses a group holding two classifiers — apply to a
 * selection it was not written about. Two registrations, two keys, one table.
 *
 * Everything that decides what the menu SAYS and what a pick WRITES is shared
 * with {@link UML_MORPH_SPEC} by reference, so the two can never offer
 * different families or write different props.
 *
 * `resolveTarget` is absent, which is identity: a bare mark is one element —
 * what the user selects, what carries the kind and what the patch lands on are
 * the same object, exactly as they are for a connector. `afterMorph` is absent
 * too, and that is the notation's doing rather than an omission: `rewriteName`
 * exists to keep a `uml:name` tier saying what the shape now is, and these
 * kinds have no tier at all — there is nothing to rewrite, and reaching for one
 * would be looking for words the specification says are not there.
 */
export const UML_BARE_MORPH_SPEC: MorphSpec<UmlNodeKind> = {
  framework: UML_MORPH_SPEC.framework,
  families: UML_MORPH_SPEC.families,
  modelType: UmlNodeElementModel,
  kindOf: UML_MORPH_SPEC.kindOf,
  roleOf: UML_MORPH_SPEC.roleOf,
  propsOf: UML_MORPH_SPEC.propsOf,
  clearOf: UML_MORPH_SPEC.clearOf,
  labelOf: UML_MORPH_SPEC.labelOf,
  iconOf: UML_MORPH_SPEC.iconOf,
  label: UML_MORPH_SPEC.label,
};
