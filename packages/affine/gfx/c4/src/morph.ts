import {
  type MorphLabel,
  morphLabel,
  type MorphSpec,
} from '@labre/affine-block-surface';
import {
  C4NodeElementModel,
  type C4NodeKind,
  GroupElementModel,
  TextElementModel,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import { c4CommandIcons, c4Commands } from './commands';
import { c4MorphClears, c4MorphProps } from './presets';
import { C4_ROLE, C4_ROLE_OF_KIND } from './roles';
import { c4MorphedTypeLine } from './type-line';

/**
 * What a C4 artefact may BECOME — the declaration behind the "Change type"
 * dropdown on a selected component's contextual toolbar.
 *
 * ## Families, and the one thing that makes them safe here
 *
 * A person and an external person are the same actor, said with a different
 * ownership; a container, a database, a mobile app and a browser app are the
 * same level of the model, drawn with different silhouettes. Realising halfway
 * through a container diagram that the box should have been the cylinder is
 * modelling, not a mistake — and the only way through it today is delete,
 * re-draw, re-connect, and retype three tiers of words.
 *
 * The three families below are DATA. Nothing derives them, and the role tree
 * would have been the wrong source in the same way it is for BPMN: `roleIsA`
 * makes `c4:database` a `c4:container`, so a derivation would reach in one
 * direction and not the other, and it says nothing at all about
 * `person`/`person-ext`, which are ONE role and still two artefacts.
 *
 * What makes these three families cheap is a property they happen to have and
 * a later one may not: **every member of a family lays its words out
 * identically**. `c4TierBoxes` differs on exactly one thing — the person's head
 * clearance, which both people share — and `NODE_SIZE` on exactly one, the
 * person's taller silhouette, which both people also share. So a morph inside
 * a family needs no re-layout at all: the three tiers stay where they are, the
 * group's derived box stays what it was, and the geometry a morph promises not
 * to touch is genuinely untouched. `component` is deliberately in NO family
 * partly for that reason and mostly for a better one: a component is a part of
 * a container, not another drawing of one, and offering the swap would invite
 * a diagram that mixes two levels of the model — the one thing C4 exists to
 * stop. The two boundaries are frames rather than artefacts and are excluded
 * for the reason `roles.ts` gives.
 */
export const C4_MORPH_FAMILIES: readonly (readonly C4NodeKind[])[] = [
  // Declaration order is menu order, and each family opens on the INTERNAL,
  // undecorated member: the plain artefact is the honest first draft and the
  // variant is the refinement — the same call `commands.ts` makes about the
  // order of the senior sub-menu.
  ['person', 'person-ext'],
  ['system', 'system-ext'],
  ['container', 'database', 'mobile', 'browser'],
];

/**
 * The creation command that draws each kind, keyed BY that kind.
 *
 * Derived from `telemetry.element`, which is where the kind is already written
 * down (`node:database`) and is documented as a historical value that must not
 * be renamed. Deriving rather than restating is what stops a second table of
 * labels and icons drifting from the one the sub-menu and the catalogue read.
 */
const NODE_COMMANDS = new Map(
  c4Commands.flatMap(command => {
    const element = command.telemetry?.element;
    return element?.startsWith('node:')
      ? [[element.slice('node:'.length), command] as const]
      : [];
  })
);

/** A kind's wording: the creation command's own key and English. */
function labelOf(kind: C4NodeKind): MorphLabel {
  const command = NODE_COMMANDS.get(kind);
  return {
    key: command?.labelKey,
    fallback: command?.labelFallback ?? kind,
  };
}

/** A kind's icon: the creation command's own, reused rather than redrawn. */
function iconOf(kind: C4NodeKind): TemplateResult {
  const iconKey = NODE_COMMANDS.get(kind)?.iconKey;
  return (iconKey && c4CommandIcons[iconKey]) || c4CommandIcons['c4.container'];
}

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * The `c4Node` shape a selected GROUP is the component of — `undefined` when
 * the group is not one.
 *
 * A C4 component is a native `group` holding the shape and its three lines of
 * words (PO recette, 28/08/2026), so what a click selects is the group and what
 * carries `kind` is the shape. This is the whole of the indirection, and it is
 * also the gate: a plain group somebody lassoed round three rectangles, a
 * Wardley component (a group of a circle and its label) and a group of two C4
 * components all answer `undefined`, so none of them is ever offered the menu.
 *
 * TWO shapes is a refusal rather than a first-wins pick. A group holding two
 * components is a group somebody made of two components — morphing "it" would
 * mean picking one of them by document order, and the honest answer to an
 * ambiguous selection is the same one the generic module gives to a mixed
 * family: nothing.
 */
export function c4NodeOfComponent(
  model: GfxPrimitiveElementModel
): C4NodeElementModel | undefined {
  if (!(model instanceof GroupElementModel)) return undefined;

  let found: C4NodeElementModel | undefined;
  for (const child of model.childElements) {
    if (!(child instanceof C4NodeElementModel)) continue;
    if (found) return undefined;
    found = child;
  }
  return found;
}

/** The component's `c4:type-line` tier, if it still has one. */
function typeLineOf(model: GfxPrimitiveElementModel) {
  if (!(model instanceof GroupElementModel)) return undefined;
  return model.childElements.find(
    (child): child is TextElementModel =>
      child instanceof TextElementModel && child.role === C4_ROLE['type-line']
  );
}

/**
 * Keep the caption saying what the shape now is — the `afterMorph` half of the
 * C4 spec.
 *
 * `[Container: Java]` is two statements in one line: the bracketed word is the
 * notation's, derived from `kind`, and the technology is the author's. The
 * watcher that keeps the two apart (`node/type-line-watcher.ts`) only ever runs
 * when somebody finishes TYPING into the tier, so a morph — which changes the
 * kind without anybody touching the words — has to make the same statement for
 * itself. {@link c4MorphedTypeLine} owns the decision, including the decision
 * to leave a line the author wrote alone.
 *
 * In place, in one transaction, and inside the caller's `captureSync`: the
 * `Y.Text` instance is what any bound editor holds, so it is mutated rather
 * than replaced, and the rewrite is part of the same single ctrl+z as the kind
 * that made it necessary.
 */
function rewriteTypeLine(
  model: GfxPrimitiveElementModel,
  from: C4NodeKind,
  to: C4NodeKind
) {
  const tier = typeLineOf(model);
  if (!tier || tier.isLocked()) return;

  const raw = tier.text.toString();
  const next = c4MorphedTypeLine(from, to, raw);
  if (next === null || next === raw) return;

  tier.surface.store.transact(() => {
    tier.text.delete(0, tier.text.length);
    tier.text.insert(0, next);
  });
}

/**
 * C4's morph declaration, handed to the generic `morphToolbarConfig`.
 *
 * `modelType` is the native `GroupElementModel` and not `C4NodeElementModel`,
 * because the group is what a click on a component selects. Everything that
 * makes that safe is in {@link c4NodeOfComponent}: the toolbar's own
 * homogeneity test only proves that every selected element is A group, and the
 * resolution proves that every one of them is one of OURS.
 *
 * `propsOf` is the shipped creation builder minus `type` / `xywh` / `text`
 * ({@link c4MorphProps}), so the palette and the morph cannot disagree about
 * what a database looks like; `clearOf` is empty on today's table and derived
 * rather than assumed so (`presets.ts`).
 */
export const C4_MORPH_SPEC: MorphSpec<C4NodeKind> = {
  framework: 'c4',
  families: C4_MORPH_FAMILIES,
  modelType: GroupElementModel,
  resolveTarget: c4NodeOfComponent,
  kindOf: (model: GfxPrimitiveElementModel) =>
    model instanceof C4NodeElementModel ? model.kind : undefined,
  // The SHAPE's role, which is the only role a C4 artefact has: the group
  // carries none by design, and the three tiers carry roles of their own
  // (`c4:title`, `c4:type-line`, `c4:description`) that say which LINE they
  // are and not what kind of box they belong to — so a morph never rewrites
  // them. Note that this table collapses: `person` and `person-ext` are both
  // `c4:person`, so a morph inside those two families reports the same role
  // twice, which is the truth — what changed is the ownership, not the meaning.
  roleOf: kind => C4_ROLE_OF_KIND[kind],
  propsOf: c4MorphProps,
  clearOf: c4MorphClears,
  afterMorph: rewriteTypeLine,
  labelOf,
  iconOf,
  label: morphLabel('com.labre.morph.toolbar.label', 'Change type'),
};
