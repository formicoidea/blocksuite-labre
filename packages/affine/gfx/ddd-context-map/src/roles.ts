import { CM_RELATIONSHIPS } from '@labre/affine-gfx-ddd-shared';
import type { RoleDef, RoleDefs } from '@labre/std/gfx';

/**
 * Context Mapping role vocabulary (WS2).
 *
 * Roles are the semantic identity of a Context Map artefact — no rule will ever
 * look at a shape type. Four families:
 *
 * - the **board** (`context-map:board`), the white card the map is drawn on;
 * - the **bounded context** (`context-map:context`), the blue pill;
 * - the **system** (`context-map:system`), the cloud — see below;
 * - the **relationship** (`context-map:relationship`), the edge parent, with
 *   one child per DDD pattern.
 *
 * ## One role per pattern, and why
 *
 * The PO arbitration of 26/08/2026: a relationship is not a connector with a
 * `pattern` property, it is nine different edges. Two reasons, both of them
 * about what the rules can then say. A pattern-per-role means a rule is written
 * on the pattern it is about (`acl` and `conformist` may not coexist) without
 * the engine growing a way to read a property; and it means a combination the
 * notation genuinely allows — C/S plus OHS plus PL on the same couple, which is
 * DDD Crew's own example — is drawn as PARALLEL LINKS, each a statement of its
 * own, rather than as a bag of flags nobody can point at.
 *
 * Hierarchy is DATA (`parent`): every pattern specialises
 * `context-map:relationship`, so a rule written on the parent — the endpoint
 * grammar, the self-loop ban — covers all nine for free (see `roleIsA`).
 *
 * ## `direction` only on the U/D patterns
 *
 * Tier 1 of `docs/adr/0010` says an edge's source is the subject of its verb.
 * That only MEANS something for the five upstream/downstream patterns, where
 * the notation itself has a direction: the source is the upstream context. The
 * four symmetric ones (Partnership, Shared Kernel, Separate Ways, Big Ball of
 * Mud) relate two contexts as equals — declaring a verb on them would announce a
 * gesture ("drag from the upstream one") that means nothing, and the reveal (M2)
 * would show a sentence the framework does not say. They therefore declare none,
 * which is exactly what an untyped edge already did.
 *
 * ## The cloud is a `system`, not a Big Ball of Mud
 *
 * DDD Crew's cheat sheet defines Big Ball of Mud as "a (part of a) system which
 * is a mess" — a DEMARCATION of a system's quality, not a kind of node. The
 * cloud is the thing being demarcated: something out there the map integrates
 * with and does not model as a bounded context (a legacy, a vendor package, a
 * mess). Naming the role `big-ball-of-mud` would make every cloud a quality
 * claim the user never made, and the id `context-map:bbom` is the PATTERN's
 * already. So the role is the neutral `context-map:system`, and its label keeps
 * the Big Ball of Mud reading in sight because that is what the palette entry
 * has always said.
 *
 * The role exists so the automatic legend can SEE a cloud (detection is by role
 * only). It is deliberately absent from every rule's endpoint matrix: a
 * relationship drawn onto a cloud stays outside the alphabet, hence unjudged
 * (`rules.ts`, CM1).
 *
 * ## Compat
 *
 * Nothing is backfilled. A cloud placed before `context-map:system` existed
 * carries no role, stays out of the legend, and is otherwise the same drawing. Relationships drawn before these roles existed — the
 * old free connector + tag + U/D markers group — carry no role and are never
 * evaluated (promesse #71): they stay drawings, in the documents they are in.
 */

/** The nine DDD Crew patterns, by the `kind` used at the creation sites. */
export type ContextMapPatternKind = (typeof CM_RELATIONSHIPS)[number]['kind'];

export type ContextMapRoleId = `context-map:${string}`;

/**
 * Role id per pattern kind, DERIVED from the shared preset table rather than
 * restated: the kinds are camelCase (`sharedKernel`) and the role ids are
 * kebab-case (`context-map:shared-kernel`), and the day a tenth pattern lands in
 * `CM_RELATIONSHIPS` it gets its role here with no edit.
 */
const kebab = (kind: string): string =>
  kind.replace(/[A-Z]/g, letter => `-${letter.toLowerCase()}`);

export const CM_PATTERN_ROLE = Object.fromEntries(
  CM_RELATIONSHIPS.map(preset => [
    preset.kind,
    `context-map:${kebab(preset.kind)}`,
  ])
) as Record<ContextMapPatternKind, ContextMapRoleId>;

/** The four roles that are not a pattern, plus the pattern ids. */
export const CONTEXT_MAP_ROLE = {
  board: 'context-map:board',
  context: 'context-map:context',
  system: 'context-map:system',
  relationship: 'context-map:relationship',
  ...CM_PATTERN_ROLE,
} as const;

/** The DDD Crew wording, verbatim: `Upstream` is the source of the relation. */
const UPSTREAM_DIRECTION = {
  verbKey: 'com.labre.ddd-context-map.role.relationship.verb',
  verbFallback: 'is upstream of',
  gestureHintKey: 'com.labre.ddd-context-map.role.relationship.gesture',
  gestureHintFallback: 'Drag from the upstream context to the downstream one.',
} as const;

const DEFS: readonly RoleDef[] = [
  // The board: a frame, not a context. It specialises nothing, so a rule
  // written on `context-map:context` can never match the card its subjects
  // sit on.
  {
    id: CONTEXT_MAP_ROLE.board,
    kind: 'node',
    labelKey: 'com.labre.ddd-context-map.role.board',
    labelFallback: 'Context map',
  },
  {
    id: CONTEXT_MAP_ROLE.context,
    kind: 'node',
    labelKey: 'com.labre.ddd-context-map.role.context',
    labelFallback: 'Bounded context',
  },
  // The cloud. Specialises nothing — above all not `context-map:context`, which
  // would pull it into the endpoint alphabet and the off-board rule.
  {
    id: CONTEXT_MAP_ROLE.system,
    kind: 'node',
    labelKey: 'com.labre.ddd-context-map.role.system',
    labelFallback: 'System / Big Ball of Mud',
  },
  // The edge parent. Carries no `direction` of its own: five of its nine
  // children have one and four do not, and a verb on the parent would be
  // inherited by the symmetric patterns that deny having one.
  {
    id: CONTEXT_MAP_ROLE.relationship,
    kind: 'edge',
    labelKey: 'com.labre.ddd-context-map.role.relationship',
    labelFallback: 'Relationship',
  },
  ...CM_RELATIONSHIPS.map(
    (preset): RoleDef => ({
      id: CM_PATTERN_ROLE[preset.kind],
      parent: CONTEXT_MAP_ROLE.relationship,
      kind: 'edge',
      labelKey: `com.labre.ddd-context-map.role.${kebab(preset.kind)}`,
      labelFallback: preset.label,
      // See the header: only the upstream/downstream patterns have a subject.
      ...(preset.upDown ? { direction: UPSTREAM_DIRECTION } : {}),
    })
  ),
];

// Null prototype: this is a lookup table keyed by ids that may one day come
// from host-supplied packs, so `defs['toString']` must not resolve.
export const CONTEXT_MAP_ROLES: RoleDefs = Object.assign(
  Object.create(null),
  Object.fromEntries(DEFS.map(def => [def.id, def]))
);
