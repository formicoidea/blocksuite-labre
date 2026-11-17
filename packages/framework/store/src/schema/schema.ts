import { SCHEMA_NOT_FOUND_MESSAGE } from '../consts.js';
import { BlockSchema, type BlockSchemaType } from '../model/index.js';
import { SchemaValidateError } from './error.js';

function escapeRegExp(text: string) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Matches a flavour against a pattern of a schema's `parent` / `children`
 * list, with the answers `minimatch` gave on the patterns the schemas use
 * (issue #667, which dropped the dependency for the `brace-expansion`
 * advisories it carried into the published core). `*` matches any run of
 * characters but `/`; a trailing `!(a|b)` matches any run but `/` that is
 * none of the alternatives (`affine:embed-!(synced-doc)` in the edgeless
 * text schema); everything else is literal and the match is anchored.
 * Pinned by `schema-flavour-pattern.unit.spec.ts`.
 *
 * ponytail: `*` and a trailing `!(literal|…)` only. `?`, classes, braces,
 * a `!(…)` followed by more pattern and glob alternatives inside `!(…)` are
 * literal, `**` acts as `*`, and minimatch's dot and empty-segment rules for
 * `*` are not mirrored (every flavour is `scope:name`). A schema that needs
 * more adds it here with a case in the guard spec, not a glob dependency.
 */
function matchFlavourPattern(flavour: string, pattern: string): boolean {
  const negation = '!(';
  const open = pattern.endsWith(')') ? pattern.lastIndexOf(negation) : -1;
  const head = open === -1 ? pattern : pattern.slice(0, open);
  const body = head.split('*').map(escapeRegExp).join('[^/]*');
  const excluded = pattern.slice(open + negation.length, -1).split('|');
  const tail =
    open === -1 ? '' : `(?!(?:${excluded.map(escapeRegExp).join('|')})$)[^/]*`;
  // "affine:embed-!(synced-doc)" accepts "affine:embed-github" and rejects
  // "affine:embed-synced-doc"; "affine:embed-*" rejects "affine:embedx".
  return new RegExp(`^${body}${tail}$`).test(flavour);
}

/**
 * Represents a schema manager for block flavours and their relationships.
 * Provides methods to register, validate, and query block schemas.
 */
export class Schema {
  /**
   * A map storing block flavour names to their corresponding schema definitions.
   */
  readonly flavourSchemaMap = new Map<string, BlockSchemaType>();

  /**
   * Safely validates the schema relationship for a given flavour, parent, and children.
   * Returns true if valid, false otherwise (does not throw).
   *
   * @param flavour - The block flavour to validate.
   * @param parentFlavour - The parent block flavour (optional).
   * @param childFlavours - The child block flavours (optional).
   * @returns True if the schema relationship is valid, false otherwise.
   */
  safeValidate = (
    flavour: string,
    parentFlavour?: string,
    childFlavours?: string[]
  ): boolean => {
    try {
      this.validate(flavour, parentFlavour, childFlavours);
      return true;
    } catch {
      return false;
    }
  };

  /**
   * Retrieves the schema for a given block flavour.
   *
   * @param flavour - The block flavour name.
   * @returns The corresponding BlockSchemaType or undefined if not found.
   */
  get(flavour: string) {
    return this.flavourSchemaMap.get(flavour);
  }

  /**
   * Validates the schema relationship for a given flavour, parent, and children.
   * Throws SchemaValidateError if invalid.
   *
   * @param flavour - The block flavour to validate.
   * @param parentFlavour - The parent block flavour (optional).
   * @param childFlavours - The child block flavours (optional).
   * @throws {SchemaValidateError} If the schema relationship is invalid.
   */
  validate = (
    flavour: string,
    parentFlavour?: string,
    childFlavours?: string[]
  ): void => {
    const schema = this.flavourSchemaMap.get(flavour);
    if (!schema) {
      throw new SchemaValidateError(flavour, SCHEMA_NOT_FOUND_MESSAGE);
    }

    const validateChildren = () => {
      childFlavours?.forEach(childFlavour => {
        const childSchema = this.flavourSchemaMap.get(childFlavour);
        if (!childSchema) {
          throw new SchemaValidateError(childFlavour, SCHEMA_NOT_FOUND_MESSAGE);
        }
        this.validateSchema(childSchema, schema);
      });
    };

    if (schema.model.role === 'root') {
      if (parentFlavour) {
        throw new SchemaValidateError(
          schema.model.flavour,
          'Root block cannot have parent.'
        );
      }

      validateChildren();
      return;
    }

    if (!parentFlavour) {
      throw new SchemaValidateError(
        schema.model.flavour,
        'None root block must have parent.'
      );
    }

    const parentSchema = this.flavourSchemaMap.get(parentFlavour);
    if (!parentSchema) {
      throw new SchemaValidateError(parentFlavour, SCHEMA_NOT_FOUND_MESSAGE);
    }
    this.validateSchema(schema, parentSchema);
    validateChildren();
  };

  /**
   * Returns an object mapping each registered flavour to its version number.
   */
  get versions() {
    return Object.fromEntries(
      Array.from(this.flavourSchemaMap.values()).map(
        (schema): [string, number] => [schema.model.flavour, schema.version]
      )
    );
  }

  /**
   * Checks if two flavours match, either one read as a pattern
   * (`matchFlavourPattern`).
   *
   * @param childFlavour - The child block flavour.
   * @param parentFlavour - The parent block flavour.
   * @returns True if the flavours match, false otherwise.
   */
  private _matchFlavour(childFlavour: string, parentFlavour: string) {
    return (
      matchFlavourPattern(childFlavour, parentFlavour) ||
      matchFlavourPattern(parentFlavour, childFlavour)
    );
  }

  /**
   * Checks if two values match as either flavours or roles, supporting role syntax (e.g., '@role').
   *
   * @param childValue - The child value (flavour or role).
   * @param parentValue - The parent value (flavour or role).
   * @param childRole - The actual role of the child.
   * @param parentRole - The actual role of the parent.
   * @returns True if the values match as flavours or roles, false otherwise.
   */
  private _matchFlavourOrRole(
    childValue: string,
    parentValue: string,
    childRole: string,
    parentRole: string
  ): boolean {
    // Check if either value starts with '@' indicating it's a role
    const isChildRole = childValue.startsWith('@');
    const isParentRole = parentValue.startsWith('@');

    // If both are roles, do exact match
    if (isChildRole && isParentRole) {
      return childValue === parentValue;
    }
    // If child is role, compare with parent's actual role
    if (isChildRole) {
      return childValue === `@${parentRole}`;
    }
    // If parent is role, compare with child's actual role
    if (isParentRole) {
      return parentValue === `@${childRole}`;
    }
    // If neither is role, use flavour matching
    return this._matchFlavour(childValue, parentValue);
  }

  /**
   * Validates if the parent schema is a valid parent for the child schema.
   *
   * @param child - The child block schema.
   * @param parent - The parent block schema.
   * @returns True if the parent is valid for the child, false otherwise.
   */
  private _validateParent(
    child: BlockSchemaType,
    parent: BlockSchemaType
  ): boolean {
    const _childFlavour = child.model.flavour;
    const _parentFlavour = parent.model.flavour;
    const _childRole = child.model.role;
    const _parentRole = parent.model.role;

    const childValidFlavourOrRole = child.model.parent || ['*'];
    const parentValidFlavourOrRole = parent.model.children || ['*'];

    return parentValidFlavourOrRole.some(parentValidFlavourOrRole => {
      return childValidFlavourOrRole.some(childValidFlavourOrRole => {
        if (
          parentValidFlavourOrRole === '*' &&
          childValidFlavourOrRole === '*'
        ) {
          return true;
        }

        if (parentValidFlavourOrRole === '*') {
          return this._matchFlavourOrRole(
            childValidFlavourOrRole,
            _parentFlavour,
            _childRole,
            _parentRole
          );
        }

        if (childValidFlavourOrRole === '*') {
          return this._matchFlavourOrRole(
            _childFlavour,
            parentValidFlavourOrRole,
            _childRole,
            _parentRole
          );
        }

        return (
          this._matchFlavourOrRole(
            _childFlavour,
            parentValidFlavourOrRole,
            _childRole,
            _parentRole
          ) &&
          this._matchFlavourOrRole(
            childValidFlavourOrRole,
            _parentFlavour,
            _childRole,
            _parentRole
          )
        );
      });
    });
  }

  /**
   * Validates the role relationship between child and parent schemas.
   * Throws if the child is a root block but has a parent.
   *
   * @param child - The child block schema.
   * @param parent - The parent block schema.
   * @throws {SchemaValidateError} If the child is a root block with a parent.
   */
  private _validateRole(child: BlockSchemaType, parent: BlockSchemaType) {
    const childRole = child.model.role;
    const childFlavour = child.model.flavour;
    const parentFlavour = parent.model.flavour;

    if (childRole === 'root') {
      throw new SchemaValidateError(
        childFlavour,
        `Root block cannot have parent: ${parentFlavour}.`
      );
    }
  }

  /**
   * Checks if the child flavour is valid under the parent flavour.
   *
   * @param child - The child block flavour name.
   * @param parent - The parent block flavour name.
   * @returns True if the relationship is valid, false otherwise.
   */
  isValid(child: string, parent: string) {
    const childSchema = this.flavourSchemaMap.get(child);
    const parentSchema = this.flavourSchemaMap.get(parent);
    if (!childSchema || !parentSchema) {
      return false;
    }
    try {
      this.validateSchema(childSchema, parentSchema);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Registers an array of block schemas into the schema manager.
   *
   * @param blockSchema - An array of block schema definitions to register.
   * @returns The Schema instance (for chaining).
   */
  register(blockSchema: BlockSchemaType[]) {
    blockSchema.forEach(schema => {
      BlockSchema.parse(schema);
      this.flavourSchemaMap.set(schema.model.flavour, schema);
    });
    return this;
  }

  /**
   * Serializes the schema map to a plain object for JSON output.
   *
   * @returns An object mapping each flavour to its role, parent, and children.
   */
  toJSON() {
    return Object.fromEntries(
      Array.from(this.flavourSchemaMap.values()).map(
        (schema): [string, Record<string, unknown>] => [
          schema.model.flavour,
          {
            role: schema.model.role,
            parent: schema.model.parent,
            children: schema.model.children,
          },
        ]
      )
    );
  }

  /**
   * Validates the relationship between a child and parent schema.
   * Throws if the relationship is invalid.
   *
   * @param child - The child block schema.
   * @param parent - The parent block schema.
   * @throws {SchemaValidateError} If the relationship is invalid.
   */
  validateSchema(child: BlockSchemaType, parent: BlockSchemaType) {
    this._validateRole(child, parent);

    const relationCheckSuccess = this._validateParent(child, parent);

    if (!relationCheckSuccess) {
      throw new SchemaValidateError(
        child.model.flavour,
        `Block cannot have parent: ${parent.model.flavour}.`
      );
    }
  }
}
