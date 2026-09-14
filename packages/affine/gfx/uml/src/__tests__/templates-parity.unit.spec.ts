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
 * The palette is the ten artefact commands. The nine relationship TOOLS arm the
 * connector and draw nothing, so they have no artefact to record, and the two
 * exports are not artefact commands at all. A future entry that is not derived
 * has to declare itself here.
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
    expect(artefacts).toHaveLength(10);
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
    // object is the one classifier that is four elements rather than five.
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
});

/** The two frames: the sheet and the boundary drawn round part of it. */
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
});
