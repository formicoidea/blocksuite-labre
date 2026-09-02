import {
  type MorphLabel,
  morphLabel,
  type MorphSpec,
} from '@labre/affine-block-surface';
import {
  ConnectorElementModel,
  GroupElementModel,
  TextElementModel,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import type { GfxModel, GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import { wardleyCommandIcons, wardleyCommands } from './commands';
import {
  wardleyCanonicalBox,
  wardleyHandleBox,
  wardleyHandleProps,
  wardleyMarketDotBoxes,
  wardleyMarketDotProps,
  wardleyMarketLinkPairs,
  wardleyMarketLinkProps,
  WARDLEY_NODE_LABEL,
  wardleyMorphClears,
  wardleyMorphProps,
} from './presets';
import { WARDLEY_ROLE } from './roles';

/**
 * What a Wardley artefact may BECOME — the declaration behind the "Change type"
 * dropdown on a selected component's contextual toolbar.
 *
 * ## One family, and why it is exactly these four
 *
 * A component, a market, an ecosystem and a pipeline are four ways of saying
 * the SAME thing: something the value chain depends on. The map's own reading
 * agrees — `roles.ts` makes `market` and `ecosystem` children of `component` in
 * the role tree — and the modelling gesture the morph exists for is the one
 * every mapper makes: you draw a component, you look at the map, and you
 * realise that what you drew is a market of many suppliers, or a whole
 * ecosystem, or a pipeline of choices. Today that costs a delete, a re-draw,
 * every dependency re-attached and the name typed again.
 *
 * The family is DATA and nothing derives it — the same call BPMN and C4 make.
 * Deriving it from `roleIsA` would have been wrong in both directions here: it
 * would reach from market to component and not back, and it would say nothing
 * at all about the pipeline, which is not a specialisation of anything and is
 * still the fourth way of drawing the same claim.
 *
 * ## The two kinds deliberately left out
 *
 * - **`anchor`** is the user, and the need they have. It is a role of its own
 *   precisely because it is NOT a component (`roles.ts`): it is what the value
 *   chain hangs from, not a link in it. A menu offering "turn this user into a
 *   pipeline" would invite a map with no anchor at all — the one thing a
 *   Wardley map cannot be read without.
 * - **`method`** is not an artefact but an annotation ON one: the coloured ring
 *   says how a component is being BUILT (buy / build / outsource), and its fill
 *   encodes the choice. Morphing it away would silently discard that decision,
 *   and morphing into it would have to invent one.
 *
 * `handle` is in no family either, and does not need excluding by name: it is
 * not an artefact at all, so nothing selects it and {@link wardleyNodeOfComponent}
 * never resolves to one.
 */
export const WARDLEY_MORPH_FAMILIES: readonly (readonly WardleyMorphKind[])[] =
  [
    // Declaration order is menu order, and it opens on the plain component: the
    // undecorated artefact is the honest first draft, and the three others are
    // refinements of it — the same call `commands.ts` makes about the senior row.
    ['component', 'market', 'ecosystem', 'pipeline'],
  ];

/** The kinds this framework offers as morph targets. */
export type WardleyMorphKind =
  | 'component'
  | 'market'
  | 'ecosystem'
  | 'pipeline';

/** The same set, as a lookup — the gate every resolution below runs through. */
const MORPH_KINDS: ReadonlySet<string> = new Set<string>(
  WARDLEY_MORPH_FAMILIES.flat()
);

/**
 * The creation command that draws each kind, keyed BY that kind.
 *
 * Derived from `telemetry.element`, which is where the kind is already written
 * down (`node:market`) and is documented as a historical value that must not be
 * renamed. Deriving rather than restating is what stops a second table of
 * labels and icons drifting from the one the sub-menu and the catalogue read.
 */
const NODE_COMMANDS = new Map(
  wardleyCommands.flatMap(command => {
    const element = command.telemetry?.element;
    return element?.startsWith('node:')
      ? [[element.slice('node:'.length), command] as const]
      : [];
  })
);

/** A kind's wording: the creation command's own key and English. */
function labelOf(kind: WardleyMorphKind): MorphLabel {
  const command = NODE_COMMANDS.get(kind);
  return {
    key: command?.labelKey,
    fallback: command?.labelFallback ?? kind,
  };
}

/** A kind's icon: the creation command's own, reused rather than redrawn. */
function iconOf(kind: WardleyMorphKind): TemplateResult {
  const iconKey = NODE_COMMANDS.get(kind)?.iconKey;
  return (
    (iconKey && wardleyCommandIcons[iconKey]) ||
    wardleyCommandIcons['wardley.component']
  );
}

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * Every element under a group, however deeply nested.
 *
 * Recursive because the pipeline's own creation site nests — (handle + label),
 * then (body + that) — so a flat pass over `childElements` would miss half of
 * one of the four artefacts this file is about.
 */
function* descendants(group: GroupElementModel): Generator<GfxModel> {
  for (const child of group.childElements) {
    yield child;
    if (child instanceof GroupElementModel) yield* descendants(child);
  }
}

/**
 * The `wardleyNode` a selected GROUP is the artefact of — `undefined` when the
 * group is not one.
 *
 * Every Wardley artefact in this family is a composite: a component is a circle
 * and its label, a market adds three dots and a triangle, and a pipeline is a
 * body plus a handle plus a label in a nested group. So what a click selects is
 * the outer group, and what carries `kind` is one node inside it — RECURSIVELY
 * inside it, because the pipeline's own creation nests.
 *
 * Three conditions, and each one excludes a piece of the notation rather than
 * an accident:
 *
 * - a `WardleyNodeElementModel`, which leaves out the labels and the connectors;
 * - with a ROLE, which leaves out the market's three neutral dots — they are the
 *   glyph's wiring and carry none by construction (`presets.ts`);
 * - whose kind is in the family, which leaves out the pipeline's `handle` and
 *   any `anchor` or `method` somebody grouped in beside the artefact.
 *
 * TWO candidates is a REFUSAL rather than a first-wins pick, exactly as C4's
 * resolution refuses a group of two components: morphing "it" would mean
 * picking one by document order, and the honest answer to an ambiguous
 * selection is nothing at all. A plain lasso round three shapes, a C4 component
 * and a group of two Wardley components all answer `undefined`, so none of them
 * is ever offered the menu.
 */
export function wardleyNodeOfComponent(
  model: GfxPrimitiveElementModel
): WardleyNodeElementModel | undefined {
  if (!(model instanceof GroupElementModel)) return undefined;

  let found: WardleyNodeElementModel | undefined;
  for (const child of descendants(model)) {
    if (!(child instanceof WardleyNodeElementModel)) continue;
    if (child.role === undefined) continue;
    if (!MORPH_KINDS.has(child.kind)) continue;
    if (found) return undefined;
    found = child;
  }
  return found;
}

/* ── The structural half of the morph ──────────────────────────────────── */

/**
 * The name an artefact should carry once it has morphed — or `null` when the
 * name is the AUTHOR's and must not be touched.
 *
 * Exactly one case rewrites: the label is the source kind's own creation
 * prompt, letter for letter, which is what an artefact nobody has named still
 * says. Everything else — a name typed over it, the prompt with a word added, a
 * cleared label, another kind's prompt — is content, and content survives a
 * morph untouched. The same timid rule `c4MorphedTitle` states, and for the same
 * reason: a morph may not take away words somebody put on the picture.
 *
 * Pure and total over every string: the input is a canvas text element somebody
 * may have typed anything into.
 */
export function wardleyMorphedLabel(
  from: WardleyMorphKind,
  to: WardleyMorphKind,
  rawText: string | null | undefined
): string | null {
  return (rawText ?? '').trim() === WARDLEY_NODE_LABEL[from]
    ? WARDLEY_NODE_LABEL[to]
    : null;
}

/** The centre of an element, from the box it currently occupies. */
function centreOf(model: GfxPrimitiveElementModel): [number, number] {
  const [x, y, w, h] = model.deserializedXYWH;
  return [x + w / 2, y + h / 2];
}

/** The label of a composite — `undefined` when there is not exactly one. */
function labelOfComposite(
  group: GroupElementModel
): TextElementModel | undefined {
  let found: TextElementModel | undefined;
  for (const child of descendants(group)) {
    if (!(child instanceof TextElementModel)) continue;
    if (child.role !== WARDLEY_ROLE.label) continue;
    if (found) return undefined;
    found = child;
  }
  return found;
}

/**
 * Point every connector that named `fromId` at `toId` instead.
 *
 * The whole point of morphing rather than re-drawing: a component wired into
 * half a value chain becomes a pipeline and keeps every dependency it had. The
 * endpoint is rewritten to the bare `{ id }` and the `position` is dropped on
 * purpose — a position is stored RELATIVE to the element it names, so carrying
 * one across to a different box would land the arrow somewhere nobody chose.
 * Every Wardley node is `centerAnchorOnly` anyway, so a connector this framework
 * drew never had one.
 */
function reanchor(
  surface: WardleyNodeElementModel['surface'],
  fromId: string,
  toId: string
) {
  for (const element of surface.elementModels) {
    if (!(element instanceof ConnectorElementModel)) continue;
    if (element.isLocked()) continue;
    if (element.source?.id === fromId) {
      surface.updateElement(element.id, { source: { id: toId } });
    }
    if (element.target?.id === fromId) {
      surface.updateElement(element.id, { target: { id: toId } });
    }
  }
}

/**
 * Take the market's glyph apart: the three neutral dots, and the triangle
 * wiring them.
 *
 * Identified the way {@link wardleyNodeOfComponent} identifies what it must NOT
 * resolve to — a `wardleyNode` with no role — and the connectors by the fact
 * that both their ends name one of those dots. Never by document order, and
 * never by "the connectors in this group": a dependency the user drew from
 * their market to something else is a child of nothing and must survive, and one
 * they drew INTO the composite still has one end outside it.
 */
function removeMarketGlyph(group: GroupElementModel) {
  const surface = group.surface;
  const dots = [...descendants(group)].filter(
    (child): child is WardleyNodeElementModel =>
      child instanceof WardleyNodeElementModel && child.role === undefined
  );
  const dotIds = new Set(dots.map(dot => dot.id));

  for (const child of [...descendants(group)]) {
    if (!(child instanceof ConnectorElementModel)) continue;
    const { id: sourceId } = child.source ?? {};
    const { id: targetId } = child.target ?? {};
    if (sourceId === undefined || targetId === undefined) continue;
    if (!dotIds.has(sourceId) || !dotIds.has(targetId)) continue;
    surface.deleteElement(child.id);
  }
  for (const dot of dots) surface.deleteElement(dot.id);
}

/**
 * Build the market's glyph round a centre: three dots and the triangle between
 * them, from the very same constants `createWardleyMarket` uses.
 *
 * Added to the group AFTER the circle they sit in, which is also the painting
 * order the creation site produces — a market drawn from the sub-menu and one
 * morphed into being are the same stack of elements.
 */
function addMarketGlyph(group: GroupElementModel, cx: number, cy: number) {
  const surface = group.surface;
  const dotIds = wardleyMarketDotBoxes(cx, cy).map(xywh =>
    surface.addElement(wardleyMarketDotProps({ xywh }))
  );
  const linkIds = wardleyMarketLinkPairs(dotIds).map(([a, b]) =>
    surface.addElement(wardleyMarketLinkProps(a, b))
  );
  for (const id of [...dotIds, ...linkIds]) {
    const element = surface.getElementById(id);
    if (element) group.addChild(element);
  }
}

/**
 * Give a pipeline the handle it is connected through, and move the user's own
 * links onto it.
 *
 * ## The handle lands FLAT in the outer group — a documented simplification
 *
 * `createWardleyPipeline` nests: it groups (handle + label), then groups that
 * with the body. Nothing depends on the nesting — the handle is found by kind
 * and the label by role, both recursively — and a morph that rebuilt it would
 * have to move the user's label into a group it never asked for. So the morph
 * adds the handle as a sibling of the body. A pipeline morphed into being is
 * therefore ONE group of three elements where a drawn one is a group of two;
 * they behave identically on the canvas, in the exporter and under every rule,
 * and the reverse morph flattens a drawn one the same way.
 */
function addHandle(
  group: GroupElementModel,
  carrier: WardleyNodeElementModel,
  cx: number,
  cy: number
) {
  const surface = group.surface;
  const handleId = surface.addElement(
    wardleyHandleProps({ xywh: wardleyHandleBox(cx, cy) })
  );
  const handle = surface.getElementById(handleId);
  if (handle) group.addChild(handle);
  // A pipeline body declares `connectable === false`, so every link the user
  // drew to the component has to move to the handle or it would point at
  // something that no longer accepts it.
  reanchor(surface, carrier.id, handleId);
}

/**
 * Take the handle away, and give the user's links back to the body.
 *
 * The mirror of {@link addHandle}, plus the one piece of tidying the nesting
 * makes necessary: a pipeline DRAWN from the sub-menu keeps its label in an
 * inner group with the handle, and removing the handle would leave a group of
 * one behind. The label is promoted into the outer group and the empty wrapper
 * deleted, which is what leaves a morphed artefact looking exactly like a drawn
 * one of its new kind.
 */
function removeHandle(
  group: GroupElementModel,
  carrier: WardleyNodeElementModel
) {
  const surface = group.surface;
  const handle = [...descendants(group)].find(
    (child): child is WardleyNodeElementModel =>
      child instanceof WardleyNodeElementModel && child.kind === 'handle'
  );
  if (!handle) return;

  // Before the deletion, never after: the links have to name something.
  reanchor(surface, handle.id, carrier.id);

  const inner = handle.group;
  surface.deleteElement(handle.id);

  if (!(inner instanceof GroupElementModel) || inner === group) return;
  // Emptied first, so `deleteElement` — which deletes a group's children with
  // it — has nothing left to take.
  for (const orphan of [...inner.childElements]) {
    inner.removeChild(orphan);
    group.addChild(orphan);
  }
  surface.deleteElement(inner.id);
}

/**
 * Keep the artefact's own name saying what the artefact now is.
 *
 * The one exception to "the words and the placement are the user's": the
 * placeholder rule of {@link wardleyMorphedLabel}. In place and in one
 * transaction, because the `Y.Text` instance is what a bound editor holds, and
 * inside the caller's `captureSync`, so the rewrite is part of the same single
 * ctrl+z as the kind that made it necessary.
 */
function rewriteLabel(
  group: GroupElementModel,
  from: WardleyMorphKind,
  to: WardleyMorphKind
) {
  const label = labelOfComposite(group);
  if (!label || label.isLocked()) return;

  const text = label.text.toString().trim();
  const next = wardleyMorphedLabel(from, to, text);
  if (next === null || next === text) return;

  label.surface.store.transact(() => {
    label.text.delete(0, label.text.length);
    label.text.insert(0, next);
  });
}

/**
 * Everything the morph owes a Wardley composite beyond the props patch — the
 * `afterMorph` half of the spec, run inside the generic module's one
 * `captureSync` so all of it is a single ctrl+z.
 *
 * ## The geometry, and why this framework writes it
 *
 * A DEVIATION from BPMN and C4, decided by the PO: those two keep the box the
 * user gave the element, because there a size is a preference. Here it is the
 * NOTATION. A market is drawn bigger than a component so a reader can tell them
 * apart at a glance, an ecosystem bigger again, and a pipeline is a 120-wide bar
 * — a market left at a component's 18 pixels is an unreadable smudge with three
 * dots crammed into it. So the target's canonical size is applied, CENTRED on
 * where the artefact already stands: the thing does not move, it becomes the
 * size its notation says it is. The label keeps its own place, which is the
 * user's.
 *
 * ## And why the rest is here rather than in the patch
 *
 * Because a market IS its three dots and a pipeline IS its handle. A patch can
 * write `kind: 'market'` onto a circle and the result is a circle that claims to
 * be a market and does not look like one; a patch cannot create an element, nor
 * move a connector somebody drew. That is exactly what `afterMorph` is for, and
 * the ORDER below is the whole of the care it needs: the glyph the artefact is
 * LEAVING comes apart before the one it is arriving at is built, so a
 * market → pipeline never has three dots and a handle at once.
 */
export function wardleyMorphComposite(
  selected: GfxPrimitiveElementModel,
  from: WardleyMorphKind,
  to: WardleyMorphKind
) {
  if (!(selected instanceof GroupElementModel)) return;
  const carrier = wardleyNodeOfComponent(selected);
  if (!carrier) return;

  const [cx, cy] = centreOf(carrier);
  carrier.surface.updateElement(carrier.id, {
    xywh: wardleyCanonicalBox(to, cx, cy),
  });

  if (from === 'market') removeMarketGlyph(selected);
  if (from === 'pipeline') removeHandle(selected, carrier);
  if (to === 'market') addMarketGlyph(selected, cx, cy);
  if (to === 'pipeline') addHandle(selected, carrier, cx, cy);

  rewriteLabel(selected, from, to);
}

/**
 * Wardley's morph declaration, handed to the generic `morphToolbarConfig`.
 *
 * `modelType` is the native `GroupElementModel` and not
 * `WardleyNodeElementModel`, because every artefact in this family is a
 * composite and the group is what a click on one selects. Everything that makes
 * that safe is in {@link wardleyNodeOfComponent}: the toolbar's own homogeneity
 * test only proves that each selected element is A group, and the resolution
 * proves that each one is one of OURS.
 *
 * `propsOf` is the shipped creation builder minus `type` / `xywh` / `text`
 * ({@link wardleyMorphProps}), so the palette and the morph cannot disagree
 * about what a pipeline looks like, and `clearOf` removes the keys the target
 * does not write — `radius`, which only the pipeline has.
 */
export const WARDLEY_MORPH_SPEC: MorphSpec<WardleyMorphKind> = {
  framework: 'wardley',
  families: WARDLEY_MORPH_FAMILIES,
  modelType: GroupElementModel,
  resolveTarget: wardleyNodeOfComponent,
  kindOf: (model: GfxPrimitiveElementModel) =>
    model instanceof WardleyNodeElementModel && MORPH_KINDS.has(model.kind)
      ? (model.kind as WardleyMorphKind)
      : undefined,
  // The NODE's role, which is the only role a Wardley artefact has: the group
  // carries none, the label carries `wardley:label` (which says it is a name,
  // not what it names) and the market's dots carry none at all.
  roleOf: kind => WARDLEY_ROLE[kind],
  propsOf: wardleyMorphProps,
  clearOf: wardleyMorphClears,
  afterMorph: wardleyMorphComposite,
  labelOf,
  iconOf,
  label: morphLabel('com.labre.morph.toolbar.label', 'Change type'),
};
