import { ConnectorElementModel } from '@labre/affine-model';
import type { XYWH } from '@labre/global/gfx';
import type { SurfaceBlockModel } from '@labre/std/gfx';
import * as Y from 'yjs';

import {
  EDGY_PAIR_TO_VERB,
  EDGY_ROLE,
  EDGY_VERB_ROLE,
  edgyPairKey,
  type EdgyRoleId,
} from './roles';

/**
 * **A relation drawn by hand names itself.**
 *
 * Until this module the 24 typed relations of the metamodel were born of the
 * "EDGY dynamic" template and nowhere else: a user who wanted "this Process
 * requires that Asset" on their own board had a plain connector, carrying no
 * role, saying nothing, read by nothing (PO recette of 26/08/2026).
 *
 * ## Why ONE menu entry and not twenty-two
 *
 * The metamodel's 24 rows are 24 DISTINCT ordered pairs of elements, so the
 * verb is entirely determined by the pair: there is exactly one thing a link
 * from a Journey to a Channel can say, and it is "traverses". A palette of
 * twenty-two verbs would therefore be twenty-two ways of asking the user a
 * question the metamodel already answers — and twenty-one ways of getting it
 * wrong. The toolbox arms ONE tool, stamped with the generic parent role
 * `edgy:relation`, and this resolver reads the pair the user actually attached
 * and writes the verb.
 *
 * ## What it writes, and what it refuses to write
 *
 * - **pair in the metamodel** → the verb's role (`EDGY_VERB_ROLE`) and the verb
 *   as the link's visible label, in the same shape the template lays one down
 *   (`text` + `labelXYWH` + `labelOffset`). The sentence is now legal, so E1
 *   says nothing.
 * - **pair known only the OTHER way round** → the role of the reversed match is
 *   written anyway, and the edge is NOT flipped. This is deliberate: silently
 *   turning the arrow round would overrule a gesture the user made on purpose,
 *   and leaving the edge generic would hide the mistake behind the vaguer "not
 *   a sentence of the metamodel". Naming it makes E1 report the precise
 *   sentence — "a channel traverses a journey" — and `docs/adr/0010`'s M3
 *   (`edge.invert-direction`) is one click away on the contextual toolbar. The
 *   violation IS the affordance.
 * - **pair in neither direction** → nothing is written. The edge keeps
 *   `edgy:relation`, and E1 reports it as a relation the metamodel does not
 *   declare between these two elements, which is exactly what it is.
 * - **an end outside the alphabet** — a People node, a base Object, a plain
 *   sticky, an element of another framework — → nothing is written and nothing
 *   is said. Same contract as the `relation-endpoints` family: outside the
 *   alphabet is outside the conversation (PRD principle 8).
 *
 * ## Once, and only from the generic towards the verb
 *
 * A verb role already written is never rewritten — not by this module, not
 * ever. Re-resolution is allowed only while the edge still carries the generic
 * role, which is what makes "drop the end on the wrong element, then move it"
 * work without the tool fighting the hand. And nothing here ever writes
 * `edgy:relation` back over a verb: the resolution runs one way.
 */

/**
 * Recompute delay. The connector tool rewrites `target` on every pointer move
 * of the drag, so resolving on the spot would name the relation after the FIRST
 * element the cursor passed over — and, the naming being write-once, would then
 * refuse to name it after the one the user actually dropped it on. Debouncing
 * means the pair that gets read is the pair that ended up on the board.
 *
 * Same value as the validation engine's, and for the same reason: it is the
 * shortest wait a human does not perceive at the end of a gesture.
 */
export const EDGY_RELATION_DELAY_MS = 120;

/** Where the verb sits along the link. The templates' own default. */
export const EDGY_RELATION_LABEL_DISTANCE = 0.5;

/**
 * The label BOX for a verb — `x`/`y` are re-centred on the path at the first
 * layout, but the `w`/`h` are the box, so it has to be sized to the word or the
 * verb wraps mid-syllable on a two-word relation like "is part of".
 *
 * Exported and read by `templates/index.ts` as well: the 24 relations the
 * template draws and the ones drawn by hand have to look identical, and two
 * copies of `verb.length * 9 + 24` is one copy too many.
 */
export function edgyVerbLabelXYWH(verb: string): XYWH {
  return [0, 0, verb.length * 9 + 24, 26];
}

/** What the metamodel calls the relation between two elements. */
export interface EdgyRelationNaming {
  /** The verb's own role: `edgy:traverses`. */
  role: EdgyRoleId;
  /** The verb, which also becomes the link's visible label. */
  verb: string;
  /**
   * Whether the metamodel knows this pair only the OTHER way round. The edge is
   * named all the same and never flipped — see the note at the top of the file.
   */
  reversed: boolean;
}

/**
 * The verb the metamodel gives an ordered pair of element roles, direct match
 * first, reversed match second, `null` when it knows neither.
 *
 * Pure, and exported for the unit spec: it is the whole opinion of this module,
 * and a function taking two strings is testable without a surface, an editor or
 * a DI container around it.
 */
export function edgyRelationNaming(
  sourceRole: string | undefined,
  targetRole: string | undefined
): EdgyRelationNaming | null {
  if (sourceRole === undefined || targetRole === undefined) return null;

  const direct = EDGY_PAIR_TO_VERB[edgyPairKey(sourceRole, targetRole)];
  if (direct !== undefined) {
    return { role: EDGY_VERB_ROLE[direct], verb: direct, reversed: false };
  }

  const reversed = EDGY_PAIR_TO_VERB[edgyPairKey(targetRole, sourceRole)];
  if (reversed !== undefined) {
    return { role: EDGY_VERB_ROLE[reversed], verb: reversed, reversed: true };
  }

  return null;
}

/**
 * Whether this edge is a generic EDGY relation with both ends ATTACHED — the
 * one state this module acts on.
 *
 * `role === EDGY_ROLE.relation` exactly, never `roleIsA`: a verb role
 * specialises the parent, and treating it as a candidate is precisely how the
 * resolver would start rewriting its own work. An end released over empty
 * canvas relates nothing to nothing, so it is not a candidate either — it
 * becomes one the moment the user drags it onto something.
 *
 * A LOCKED edge is left alone, the guard `edge.invert-direction` applies for
 * the same reason: locking is the user saying "do not touch this", and a
 * resolver that wrote to one anyway would be the one gesture on this canvas
 * that ignores it.
 */
export function isUnnamedEdgyRelation(edge: ConnectorElementModel): boolean {
  return (
    edge.role === EDGY_ROLE.relation &&
    Boolean(edge.source?.id) &&
    Boolean(edge.target?.id) &&
    !edge.isLocked()
  );
}

/**
 * The naming this edge has earned from the elements it is attached to, or
 * `null` when there is nothing to write. Reads only; the writes are below.
 */
export function edgeRelationNaming(
  surface: SurfaceBlockModel,
  edge: ConnectorElementModel
): EdgyRelationNaming | null {
  if (!isUnnamedEdgyRelation(edge)) return null;
  const source = surface.getElementById(edge.source.id!);
  const target = surface.getElementById(edge.target.id!);
  if (!source || !target) return null;
  return edgyRelationNaming(source.role, target.role);
}

/**
 * Write the verb onto one edge.
 *
 * Through `surface.updateElement` and never through `EdgelessCRUDIdentifier`,
 * for the reason `edge.invert-direction` spells out at length: `crud`'s wrapper
 * calls `recordLastProps`, which would make this relation's label geometry the
 * DEFAULT for every connector drawn afterwards. Naming one relation is a
 * statement about that relation, never a style preference.
 */
export function writeEdgyRelationName(
  surface: SurfaceBlockModel,
  edge: ConnectorElementModel,
  naming: EdgyRelationNaming
): void {
  surface.updateElement(edge.id, {
    role: naming.role,
    // The verb travels with the link as a label, exactly as the template lays
    // it down — the role is what the engine reads, the label is what the user
    // reads out loud to notice a sentence running backwards.
    text: new Y.Text(naming.verb),
    labelXYWH: edgyVerbLabelXYWH(naming.verb),
    labelOffset: { distance: EDGY_RELATION_LABEL_DISTANCE },
  });
}

/**
 * Name every edge among `ids` that has earned a name, in ONE undo step.
 *
 * The seam, and the only function here that writes. Two phases on purpose: the
 * namings are decided BEFORE anything is captured, so a flush that finds
 * nothing to say costs no undo entry at all — an empty capture would turn every
 * stray connector into a stop on the user's way back through their own history.
 *
 * Read-only is checked here rather than trusted: `surface.updateElement`
 * THROWS on a read-only store, so a resolver that did not ask would turn
 * opening a shared board in read-only into an exception per connector drawn on
 * it.
 */
export function resolveEdgyRelations(
  surface: SurfaceBlockModel,
  ids: Iterable<string>
): EdgyRelationNaming[] {
  if (surface.store.readonly) return [];

  const planned: [ConnectorElementModel, EdgyRelationNaming][] = [];
  for (const id of ids) {
    const edge = surface.getElementById(id);
    if (!(edge instanceof ConnectorElementModel)) continue;
    const naming = edgeRelationNaming(surface, edge);
    if (naming) planned.push([edge, naming]);
  }
  if (planned.length === 0) return [];

  // BEFORE the writes: `Store.transact` is no undo boundary, so without this
  // the naming would be undone TOGETHER with the drag that produced it and the
  // user would lose the link they just drew to take back a word.
  surface.store.captureSync();
  for (const [edge, naming] of planned) {
    writeEdgyRelationName(surface, edge, naming);
  }
  return planned.map(([, naming]) => naming);
}
