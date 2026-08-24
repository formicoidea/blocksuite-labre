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

/** The two ends of the relation, named. `''` for an end that has no name. */
export interface EdgeEndpointNames {
  /** The subject of the role's verb. */
  source: string;
  /** Its object. */
  target: string;
}

/** The text an element carries itself, `''` when it carries none. */
function ownText(element: unknown): string {
  const text: unknown = (element as { text?: unknown } | null)?.text;
  if (typeof text === 'string') return text.trim();
  if (text && typeof (text as { toString?: unknown }).toString === 'function') {
    return String(text).trim();
  }
  return '';
}

/**
 * The members of the group holding `element`, or `null`.
 *
 * `group` is a getter that WALKS the surface, so on a detached element it
 * throws. Reading a name must never throw: a label that crashes the widget is
 * worse than a sentence with a blank in it, and the caller's fallback (no
 * name) is the same silence every other unreadable end produces. Same guard,
 * same reason as `extensions/reading.ts`.
 */
function groupMembers(element: unknown): unknown[] {
  let group: unknown;
  try {
    group = (element as { group?: unknown }).group;
  } catch {
    return [];
  }
  const children = (group as { childElements?: unknown } | null)?.childElements;
  return Array.isArray(children) ? children : [];
}

/**
 * What the two ends of a typed edge are CALLED, so the reveal can say
 * `Kettle depends on Electricity` rather than just `depends on`.
 *
 * Its own text first, then — because a framework artefact on this canvas is a
 * composite, a circle with a free text beside it — the text of the sibling in
 * its group carrying a role of `kind: 'text'`. That is the same composition
 * `extensions/reading.ts` resolves from the other direction, and it is read
 * GENERICALLY: `kind` and nothing else, so no framework's label role is named
 * here and a framework that draws its names inside the node works too.
 *
 * An end with no name resolves to `''` and the caller drops it from the
 * sentence, which then reads as the bare verb — never as a blank where a name
 * was promised.
 */
export function endpointNamesOf(
  vocabularies: readonly RoleDefs[],
  model: ConnectorElementModel
): EdgeEndpointNames {
  const surface = (
    model as unknown as {
      surface?: { getElementById(id: string): unknown } | null;
    }
  ).surface;

  const nameOf = (id: string | undefined): string => {
    if (!id || !surface) return '';
    const element = surface.getElementById(id);
    if (!element) return '';
    const own = ownText(element);
    if (own) return own;

    for (const child of groupMembers(element)) {
      if (!child || child === element) continue;
      const role = findRoleDef(vocabularies, (child as { role?: string }).role);
      if (role?.kind !== 'text') continue;
      const text = ownText(child);
      if (text) return text;
    }
    return '';
  };

  return {
    source: nameOf(model.source?.id),
    target: nameOf(model.target?.id),
  };
}
