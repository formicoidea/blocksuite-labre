import type { UmlNodeKind } from '@labre/affine-model';
import { roleIsA } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { UML_NODE_BOX } from '../consts.js';
import { UML_ROLE, UML_ROLE_OF_KIND, UML_ROLES } from '../roles.js';

/**
 * The UML vocabulary, checked the way the other frameworks' are: the shape of
 * every declaration, the hierarchy read through `roleIsA` rather than restated,
 * and the bridge that has to hold — the `kind` discriminant and the role it
 * means.
 */

/** Every kind the model declares, restated so the tables can be walked. */
const ALL_KINDS = Object.keys(UML_NODE_BOX) as UmlNodeKind[];

const NODE_ROLES = [
  UML_ROLE.classifier,
  UML_ROLE.class,
  UML_ROLE.interface,
  UML_ROLE.enumeration,
  UML_ROLE.object,
  UML_ROLE.package,
  UML_ROLE.note,
  UML_ROLE.actor,
  UML_ROLE['use-case'],
  // Phase 2 — the component artefacts and the deployment ones.
  UML_ROLE.component,
  UML_ROLE.port,
  UML_ROLE['provided-interface'],
  UML_ROLE['required-interface'],
  UML_ROLE.artifact,
  UML_ROLE.node,
  UML_ROLE.device,
  UML_ROLE['execution-environment'],
] as const;

const TIER_ROLES = [
  UML_ROLE.name,
  UML_ROLE.attributes,
  UML_ROLE.operations,
  UML_ROLE.label,
] as const;

const FRAME_ROLES = [UML_ROLE.diagram, UML_ROLE.subject] as const;

const EDGE_ROLES = [
  UML_ROLE.association,
  UML_ROLE.aggregation,
  UML_ROLE.composition,
  UML_ROLE.generalization,
  UML_ROLE.realization,
  UML_ROLE.dependency,
  UML_ROLE.anchor,
  UML_ROLE.include,
  UML_ROLE.extend,
  UML_ROLE.deploy,
  UML_ROLE.manifest,
  UML_ROLE['communication-path'],
] as const;

describe('UML role vocabulary', () => {
  it('declares seventeen artefacts, four tiers, two frames and twelve relations', () => {
    expect(Object.keys(UML_ROLES)).toHaveLength(
      NODE_ROLES.length +
        TIER_ROLES.length +
        FRAME_ROLES.length +
        EDGE_ROLES.length
    );
    for (const id of [...NODE_ROLES, ...FRAME_ROLES]) {
      expect(UML_ROLES[id]?.kind, id).toBe('node');
    }
    for (const id of EDGE_ROLES) {
      expect(UML_ROLES[id]?.kind, id).toBe('edge');
    }
  });

  /**
   * The written compartments of an artefact, as canvas TEXT elements.
   *
   * `kind: 'text'` and not `'node'`, the same call `c4:title` and
   * `wardley:label` make: a tier's BOX is a creation-time default 84% of the
   * node wide whatever it reads, so a rule measuring one has to measure its INK.
   * Filing them as nodes would let a geometric rule judge an element by a
   * rectangle nobody drew.
   */
  it('declares every written tier as text, and none as an artefact', () => {
    for (const id of TIER_ROLES) {
      expect(UML_ROLES[id]?.kind, id).toBe('text');
      // Parent-less: a tier is one part of one element's label, not an artefact
      // of the model, so nothing written about classifiers may fall on it.
      expect(UML_ROLES[id]?.parent, id).toBeUndefined();
      // …and no `kind` maps to any of them: the artefacts are the artefacts,
      // and the role of a component stays on its SHAPE alone.
      expect(Object.values(UML_ROLE_OF_KIND), id).not.toContain(id);
    }
  });

  /**
   * `uml:name` and `uml:label` are two roles and not one.
   *
   * The name COMPARTMENT of §11.4.4 is a rectangle with a rule under it; an
   * actor's word has no compartment to be one of. Merging them would make the
   * node view, the exporter and the reading profiles ask an element's KIND which
   * of the two a group holds, which the shape already states.
   */
  it('keeps the name compartment and the bare label apart', () => {
    expect(UML_ROLE.name).toBe('uml:name');
    expect(UML_ROLE.label).toBe('uml:label');
    expect(new Set(TIER_ROLES).size).toBe(TIER_ROLES.length);
  });

  it('namespaces every role, keys it by its own id and kebab-cases it', () => {
    for (const [id, def] of Object.entries(UML_ROLES)) {
      expect(id).toBe(def.id);
      expect(id.startsWith('uml:')).toBe(true);
      expect(id).toBe(id.toLowerCase());
      expect(def.labelFallback, id).toBeTruthy();
    }
  });

  it('names every role through the translation seam', () => {
    for (const [id, def] of Object.entries(UML_ROLES)) {
      expect(def.labelKey, id).toBe(
        `com.labre.uml.role.${id.slice('uml:'.length)}`
      );
    }
  });

  /**
   * §9.2: a Class, an Interface and an Enumeration are all Classifiers, drawn as
   * the same compartmented rectangle and told apart by the keyword above the
   * name. A rule written on the parent has to reach all three.
   */
  it('files the three classifiers under the classifier, one way only', () => {
    expect(UML_ROLES[UML_ROLE.classifier].parent).toBeUndefined();
    for (const child of [
      UML_ROLE.class,
      UML_ROLE.interface,
      UML_ROLE.enumeration,
    ] as const) {
      expect(UML_ROLES[child].parent, child).toBe(UML_ROLE.classifier);
      expect(roleIsA(child, UML_ROLE.classifier, UML_ROLES), child).toBe(true);
      // Descent runs child → ancestor and never back: not every classifier is a
      // class, so a rule framed on a child does not reach the parent.
      expect(roleIsA(UML_ROLE.classifier, child, UML_ROLES), child).toBe(false);
    }
  });

  /**
   * §9.8: an object is an InstanceSpecification — an INSTANCE of a classifier,
   * not a kind of one. It shares the rectangle and nothing else, and filing it
   * in the chain would make every rule about classifiers fall on instances.
   */
  it('keeps the object OUT of the classifier chain', () => {
    expect(UML_ROLES[UML_ROLE.object].parent).toBeUndefined();
    expect(roleIsA(UML_ROLE.object, UML_ROLE.classifier, UML_ROLES)).toBe(
      false
    );
    expect(roleIsA(UML_ROLE.classifier, UML_ROLE.object, UML_ROLES)).toBe(
      false
    );
  });

  /**
   * §11.5.4: aggregation and composition ARE associations — the same solid line,
   * with a diamond on the whole's end. `aggregationKind` is a property of an
   * association end in the metamodel, not a different relationship.
   */
  it('files aggregation and composition under the association', () => {
    for (const child of [UML_ROLE.aggregation, UML_ROLE.composition] as const) {
      expect(UML_ROLES[child].parent, child).toBe(UML_ROLE.association);
      expect(roleIsA(child, UML_ROLE.association, UML_ROLES), child).toBe(true);
      expect(roleIsA(UML_ROLE.association, child, UML_ROLES), child).toBe(
        false
      );
    }
    // Siblings, not a chain: a composition is not an aggregation.
    expect(roleIsA(UML_ROLE.composition, UML_ROLE.aggregation, UML_ROLES)).toBe(
      false
    );
  });

  /**
   * §19.4: a Device and an ExecutionEnvironment ARE Nodes, drawn as the same
   * cube and told apart by their keyword. The one chain whose PARENT is itself
   * drawn — a Node is instantiable, unlike the abstract classifier.
   */
  it('files the device and the execution environment under the node', () => {
    expect(UML_ROLES[UML_ROLE.node].parent).toBeUndefined();
    for (const child of [
      UML_ROLE.device,
      UML_ROLE['execution-environment'],
    ] as const) {
      expect(UML_ROLES[child].parent, child).toBe(UML_ROLE.node);
      expect(roleIsA(child, UML_ROLE.node, UML_ROLES), child).toBe(true);
      expect(roleIsA(UML_ROLE.node, child, UML_ROLES), child).toBe(false);
    }
    // Siblings, not a chain: an execution environment is not a device.
    expect(
      roleIsA(UML_ROLE['execution-environment'], UML_ROLE.device, UML_ROLES)
    ).toBe(false);
    // …and the parent IS a drawing, which is what makes it unlike the
    // classifier: `kind: 'node'` maps onto it.
    expect(UML_ROLE_OF_KIND.node).toBe(UML_ROLE.node);
  });

  /**
   * The component artefacts are flat, each for a reason the header records: a
   * component is a structured classifier in the metamodel and its own figure on
   * the page, and a port, a ball and a socket are parts attached to one rather
   * than specialisations of it (§11.6.4, §11.3.4, §10.4.4).
   */
  it('keeps the component artefacts and the artifact flat', () => {
    for (const flat of [
      UML_ROLE.component,
      UML_ROLE.port,
      UML_ROLE['provided-interface'],
      UML_ROLE['required-interface'],
      UML_ROLE.artifact,
    ] as const) {
      expect(UML_ROLES[flat].parent, flat).toBeUndefined();
      expect(roleIsA(flat, UML_ROLE.classifier, UML_ROLES), flat).toBe(false);
    }
    // The two interface glyphs are two STATEMENTS, not one with a flag: a rule
    // about a required interface left dangling must not reach every lollipop.
    expect(
      roleIsA(
        UML_ROLE['required-interface'],
        UML_ROLE['provided-interface'],
        UML_ROLES
      )
    ).toBe(false);
  });

  it('keeps the other nine relations FLAT under nothing', () => {
    // Different metaclasses drawn with different lines (§9.9.4, §10.4.4,
    // §7.8.4, §18.1.4). Flattening what a reader sees as distinct notations
    // would let one rule silently police all of them.
    for (const flat of [
      UML_ROLE.association,
      UML_ROLE.generalization,
      UML_ROLE.realization,
      UML_ROLE.dependency,
      UML_ROLE.anchor,
      UML_ROLE.include,
      UML_ROLE.extend,
      UML_ROLE.deploy,
      UML_ROLE.manifest,
      UML_ROLE['communication-path'],
    ] as const) {
      expect(UML_ROLES[flat].parent, flat).toBeUndefined();
    }
    // A generalization is emphatically not an association.
    expect(
      roleIsA(UML_ROLE.generalization, UML_ROLE.association, UML_ROLES)
    ).toBe(false);
    // Nor is a communication path, and that one IS a departure from the
    // metamodel (§19.4 derives it from Association) made on purpose: it is a
    // line between two cubes, and the class-diagram association rules have no
    // business being handed a deployment diagram to police.
    expect(
      roleIsA(UML_ROLE['communication-path'], UML_ROLE.association, UML_ROLES)
    ).toBe(false);
  });

  /**
   * Tier 2 of `docs/adr/0010`: the verb the hover reveal reads back on a drawn
   * line. UML is the framework that needs it most — its whole grammar is in
   * which end carries the decoration.
   */
  it('gives every directed relation a verb, and the two undirected ones none', () => {
    const verbs: Record<string, string> = {
      [UML_ROLE.aggregation]: 'is composed of',
      [UML_ROLE.composition]: 'is composed of',
      [UML_ROLE.generalization]: 'is a',
      [UML_ROLE.realization]: 'realizes',
      [UML_ROLE.dependency]: 'depends on',
      [UML_ROLE.include]: 'includes',
      [UML_ROLE.extend]: 'extends',
      // Both run FROM the artifact: it is the subject of the sentence, and the
      // arrow lands on what it is deployed on or what it manifests (§19.2.4,
      // §19.3.4).
      [UML_ROLE.deploy]: 'is deployed on',
      [UML_ROLE.manifest]: 'manifests',
    };
    for (const [id, verb] of Object.entries(verbs)) {
      const direction = UML_ROLES[id].direction;
      expect(direction?.verbFallback, id).toBe(verb);
      expect(direction?.verbKey, id).toBe(
        `com.labre.uml.role.${id.slice('uml:'.length)}.verb`
      );
      // Every one of them announces the GESTURE too: which end the decoration
      // lands on is the one thing a user gets backwards without noticing.
      expect(direction?.gestureHintFallback, id).toBeTruthy();
    }

    // The association claims no direction because the notation draws none
    // (§11.5.4), and an anchor is a comment pinned to an element rather than a
    // relationship between two of them.
    expect(UML_ROLES[UML_ROLE.association].direction).toBeUndefined();
    expect(UML_ROLES[UML_ROLE.anchor].direction).toBeUndefined();
    // …and a communication path draws no arrow either (§19.4.4): two nodes that
    // can talk to each other, with nothing said about which one starts.
    expect(UML_ROLES[UML_ROLE['communication-path']].direction).toBeUndefined();
  });

  it('gives no node or text role a direction', () => {
    for (const id of [...NODE_ROLES, ...TIER_ROLES, ...FRAME_ROLES]) {
      expect(UML_ROLES[id].direction, id).toBeUndefined();
    }
  });

  it('keeps the frames out of every artefact role', () => {
    // A rule written on the artefacts must never fall on the sheet they are
    // drawn on, nor on the rectangle drawn round them.
    for (const frame of FRAME_ROLES) {
      expect(UML_ROLES[frame].parent, frame).toBeUndefined();
      for (const role of NODE_ROLES) {
        expect(roleIsA(frame, role, UML_ROLES), `${frame} → ${role}`).toBe(
          false
        );
        expect(roleIsA(role, frame, UML_ROLES), `${role} → ${frame}`).toBe(
          false
        );
      }
    }
  });
});

describe('UML_ROLE_OF_KIND', () => {
  it('gives every kind a role, and only declared ones', () => {
    expect(Object.keys(UML_ROLE_OF_KIND).sort()).toEqual([...ALL_KINDS].sort());
    for (const kind of ALL_KINDS) {
      const role = UML_ROLE_OF_KIND[kind];
      expect(role, kind).toBeDefined();
      expect(UML_ROLES[role], `${kind} → ${role}`).toBeDefined();
    }
  });

  /**
   * One kind, one role, with none collapsed — unlike C4, where four kinds are a
   * second DRAWING of a level. Here the sixteen kinds are sixteen artefacts of
   * the specification.
   */
  it('maps each kind onto its own role, and never onto the abstract parent', () => {
    expect(new Set(Object.values(UML_ROLE_OF_KIND)).size).toBe(
      ALL_KINDS.length
    );
    // `uml:classifier` is an ancestor nothing is ever drawn as: a box stamped
    // with it would be an artefact the notation has no picture for. It is the
    // ONLY such role — `uml:node` is a parent too and is drawn, because §19.4
    // makes a Node instantiable.
    expect(Object.values(UML_ROLE_OF_KIND)).not.toContain(UML_ROLE.classifier);
    expect(Object.values(UML_ROLE_OF_KIND)).toContain(UML_ROLE.node);
    // …and the three that ARE classifiers still read as such, for free.
    for (const kind of ['class', 'interface', 'enumeration'] as const) {
      expect(
        roleIsA(UML_ROLE_OF_KIND[kind], UML_ROLE.classifier, UML_ROLES),
        kind
      ).toBe(true);
    }
    expect(
      roleIsA(UML_ROLE_OF_KIND.object, UML_ROLE.classifier, UML_ROLES)
    ).toBe(false);
  });
});
