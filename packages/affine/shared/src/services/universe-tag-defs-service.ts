/**
 * Per-universe tag definitions — the format, the seeding mechanism and the
 * merged read-only view over them (MF3 / ADR 0007 §§ 2 and 3).
 *
 * The **application seeds** the definitions per universe; the **library fixes
 * their format**. That split is the whole point: a new business universe
 * (cynefin, TOGAF, a client's private taxonomy) must be addable without
 * shipping library code. The library ships exactly one pack of its own —
 * Wardley's four natures — as a worked example, on the same mechanism a host
 * would use.
 *
 * Three rules govern everything below, and they are not negotiable:
 *
 * - **Nothing throws, ever.** An invalid id, a cross-framework id, an
 *   unrecognised `formatVersion` — each drops the offending def and records an
 *   issue. A malformed seed must never prevent a document from opening. That is
 *   the hard boundary between "the app misconfigured a pack" and "the user lost
 *   their board".
 * - **Defs are runtime configuration and are NEVER persisted.** The document
 *   stores ids only. A value whose def has vanished still loads and is shown as
 *   its raw id, marked unknown.
 * - **Ids are forever.** A def is never removed, only `deprecated`.
 */
import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope, FrameworkId } from '@labre/std';
import { FRAMEWORK_IDS } from '@labre/std';
import type { RoleDefs, RoleId } from '@labre/std/gfx';
import { roleIsA } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

/**
 * `'<framework>:<local>'` — e.g. `'wardley:component'`, `'wardley:nature'`.
 *
 * A **seed-time** validation aid only. Persisted values are plain `string`s and
 * are never narrowed to this, because a document may legitimately carry an id
 * whose def was removed, renamed or never seeded in this deployment — and it
 * must still open.
 */
export type QualifiedId = `${string}:${string}`;

/** `'<tagId>/<local>'` — e.g. `'wardley:nature/data'`. */
export type TagValueId = string;

/**
 * Lower-kebab, case-sensitive, no unicode, no dots. Hyphenated framework ids
 * are legal, so `cynefin-estuarine:domain` is well formed.
 */
const ID_PATTERN =
  /^[a-z0-9][a-z0-9-]*:[a-z0-9][a-z0-9-]*(\/[a-z0-9][a-z0-9-]*)?$/;

export type TagValueDef = {
  /** `'<tagId>/<local>'`, e.g. `'wardley:nature/data'`. */
  id: TagValueId;
  /** Display label, already localized by the host. */
  label: string;
  description?: string;
  /** Advisory colour token. The library may ignore it; it never affects layout. */
  color?: string;
  /** Hidden from pickers; still displayed when already present on an element. */
  deprecated?: boolean;
};

export type TagDef = {
  /** `'<framework>:<local>'`, e.g. `'wardley:nature'`. */
  id: QualifiedId;
  label: string;
  description?: string;
  /** How many values an element may carry for this tag. */
  cardinality: 'single' | 'multi';
  /** A closed list, or `'open'` for free-text values. */
  values: TagValueDef[] | 'open';
  /**
   * Role ids this tag qualifies. `'*'` = every role of this framework.
   * Specialisation applies: a tag on `'wardley:component'` also applies to
   * every role whose `parent` chain reaches it — resolved with `roleIsA`
   * against the framework's own `RoleDefs`, which the CALLER supplies.
   */
  appliesTo: RoleId[] | '*';
  /**
   * Advisory only. A missing "required" tag is reported by the rules engine; it
   * NEVER blocks a gesture, a save, or a document load.
   */
  required?: boolean;
  /** Ascending display order. Ties broken by seed order, then by id. */
  order?: number;
  deprecated?: boolean;
};

/**
 * One pack of tag definitions. Plain data — no functions, no classes, no
 * `Symbol` — so the TS type IS the JSON schema and a pack can ship as a `.json`
 * asset.
 *
 * `roles` is deliberately absent: roles are lib-side data modules shipped by
 * the framework that renders them (`WARDLEY_ROLES`), not app-seeded, and never
 * pass through this registry (ADR 0007 § 2bis).
 */
export type UniverseTagDefs = {
  /** Bumped only on a breaking change to THIS format. Currently 1. */
  formatVersion: 1;
  /**
   * Unique id of this *pack*, not of the framework: several packs may extend
   * the same framework (a base Wardley pack + a client's private extension).
   * Doubles as the DI variant.
   */
  packId: string;
  framework: FrameworkId;
  label: string;
  tags: TagDef[];
};

/** A seed-time problem, for a host diagnostics panel. Never thrown. */
export type UniverseDefIssue = {
  severity: 'warning' | 'error';
  code:
    | 'invalid-id'
    | 'cross-framework-id'
    | 'duplicate-conflict'
    | 'unsupported-format-version';
  id?: string;
  message: string;
};

/**
 * Merged, validated, read-only view over the registered packs. **TAGS ONLY.**
 */
export interface UniverseRegistry {
  frameworks(): FrameworkId[];
  /**
   * Tags applying to a role, ordered. Role specialisation is resolved with
   * `roleIsA` against the framework's own `RoleDefs`, which the caller supplies
   * — the registry holds no role vocabulary of its own.
   */
  tagsForRole(roleId: RoleId, defs: RoleDefs): TagDef[];
  tag(id: string): TagDef | undefined;
  /** Every merged tag, ordered. */
  tags(): TagDef[];
  /** Seed-time problems. Never thrown. */
  issues(): UniverseDefIssue[];
}

/**
 * Variant-parameterized: **one registration per pack, keyed by `packId`** —
 * the same mechanism as `SpotlightHostExtension(elementType)` and
 * `ExternalGroupByConfigProvider(config.name)`.
 */
export const UniverseTagDefsProvider = createIdentifier<UniverseTagDefs>(
  'LabreUniverseTagDefs'
);

/**
 * Seed one or more packs.
 *
 * `di.override`, **not** `di.addImpl`: `addImpl` throws
 * `DuplicateServiceDefinitionError` when the same `[scope, identifier, variant]`
 * is registered twice, while `override` works whether or not a prior
 * registration exists. That is exactly the idempotency this needs — **distinct
 * `packId`s accumulate, identical `packId`s replace** — so a host that
 * re-registers on every render never throws and never grows the registry.
 *
 * Order stability is load-bearing and non-obvious: `getAll` returns a
 * `Map<ServiceVariant, T>`, and `Map.set` on an EXISTING key keeps that key's
 * original insertion position. Re-seeding a pack therefore updates it in place
 * rather than moving it to the end, so a re-registration cannot silently flip
 * which pack wins a cosmetic field.
 *
 * **All packs MUST be registered in the same DI scope.** `getAllRaw` falls back
 * to the parent scope only when the current scope has no registration for the
 * identifier AT ALL; it never merges across scopes. Seeding one pack from a
 * `StoreExtension` and another from a `ViewExtension` would silently hide the
 * first behind the second. The library cannot enforce this, so it is stated
 * here and belongs in the host integration checklist.
 */
export function UniverseTagDefsExtension(
  defs: UniverseTagDefs | UniverseTagDefs[]
): ExtensionType {
  return {
    setup: di => {
      for (const pack of Array.isArray(defs) ? defs : [defs]) {
        di.override(UniverseTagDefsProvider(pack.packId), () => pack);
      }
    },
  };
}

/** `'wardley:nature'` → `'wardley'`. */
const namespaceOf = (id: string) => id.split(':')[0] ?? '';

/** `'wardley:nature/data'` → `'wardley:nature'`. */
const tagOfValue = (valueId: string) => valueId.split('/')[0] ?? '';

type Draft = {
  def: TagDef;
  /** Value defs by value id, in first-seen order. */
  values: Map<string, TagValueDef> | 'open';
  appliesTo: Set<RoleId> | '*';
  /** Declaration rank, for stable ties. */
  rank: number;
};

/**
 * Merge every registered pack into one read-only view.
 *
 * Pure, so it is testable with literals and no container. The merge rules, in
 * full:
 *
 * - **Union by id.** Several packs may extend the same universe.
 * - **Additive fields merge:** `values` are unioned by value id, `appliesTo`
 *   arrays are unioned, and `'*'` absorbs any list.
 * - **Cosmetic fields — last pack wins:** `label`, `description`, `color`,
 *   `order`, `required`, `deprecated`.
 * - **Structural fields — first pack wins, conflict recorded:** `cardinality`,
 *   and `values: 'open'` vs a closed list. The conflict becomes a
 *   `duplicate-conflict` error issue and does NOT throw. A host that needs a
 *   deterministic winner should not define the same structural field twice; the
 *   registry reports the collision rather than guessing.
 * - **Idempotent by value.** Activating a universe twice yields the same
 *   registry.
 */
export function buildUniverseRegistry(
  packs: readonly UniverseTagDefs[]
): UniverseRegistry {
  const issues: UniverseDefIssue[] = [];
  const drafts = new Map<string, Draft>();
  const frameworks: FrameworkId[] = [];
  let rank = 0;

  const issue = (
    severity: UniverseDefIssue['severity'],
    code: UniverseDefIssue['code'],
    message: string,
    id?: string
  ) =>
    issues.push(
      id === undefined
        ? { severity, code, message }
        : { severity, code, id, message }
    );

  for (const pack of packs) {
    if (pack?.formatVersion !== 1) {
      // The WHOLE pack is dropped: a format we do not understand may mean
      // anything. Documents still open; the tooling is simply unavailable.
      issue(
        'error',
        'unsupported-format-version',
        `Pack "${pack?.packId ?? '<unnamed>'}" declares formatVersion ${String(
          pack?.formatVersion
        )}; this build understands 1. The pack is ignored.`,
        pack?.packId
      );
      continue;
    }

    if (!(FRAMEWORK_IDS as readonly string[]).includes(pack.framework)) {
      issue(
        'warning',
        'cross-framework-id',
        `Pack "${pack.packId}" declares the unknown framework "${pack.framework}".`,
        pack.packId
      );
    }
    if (!frameworks.includes(pack.framework)) frameworks.push(pack.framework);

    for (const def of pack.tags ?? []) {
      if (typeof def?.id !== 'string' || !ID_PATTERN.test(def.id)) {
        issue(
          'error',
          'invalid-id',
          `Tag id "${String(def?.id)}" in pack "${pack.packId}" is not a well-formed '<framework>:<local>' id.`,
          typeof def?.id === 'string' ? def.id : undefined
        );
        continue;
      }
      // The `<framework>` segment of every id in a pack MUST equal the pack's
      // own framework. A cross-framework id is how one taxonomy would quietly
      // start answering for another's roles.
      if (namespaceOf(def.id) !== pack.framework) {
        issue(
          'error',
          'cross-framework-id',
          `Tag "${def.id}" is namespaced "${namespaceOf(def.id)}" but pack "${pack.packId}" declares framework "${pack.framework}".`,
          def.id
        );
        continue;
      }

      mergeTagDef(drafts, def, pack, issue, rank++);
    }
  }

  const merged = [...drafts.values()]
    .map(draft => finishDraft(draft))
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        drafts.get(a.id)!.rank - drafts.get(b.id)!.rank ||
        a.id.localeCompare(b.id)
    );
  // Keyed by plain `string`, not by `QualifiedId`: a lookup comes from a
  // DOCUMENT, which may carry any id at all, and the template-literal type is a
  // seed-time aid rather than a claim about what is persisted.
  const byId = new Map<string, TagDef>(merged.map(def => [def.id, def]));

  return {
    frameworks: () => [...frameworks],
    tags: () => [...merged],
    tag: id => byId.get(id),
    tagsForRole: (roleId, defs) =>
      merged.filter(def => tagAppliesToRole(def, roleId, defs)),
    issues: () => [...issues],
  };
}

function mergeTagDef(
  drafts: Map<string, Draft>,
  def: TagDef,
  pack: UniverseTagDefs,
  issue: (
    severity: UniverseDefIssue['severity'],
    code: UniverseDefIssue['code'],
    message: string,
    id?: string
  ) => void,
  rank: number
) {
  const existing = drafts.get(def.id);

  if (!existing) {
    drafts.set(def.id, {
      def: { ...def },
      values: valueMapOf(def, pack, issue),
      appliesTo: appliesToOf(def),
      rank,
    });
    return;
  }

  // Cosmetic: last pack wins. Absent stays absent rather than blanking what an
  // earlier pack said.
  const draft = existing.def;
  if (def.label !== undefined) draft.label = def.label;
  if (def.description !== undefined) draft.description = def.description;
  if (def.order !== undefined) draft.order = def.order;
  if (def.required !== undefined) draft.required = def.required;
  if (def.deprecated !== undefined) draft.deprecated = def.deprecated;

  // Structural: first pack wins, and the collision is REPORTED rather than
  // guessed at.
  if (def.cardinality !== draft.cardinality) {
    issue(
      'error',
      'duplicate-conflict',
      `Tag "${def.id}": pack "${pack.packId}" declares cardinality "${def.cardinality}" but "${draft.cardinality}" was declared first and stands.`,
      def.id
    );
  }

  const incomingOpen = def.values === 'open';
  const existingOpen = existing.values === 'open';
  if (incomingOpen !== existingOpen) {
    issue(
      'error',
      'duplicate-conflict',
      `Tag "${def.id}": pack "${pack.packId}" declares ${
        incomingOpen ? 'an open value list' : 'a closed value list'
      } but the opposite was declared first and stands.`,
      def.id
    );
  } else if (existing.values !== 'open') {
    // Additive: values union by value id, last cosmetic wins.
    for (const [valueId, value] of valueMapOf(def, pack, issue) as Map<
      string,
      TagValueDef
    >) {
      const current = existing.values.get(valueId);
      existing.values.set(valueId, current ? { ...current, ...value } : value);
    }
  }

  // Additive: `'*'` absorbs any list, in either direction.
  const incomingRoles = appliesToOf(def);
  if (existing.appliesTo !== '*') {
    if (incomingRoles === '*') existing.appliesTo = '*';
    else for (const role of incomingRoles) existing.appliesTo.add(role);
  }
}

function valueMapOf(
  def: TagDef,
  pack: UniverseTagDefs,
  issue: (
    severity: UniverseDefIssue['severity'],
    code: UniverseDefIssue['code'],
    message: string,
    id?: string
  ) => void
): Map<string, TagValueDef> | 'open' {
  if (def.values === 'open') return 'open';

  const values = new Map<string, TagValueDef>();
  for (const value of def.values ?? []) {
    if (typeof value?.id !== 'string' || !ID_PATTERN.test(value.id)) {
      issue(
        'error',
        'invalid-id',
        `Value id "${String(value?.id)}" of tag "${def.id}" in pack "${pack.packId}" is not a well-formed '<tagId>/<local>' id.`,
        typeof value?.id === 'string' ? value.id : undefined
      );
      continue;
    }
    // A value belongs to its tag, spelled out in the id itself. Anything else
    // would let a pack file a value under a tag it does not own.
    if (tagOfValue(value.id) !== def.id) {
      issue(
        'error',
        'invalid-id',
        `Value "${value.id}" is not a value of tag "${def.id}".`,
        value.id
      );
      continue;
    }
    values.set(value.id, { ...value });
  }
  return values;
}

const appliesToOf = (def: TagDef): Set<RoleId> | '*' =>
  def.appliesTo === '*' ? '*' : new Set(def.appliesTo ?? []);

function finishDraft(draft: Draft): TagDef {
  return {
    ...draft.def,
    values: draft.values === 'open' ? 'open' : [...draft.values.values()],
    appliesTo: draft.appliesTo === '*' ? '*' : [...draft.appliesTo],
  };
}

/**
 * Whether a tag qualifies a role, following specialisation: a tag declared on
 * `'wardley:component'` also applies to `'wardley:market'`, which specialises
 * it. `'*'` matches every role of the tag's own framework and nothing else —
 * a wildcard that crossed framework boundaries would make two taxonomies
 * qualify each other's elements.
 */
export function tagAppliesToRole(
  def: TagDef,
  roleId: RoleId | undefined,
  defs: RoleDefs
): boolean {
  if (!roleId) return false;
  if (def.appliesTo === '*') return namespaceOf(roleId) === namespaceOf(def.id);
  return def.appliesTo.some(ancestor => roleIsA(roleId, ancestor, defs));
}

/**
 * The merged registry for this editor assembly.
 *
 * Memoized per `BlockStdScope`: the merge is pure and the packs are fixed at
 * assembly time, while callers (a toolbar section rebuilt on every selection
 * change) ask for it often. A host that re-seeds a pack after the first read
 * therefore needs a new scope — which is what re-creating the editor already
 * does, and the only cost of not re-validating a static configuration on every
 * keystroke.
 */
const REGISTRY_CACHE = new WeakMap<BlockStdScope, UniverseRegistry>();

export function getUniverseRegistry(std: BlockStdScope): UniverseRegistry {
  const cached = REGISTRY_CACHE.get(std);
  if (cached) return cached;

  const packs = [...std.provider.getAll(UniverseTagDefsProvider).values()];
  const registry = buildUniverseRegistry(packs);
  REGISTRY_CACHE.set(std, registry);
  return registry;
}
