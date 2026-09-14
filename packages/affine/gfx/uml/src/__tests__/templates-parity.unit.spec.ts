import { snapshotFromAction } from '@labre/affine-gfx-template';
import type { CommandInvocation } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { umlCommands } from '../commands.js';
import { UML_ROLE } from '../roles.js';
import { umlTemplateCategory } from '../templates.js';

/**
 * The guard the UML palette is born with: **a template must be what its command
 * draws.**
 *
 * Writing this palette by hand was never an option. A UML classifier is FIVE
 * elements — a bodyless shape, the name, the attributes and the operations
 * tiers, and the group that makes the four one thing — created in painting
 * order, with the compartment seeds written verbatim because the grammar reads
 * them back. Every framework palette written by hand before C4's had already
 * drifted from its toolbox.
 *
 * So the category is DERIVED, and this file re-runs each command against the
 * same recording surface and compares. {@link HAND_AUTHORED} being empty is the
 * statement that nothing here is authored: every template in the panel is a
 * command.
 */

/** A template's stored snapshot, as far as this file reads it. */
type Snapshot = {
  blocks: { children: { props: { elements: Record<string, RawElement> } }[] };
};

type RawElement = {
  type?: string;
  kind?: string;
  role?: string;
  name?: string;
  index?: string;
  text?: { delta?: { insert?: string }[] };
  children?: { json?: Record<string, boolean> };
};

/**
 * The invocation a derived template is recorded under.
 *
 * Any value does: a UML command's `run` hands the `GfxController` to its action
 * and reads nothing else off the invocation. Spelled out rather than cast, so
 * the day one does the failure is a comparison rather than a crash.
 */
const INVOCATION: CommandInvocation = {
  surface: 'senior-menu',
  source: 'internal',
};

/**
 * The templates written by hand — none.
 *
 * The palette is the thirty-nine artefact commands. The fifteen relationship
 * TOOLS arm the connector and draw nothing, so they have no artefact to record,
 * and the two exports are not artefact commands at all. A future entry that is
 * not derived has to declare itself here.
 */
const HAND_AUTHORED: string[] = [];

const shipped = umlTemplateCategory.templates;
if (typeof shipped === 'function') {
  throw new Error('the UML template category is expected to be eager');
}
const templates = shipped;

const elementsOf = (template: (typeof templates)[number]) =>
  (template.content as unknown as Snapshot).blocks.children[0].props.elements;

const named = (name: string) => {
  const found = templates.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return elementsOf(found);
};

describe('the UML palette covers the toolbox', () => {
  const artefacts = umlCommands.filter(command => command.kind === 'artefact');

  it('ships one derived template per artefact command', () => {
    // Ten from phase 1, plus phase 2's four component artefacts and four
    // deployment ones, plus its twenty-one behaviour ones (ten of the activity
    // vocabulary, nine of the state machine, and the partition and region
    // backgrounds). The six TOOLS phase 2 added are not here for the reason the
    // nine before them are not: arming a connector draws nothing.
    expect(artefacts).toHaveLength(39);
    for (const command of artefacts) {
      const derived = templates.filter(
        template => template.commandId === command.id
      );
      expect(
        derived.map(template => template.name),
        `templates for ${command.id}`
      ).toHaveLength(1);
    }
  });

  it('names every template that is NOT derived', () => {
    const free = templates
      .filter(template => template.commandId === undefined)
      .map(template => template.name);
    expect([...free].sort()).toEqual([...HAND_AUTHORED].sort());
  });

  it('is filed under the category name the panel and the gating test read', () => {
    // `flags/template-categories-gating.unit.spec.ts` enumerates this string.
    expect(umlTemplateCategory.name).toBe('UML');
  });
});

describe('every derived template is what its command draws', () => {
  for (const template of templates) {
    if (template.commandId === undefined) continue;
    const command = umlCommands.find(entry => entry.id === template.commandId);

    it(`${template.name} re-runs identically`, () => {
      expect(command, template.commandId).toBeDefined();
      expect(template.content).toEqual(
        snapshotFromAction(
          std => command!.run(std, INVOCATION),
          template.name ?? 'Template'
        )
      );
    });
  }
});

/**
 * The classifier, spelled out: the one artefact of this pack a hand-written
 * template would have got wrong, in several ways at once.
 */
describe('a classifier template is the elements the button draws', () => {
  const THREE_TIERS: [string, string][] = [
    ['Class', 'class'],
    ['Interface', 'interface'],
    ['Enumeration', 'enumeration'],
  ];

  for (const [name, kind] of THREE_TIERS) {
    it(`${name} is a bodyless shape, three tiers and the group over them`, () => {
      const entries = Object.entries(named(name));
      expect(entries).toHaveLength(5);

      const shape = entries.find(([, el]) => el.type === 'umlNode');
      const group = entries.find(([, el]) => el.type === 'group');
      expect(shape && group).toBeTruthy();
      expect(shape![1].kind).toBe(kind);
      // NO text on the shape: the name is the `uml:name` child, and the shape
      // is a body and nothing else (`actions.ts`).
      expect(shape![1].text).toBeUndefined();
      // The wrapper round a box is not a second box (`roles.ts`).
      expect(group![1].role).toBeUndefined();

      const roles = entries
        .map(([, el]) => el.role)
        .filter((role): role is string => !!role)
        .sort();
      expect(roles).toEqual(
        [
          UML_ROLE[kind as 'class' | 'interface' | 'enumeration'],
          UML_ROLE.name,
          UML_ROLE.attributes,
          UML_ROLE.operations,
        ].sort()
      );
    });
  }

  it('gives the object a name and one tier of slots, and nothing else', () => {
    // An instance specification has no operations compartment (§9.8.4), so the
    // object is four elements rather than five.
    const entries = Object.entries(named('Object'));
    expect(entries).toHaveLength(4);
    const roles = entries
      .map(([, el]) => el.role)
      .filter((role): role is string => !!role)
      .sort();
    expect(roles).toEqual(
      [UML_ROLE.object, UML_ROLE.name, UML_ROLE.attributes].sort()
    );
  });

  it('gives a component and an artifact the object own two tiers', () => {
    // §11.6.4 and §19.3.4 draw both as a name over ONE body compartment, which
    // is the instance specification's layout with a different mark in the
    // corner — so both are four elements too.
    for (const [name, role] of [
      ['Component', UML_ROLE.component],
      ['Artifact', UML_ROLE.artifact],
    ] as const) {
      const entries = Object.entries(named(name));
      expect(entries, name).toHaveLength(4);
      const roles = entries
        .map(([, el]) => el.role)
        .filter((id): id is string => !!id)
        .sort();
      expect(roles, name).toEqual(
        [role, UML_ROLE.name, UML_ROLE.attributes].sort()
      );
    }
  });
});

/**
 * The phase-2 pictures: one shape, one label, one group — and the label is the
 * only one of the three a hand-written palette would have got right.
 */
describe('a phase-2 picture template is the elements the button draws', () => {
  const PICTURES: [string, string, string, string][] = [
    ['Port', UML_ROLE.port, 'port', UML_ROLE.label],
    [
      'Provided interface',
      UML_ROLE['provided-interface'],
      'provided-interface',
      UML_ROLE.label,
    ],
    [
      'Required interface',
      UML_ROLE['required-interface'],
      'required-interface',
      UML_ROLE.label,
    ],
    // The three cubes are NAMED, not labelled: their seed carries §19.4.4's
    // keyword line, which is what a name compartment is for and what the morph
    // rewrites (`actions.ts`).
    ['Node', UML_ROLE.node, 'node', UML_ROLE.name],
    ['Device', UML_ROLE.device, 'device', UML_ROLE.name],
    [
      'Execution environment',
      UML_ROLE['execution-environment'],
      'execution-environment',
      UML_ROLE.name,
    ],
  ];

  for (const [name, role, kind, tier] of PICTURES) {
    it(`${name} is a bodyless shape, one label and the group over them`, () => {
      const entries = Object.entries(named(name));
      expect(entries).toHaveLength(3);

      const shape = entries.find(([, el]) => el.type === 'umlNode');
      expect(shape![1].kind).toBe(kind);
      expect(shape![1].role).toBe(role);
      // NO text on the shape, whatever the picture: R16 applies to a cube and
      // to a 16-unit square exactly as it applies to a class box.
      expect(shape![1].text).toBeUndefined();

      const text = entries.find(([, el]) => el.type === 'text');
      expect(text![1].role).toBe(tier);
    });
  }
});

/**
 * The behaviour marks, which are the first artefacts in this pack that are ONE
 * element.
 *
 * §15.3.4 and §14.2.4 name none of them — an initial node has no name, a fork
 * has no name, a history mark is an `H` — so creation seeds nothing and there
 * is no group either, because a group of one element is a wrapper a user would
 * have to descend through to reach the mark it holds (`actions.ts`).
 */
describe('a behaviour template is the elements the button draws', () => {
  it('drops an unlabelled mark as the shape and nothing else', () => {
    for (const [name, role, kind] of [
      ['Initial node', UML_ROLE.initial, 'initial'],
      ['Activity final', UML_ROLE['activity-final'], 'activity-final'],
      ['Decision', UML_ROLE.decision, 'decision'],
      ['Fork', UML_ROLE.fork, 'fork'],
      ['Final state', UML_ROLE['final-state'], 'final-state'],
      ['Junction', UML_ROLE.junction, 'junction'],
      ['Terminate', UML_ROLE.terminate, 'terminate'],
    ] as const) {
      const entries = Object.entries(named(name));
      expect(entries, name).toHaveLength(1);
      const [, mark] = entries[0];
      expect(mark.type, name).toBe('umlNode');
      expect(mark.kind, name).toBe(kind);
      expect(mark.role, name).toBe(role);
      // R16 all the same: nothing is written ON the shape, there is simply
      // nothing to write.
      expect(mark.text, name).toBeUndefined();
    }
  });

  it('gives the labelled behaviour kinds one `uml:label` and a group', () => {
    // One tier for all six, and the STATE is the one worth naming: its
    // `entry / …` lines are written under its name in that same text, so the
    // renderer draws the name compartment exactly when an author writes
    // behaviour into it (§14.2.4).
    for (const [name, role, kind] of [
      ['Action', UML_ROLE.action, 'action'],
      ['Object node', UML_ROLE['object-node'], 'object-node'],
      ['Send signal', UML_ROLE['send-signal'], 'send-signal'],
      ['Accept event', UML_ROLE['accept-event'], 'accept-event'],
      ['Time event', UML_ROLE['time-event'], 'time-event'],
      ['State', UML_ROLE.state, 'state'],
    ] as const) {
      const entries = Object.entries(named(name));
      expect(entries, name).toHaveLength(3);
      const shape = entries.find(([, el]) => el.type === 'umlNode');
      expect(shape![1].kind, name).toBe(kind);
      expect(shape![1].role, name).toBe(role);
      expect(shape![1].text, name).toBeUndefined();
      const text = entries.find(([, el]) => el.type === 'text');
      expect(text![1].role, name).toBe(UML_ROLE.label);
    }
  });
});

/** The frames: the sheet, and the three boundaries drawn round part of it. */
describe('the frame templates', () => {
  it('the diagram is one sheet, with a kind and a name', () => {
    const entries = Object.entries(named('UML diagram'));
    expect(entries).toHaveLength(1);
    const [, diagram] = entries[0];
    expect(diagram.type).toBe('umlDiagram');
    expect(diagram.role).toBe(UML_ROLE.diagram);
    expect(diagram.kind).toBe('class');
  });

  it('the subject is one frame carrying its own name', () => {
    const entries = Object.entries(named('Subject'));
    expect(entries).toHaveLength(1);
    const [, subject] = entries[0];
    expect(subject.type).toBe('umlSubject');
    expect(subject.role).toBe(UML_ROLE.subject);
    expect(subject.name).toBeTruthy();
  });

  it('the partition and the region are frames of the same shape', () => {
    // §15.6.4's swimlane and §14.2.4's composite state: one element each,
    // carrying a name and nothing else. The partition writes NO `orientation`
    // — the model's own default is vertical, and a creation restating it would
    // be a second place for it to be changed (`actions.ts`).
    for (const [name, type, role] of [
      ['Partition', 'umlPartition', UML_ROLE.partition],
      ['Region', 'umlRegion', UML_ROLE.region],
    ] as const) {
      const entries = Object.entries(named(name));
      expect(entries, name).toHaveLength(1);
      const [, frame] = entries[0];
      expect(frame.type, name).toBe(type);
      expect(frame.role, name).toBe(role);
      expect(frame.name, name).toBeTruthy();
      expect(frame, name).not.toHaveProperty('orientation');
    }
  });
});
