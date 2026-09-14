import { readElement, readingProfileFor } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  UML_ACTOR_READING,
  UML_CLASS_READING,
  UML_NOTE_READING,
  UML_PACKAGE_READING,
  UML_READINGS,
} from '../reading.js';
import { UML_ROLE, UML_ROLES } from '../roles.js';

/**
 * MF3 — what the UML declaration lets the tool read.
 *
 * The engine's own behaviour is tested in `blocks/surface`, against a made-up
 * framework. This one owns the DATA: that every artefact is readable, that the
 * two frames and the four written tiers are not, that the name comes off the
 * right sibling for each of them, and that a profile written on
 * `uml:association` reads the diamonds too.
 */

/** The frames: the sheet and the subject drawn on it. Not artefacts. */
const FRAME_ROLES: string[] = [UML_ROLE.diagram, UML_ROLE.subject];

/**
 * The one node role that is READ THROUGH another: `uml:classifier` is an
 * ancestor nothing is ever drawn as, so it has no profile of its own and an
 * element carrying it — which no creation site produces — falls through to none.
 */
const ABSTRACT_ROLES: string[] = [UML_ROLE.classifier];

type Stub = {
  id: string;
  role?: string;
  bound?: [number, number, number, number];
  text?: string;
  source?: string;
  target?: string;
  children?: GfxPrimitiveElementModel[];
};

function element({
  id,
  role,
  bound = [0, 0, 200, 120],
  text,
  source,
  target,
  children,
}: Stub): GfxPrimitiveElementModel {
  const el = Object.create(
    GfxPrimitiveElementModel.prototype
  ) as GfxPrimitiveElementModel;
  const define = (key: string, value: unknown) =>
    Object.defineProperty(el, key, { value, configurable: true });

  define('id', id);
  define('role', role);
  define('text', text);
  define('group', null);
  define('elementBound', new Bound(...bound));
  if (source !== undefined) define('source', { id: source });
  if (target !== undefined) define('target', { id: target });
  if (children) define('childElements', children);
  return el;
}

/** A shape and its one text, grouped the way a creation site groups them. */
function component(
  role: string,
  tierRole: string,
  words: string,
  id = 'n'
): { node: GfxPrimitiveElementModel; elements: GfxPrimitiveElementModel[] } {
  const node = element({ id, role });
  const tier = element({ id: `${id}-t`, role: tierRole, text: words });
  const group = element({ id: `${id}-g`, children: [node, tier] });
  Object.defineProperty(node, 'group', { value: group, configurable: true });
  return { node, elements: [node, tier] };
}

const profileOf = (role: string | undefined) =>
  readingProfileFor(element({ id: 'x', role }), UML_READINGS);

describe('what a UML diagram is read as', () => {
  it('gives every drawable artefact a profile, and the frames none', () => {
    const unread = Object.values(UML_ROLES)
      .filter(
        def =>
          def.kind === 'node' &&
          !FRAME_ROLES.includes(def.id) &&
          !ABSTRACT_ROLES.includes(def.id)
      )
      .filter(def => profileOf(def.id) === null)
      .map(def => def.id);
    expect(unread).toEqual([]);

    for (const role of FRAME_ROLES) {
      expect(profileOf(role), role).toBeNull();
    }
    expect(profileOf(undefined)).toBeNull();
    // The written tiers are not artefacts either.
    expect(profileOf(UML_ROLE.name)).toBeNull();
    expect(profileOf(UML_ROLE.operations)).toBeNull();
    expect(profileOf(UML_ROLE.label)).toBeNull();
  });

  it('gives each artefact its OWN profile, with a unique id', () => {
    expect(profileOf(UML_ROLE.class)?.id).toBe('uml-class');
    expect(profileOf(UML_ROLE.interface)?.id).toBe('uml-interface');
    expect(profileOf(UML_ROLE.enumeration)?.id).toBe('uml-enumeration');
    expect(profileOf(UML_ROLE.object)?.id).toBe('uml-object');
    expect(profileOf(UML_ROLE.package)?.id).toBe('uml-package');
    expect(profileOf(UML_ROLE.note)?.id).toBe('uml-note');
    expect(profileOf(UML_ROLE.actor)?.id).toBe('uml-actor');
    expect(profileOf(UML_ROLE['use-case'])?.id).toBe('uml-use-case');

    // Ids are unique: the DI keys on them and throws on a duplicate.
    expect(new Set(UML_READINGS.map(p => p.id)).size).toBe(UML_READINGS.length);
    for (const profile of UML_READINGS) {
      expect(profile.framework, profile.id).toBe('uml');
      expect(profile.roles, profile.id).toBe(UML_ROLES);
    }
  });

  /**
   * Every UML artefact is a composite — a shape and the canvas texts grouped
   * with it — so the name comes off a SIBLING. The tier is `uml:name` for
   * everything with a name compartment and `uml:label` for the two artefacts
   * that have none (`roles.ts`).
   */
  it('takes the name off the right tier, never the id', () => {
    const cls = component(UML_ROLE.class, UML_ROLE.name, 'Order');
    expect(readElement(cls.node, cls.elements, UML_CLASS_READING)!.name).toBe(
      'Order'
    );

    const actor = component(UML_ROLE.actor, UML_ROLE.label, 'Customer', 'a');
    expect(
      readElement(actor.node, actor.elements, UML_ACTOR_READING)!.name
    ).toBe('Customer');

    const labelled = new Set(['uml-actor', 'uml-use-case']);
    for (const profile of UML_READINGS) {
      expect(profile.labelRole, profile.id).toBe(
        labelled.has(profile.id) ? UML_ROLE.label : UML_ROLE.name
      );
    }
  });

  /**
   * §11.5.4: an aggregation and a composition ARE associations, so a profile
   * declaring `uml:association` reads them through `roleIsA` with nothing
   * restated — which is the whole reason the chain exists in `roles.ts`.
   */
  it('reads the diamonds through the association they specialise', () => {
    const me = component(UML_ROLE.class, UML_ROLE.name, 'Order');
    const part = component(UML_ROLE.class, UML_ROLE.name, 'OrderLine', 'p');
    const payable = component(
      UML_ROLE.interface,
      UML_ROLE.name,
      'Payable',
      'i'
    );

    const relations = readElement(
      me.node,
      [
        ...me.elements,
        ...part.elements,
        ...payable.elements,
        // The whole is the SOURCE: the diamond lands on the front end.
        element({
          id: 'r1',
          role: UML_ROLE.composition,
          source: 'n',
          target: 'p',
        }),
        element({
          id: 'r2',
          role: UML_ROLE.association,
          source: 'i',
          target: 'n',
        }),
        // A generalization is NOT an association, and must not be read as one.
        element({
          id: 'r3',
          role: UML_ROLE.generalization,
          source: 'n',
          target: 'i',
        }),
      ],
      UML_CLASS_READING
    )!.relations;

    expect(relations.map(r => [r.otherName, r.side])).toEqual([
      ['OrderLine', 'supplier'],
      ['Payable', 'consumer'],
    ]);
  });

  /**
   * An association is UNDIRECTED (§11.5.4), so both sides read the same — the
   * panel must not announce a direction the notation declines to draw. A
   * dependency IS directed, and the package profile says so.
   */
  it('words the undirected relations symmetrically and the directed ones not', () => {
    const sides = UML_CLASS_READING.relation!.sides;
    expect(sides.consumer.labelFallback).toBe('Associated with');
    expect(sides.supplier.labelFallback).toBe(sides.consumer.labelFallback);

    const pkg = UML_PACKAGE_READING.relation!;
    expect(pkg.edgeRole).toBe(UML_ROLE.dependency);
    expect(pkg.sides.supplier.labelFallback).toBe('Depends on');
    expect(pkg.sides.consumer.labelFallback).toBe('Depended on by');

    expect(UML_NOTE_READING.relation!.edgeRole).toBe(UML_ROLE.anchor);

    // Every side names a key as well as a wording: a host with a catalogue
    // always wins, a catalogue-less playground still reads.
    for (const profile of UML_READINGS) {
      for (const side of Object.values(profile.relation!.sides)) {
        expect(side.labelKey, profile.id).toMatch(
          /^com\.labre\.uml\.reading\.relations\./
        );
      }
    }
  });

  it('never contradicts the drawing, proposes no nature, reads no phase', () => {
    // Nothing in UML gives a coordinate a meaning: a class drawn above the one
    // it uses is the ordinary way round, and so is the other way.
    for (const profile of UML_READINGS) {
      expect(profile.relation?.geometry, profile.id).toBeUndefined();
      expect(profile.nature, profile.id).toBeUndefined();
      expect(profile.frame, profile.id).toBeUndefined();
    }

    const top = element({
      id: 'top',
      role: UML_ROLE.class,
      bound: [0, 0, 200, 120],
    });
    const bottom = element({
      id: 'bot',
      role: UML_ROLE.class,
      bound: [0, 400, 200, 120],
    });
    const reading = readElement(
      bottom,
      [
        top,
        bottom,
        element({
          id: 'r',
          role: UML_ROLE.association,
          source: 'bot',
          target: 'top',
        }),
      ],
      UML_CLASS_READING
    )!;
    expect(reading.relations.every(r => !r.contradictsGeometry)).toBe(true);
    expect(reading.nature).toBeUndefined();
    expect(reading.naming).toBeUndefined();
    expect(reading.phase).toBeUndefined();
  });
});
