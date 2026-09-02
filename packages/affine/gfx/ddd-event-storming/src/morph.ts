import {
  type MorphLabel,
  morphLabel,
  type MorphSpec,
} from '@labre/affine-block-surface';
import {
  ES_HOTSPOT,
  ES_STICKIES,
  SHADOW_COLOR,
  STICKY_RADIUS,
} from '@labre/affine-gfx-ddd-shared';
import {
  GroupElementModel,
  ShapeElementModel,
  ShapeType,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import {
  eventStormingCommandIcons,
  eventStormingCommands,
} from './commands.js';
import { ES_STICKY_ROLE, type EventStormingStickyKind } from './roles.js';

/**
 * What an Event Storming sticky may BECOME — the declaration behind the
 * "Change type" dropdown on a selected sticky's contextual toolbar.
 *
 * ## One family, and why nine kinds is the honest number
 *
 * A workshop does not draw a domain event and a command in two different
 * gestures; it draws a sticky and then argues about which colour it is. That
 * argument IS Event Storming — Brandolini's whole method is a wall of
 * identically-shaped paper whose colour is the claim — and the artefact never
 * changes size, level or grammar rank when the claim does. So unlike BPMN's six
 * families and C4's three, every sticky here is reachable from every other:
 * splitting them would be inventing a hierarchy the notation does not have,
 * and would mean deciding that "this orange one was really a command" needs a
 * delete and a redraw while "this event was really a hotspot" does not.
 *
 * The **hotspot is in the family** for exactly that reason. It is the only
 * member drawn as a diamond, which is a silhouette and not a rank: a hotspot is
 * what the workshop writes when a sticky it already placed turns out to be a
 * question rather than a claim, and that is the single most common morph the
 * method actually performs. Its diamond is handled by {@link
 * eventStormingMorphProps} like any other preset difference — and by
 * {@link followTheFace}, since the sticky's shadow is drawn in the same
 * silhouette as the face it sits behind.
 *
 * Declaration order is menu order and it is the GRAMMAR's order — the one
 * `ES_STICKIES` declares and the senior sub-menu renders (an actor issues a
 * command, a command lands on an aggregate, an aggregate raises an event) —
 * with the hotspot last, where the palette also puts it. A user meets the same
 * sequence in the menu that draws stickies and in the menu that re-says them.
 */

/**
 * Everything one sticky kind is worth on the FACE, derived from the same two
 * preset tables the creation commands read.
 *
 * `ES_STICKIES` is eight squares and `ES_HOTSPOT` is the ninth, a diamond in
 * its own preset — the split `roles.ts` already works around, and for the same
 * reason: the hotspot is not a colour variant, so it is not in the colour
 * table. Joined here once so that every consumer below (the family, the patch,
 * the labels, the inverse role table) reads ONE list and no second table of
 * nine can drift from the one the palette draws.
 */
interface StickyFace {
  kind: EventStormingStickyKind;
  /** `fillColor` of the face. */
  fill: string;
  /** `color` — the handwriting on it. */
  text: string;
  /** The words a freshly-drawn sticky of this kind carries. */
  label: string;
  shapeType: ShapeType.Rect | ShapeType.Diamond;
}

export const ES_STICKY_FACES: readonly StickyFace[] = [
  ...ES_STICKIES.map(
    (preset): StickyFace => ({
      kind: preset.kind,
      fill: preset.fill,
      text: preset.text,
      label: preset.label,
      shapeType: ShapeType.Rect,
    })
  ),
  {
    kind: 'hotspot',
    fill: ES_HOTSPOT.fill,
    text: ES_HOTSPOT.text,
    label: ES_HOTSPOT.label,
    shapeType: ShapeType.Diamond,
  },
];

const FACE_OF_KIND = new Map(ES_STICKY_FACES.map(face => [face.kind, face]));

/** The one family: every sticky, in the order the grammar reads them. */
export const ES_MORPH_FAMILIES: readonly (readonly EventStormingStickyKind[])[] =
  [ES_STICKY_FACES.map(face => face.kind)];

/**
 * The rounding a silhouette takes — the same ternary `addSticky` applies, so a
 * morphed diamond cannot end up with the square's soft corners.
 */
const radiusOf = (shapeType: ShapeType) =>
  shapeType === ShapeType.Rect ? STICKY_RADIUS : 0;

/* ── The kind, which is not a field ────────────────────────────────────── */

/**
 * Role → kind, the inverse of the table `roles.ts` derives.
 *
 * A sticky has no `kind` prop and is not getting one: it is a native `shape`,
 * and what makes it a domain EVENT rather than an orange square is the `role`
 * on its face. That is already the single source every validation rule reads,
 * so inverting it is cheaper and safer than writing a second identity beside
 * it — a document where the two disagreed would be a document whose rules and
 * whose toolbar told different stories about the same sticky.
 */
const KIND_OF_ROLE = new Map<string, EventStormingStickyKind>(
  ES_STICKY_FACES.map(face => [ES_STICKY_ROLE[face.kind], face.kind])
);

/**
 * The kind a shape carries, or `undefined` when it carries none.
 *
 * `undefined` for a sticky placed before WS5 is the whole compat story and it
 * is deliberate: those carry no role, they are never evaluated by a rule
 * (promesse #71), and nothing here backfills one. A morph that inferred a kind
 * from a fill colour would be writing a semantic claim the workshop never
 * made — so a pre-WS5 sticky is simply not offered the menu, exactly as it is
 * not offered a verdict.
 */
export function eventStormingStickyKind(
  model: GfxPrimitiveElementModel
): EventStormingStickyKind | undefined {
  const role = model.role;
  return role === undefined ? undefined : KIND_OF_ROLE.get(role);
}

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * The FACE of a selected sticky — `undefined` when the group is not one.
 *
 * A sticky is a native `group` of two shapes: a neutral offset rectangle that
 * is the drop shadow, and the coloured face that carries the role, the words
 * and every connector endpoint. One click selects the group, so this is the
 * same indirection `c4NodeOfComponent` performs, and the same gate: the face is
 * identified by its ROLE and not by its position in the group, so the shadow
 * (which is ink and carries none) is skipped, a plain lasso round two
 * rectangles resolves to nothing, another framework's composite resolves to
 * nothing, and a legacy sticky whose label is a separate text element resolves
 * to nothing because its face carries no role either.
 *
 * TWO faces is a refusal rather than a first-wins pick, for the reason C4
 * gives: a group of two stickies is a group somebody made of two stickies, and
 * morphing "it" would mean choosing one of them by document order.
 */
export function eventStormingFaceOfSticky(
  model: GfxPrimitiveElementModel
): ShapeElementModel | undefined {
  if (!(model instanceof GroupElementModel)) return undefined;

  let found: ShapeElementModel | undefined;
  for (const child of model.childElements) {
    if (!(child instanceof ShapeElementModel)) continue;
    if (eventStormingStickyKind(child) === undefined) continue;
    if (found) return undefined;
    found = child;
  }
  return found;
}

/* ── The patch ─────────────────────────────────────────────────────────── */

/**
 * What one kind is worth to a face that ALREADY EXISTS.
 *
 * Five keys, and they are exactly the five that differ between two stickies:
 * the role, the two colours, the silhouette and its rounding. Every other prop
 * `addSticky` writes — `filled`, `strokeColor`, `strokeWidth`, `shapeStyle`,
 * `roughness`, and the whole typography of the contained label — is the SAME
 * for all nine kinds, which the unit suite asserts rather than assumes: the day
 * a tenth sticky lands with a preset of its own, that case is what says this
 * table has to grow.
 *
 * ## Why the size is not in here, unlike C4 and BPMN
 *
 * Because on this notation size is not a preset, it is a statement the author
 * made. The aggregate is BORN at 160 against the standard 120 (`commands.ts`),
 * but a sticky a workshop stretched to fit six words is stretched on purpose,
 * and `xywh` is the one thing a morph promises never to touch — the generic
 * module strips it whatever a spec returns. The consequence is visible and
 * accepted: an aggregate morphed to a command keeps its 160, and a command
 * morphed to an aggregate stays 120. The paint says what it is; the size says
 * how much room the author gave it.
 */
export function eventStormingMorphProps(
  kind: EventStormingStickyKind
): Record<string, unknown> {
  const face = FACE_OF_KIND.get(kind);
  // Total over the union by construction — the map is built from the same list
  // the type is derived from — and defensive only for a host that hands a
  // string in from outside TypeScript.
  if (!face) return {};

  return {
    role: ES_STICKY_ROLE[kind],
    fillColor: face.fill,
    color: face.text,
    shapeType: face.shapeType,
    radius: radiusOf(face.shapeType),
  };
}

/* ── What the rest of the sticky owes the change ───────────────────────── */

/** The words a freshly-drawn sticky of each kind carries. */
const STICKY_LABEL = Object.fromEntries(
  ES_STICKY_FACES.map(face => [face.kind, face.label])
) as Record<EventStormingStickyKind, string>;

/**
 * The words a sticky should carry once its face has morphed — or `null` when
 * the words are the AUTHOR's and must not be touched.
 *
 * The same timid rule as `c4MorphedTitle`, and it matters more here: a sticky
 * nobody has written on still says "Domain event", and an orange one that
 * became blue while still saying "Domain event" is a wall contradicting itself
 * in the one place a reader looks. Exactly one case rewrites — the text is the
 * source kind's own creation prompt, letter for letter. A sticky somebody wrote
 * "Order placed" on is called that whatever it becomes, and so is one they
 * cleared, one they added a word to, and one carrying another kind's prompt.
 *
 * Pure and total over every string: the input is a shape label a user may have
 * typed anything into.
 */
export function eventStormingMorphedLabel(
  from: EventStormingStickyKind,
  to: EventStormingStickyKind,
  rawText: string | null | undefined
): string | null {
  return (rawText ?? '').trim() === STICKY_LABEL[from]
    ? STICKY_LABEL[to]
    : null;
}

/**
 * The shadow behind a face — the sibling shape drawn in {@link SHADOW_COLOR}.
 *
 * Identified by its paint and not by its index, because the group's child order
 * is a painting decision `addSticky` happens to make and not a contract. It is
 * excluded by identity from the face rather than by role, so a document where
 * some hand-built group put a role on something unexpected still cannot make
 * the morph rewrite the very element it just patched.
 */
function shadowBehind(
  group: GroupElementModel,
  face: ShapeElementModel
): ShapeElementModel | undefined {
  return group.childElements.find(
    (child): child is ShapeElementModel =>
      child instanceof ShapeElementModel &&
      child !== face &&
      child.fillColor === SHADOW_COLOR
  );
}

/**
 * Keep the sticky's shadow and its words saying what the face now is — the
 * `afterMorph` half of the spec, run inside the morph's own `captureSync` so
 * one ctrl+z puts the whole sticky back.
 *
 * Two things the patch cannot reach, for two different reasons:
 *
 * - **The shadow** is a different ELEMENT. It is the only faux-drop-shadow in
 *   the repo — an offset rectangle behind the face rather than a canvas shadow
 *   — and it is drawn in the face's own silhouette. Morph a square sticky into
 *   a hotspot without it and the diamond floats over a rectangular smudge. Its
 *   POSITION is deliberately untouched: the offset is the author's geometry as
 *   much as the face's box is.
 * - **The words** are `text`, which the generic module strips from every patch
 *   on principle. The rewrite is the placeholder→placeholder rule above.
 *
 * Both derive the target's appearance from {@link eventStormingMorphProps}
 * rather than by reading the freshly-patched face: what the shadow must follow
 * is what the KIND says, and a hook that read its sibling would quietly depend
 * on the order the generic module happens to write in.
 */
function followTheFace(
  model: GfxPrimitiveElementModel,
  from: EventStormingStickyKind,
  to: EventStormingStickyKind
) {
  if (!(model instanceof GroupElementModel)) return;
  const face = eventStormingFaceOfSticky(model);
  if (!face) return;

  const { shapeType, radius } = eventStormingMorphProps(to);

  const shadow = shadowBehind(model, face);
  if (
    shadow &&
    !shadow.isLocked() &&
    (shadow.shapeType !== shapeType || shadow.radius !== radius)
  ) {
    shadow.surface.updateElement(shadow.id, { shapeType, radius });
  }

  rewriteLabel(face, from, to);
}

/**
 * Rewrite the face's own label, in place, if the rule says to.
 *
 * In place and in one transaction, like `rewriteTier`: the `Y.Text` instance is
 * what a bound editor holds, so it is mutated rather than replaced. The
 * comparison is against the TRIMMED text — the same string the rule was given —
 * so a decision made on `'Command  '` does not spend a transaction rewriting
 * the padding away.
 */
function rewriteLabel(
  face: ShapeElementModel,
  from: EventStormingStickyKind,
  to: EventStormingStickyKind
) {
  const words = face.text;
  if (!words) return;

  const text = words.toString().trim();
  const next = eventStormingMorphedLabel(from, to, text);
  if (next === null || next === text) return;

  face.surface.store.transact(() => {
    words.delete(0, words.length);
    words.insert(0, next);
  });
}

/* ── The chrome ────────────────────────────────────────────────────────── */

/**
 * The creation command that draws each kind, keyed BY that kind.
 *
 * Derived from `telemetry.element`, which is where the kind is already written
 * down (`sticky:domainEvent`) and is documented as a historical value that must
 * not be renamed (ADR 0008). Deriving rather than restating is what stops a
 * second table of labels and icons drifting from the one the sub-menu, the
 * catalogue and the agent read — including the one entry where it would bite:
 * `system` is labelled "External system", and a restated table would sooner or
 * later say "System".
 */
const STICKY_COMMANDS = new Map(
  eventStormingCommands.flatMap(command => {
    const element = command.telemetry?.element;
    return element?.startsWith('sticky:')
      ? [[element.slice('sticky:'.length), command] as const]
      : [];
  })
);

/** A kind's wording: the creation command's own key and English. */
function labelOf(kind: EventStormingStickyKind): MorphLabel {
  const command = STICKY_COMMANDS.get(kind);
  return {
    key: command?.labelKey,
    fallback: command?.labelFallback ?? kind,
  };
}

/** A kind's icon: the creation command's own swatch, reused rather than redrawn. */
function iconOf(kind: EventStormingStickyKind): TemplateResult {
  const iconKey = STICKY_COMMANDS.get(kind)?.iconKey;
  return (
    (iconKey && eventStormingCommandIcons[iconKey]) ||
    eventStormingCommandIcons['ddd-event-storming.sticky.domainEvent']
  );
}

/**
 * Event Storming's morph declaration, handed to the generic
 * `morphToolbarConfig`.
 *
 * `modelType` is the native `GroupElementModel` and not a shape, because the
 * group is what a click on a sticky selects — the same arrangement C4 has, and
 * everything that makes it safe is in {@link eventStormingFaceOfSticky}: the
 * toolbar's own homogeneity test proves only that every selection is A group,
 * and the resolution proves that every one of them is one of OURS.
 */
export const EVENT_STORMING_MORPH_SPEC: MorphSpec<EventStormingStickyKind> = {
  framework: 'ddd-event-storming',
  families: ES_MORPH_FAMILIES,
  modelType: GroupElementModel,
  resolveTarget: eventStormingFaceOfSticky,
  kindOf: eventStormingStickyKind,
  // The FACE's role, which is the only role a sticky has: the group carries
  // none and the shadow is ink. Unlike C4's, this table does not collapse —
  // nine kinds, nine roles — so the telemetry's `fromRole`/`toRole` always name
  // the two claims the workshop swapped between.
  roleOf: kind => ES_STICKY_ROLE[kind],
  propsOf: eventStormingMorphProps,
  afterMorph: followTheFace,
  labelOf,
  iconOf,
  label: morphLabel('com.labre.morph.toolbar.label', 'Change type'),
};
