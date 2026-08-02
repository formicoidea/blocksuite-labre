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
