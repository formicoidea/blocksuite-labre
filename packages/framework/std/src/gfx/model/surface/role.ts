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

/** Namespaced role identifier, `<framework>:<role>`. */
export type RoleId = string;

/** Whether a role describes a node (a surface element) or an edge (a connector). */
export type RoleKind = 'node' | 'edge';

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
 * Is `roleId` the `ancestorId` role, or a specialisation of it?
 *
 * ```ts
 * roleIsA('wardley:market', 'wardley:component', WARDLEY_ROLES); // true
 * roleIsA('wardley:component', 'wardley:market', WARDLEY_ROLES); // false
 * ```
 *
 * A neutral element (`undefined`) is never any role. Roles absent from `defs`
 * only match themselves. A malformed `parent` cycle terminates instead of
 * hanging. Allocation-free: rules call this per element, per rule.
 */
export function roleIsA(
  roleId: RoleId | undefined,
  ancestorId: RoleId,
  defs: RoleDefs
): boolean {
  let current = roleId;

  // A specialisation chain is a handful of links deep; the bound only exists
  // so a malformed `parent` cycle cannot hang the caller.
  for (let hops = 0; current !== undefined && hops < 32; hops++) {
    if (current === ancestorId) return true;
    current = defs[current]?.parent;
  }

  return false;
}
