import { snapshotFromAction } from '@labre/affine-gfx-template';
import { TextFitMode } from '@labre/affine-model';
import type { CommandInvocation } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { WARDLEY_BACKGROUND } from '../background';
import { wardleyCommands } from '../commands';
import {
  WARDLEY_LABEL_W,
  WARDLEY_NODE_LABEL,
  wardleyNodeProps,
  type WardleyArtefactKind,
} from '../presets';
import { WARDLEY_ROLE } from '../roles';
import { wardleyTemplateCategory } from '../templates';

/**
 * The guard the palette never had: **a template must be what its command
 * draws.**
 *
 * The templates were written by hand in June 2026 and the toolbox kept moving —
 * nodes started travelling grouped with their name (#51), backgrounds gained
 * `role: wardley:map` and `resizeEnabled` (#77), the inertia bar gained a fit
 * mode — and nothing in the repository compared the two. The existing tests
 * checked that a template's own snapshot obeys the rules; a template that
 * obeyed the rules while producing a different artefact from the button next to
 * it passed all of them.
 *
 * So: every single-artefact template is DERIVED (`templateFromCommand` runs the
 * command against a recording surface), and this file re-runs the command and
 * compares. The two shipped maps cannot derive — a canonical map is an
 * arrangement of a dozen artefacts, which no one command draws — so they are
 * checked on COMPOSITION instead: the same presets, the same roles, and the
 * groups the toolbox writes.
 */

/** A template's stored snapshot, as far as this file reads it. */
type Snapshot = {
  blocks: { children: { props: { elements: Record<string, RawElement> } }[] };
};

type RawElement = {
  type?: string;
  kind?: string;
  role?: string;
  shapeType?: string;
  xywh?: string;
  textFitMode?: string;
  resizeEnabled?: boolean;
  children?: { json?: Record<string, boolean> };
};

/**
 * The invocation a derived template is recorded under.
 *
 * Any value does: a Wardley command's `run` hands the `GfxController` to its
 * action and reads nothing else off the invocation, so the recording cannot
 * depend on it. Spelled out rather than cast, so the day one does the failure
 * is a comparison rather than a crash.
 */
const INVOCATION: CommandInvocation = {
  surface: 'senior-menu',
  source: 'internal',
};

/**
 * The five templates written by hand, and why each one is.
 *
 * The two maps are arrangements no command draws. "Link", "Evolution arrow" and
 * "Area (polygon)" are the three whose commands activate a TOOL and draw
 * nothing at all, so there is no artefact to record — the user draws it. Their
 * cards still offer the artefact ready-made, because a panel card inserts a
 * snapshot and cannot arm a tool.
 */
const HAND_AUTHORED = [
  'Tea Shop',
  'Kodak inertia',
  'Link',
  'Evolution arrow',
  'Area (polygon)',
];

const shipped = wardleyTemplateCategory.templates;
if (typeof shipped === 'function') {
  throw new Error('the Wardley template category is expected to be eager');
}
const templates = shipped;

const elementsOf = (template: (typeof templates)[number]) =>
  (template.content as unknown as Snapshot).blocks.children[0].props.elements;

const mapNamed = (name: string) => {
  const found = templates.find(template => template.name === name);
  if (!found) throw new Error(`no template named "${name}"`);
  return elementsOf(found);
};

/** `id → the groups that claim it`, read off `children.json`. */
function membership(elements: Record<string, RawElement>) {
  const of = new Map<string, string[]>();
  for (const [groupId, element] of Object.entries(elements)) {
    if (element.type !== 'group') continue;
    for (const childId of Object.keys(element.children?.json ?? {})) {
      of.set(childId, [...(of.get(childId) ?? []), groupId]);
    }
  }
  return of;
}

describe('the Wardley palette covers the toolbox', () => {
  const artefacts = wardleyCommands.filter(
    command => command.kind === 'artefact'
  );

  it('ships one derived template per artefact command', () => {
    expect(artefacts.length).toBeGreaterThan(0);
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
});

describe('every derived template is what its command draws', () => {
  for (const template of templates) {
    if (template.commandId === undefined) continue;
    const command = wardleyCommands.find(
      entry => entry.id === template.commandId
    );

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

describe('the shipped maps are composed of the same presets', () => {
  for (const name of ['Tea Shop', 'Kodak inertia']) {
    describe(name, () => {
      const elements = mapNamed(name);
      const groupsOf = membership(elements);
      const nodes = Object.entries(elements).filter(
        ([, element]) => element.type === 'wardleyNode'
      );

      it('draws every node from `wardleyNodeProps`', () => {
        expect(nodes.length).toBeGreaterThan(5);
        for (const [id, element] of nodes) {
          const kind = element.kind as WardleyArtefactKind;
          const preset = wardleyNodeProps(kind, { xywh: element.xywh ?? '' });
          expect(
            {
              type: element.type,
              kind: element.kind,
              role: element.role,
              shapeType: element.shapeType,
            },
            id
          ).toEqual({
            type: preset.type,
            kind: preset.kind,
            role: preset.role,
            shapeType: preset.shapeType,
          });
          expect(element.role, id).toBe(
            WARDLEY_ROLE[kind as keyof typeof WARDLEY_ROLE]
          );
        }
      });

      it('groups every named artefact with its name', () => {
        for (const [id, element] of nodes) {
          if (!(element.kind! in WARDLEY_NODE_LABEL)) continue;
          const groups = groupsOf.get(id) ?? [];
          expect(groups, `groups of ${id}`).toHaveLength(1);
          const siblings = Object.keys(
            elements[groups[0]].children?.json ?? {}
          ).filter(childId => childId !== id);
          expect(siblings, `siblings of ${id}`).toHaveLength(1);
          const label = elements[siblings[0]];
          expect(label.type, siblings[0]).toBe('text');
          expect(label.role, siblings[0]).toBe(WARDLEY_ROLE.label);
        }
      });

      it('leaves no name outside a group', () => {
        for (const [id, element] of Object.entries(elements)) {
          if (element.role !== WARDLEY_ROLE.label) continue;
          expect(
            groupsOf.get(id),
            `${id} is a name nothing carries`
          ).toHaveLength(1);
        }
      });

      it('never lets an inertia bar deform around its text', () => {
        const bars = Object.values(elements).filter(
          element => element.role === WARDLEY_ROLE.inertia
        );
        for (const bar of bars) {
          expect(bar.textFitMode).toBe(TextFitMode.Overflow);
        }
      });

      it('lays itself on a declared map', () => {
        const backgrounds = Object.values(elements).filter(
          element => element.type === WARDLEY_BACKGROUND.type
        );
        expect(backgrounds).toHaveLength(1);
        expect(backgrounds[0].role).toBe(WARDLEY_BACKGROUND.role);
        expect(backgrounds[0].resizeEnabled).toBe(false);
      });
    });
  }
});

/**
 * The case the PO reported, spelled out: an ecosystem dropped from the palette
 * must arrive as the THREE elements the button produces, not as two loose ones
 * that walk apart the first time somebody drags the circle.
 */
describe('Ecosystem, the reported case', () => {
  const elements = mapNamed('Ecosystem');

  it('is a circle, its name, and the group that carries both', () => {
    const entries = Object.entries(elements);
    expect(entries).toHaveLength(3);

    const node = entries.find(([, el]) => el.type === 'wardleyNode');
    const label = entries.find(([, el]) => el.type === 'text');
    const group = entries.find(([, el]) => el.type === 'group');
    expect(node && label && group).toBeTruthy();

    expect(node![1].kind).toBe('ecosystem');
    expect(node![1].shapeType).toBe('ellipse');
    expect(node![1].role).toBe(WARDLEY_ROLE.ecosystem);

    expect(label![1].role).toBe(WARDLEY_ROLE.label);
    const [, , width] = JSON.parse(label![1].xywh!) as number[];
    expect(width).toBe(WARDLEY_LABEL_W);

    expect(Object.keys(group![1].children?.json ?? {}).sort()).toEqual(
      [node![0], label![0]].sort()
    );
  });
});
