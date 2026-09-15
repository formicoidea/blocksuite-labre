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
  // Phase 2 — the activity artefacts and their abstract parent.
  UML_ROLE['control-node'],
  UML_ROLE.action,
  UML_ROLE.initial,
  UML_ROLE['activity-final'],
  UML_ROLE['flow-final'],
  UML_ROLE.decision,
  UML_ROLE.fork,
  UML_ROLE['object-node'],
  UML_ROLE['send-signal'],
  UML_ROLE['accept-event'],
  UML_ROLE['time-event'],
  // Phase 2 — the state machine artefacts and theirs.
  UML_ROLE.state,
  UML_ROLE['final-state'],
  UML_ROLE.pseudostate,
  UML_ROLE.choice,
  UML_ROLE.junction,
  UML_ROLE['shallow-history'],
  UML_ROLE['deep-history'],
  UML_ROLE['entry-point'],
  UML_ROLE['exit-point'],
  UML_ROLE.terminate,
  // Phase 3 — the interaction artefacts of §17.2.4 and §17.3.4.
  UML_ROLE.lifeline,
  UML_ROLE.execution,
  UML_ROLE.destruction,
] as const;

const TIER_ROLES = [
  UML_ROLE.name,
  UML_ROLE.attributes,
  UML_ROLE.operations,
  UML_ROLE.label,
  // Phase 3 — §17.3.4's lifeline HEAD, split off the shared label tier so the
  // two questions a tier is asked can be asked of a head without being asked of
  // an actor's word (`roles.ts`).
  UML_ROLE['lifeline-ident'],
] as const;

const FRAME_ROLES = [
  UML_ROLE.diagram,
  UML_ROLE.subject,
  // Phase 2 — the swimlane of §15.6.4 and the composite state of §14.2.4.
  UML_ROLE.partition,
  UML_ROLE.region,
  // Phase 3 — the combined fragment of §17.6.4 and one operand of it. The
  // operand is DECLARED and never stamped: it is an instance zone of the
  // fragment's own plot, so a rule about what may sit in one has a name.
  UML_ROLE.fragment,
  UML_ROLE.operand,
] as const;

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
  // Phase 2 — the two activity edges and the state machine transition.
  UML_ROLE['control-flow'],
  UML_ROLE['object-flow'],
  UML_ROLE.transition,
  // Phase 3 — the five messages of §17.4.4 and the parent they share.
  UML_ROLE.message,
  UML_ROLE['message-sync'],
  UML_ROLE['message-async'],
  UML_ROLE['message-reply'],
  UML_ROLE['message-create'],
  UML_ROLE['message-delete'],
] as const;

describe('UML role vocabulary', () => {
  it('declares forty-one artefacts, four tiers, six frames and twenty-one relations', () => {
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

  /**
   * §15.3.4: the five shapes that ROUTE an activity's flow are all
   * ControlNodes. An abstract parent, like `uml:classifier` and unlike
   * `uml:node`: nothing is ever drawn as a bare control node.
   */
  it('files the five control nodes under the control node', () => {
    expect(UML_ROLES[UML_ROLE['control-node']].parent).toBeUndefined();
    for (const child of [
      UML_ROLE.initial,
      UML_ROLE['activity-final'],
      UML_ROLE['flow-final'],
      UML_ROLE.decision,
      UML_ROLE.fork,
    ] as const) {
      expect(UML_ROLES[child].parent, child).toBe(UML_ROLE['control-node']);
      expect(roleIsA(child, UML_ROLE['control-node'], UML_ROLES), child).toBe(
        true
      );
      expect(roleIsA(UML_ROLE['control-node'], child, UML_ROLES), child).toBe(
        false
      );
    }
    // The action is what an activity DOES, not what routes it: a rule about
    // control nodes must not reach it.
    expect(roleIsA(UML_ROLE.action, UML_ROLE['control-node'], UML_ROLES)).toBe(
      false
    );
    // Nor is an object node one — it is the value that moves (§15.4.4).
    expect(
      roleIsA(UML_ROLE['object-node'], UML_ROLE['control-node'], UML_ROLES)
    ).toBe(false);
  });

  /**
   * §14.2.4: the seven routing vertices of a state machine are Pseudostates —
   * the other abstract parent, and the counterpart of the control node.
   */
  it('files the seven pseudostates under the pseudostate', () => {
    expect(UML_ROLES[UML_ROLE.pseudostate].parent).toBeUndefined();
    for (const child of [
      UML_ROLE.choice,
      UML_ROLE.junction,
      UML_ROLE['shallow-history'],
      UML_ROLE['deep-history'],
      UML_ROLE['entry-point'],
      UML_ROLE['exit-point'],
      UML_ROLE.terminate,
    ] as const) {
      expect(UML_ROLES[child].parent, child).toBe(UML_ROLE.pseudostate);
      expect(roleIsA(child, UML_ROLE.pseudostate, UML_ROLES), child).toBe(true);
    }
    // A state is where the machine RESTS, and a final state is where it stops:
    // neither is a pseudostate, and a rule about "carries no name" must not
    // fall on either.
    expect(roleIsA(UML_ROLE.state, UML_ROLE.pseudostate, UML_ROLES)).toBe(
      false
    );
    expect(
      roleIsA(UML_ROLE['final-state'], UML_ROLE.pseudostate, UML_ROLES)
    ).toBe(false);
  });

  /**
   * `uml:initial` is filed under the CONTROL NODE and is the role a state
   * machine's initial pseudostate carries too — §14.2.4 and §15.3.4 draw the
   * same disc and mean the same thing by it, so one rule polices both.
   *
   * Asserted because it is the one cross-family reading in the vocabulary, and
   * the one somebody would otherwise "fix" by adding a second role.
   */
  it('shares the initial node between the two behaviour families', () => {
    expect(UML_ROLE_OF_KIND.initial).toBe(UML_ROLE.initial);
    expect(roleIsA(UML_ROLE.initial, UML_ROLE['control-node'], UML_ROLES)).toBe(
      true
    );
    // …and it is NOT also filed under the pseudostate: one parent, and the
    // sharing lives in the kind that maps onto it rather than in the tree.
    expect(roleIsA(UML_ROLE.initial, UML_ROLE.pseudostate, UML_ROLES)).toBe(
      false
    );
  });

  /**
   * An action and a state are the same round-cornered rectangle and are
   * emphatically not relatives: one is work that happens, the other a condition
   * that holds. The same call the file makes for the object and the classifier.
   */
  it('keeps the action, the state and the two look-alikes apart', () => {
    for (const flat of [
      UML_ROLE.action,
      UML_ROLE.state,
      UML_ROLE['object-node'],
      UML_ROLE['final-state'],
      UML_ROLE['send-signal'],
      UML_ROLE['accept-event'],
      UML_ROLE['time-event'],
    ] as const) {
      expect(UML_ROLES[flat].parent, flat).toBeUndefined();
    }
    expect(roleIsA(UML_ROLE.state, UML_ROLE.action, UML_ROLES)).toBe(false);
    expect(roleIsA(UML_ROLE.action, UML_ROLE.state, UML_ROLES)).toBe(false);
    // An activity's object node is not an object diagram's instance
    // specification: two metaclasses sharing a rectangle.
    expect(roleIsA(UML_ROLE['object-node'], UML_ROLE.object, UML_ROLES)).toBe(
      false
    );
    // A final state is drawn exactly like an activity final and is a different
    // thing: the picture is shared, the role is not.
    expect(
      roleIsA(UML_ROLE['final-state'], UML_ROLE['activity-final'], UML_ROLES)
    ).toBe(false);
    // A time event is an accept event whose trigger is a clock — and it gets
    // its own role because the notation gives it its own picture.
    expect(
      roleIsA(UML_ROLE['time-event'], UML_ROLE['accept-event'], UML_ROLES)
    ).toBe(false);
  });

  it('keeps the other twelve relations FLAT under nothing', () => {
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
      UML_ROLE['control-flow'],
      UML_ROLE['object-flow'],
      UML_ROLE.transition,
    ] as const) {
      expect(UML_ROLES[flat].parent, flat).toBeUndefined();
    }
    // A transition is not an activity edge: a token moving between actions and
    // a machine firing from one state to another are different sentences with
    // different endpoint tables, drawn with the same arrow.
    expect(
      roleIsA(UML_ROLE.transition, UML_ROLE['control-flow'], UML_ROLES)
    ).toBe(false);
    expect(
      roleIsA(UML_ROLE['object-flow'], UML_ROLE['control-flow'], UML_ROLES)
    ).toBe(false);
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
      // §15.2.4: both activity edges read the same way — the difference is at
      // the ENDS, not in the verb.
      [UML_ROLE['control-flow']]: 'flows to',
      [UML_ROLE['object-flow']]: 'flows to',
      // §14.2.4.8: a machine leaves one state and enters another.
      [UML_ROLE.transition]: 'transitions to',
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
   * second DRAWING of a level. Here the thirty-five kinds are thirty-five artefacts of
   * the specification.
   */
  it('maps each kind onto its own role, and never onto the abstract parent', () => {
    expect(new Set(Object.values(UML_ROLE_OF_KIND)).size).toBe(
      ALL_KINDS.length
    );
    // `uml:classifier`, `uml:control-node` and `uml:pseudostate` are ancestors
    // nothing is ever drawn as: a box stamped with one would be an artefact the
    // notation has no picture for. They are the ONLY such roles — `uml:node` is
    // a parent too and is drawn, because §19.4 makes a Node instantiable.
    for (const abstract of [
      UML_ROLE.classifier,
      UML_ROLE['control-node'],
      UML_ROLE.pseudostate,
    ] as const) {
      expect(Object.values(UML_ROLE_OF_KIND), abstract).not.toContain(abstract);
    }
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
