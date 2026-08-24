import { ConnectorElementModel } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import type { EdgeDirectionDef, RoleDef, RoleDefs } from '@labre/std/gfx';
import { findRoleDef, RoleVocabularyIdentifier } from '@labre/std/gfx';

/**
 * "Is this connector a TYPED EDGE, and if so what does it say?" — the one
 * question `docs/adr/0010` turns on.
 *
 * For an element whose `role` resolves to a `RoleDef` with `kind: 'edge'`, the
 * persisted pair `source → target` IS the relation's orientation and part of
 * the document's meaning. For a connector with no role — the generalist
 * connector, the market glyph's wiring, an EDGY decoration — the two ends stay
 * what they always were: the first and last point of a path, carrying no claim.
 *
 * Everything M1, M2 and M3 do is gated on this, and none of them knows a
 * framework's name: the vocabulary is registered by whoever owns it
 * (`RoleVocabularyExtension`), and this file only reads `kind` and the verb.
 */

/** A connector, plus the declaration that makes its direction mean something. */
export interface TypedEdge {
  model: ConnectorElementModel;
  role: RoleDef;
  /** The verb and the gesture hint, when the role declares them. */
  direction?: EdgeDirectionDef;
}

/** Every role vocabulary registered in this editor assembly. */
export function roleVocabularies(std: BlockStdScope): readonly RoleDefs[] {
  return [...std.provider.getAll(RoleVocabularyIdentifier).values()];
}

/**
 * `element` read as a typed edge, or `null`.
 *
 * Three ways to be `null`, and all three are deliberate:
 *
 * - it is not a connector (the reveal is about edges, not about nodes);
 * - it carries no role, or one no loaded framework declares — nothing is
 *   claimed about its ends and nothing is shown;
 * - it carries a role of `kind: 'node'`, which on a connector is a mistake
 *   somebody's data made and is treated as neutral rather than guessed at.
 */
export function asTypedEdge(
  vocabularies: readonly RoleDefs[],
  element: unknown
): TypedEdge | null {
  if (!(element instanceof ConnectorElementModel)) return null;
  const role = findRoleDef(vocabularies, element.role);
  if (role === undefined || role.kind !== 'edge') return null;
  return role.direction
    ? { model: element, role, direction: role.direction }
    : { model: element, role };
}

/**
 * Whether both ends of the edge are actually BOUND to an element.
 *
 * The guard `docs/adr/0010` asks for by name: an edge with a free endpoint
 * relates nothing to nothing. Releasing the link tool over empty canvas
 * produces one at any time, so this is not an edge case — it is a state the
 * product reaches on the first misfire, and the honest answer there is silence.
 * No chevron, no verb, and no W4 verdict either (the rule family applies the
 * same test).
 */
export function edgeIsBound(model: ConnectorElementModel): boolean {
  return Boolean(model.source?.id) && Boolean(model.target?.id);
}
