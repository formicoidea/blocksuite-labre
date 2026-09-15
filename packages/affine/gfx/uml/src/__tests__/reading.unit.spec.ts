import { readElement, readingProfileFor } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import {
  UML_ACTOR_READING,
  UML_ARTIFACT_READING,
  UML_CLASS_READING,
  UML_NODE_READING,
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

/**
 * The frames: the sheet, and the three boundaries drawn on it — the use-case
 * subject (§18.1.4), the activity partition (§15.6.4) and the composite state's
 * region (§14.2.4). Not artefacts: what belongs to each is read back from where
 * an element SITS, which is the opposite of being read itself.
 */
const FRAME_ROLES: string[] = [
  UML_ROLE.diagram,
  UML_ROLE.subject,
  UML_ROLE.partition,
  UML_ROLE.region,
];

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
    expect(profileOf(UML_ROLE.component)?.id).toBe('uml-component');
    expect(profileOf(UML_ROLE.port)?.id).toBe('uml-port');
    expect(profileOf(UML_ROLE['provided-interface'])?.id).toBe(
      'uml-provided-interface'
    );
    expect(profileOf(UML_ROLE['required-interface'])?.id).toBe(
      'uml-required-interface'
    );
    expect(profileOf(UML_ROLE.artifact)?.id).toBe('uml-artifact');
    expect(profileOf(UML_ROLE.node)?.id).toBe('uml-node');

    // Ids are unique: the DI keys on them and throws on a duplicate.
    expect(new Set(UML_READINGS.map(p => p.id)).size).toBe(UML_READINGS.length);
    // Every role a profile applies to is declared once, so no two of them can
    // quietly answer for the same element.
    expect(new Set(UML_READINGS.map(p => p.appliesTo)).size).toBe(
      UML_READINGS.length
    );
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

    // `uml:name` for every artefact whose words a KEYWORD may be written over —
    // the classifiers, the package, the note, phase 2's component and artifact
    // (drawn as the same divided rectangle) and the three cubes, whose
    // `«device»` line is exactly that. `uml:label` for the five whose one word
    // is a name and nothing else.
    const named = new Set([
      'uml-class',
      'uml-interface',
      'uml-enumeration',
      'uml-object',
      'uml-package',
      'uml-note',
      'uml-component',
      'uml-artifact',
      'uml-node',
      'uml-device',
      'uml-execution-environment',
      // …and phase 2's one behaviour artefact that is a DIVIDED BOX: §14.2.4
      // draws a state with a name compartment ruled off over its internal
      // activities, so its heading is a `uml:name` exactly as a classifier's
      // is. Every other behaviour artefact carries one word, or none at all.
      'uml-state',
    ]);
    for (const profile of UML_READINGS) {
      expect(profile.labelRole, profile.id).toBe(
        named.has(profile.id) ? UML_ROLE.name : UML_ROLE.label
      );
    }
  });

  /**
   * The one place in this pack where declaration ORDER changes an answer.
   *
   * `readingProfileFor` takes the FIRST profile whose `appliesTo` the element's
   * role IS A, and `uml:device` and `uml:execution-environment` are both a
   * `uml:node` (§19.4.4 makes Node their parent). With `uml-node` listed first,
   * every device would be read as a node and its own profile would never fire —
   * so the two children are registered ahead of it, and this is what says so.
   */
  it('reads a device as a device, not as the node it specialises', () => {
    expect(profileOf(UML_ROLE.device)?.id).toBe('uml-device');
    expect(profileOf(UML_ROLE['execution-environment'])?.id).toBe(
      'uml-execution-environment'
    );
    const idsInOrder = UML_READINGS.map(p => p.id);
    expect(idsInOrder.indexOf('uml-device')).toBeLessThan(
      idsInOrder.indexOf('uml-node')
    );
    expect(idsInOrder.indexOf('uml-execution-environment')).toBeLessThan(
      idsInOrder.indexOf('uml-node')
    );
  });

  /**
   * The same rule, for the two parents phase 2's behaviour half declares.
   *
   * `uml:control-node` and `uml:pseudostate` are generalisations nothing is
   * ever drawn as — rules are written on them so one declaration reaches five
   * children — and each has a profile all the same, as a FLOOR: a routing mark
   * added in a later phase is readable from the day its role is filed under its
   * parent. Registered last, or every child would be answered for by its parent.
   */
  it('reads each routing mark as itself, never as the parent it hangs off', () => {
    const idsInOrder = UML_READINGS.map(p => p.id);
    for (const [child, parent] of [
      ['uml-initial', 'uml-control-node'],
      ['uml-decision', 'uml-control-node'],
      ['uml-fork', 'uml-control-node'],
      ['uml-choice', 'uml-pseudostate'],
      ['uml-junction', 'uml-pseudostate'],
      ['uml-terminate', 'uml-pseudostate'],
    ]) {
      expect(idsInOrder.indexOf(child), child).toBeLessThan(
        idsInOrder.indexOf(parent)
      );
    }
    expect(profileOf(UML_ROLE.initial)?.id).toBe('uml-initial');
    expect(profileOf(UML_ROLE.choice)?.id).toBe('uml-choice');
  });

  /**
   * The three behaviour relations, and why they are three tables rather than
   * one: an activity's arrow says what happens NEXT, a state machine's says
   * what this thing BECOMES, and an object flow says who produced the data.
   */
  it('words the behaviour relations as the diagram each belongs to would', () => {
    const flow = profileOf(UML_ROLE.action)!.relation!;
    expect(flow.edgeRole).toBe(UML_ROLE['control-flow']);
    expect(flow.sides.supplier.labelFallback).toBe('Flows to');
    expect(flow.sides.consumer.labelFallback).toBe('Flows from');

    // An object flow is filed FLAT beside the control flow rather than under
    // it, so the data node needs a table of its own or it would read nothing.
    const data = profileOf(UML_ROLE['object-node'])!.relation!;
    expect(data.edgeRole).toBe(UML_ROLE['object-flow']);
    expect(data.sides.supplier.labelFallback).toBe('Consumed by');

    const transition = profileOf(UML_ROLE.state)!.relation!;
    expect(transition.edgeRole).toBe(UML_ROLE.transition);
    expect(transition.sides.supplier.labelFallback).toBe('Transitions to');
    expect(transition.sides.consumer.labelFallback).toBe('Entered from');
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

  /**
   * §19.2.4 — the one relation in the pack whose two ends are different KINDS
   * of thing, so the wording is asymmetric on purpose: the artifact reads
   * "Deployed on: AppServer" and the server reads "Hosts: orders.war", off one
   * table read from its two ends.
   */
  it('reads a deployment from both ends, in the words each end wants', () => {
    const deploy = UML_ARTIFACT_READING.relation!;
    expect(deploy.edgeRole).toBe(UML_ROLE.deploy);
    expect(deploy.sides.supplier.labelFallback).toBe('Deployed on');
    expect(deploy.sides.consumer.labelFallback).toBe('Hosts');
    // The cube reads the very same table: one relation, two sentences.
    expect(UML_NODE_READING.relation).toBe(deploy);

    const artifact = component(UML_ROLE.artifact, UML_ROLE.name, 'orders.war');
    const server = component(UML_ROLE.node, UML_ROLE.name, ':AppServer', 's');
    const relations = readElement(
      artifact.node,
      [
        ...artifact.elements,
        ...server.elements,
        // The artifact is the SOURCE: `uml:deploy` reads "is deployed on".
        element({
          id: 'd',
          role: UML_ROLE.deploy,
          source: 'n',
          target: 's',
        }),
      ],
      UML_ARTIFACT_READING
    )!.relations;
    expect(relations.map(r => [r.otherName, r.side])).toEqual([
      [':AppServer', 'supplier'],
    ]);
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
