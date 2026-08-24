/**
 * Semantic roles for surface elements — the vocabulary side of PF1.
 *
 * A role is the ONLY semantic identity of an element. Validation rules are
 * written against roles, never against a shape type: two artefacts drawn with
 * the same ellipse can carry different roles, and a role can be re-skinned
 * without touching a single rule.
 *
 * A role id is namespaced by its framework — `<framework>:<role>`, e.g.
 * `wardley:component`. The neutral role (a generalist square, triangle or free
 * text) is the ABSENCE of a role: nothing is written on generic elements, and
 * documents authored before this field existed read as neutral.
 *
 * The role itself is stored as a flat string on
 * {@link GfxPrimitiveElementModel.role}. The vocabulary below is declarative
 * DATA, not TS class inheritance: a framework declares its roles (and their
 * specialisation links) in a plain module, so the framework core never has to
 * know the concrete roles, and a rule written on a parent role applies to its
 * children via {@link roleIsA}.
 */

import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';

/**
 * Namespaced role identifier, `<framework>:<role>`.
 *
 * Deliberately a plain `string` for now: the framework half is spelled several
 * different ways across the codebase and no canonical `FrameworkId` type
 * exists yet. When one lands, this should become `` `${FrameworkId}:${string}` ``
 * so the namespace is checked, not just the shape.
 */
export type RoleId = string;

/**
 * What SHAPE of thing a role describes — and therefore what geometry a rule
 * measures it with.
 *
 * - `node` — a surface element, measured by its bounds.
 * - `edge` — a connector, measured along its path: the bounding box of a
 *   diagonal link covers half the map.
 * - `text` — a free text element, measured by the INK its text actually
 *   occupies. A text box is created at a width that has nothing to do with its
 *   content (a Wardley label is 120–200 units wide whatever it says), so its
 *   box is not a statement about what the eye can see.
 */
export type RoleKind = 'node' | 'edge' | 'text';

/**
 * What an EDGE role says about its own orientation — tier 1 of `docs/adr/0010`,
 * written down where the vocabulary is rather than in the head of whoever
 * drew the link:
 *
 * > An edge role names a **relation with a verb**. `source` is the subject of
 * > that verb, `target` is its object. Reading an edge is reading one sentence:
 * > `source` _verb_ `target`.
 *
 * Declared here so the three mechanisms of that ADR can be generic: the tool
 * hint that ANNOUNCES the gesture (M1), the hover/selection reveal that SHOWS
 * the orientation (M2) and the inversion command that lets the user FIX it
 * (M3) all read this and never a framework's name. A `node` role has no
 * business declaring one; an edge role that declares none simply reveals its
 * label and no sentence.
 *
 * Keys plus the framework's own wording, exactly like a rule's message and a
 * background's labels: the library never invents prose, a host with a
 * catalogue always wins, and a catalogue-less playground still reads.
 */
export interface EdgeDirectionDef {
  /** i18n key of the verb — `'depends on'`. Resolved by the host. */
  verbKey: string;
  /** The framework's own wording for {@link verbKey}. */
  verbFallback?: string;
  /**
   * i18n key of the sentence that tells a user which way to DRAW the edge —
   * "drag from the component that has the need to what it needs" (M1).
   * Absent means the tool announces nothing, which is what every edge did
   * before this ADR.
   */
  gestureHintKey?: string;
  /** The framework's own wording for {@link gestureHintKey}. */
  gestureHintFallback?: string;
}

export interface RoleDef {
  /** Namespaced id, `<framework>:<role>`. */
  id: RoleId;
  /**
   * The role this one specialises, if any. A rule written on the parent role
   * applies to every descendant — see {@link roleIsA}.
   */
  parent?: RoleId;
  kind: RoleKind;
  /** i18n key of the human label; resolved by the host app. */
  labelKey?: string;
  /**
   * The framework's own wording for {@link labelKey}, for a host that ships no
   * catalogue. Same seam and same rule as everywhere else in this library.
   */
  labelFallback?: string;
  /** `edge` roles only: the verb the relation is read with. See {@link EdgeDirectionDef}. */
  direction?: EdgeDirectionDef;
}

/** A framework's role vocabulary, indexed by role id. */
export type RoleDefs = Readonly<Record<RoleId, RoleDef>>;

/**
 * Deepest specialisation chain {@link roleIsA} walks. Real vocabularies are
 * one or two levels deep; the bound exists so a malformed `parent` cycle
 * cannot hang the caller. Chains longer than this are NOT supported.
 */
const MAX_ROLE_DEPTH = 32;

/**
 * Is `roleId` the `ancestorId` role, or a specialisation of it?
 *
 * ```ts
 * roleIsA('wardley:market', 'wardley:component', WARDLEY_ROLES); // true
 * roleIsA('wardley:component', 'wardley:market', WARDLEY_ROLES); // false
 * ```
 *
 * A neutral element (`undefined`) is never any role. Roles absent from `defs`
 * only match themselves. Allocation-free: rules call this per element, per
 * rule.
 */
export function roleIsA(
  roleId: RoleId | undefined,
  ancestorId: RoleId,
  defs: RoleDefs
): boolean {
  let current = roleId;

  for (let hops = 0; current !== undefined; hops++) {
    if (current === ancestorId) return true;

    if (hops >= MAX_ROLE_DEPTH) {
      // Either a `parent` cycle or a vocabulary deeper than we support —
      // both are authoring bugs in the defs. Give up rather than hang, and
      // say so instead of silently answering "no".
      console.warn(
        `roleIsA: gave up on the parent chain of "${roleId}" after ` +
          `${MAX_ROLE_DEPTH} hops — cycle or over-deep vocabulary?`
      );
      return false;
    }

    current = defs[current]?.parent;
  }

  return false;
}

/**
 * A framework publishes its role vocabulary here, and nothing else publishes
 * one. Multi-instance: one registered {@link RoleDefs} per framework.
 *
 * Registered from the framework's ALWAYS-ON render extension, never from its
 * flag-gated one (`docs/adr/0009`). A role is not tooling: it is written in the
 * document, and what reads it back — the direction reveal, the inversion
 * command, the toolbar entry that must NOT lie about a typed edge — has to keep
 * working on a map drawn while the flag was on and opened while it is off.
 * Validation rules are the tooling half and stay where they are.
 */
export const RoleVocabularyIdentifier =
  createIdentifier<RoleDefs>('RoleVocabulary');

let _vocabularyId = 1;

/**
 * Register a framework's role vocabulary.
 *
 * ```ts
 * context.register(RoleVocabularyExtension(WARDLEY_ROLES));
 * ```
 */
export function RoleVocabularyExtension(defs: RoleDefs): ExtensionType {
  return {
    setup: di => {
      di.addImpl(RoleVocabularyIdentifier(`RoleVocabulary-${_vocabularyId++}`), () => defs);
    },
  };
}

/**
 * The declaration of `roleId` among the registered vocabularies, or
 * `undefined` — for a neutral element, for a role whose framework registered
 * nothing, and for a role that no longer exists.
 *
 * Takes the vocabularies rather than a `BlockStdScope` on purpose: this file is
 * the vocabulary side of PF1 and has no business importing the editor scope.
 * Callers hand in
 * `[...std.provider.getAll(RoleVocabularyIdentifier).values()]`.
 */
export function findRoleDef(
  vocabularies: readonly RoleDefs[],
  roleId: RoleId | undefined
): RoleDef | undefined {
  if (roleId === undefined) return undefined;
  for (const defs of vocabularies) {
    const def = defs[roleId];
    if (def !== undefined) return def;
  }
  return undefined;
}

/**
 * Is this element's role a TYPED EDGE, i.e. a declared role of `kind: 'edge'`?
 *
 * The one predicate `docs/adr/0010` turns on: for such an element the persisted
 * `source → target` pair IS the relation's orientation and part of the
 * document's meaning. Everything else — a generalist connector, a decoration,
 * an element whose framework is not loaded — answers `false` and keeps the two
 * ends it always had, carrying no claim.
 */
export function isTypedEdgeRole(
  vocabularies: readonly RoleDefs[],
  roleId: RoleId | undefined
): boolean {
  return findRoleDef(vocabularies, roleId)?.kind === 'edge';
}
