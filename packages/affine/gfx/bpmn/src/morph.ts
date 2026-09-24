import {
  type MorphLabel,
  morphLabel,
  type MorphSpec,
} from '@labre/affine-block-surface';
import {
  BpmnNodeElementModel,
  type BpmnNodeKind,
  GroupElementModel,
  TextElementModel,
} from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import type { GfxModel, GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { TemplateResult } from 'lit';

import { bpmnCommandIcons, bpmnCommands } from './commands.js';
import { bpmnLabelMode, NODE_LABEL, nodeLabelKey } from './consts.js';
import { bpmnMorphClears, bpmnMorphProps } from './presets.js';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from './roles.js';

/**
 * What a BPMN artefact may BECOME — the declaration behind the "Change type"
 * dropdown on a selected node's contextual toolbar.
 *
 * ## Families, and why they are a table
 *
 * A user task IS a task, said more precisely; a timer start IS a start event
 * that names its trigger. Realising halfway through a draft that the rectangle
 * should have been a user task is modelling, not a mistake — but the only way
 * through it today is delete, re-draw, re-connect and re-type the label, which
 * loses every sequence flow attached to the node.
 *
 * The six families below are DATA and nothing derives them. The role tree would
 * have been the obvious source and it is the wrong one: `roleIsA` makes
 * `bpmn:task` and `bpmn:sub-process` both `bpmn:activity`, so a derivation
 * would offer "turn this task into a sub-process" — a swap between an atomic
 * unit of work and a stand-in for a whole process, which is not the same
 * artefact said more precisely but a different claim about the process. A
 * reader has to accept the pair, and only a human knows which pairs a reader
 * accepts.
 *
 * Each family is closed under "the same thing, more or less specific":
 *
 * - the three tasks — plain, and the two that say WHO performs the work;
 * - the three starts and the three ends — plain, and the variants that say what
 *   triggers the one and what the other does on the way out;
 * - the two gateways — the same diamond, and the marker is the whole difference;
 * - the two data artefacts — a data object dies with the process instance, a
 *   data store outlives it, and both are the paperwork rather than the work;
 * - the sub-process and the call activity — the two ways of standing for a
 *   whole process, one defined inline and one defined elsewhere. They are each
 *   other's neighbour and neither is a task.
 *
 * ## The two kinds with no family, deliberately
 *
 * `textAnnotation` and `group` are what the author drew ON the picture rather
 * than IN it (BPMN 2.0.2 §10.4), and there is nothing either of them could
 * become without ceasing to be commentary. They are in no family, so a
 * selection holding one offers no menu at all — which is the same isolation
 * `roles.ts` already gives them in the role tree.
 */
export const BPMN_MORPH_FAMILIES: readonly (readonly BpmnNodeKind[])[] = [
  // Declaration order is menu order, and it opens on the plain member of each
  // family: the undecorated artefact is the honest first draft, and the variant
  // is the refinement — the same call `commands.ts` makes about the senior row.
  ['task', 'taskUser', 'taskService'],
  ['startEvent', 'startEventMessage', 'startEventTimer'],
  ['endEvent', 'endEventMessage', 'endEventTerminate'],
  ['gatewayExclusive', 'gatewayParallel'],
  ['dataObject', 'dataStore'],
  ['subProcess', 'callActivity'],
];

/**
 * The creation command that draws each kind, keyed BY that kind.
 *
 * Derived from `telemetry.element`, which is where the kind is already written
 * down (`node:taskUser`) and is documented as a historical value that must not
 * be renamed. Deriving rather than restating is what stops a second table of
 * labels and icons drifting from the one the palette and the catalogue read: a
 * kind whose command is renamed, re-iconed or re-worded changes here for free,
 * and a kind with no creation command at all simply falls back to its own name.
 */
const NODE_COMMANDS = new Map(
  bpmnCommands.flatMap(command => {
    const element = command.telemetry?.element;
    return element?.startsWith('node:')
      ? [[element.slice('node:'.length), command] as const]
      : [];
  })
);

/**
 * A kind's wording: the creation command's own key and English, so the dropdown
 * says "User task" in whatever the host's catalogue says it in, and says
 * exactly what the palette entry that draws one says.
 */
function labelOf(kind: BpmnNodeKind): MorphLabel {
  const command = NODE_COMMANDS.get(kind);
  return {
    key: command?.labelKey,
    fallback: command?.labelFallback ?? kind,
  };
}

/** A kind's icon: the creation command's own, reused rather than redrawn. */
function iconOf(kind: BpmnNodeKind): TemplateResult {
  const iconKey = NODE_COMMANDS.get(kind)?.iconKey;
  return (
    (iconKey && bpmnCommandIcons[iconKey]) || bpmnCommandIcons['bpmn.task']
  );
}

/* ── The gravitating label (R38) ───────────────────────────────────────── */

/**
 * Every element under a group, however deeply nested — the same walk as
 * Wardley's `descendants`, so an author who grouped a composite with
 * something else still has it resolved.
 */
function* descendants(group: GroupElementModel): Generator<GfxModel> {
  for (const child of group.childElements) {
    yield child;
    if (child instanceof GroupElementModel) yield* descendants(child);
  }
}

/**
 * The BPMN node a selected GROUP is the artefact of — `undefined` when it is
 * not one.
 *
 * An event, a gateway or a data shape is born as a native group of the symbol
 * and its `bpmn:label` (`createBpmnNode`, R38), so a click selects the GROUP
 * and the `kind` lives on the node inside it. Mirrors
 * `wardleyNodeOfComponent`: only a `BpmnNodeElementModel` of an EXTERNAL kind
 * is a candidate (the label, a connector or an activity somebody grouped in
 * beside it are not), and TWO candidates is a refusal rather than a first-wins
 * pick — morphing "it" in a group of two events would mean choosing one by
 * document order.
 */
export function bpmnNodeOfComposite(
  model: GfxPrimitiveElementModel
): BpmnNodeElementModel | undefined {
  if (!(model instanceof GroupElementModel)) return undefined;

  let found: BpmnNodeElementModel | undefined;
  for (const child of descendants(model)) {
    if (!(child instanceof BpmnNodeElementModel)) continue;
    if (bpmnLabelMode(child.kind) !== 'external') continue;
    if (found) return undefined;
    found = child;
  }
  return found;
}

/**
 * The one `bpmn:label` of the composite the selected element belongs to —
 * the group itself when the group row morphed, the node's group when the node
 * row did. `undefined` when there is not exactly one.
 */
function labelOfComposite(
  selected: GfxPrimitiveElementModel
): TextElementModel | undefined {
  const group =
    selected instanceof GroupElementModel
      ? selected
      : selected.group instanceof GroupElementModel
        ? selected.group
        : undefined;
  if (!group) return undefined;

  let found: TextElementModel | undefined;
  for (const child of descendants(group)) {
    if (!(child instanceof TextElementModel)) continue;
    if (child.role !== BPMN_ROLE.label) continue;
    if (found) return undefined;
    found = child;
  }
  return found;
}

/**
 * The name an artefact should carry once it has morphed — or `null` when the
 * name is the AUTHOR's.
 *
 * Exactly one case rewrites: the label still says the SOURCE kind's seed,
 * English or translated, letter for letter. A "Start event" that became a
 * timer start and still read "Start event" would contradict its own glyph;
 * anything typed over the seed is content and survives the morph untouched —
 * the rule `wardleyMorphedLabel` states, for the same reason.
 */
export function bpmnMorphedLabel(
  from: BpmnNodeKind,
  to: BpmnNodeKind,
  rawText: string | null | undefined,
  std?: BlockStdScope
): string | null {
  const text = (rawText ?? '').trim();
  const fromSeed = std
    ? translateKey(std, nodeLabelKey(from), NODE_LABEL[from])
    : NODE_LABEL[from];
  if (text !== NODE_LABEL[from] && text !== fromSeed) return null;
  return std
    ? translateKey(std, nodeLabelKey(to), NODE_LABEL[to])
    : NODE_LABEL[to];
}

/**
 * The structural half of a morph on an external kind: rewrite the grouped
 * label when it is still the source kind's seed. The families never cross
 * inscribed ⇄ external, so nothing moves in or out of the shape; an inscribed
 * kind has no grouped label and this does nothing for it.
 */
function bpmnMorphLabel(
  selected: GfxPrimitiveElementModel,
  from: BpmnNodeKind,
  to: BpmnNodeKind,
  std?: BlockStdScope
) {
  const label = labelOfComposite(selected);
  if (!label || label.isLocked()) return;

  const text = label.text.toString().trim();
  const next = bpmnMorphedLabel(from, to, text, std);
  if (next === null || next === text) return;

  label.surface.store.transact(() => {
    label.text.delete(0, label.text.length);
    label.text.insert(0, next);
  });
}

/**
 * BPMN's morph declaration, handed to the generic `morphToolbarConfig`.
 *
 * `propsOf` is the shipped creation builder minus `type` / `xywh` / `text`
 * ({@link bpmnMorphProps}) and `clearOf` the keys the target does not write
 * ({@link bpmnMorphClears}) — both live in `presets.ts`, beside the one
 * description of what a BPMN node IS, precisely so that a morph and a creation
 * can never disagree about what a `callActivity` looks like.
 *
 * That pair is the one place the FULL preset earns its keep on today's table:
 * `subProcess` and `callActivity` differ only in `strokeWidth` (2 ⇄ 4), and the
 * thick border is the whole distinction. Every other family here shares one
 * preset across its members, so the rest of the patch is inert — kept anyway,
 * because a family grows by DECLARATION and nobody would be prompted to check
 * the presets on the day one gains a member that styles itself differently.
 */
export const BPMN_MORPH_SPEC: MorphSpec<BpmnNodeKind> = {
  framework: 'bpmn',
  families: BPMN_MORPH_FAMILIES,
  modelType: BpmnNodeElementModel,
  kindOf: (model: GfxPrimitiveElementModel) =>
    model instanceof BpmnNodeElementModel ? model.kind : undefined,
  roleOf: kind => BPMN_ROLE_OF_KIND[kind],
  propsOf: bpmnMorphProps,
  clearOf: bpmnMorphClears,
  afterMorph: bpmnMorphLabel,
  labelOf,
  iconOf,
  label: morphLabel('com.labre.morph.toolbar.label', 'Change type'),
};

/**
 * The same declaration on the GROUP row: an event, a gateway or a data shape
 * is a native group of the symbol and its label (R38), and the group is what a
 * click on one selects. `modelType` is therefore `GroupElementModel`, and
 * everything that makes that safe is {@link bpmnNodeOfComposite} — the
 * toolbar's homogeneity test only proves each selected element is A group.
 * Mirrors `WARDLEY_MORPH_SPEC`.
 */
export const BPMN_GROUP_MORPH_SPEC: MorphSpec<BpmnNodeKind> = {
  ...BPMN_MORPH_SPEC,
  modelType: GroupElementModel,
  resolveTarget: bpmnNodeOfComposite,
};
