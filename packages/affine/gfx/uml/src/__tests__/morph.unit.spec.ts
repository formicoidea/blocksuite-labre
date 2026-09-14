import {
  GroupElementModel,
  ShapeElementModel,
  StrokeStyle,
  UmlDiagramElementModel,
  UmlNodeElementModel,
  type UmlNodeKind,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { UML_NODE_BOX } from '../consts.js';
import { guillemets, UML_NAME_SEED } from '../keywords.js';
import {
  UML_MORPH_FAMILIES,
  UML_MORPH_SPEC,
  umlMorphedName,
  umlNodeOfGroup,
} from '../morph.js';
import { umlMorphClears, umlMorphProps, umlNodeProps } from '../presets.js';
import { UML_ROLE_OF_KIND } from '../roles.js';

/**
 * What a UML classifier may BECOME — the framework's half of the morph.
 *
 * The generic half (when the dropdown stands up, what one pick writes, that the
 * two composite hooks are honoured) is the surface package's; this file is about
 * the DATA: which kinds are reachable from which, that the patch is the
 * toolbox's own and not a second table, that a selected group resolves to the
 * one shape the kind lives on, and that the name compartment keeps saying what
 * the rectangle now is.
 */

const EVERY_KIND = Object.keys(UML_NODE_BOX) as UmlNodeKind[];
const FAMILY_MEMBERS = UML_MORPH_FAMILIES.flat();

describe('the declared families', () => {
  it('is a TOTAL partition of the pack: every kind, exactly once', () => {
    // Stronger than C4's equivalent, and deliberately so: UML declares its
    // solitary kinds rather than omitting them, so a kind added to the pack
    // cannot be silently left out of this decision — it fails here until
    // somebody says which family it belongs to, or that it belongs to none.
    for (const kind of FAMILY_MEMBERS) expect(EVERY_KIND).toContain(kind);
    expect(new Set(FAMILY_MEMBERS).size).toBe(FAMILY_MEMBERS.length);
    // Copies, not `.sort()` on the shared arrays: sorting in place would leave
    // every later case in this file reading a table this one reordered.
    expect([...FAMILY_MEMBERS].sort()).toEqual([...EVERY_KIND].sort());
  });

  it('puts the one picture UML draws three ways in one family', () => {
    // §9.5.4: a class, an interface and an enumeration are the SAME divided
    // rectangle, told apart by the keyword above the name. Declaration order is
    // menu order and it opens on the plain class.
    expect(UML_MORPH_FAMILIES[0]).toEqual([
      'class',
      'interface',
      'enumeration',
    ]);
  });

  it('puts the one BOX UML draws three ways in the second family', () => {
    // §19.4.4: a node, a device and an execution environment are the SAME cube,
    // told apart by `«device»` / `«executionEnvironment»` over the name. The
    // same statement as the classifier family, in a different clause — and it
    // opens on the plain node for the same reason.
    expect(UML_MORPH_FAMILIES).toContainEqual([
      'node',
      'device',
      'execution-environment',
    ]);
  });

  it('leaves the solitary kinds alone, and offers no menu for them', () => {
    // An object is an instance, a package a namespace, a note a comment, an
    // actor and a use case a behaviour diagram's furniture; a component is
    // announced by a mark rather than a keyword, an artifact is a file, a port
    // is a property of its owner, and the ball and the socket are two DIFFERENT
    // drawings. Each is declared alone — and a family of one has nothing to
    // offer, so the SPEC does not carry it: a dropdown whose only option is what
    // is already selected is a control that cannot do anything.
    for (const kind of [
      'object',
      'package',
      'note',
      'actor',
      'use-case',
      'component',
      'artifact',
      'port',
      'provided-interface',
      'required-interface',
    ]) {
      expect(UML_MORPH_FAMILIES).toContainEqual([kind]);
      expect(UML_MORPH_SPEC.families.flat()).not.toContain(kind);
    }
    // Exactly the families with something to say, in declaration order.
    expect(UML_MORPH_SPEC.families).toEqual(
      UML_MORPH_FAMILIES.filter(family => family.length > 1)
    );
    expect(UML_MORPH_SPEC.families).toHaveLength(2);
  });
});

/**
 * The claim that makes a family cheap: a morph inside one needs no re-layout, so
 * the geometry the module promises not to touch is genuinely untouched.
 */
describe('a family is geometry-preserving by construction', () => {
  it('shares one footprint inside every OFFERED family', () => {
    // The claim that makes a morph cheap, and it has to hold for the deployment
    // cubes as well as for the classifiers: a swap inside a family moves
    // nothing, so nothing has to be laid out again afterwards.
    for (const family of UML_MORPH_SPEC.families) {
      const [first, ...rest] = family;
      for (const kind of rest) {
        expect(UML_NODE_BOX[kind], `${first} → ${kind}`).toEqual(
          UML_NODE_BOX[first]
        );
      }
    }
  });

  it('shares one silhouette inside every offered family', () => {
    // The whole point of a family: nobody in it is drawn differently from
    // anybody else, so the morph never has to stop or start the shape layer
    // painting — the keyword line does all the work a reader sees. The
    // classifiers are native filled rectangles; the cubes are GLYPH-bodied
    // (`presets.ts`), so their three are alike in the opposite way, and this
    // asserts the likeness rather than the value.
    for (const family of UML_MORPH_SPEC.families) {
      const [first, ...rest] = family;
      const reference = umlMorphProps(first);
      for (const kind of rest) {
        const props = umlMorphProps(kind);
        for (const key of ['shapeType', 'filled', 'strokeStyle'] as const) {
          expect(props[key], `${kind}.${key}`).toEqual(reference[key]);
        }
      }
    }
  });

  it('draws the classifier family as the native filled rectangle', () => {
    for (const kind of UML_MORPH_FAMILIES[0]) {
      const props = umlMorphProps(kind);
      expect(props.shapeType).toBe('rect');
      expect(props.filled).toBe(true);
      expect(props.strokeStyle).toBe(StrokeStyle.Solid);
    }
  });
});

describe('the patch one kind is worth', () => {
  it('is the creation builder, minus identity, geometry and words', () => {
    for (const kind of EVERY_KIND) {
      const created: Record<string, unknown> = {
        ...umlNodeProps(kind, { xywh: '[1,2,3,4]' }),
      };
      delete created.type;
      delete created.xywh;
      // Derived, not restated: the toolbox and the morph cannot drift.
      expect(umlMorphProps(kind)).toEqual(created);
    }
  });

  it('never carries type, xywh, text, source or target', () => {
    // The first three are the generic module's own contract. `source` and
    // `target` are here because the edge morph beside this one writes to a
    // CONNECTOR, and the node patch must never grow a key that would mean
    // something on one — the two specs are read by one `applyMorph`.
    for (const kind of EVERY_KIND) {
      const props = umlMorphProps(kind);
      for (const forbidden of ['type', 'xywh', 'text', 'source', 'target']) {
        expect(props).not.toHaveProperty(forbidden);
      }
      expect(props).toMatchObject({ kind, role: UML_ROLE_OF_KIND[kind] });
    }
  });

  it('has nothing to clear on this table, and says so by deriving it', () => {
    // No UML preset spreads a key conditionally: all eight write the same key
    // set with different values. The day one stops, this stops being empty.
    for (const kind of EVERY_KIND) expect(umlMorphClears(kind)).toEqual([]);
  });
});

/**
 * The NAME compartment, when the rectangle becomes another metaclass.
 *
 * Two rewrites and one rule: the notation's own words follow the shape, and
 * anything a human typed is theirs.
 */
describe('umlMorphedName — the keyword follows the shape, the name does not', () => {
  it('writes the target keyword above a name the author wrote', () => {
    // The case the brief names: the first line becomes «interface» and the
    // author's own name is still there, on the second.
    expect(umlMorphedName('class', 'interface', 'Payments')).toBe(
      `${guillemets('interface')}\nPayments`
    );
    const morphed = umlMorphedName('class', 'interface', 'Payments')!.split(
      '\n'
    );
    expect(morphed[0]).toBe('«interface»');
    expect(morphed[1]).toBe('Payments');
  });

  it('replaces the source keyword rather than stacking a second one', () => {
    expect(
      umlMorphedName('interface', 'enumeration', '«interface»\nPayments')
    ).toBe(`${guillemets('enumeration')}\nPayments`);
    // …and takes the keyword away entirely on the way back to a plain class,
    // which is what makes the rectangle mean a Class again (§9.5.4).
    expect(umlMorphedName('interface', 'class', '«interface»\nPayments')).toBe(
      'Payments'
    );
  });

  it('carries an untouched seed across, keyword and name together', () => {
    // What a classifier nobody has named still says, both halves of it.
    expect(umlMorphedName('class', 'interface', UML_NAME_SEED.class)).toBe(
      UML_NAME_SEED.interface
    );
    expect(
      umlMorphedName('interface', 'enumeration', UML_NAME_SEED.interface)
    ).toBe(UML_NAME_SEED.enumeration);
    expect(
      umlMorphedName('enumeration', 'class', UML_NAME_SEED.enumeration)
    ).toBe(UML_NAME_SEED.class);
    // Padding is not content: the compartment is read trimmed, as it is stored.
    expect(umlMorphedName('class', 'interface', '  Class  ')).toBe(
      UML_NAME_SEED.interface
    );
  });

  it('stamps the cube with §19.4.4 keyword, and keeps the name typed in it', () => {
    // The second family, and the same rule: a node has no keyword at all, a
    // device and an execution environment each have one, and the name — which
    // on a cube is written INSIDE the front face — is the author's.
    expect(umlMorphedName('node', 'device', UML_NAME_SEED.node)).toBe(
      UML_NAME_SEED.device
    );
    expect(umlMorphedName('node', 'device', ':AppServer')).toBe(
      `${guillemets('device')}\n:AppServer`
    );
    expect(
      umlMorphedName('device', 'execution-environment', ':AppServer')?.split(
        '\n'
      )
    ).toEqual(['«executionEnvironment»', ':AppServer']);
    // …and back to the plain node takes the keyword away, which is what makes
    // the box mean a Node again.
    expect(
      umlMorphedName('device', 'node', `${guillemets('device')}\n:AppServer`)
    ).toBe(':AppServer');
  });

  it('leaves a keyword the author wrote, and writes the new one above it', () => {
    // Annex C is explicit that not every word in guillemets is a keyword: a
    // stereotype goes in the same brackets. So only the SOURCE kind's own
    // keyword is ever dropped, and anything else is words on the picture.
    expect(umlMorphedName('class', 'interface', '«service»\nPayments')).toBe(
      `${guillemets('interface')}\n«service»\nPayments`
    );
  });

  it('is a no-op wherever there is nothing for the notation to say', () => {
    // A kind morphed to itself, and the five solitary kinds, which can only
    // ever be asked this question by a caller that has no menu to ask it from.
    for (const kind of EVERY_KIND) {
      expect(umlMorphedName(kind, kind, UML_NAME_SEED[kind])).toBeNull();
    }
    expect(umlMorphedName('class', 'class', 'Payments')).toBeNull();
  });

  it('is total over whatever a text element may hold', () => {
    // Empty, whitespace, absent: a name compartment somebody cleared is still a
    // classifier, and the keyword is still owed to it.
    expect(umlMorphedName('class', 'interface', '')).toBe('«interface»');
    expect(umlMorphedName('class', 'interface', '   ')).toBe('«interface»');
    expect(umlMorphedName('class', 'interface', null)).toBe('«interface»');
    expect(umlMorphedName('class', 'interface', undefined)).toBe('«interface»');
    expect(umlMorphedName('interface', 'class', '')).toBeNull();
  });
});

/* ── Resolving the composite ───────────────────────────────────────────── */

/**
 * A model built detached, the way the C4 morph suite builds one: the `instanceof`
 * gates the resolution runs are the shipped ones, and the accessors it reads are
 * defined as plain values rather than driven through a Yjs document that no unit
 * test has.
 */
function detached<T>(
  Ctor: abstract new (...args: never[]) => T,
  props: Record<string, unknown>
): T {
  const element = Object.create(Ctor.prototype) as object;
  for (const [key, value] of Object.entries(props)) {
    Object.defineProperty(element, key, { value, configurable: true });
  }
  return element as T;
}

const shape = (kind: UmlNodeKind) =>
  detached(UmlNodeElementModel, {
    kind,
  }) as unknown as GfxPrimitiveElementModel;

const group = (children: unknown[]) =>
  detached(GroupElementModel, {
    childElements: children,
  }) as unknown as GfxPrimitiveElementModel;

describe('resolving a selected group to its shape', () => {
  it('finds the one umlNode a classifier is built round', () => {
    const node = shape('class');
    // The three text tiers ride along and are ignored: what the resolution is
    // after is the element the kind lives on.
    const resolved = umlNodeOfGroup(group([{}, node, {}]));
    expect(resolved).toBe(node);
    expect(UML_MORPH_SPEC.kindOf(resolved!)).toBe('class');
  });

  it('refuses anything that is not a group', () => {
    expect(umlNodeOfGroup(shape('class'))).toBeUndefined();
    expect(
      umlNodeOfGroup(
        detached(
          UmlDiagramElementModel,
          {}
        ) as unknown as GfxPrimitiveElementModel
      )
    ).toBeUndefined();
  });

  it('refuses a group holding no UML shape at all', () => {
    // A plain lasso round three rectangles, and another framework's component
    // — a Wardley one is a group of a circle and its label.
    const alien = detached(ShapeElementModel, {}) as unknown;
    expect(umlNodeOfGroup(group([alien, {}]))).toBeUndefined();
    expect(umlNodeOfGroup(group([]))).toBeUndefined();
  });

  it('refuses a group holding two of them', () => {
    // Two classifiers grouped together: morphing "it" would mean picking one by
    // document order, and the honest answer to an ambiguous selection is none.
    expect(
      umlNodeOfGroup(group([shape('class'), shape('interface')]))
    ).toBeUndefined();
  });
});

describe('the spec handed to the generic module', () => {
  it('is declared on the GROUP, because that is what a click selects', () => {
    expect(UML_MORPH_SPEC.modelType).toBe(GroupElementModel);
    expect(UML_MORPH_SPEC.resolveTarget).toBe(umlNodeOfGroup);
    expect(UML_MORPH_SPEC.framework).toBe('uml');
  });

  it('reports the SHAPE roles, one per kind', () => {
    // No collapsing here, unlike C4's table: a class, an interface and an
    // enumeration are three metaclasses drawn alike, not one metaclass drawn
    // three ways, and the telemetry says exactly that.
    for (const kind of EVERY_KIND) {
      expect(UML_MORPH_SPEC.roleOf(kind)).toBe(UML_ROLE_OF_KIND[kind]);
    }
    expect(new Set(EVERY_KIND.map(UML_MORPH_SPEC.roleOf)).size).toBe(
      EVERY_KIND.length
    );
  });

  it('names and draws every kind from its own creation command', () => {
    // Reused rather than redrawn, so the dropdown says what the sub-menu entry
    // that draws one says.
    expect(UML_MORPH_SPEC.labelOf('interface')).toEqual({
      key: 'com.labre.commands.uml.addInterface',
      fallback: 'Interface',
    });
    for (const kind of EVERY_KIND) {
      expect(UML_MORPH_SPEC.labelOf(kind).key).toBeTruthy();
      expect(UML_MORPH_SPEC.iconOf(kind)).toBeTruthy();
    }
  });
});
