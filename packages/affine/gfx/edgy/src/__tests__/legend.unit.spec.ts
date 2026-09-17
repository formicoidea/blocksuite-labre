import { legendFromCommands } from '@labre/affine-block-surface';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import {
  type BlockStdScope,
  CommandDescriptorIdentifier,
  type CommandLegendEntry,
} from '@labre/std';
import { describe, expect, it } from 'vitest';

import { edgyCommands } from '../commands';
import {
  EDGY_DYNAMIC_NODES,
  EDGY_ZONE_FILL,
  EDGY_ZONES,
  edgyElementLabel,
  edgyElementLabelKey,
  type EdgyElementName,
} from '../metamodel';
import { NODE_FILL, NODE_LABEL, NODE_STROKE } from '../node/consts';
import { EDGY_ROLE, EDGY_ROLES, EDGY_VERB_ROLE } from '../roles';

/**
 * The EDGY legend is a SUBSCRIPTION over the metamodel (`docs/adr/0026`): every
 * row is declared by the command that draws the artefact, so there is no second
 * table here to keep in step with the first. What is worth freezing is the
 * DERIVATION — every element the metamodel declares has its row, the colour the
 * legend shows for one IS the colour the diagram paints it with, and the wording
 * comes from the vocabulary, so a thirteenth element gets its row for free and a
 * re-coloured zone re-colours its swatches.
 */

/** Every row the toolbox subscribes, in the order its commands declare them. */
const entries: CommandLegendEntry[] = edgyCommands.flatMap(command =>
  command.legend
    ? Array.isArray(command.legend)
      ? [...command.legend]
      : [command.legend]
    : []
);

/**
 * A std with the toolbox registered and NO host catalogue, so
 * `legendFromCommands` reads exactly the commands the editor registers and every
 * wording falls through to its English fallback.
 */
const LEGEND_STD = {
  provider: {
    getAll: (identifier: unknown) =>
      new Map<string, unknown>(
        identifier === (CommandDescriptorIdentifier as unknown)
          ? edgyCommands.map((command, index) => [`c-${index}`, command])
          : [['edgy', EDGY_ROLES]]
      ),
  },
  getOptional: () => undefined,
} as unknown as BlockStdScope;

const sectionsOf = (present: string[]) =>
  legendFromCommands(LEGEND_STD, 'edgy', new Set(present));

const labels = (present: string[]) =>
  sectionsOf(present).map(section => ({
    title: section.title,
    rows: section.rows.map(row => row.label),
  }));

/** Everything the notation can put on a board, so every row lights up. */
const EVERYTHING = entries.map(entry => entry.role);

describe('the EDGY legend derives from the metamodel', () => {
  it('leaves the box its generic chrome, and declares no layout of its own', () => {
    // Every board that has a legend says "Legend", through the one
    // `BOARD_LEGEND_TITLE` key the platform falls back to — and EDGY's rows are
    // 16-unit colour chips, which is exactly what the shared box is built for.
    expect(edgyCommands.filter(command => command.legendBox)).toEqual([]);
  });

  it('groups by zone: the three facets, the intersections, the bases, the relations', () => {
    expect(sectionsOf(EVERYTHING).map(section => section.title)).toEqual([
      ...EDGY_ZONES.filter(zone => zone.group === 'facet').map(zone =>
        edgyElementLabel(zone.id)
      ),
      'Intersections',
      'Base elements',
      'Relations',
    ]);
    // The facets and the intersections reuse the metamodel's own seed keys —
    // the legend and the facets diagram say "Identity" with ONE key, not two.
    const sectionKeyOf = (name: EdgyElementName) =>
      entries.find(entry => entry.role === EDGY_ROLE[name])?.section?.[0];
    expect(sectionKeyOf('content')).toBe(edgyElementLabelKey('identity'));
    expect(sectionKeyOf('organisation')).toBe(
      'com.labre.edgy.seed.intersections-title'
    );
  });

  it('gives each of the twelve official elements exactly one row', () => {
    const names = Object.keys(EDGY_DYNAMIC_NODES) as EdgyElementName[];
    const listed = entries
      .map(entry => entry.role)
      .filter(role => names.some(name => EDGY_ROLE[name] === role));
    expect(listed).toHaveLength(names.length);
    expect(new Set(listed).size).toBe(names.length);
    for (const name of names) {
      expect(listed, `no legend row for ${name}`).toContain(EDGY_ROLE[name]);
    }
    // All twelve on ONE command: they are stamped by the "EDGY dynamic"
    // template and by nothing else, and no "add a Content" gesture exists.
    const dynamic = edgyCommands.find(
      command => command.id === 'edgy.insertDynamic'
    );
    expect(
      (dynamic?.legend as readonly CommandLegendEntry[] | undefined)?.length
    ).toBe(names.length);
  });

  it('shows each element in the fill its zone is drawn with', () => {
    for (const [name, node] of Object.entries(EDGY_DYNAMIC_NODES) as [
      EdgyElementName,
      (typeof EDGY_DYNAMIC_NODES)[EdgyElementName],
    ][]) {
      const entry = entries.find(e => e.role === EDGY_ROLE[name]);
      expect(entry?.row.color).toBe(EDGY_ZONE_FILL[node.zone]);
      expect(entry?.row.swatch).toBe('square');
      // The wording is the vocabulary's, which is the metamodel's own name —
      // and it is nowhere in the subscription, so renaming the role renames it.
      expect(entry).not.toHaveProperty('labelWording');
      expect(labels([EDGY_ROLE[name]])[0].rows).toEqual([
        edgyElementLabel(name),
      ]);
      expect(EDGY_ROLES[EDGY_ROLE[name]].labelFallback).toBe(
        edgyElementLabel(name)
      );
    }
  });

  it('lists the four base elements in the fill the palette gives them', () => {
    const base = sectionsOf(EVERYTHING).find(
      section => section.title === 'Base elements'
    );
    expect(base?.rows.map(row => row.label)).toEqual([
      NODE_LABEL.people,
      NODE_LABEL.outcome,
      NODE_LABEL.object,
      NODE_LABEL.activity,
    ]);
    expect(base?.rows.map(row => row.color)).toEqual(Array(4).fill(NODE_FILL));
    // The order is the four commands' own (`addPeople`…`addActivity`), which is
    // the order the sub-menu offers them in: one `order`, both surfaces.
    expect(
      edgyCommands
        .filter(command => command.legend && command.category === 'elements')
        .map(command => command.id)
    ).toEqual([
      'edgy.addPeople',
      'edgy.addOutcome',
      'edgy.addObject',
      'edgy.addActivity',
    ]);
  });

  it('says "Relation" once, in the stroke relations are drawn with', () => {
    const relations = sectionsOf(EVERYTHING).find(
      section => section.title === 'Relations'
    );
    expect(relations?.rows).toHaveLength(1);
    const [row] = relations!.rows;
    expect(row.swatch).toBe('line');
    expect(row.color).toBe(NODE_STROKE);
    expect(row.label).toBe(EDGY_ROLES[EDGY_ROLE.relation].labelFallback);
  });

  it('names only roles the vocabulary declares', () => {
    for (const entry of entries) {
      expect(
        EDGY_ROLES[entry.role],
        `undeclared role ${entry.role}`
      ).toBeDefined();
    }
  });

  it('never stamps a ROLE on a swatch', () => {
    // A legend is drawn ON the background it documents and the scan is by role:
    // a swatch carrying one would list itself the next time a legend was made.
    for (const entry of entries) {
      expect(entry.row.props ?? {}, entry.role).not.toHaveProperty('role');
    }
  });

  it('lists nothing for the two frames the elements are drawn inside', () => {
    // The facets Venn and the board are the paper, not the drawing.
    for (const id of ['edgy.addFacets', 'edgy.addBoard']) {
      expect(
        edgyCommands.find(command => command.id === id)?.legend,
        id
      ).toBeUndefined();
    }
  });
});

describe('what an EDGY board puts in its legend', () => {
  it('lists the elements actually drawn on it, and nothing else', () => {
    expect(
      labels([EDGY_ROLE.content, EDGY_ROLE.purpose, EDGY_ROLE.task])
    ).toEqual([
      { title: 'Identity', rows: ['Content', 'Purpose'] },
      { title: 'Experience', rows: ['Task'] },
    ]);
  });

  it('recognises a relation through its verb, whichever verb it is', () => {
    for (const verbRole of Object.values(EDGY_VERB_ROLE)) {
      expect(labels([verbRole])).toEqual([
        { title: 'Relations', rows: ['Relation'] },
      ]);
    }
    // ...and the generic role a hand-drawn link carries before the resolver
    // has named it.
    expect(labels([EDGY_ROLE.relation])).toEqual([
      { title: 'Relations', rows: ['Relation'] },
    ]);
  });

  it('lists a base element only when one is on the board BARE', () => {
    // A Content IS an object in the vocabulary, but the board carries no bare
    // Object — so the legend must not claim one.
    expect(labels([EDGY_ROLE.content])).toEqual([
      { title: 'Identity', rows: ['Content'] },
    ]);
    expect(labels([EDGY_ROLE.object])).toEqual([
      { title: 'Base elements', rows: ['Object'] },
    ]);
    expect(labels([EDGY_ROLE.content, EDGY_ROLE.object])).toEqual([
      { title: 'Identity', rows: ['Content'] },
      { title: 'Base elements', rows: ['Object'] },
    ]);
  });

  it('asks for the exact role on the four bases, and only on them', () => {
    // The legend reads the REAL vocabulary — the twelve still specialise their
    // kind for every rule that walks it — so the four base rows have to say for
    // themselves that they mean the bare kind and not the family.
    expect(
      entries.filter(entry => entry.exact).map(entry => entry.role)
    ).toEqual([
      EDGY_ROLE.people,
      EDGY_ROLE.outcome,
      EDGY_ROLE.object,
      EDGY_ROLE.activity,
    ]);
    for (const name of Object.keys(EDGY_DYNAMIC_NODES) as EdgyElementName[]) {
      expect(EDGY_ROLES[EDGY_ROLE[name]].parent).toBe(
        EDGY_ROLE[EDGY_DYNAMIC_NODES[name].kind]
      );
    }
  });

  it('never claims a base kind on a board carrying only its specialisations', () => {
    // Every one of the twelve, drawn alone: the kind it specialises must not
    // put a white square in the box.
    for (const name of Object.keys(EDGY_DYNAMIC_NODES) as EdgyElementName[]) {
      const titles = labels([EDGY_ROLE[name]]).map(section => section.title);
      expect(titles, `${name} lit up the base section`).not.toContain(
        'Base elements'
      );
    }
  });

  it('says nothing about a board nothing is recognised on', () => {
    expect(labels([])).toEqual([]);
    // A neutral drawing and another framework's artefacts are not EDGY.
    expect(labels(['wardley:component'])).toEqual([]);
  });
});

describe('the EDGY base-element neutrals', () => {
  it('fill with the shared notation scale card', () => {
    expect(NODE_FILL).toBe(NOTATION_NEUTRALS.cardFill);
  });

  it('draw in the official EDGY stencil ink, not the scale ink', () => {
    // `stroke:#262626` is what every base-shape pictogram of the EDGY stencil
    // draws with (`pictograms/Shape-*.svg`, `Icon-People.svg`): content of the
    // notation, pinned as a literal so a change of the shared ink cannot move it.
    expect(NODE_STROKE).toBe('#262626');
    expect(NODE_STROKE).not.toBe(NOTATION_NEUTRALS.ink);
  });
});
