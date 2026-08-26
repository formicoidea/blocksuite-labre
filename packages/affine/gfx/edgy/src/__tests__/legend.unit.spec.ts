import { autoLegendSections } from '@labre/affine-gfx-ddd-shared';
import { describe, expect, it } from 'vitest';

import { EDGY_AUTO_LEGEND } from '../legend';
import {
  EDGY_DYNAMIC_NODES,
  EDGY_ZONE_FILL,
  EDGY_ZONES,
  edgyElementLabel,
  type EdgyElementName,
} from '../metamodel';
import { NODE_FILL, NODE_LABEL, NODE_STROKE } from '../node/consts';
import { EDGY_ROLE, EDGY_ROLES, EDGY_VERB_ROLE } from '../roles';

/**
 * The EDGY auto-legend is a TABLE over the metamodel. What is worth freezing is
 * its DERIVATION: every element the metamodel declares has its row, the colour
 * the legend shows for one IS the colour the diagram paints it with, and the
 * wording comes from the vocabulary — so a thirteenth element gets its row for
 * free and a re-coloured zone re-colours its swatches.
 */
describe('the EDGY auto-legend table derives from the metamodel', () => {
  const entries = EDGY_AUTO_LEGEND.sections.flatMap(s => s.entries);

  it('groups by zone: the three facets, the intersections, the bases, the relations', () => {
    expect(EDGY_AUTO_LEGEND.sections.map(s => s.title)).toEqual([
      ...EDGY_ZONES.filter(z => z.group === 'facet').map(z =>
        edgyElementLabel(z.id)
      ),
      'Intersections',
      'Base elements',
      'Relations',
    ]);
  });

  it('gives each of the twelve official elements exactly one row', () => {
    const names = Object.keys(EDGY_DYNAMIC_NODES) as EdgyElementName[];
    const listed = entries
      .map(e => e.role)
      .filter(role => names.some(name => EDGY_ROLE[name] === role));
    expect(listed).toHaveLength(names.length);
    expect(new Set(listed).size).toBe(names.length);
    for (const name of names) {
      expect(listed, `no legend row for ${name}`).toContain(EDGY_ROLE[name]);
    }
  });

  it('shows each element in the fill its zone is drawn with', () => {
    for (const [name, node] of Object.entries(EDGY_DYNAMIC_NODES) as [
      EdgyElementName,
      (typeof EDGY_DYNAMIC_NODES)[EdgyElementName],
    ][]) {
      const entry = entries.find(e => e.role === EDGY_ROLE[name]);
      expect(entry?.row.color).toBe(EDGY_ZONE_FILL[node.zone]);
      expect(entry?.row.swatch).toBe('square');
      // The wording is the vocabulary's, which is the metamodel's own name.
      expect(entry?.row.label).toBe(edgyElementLabel(name));
      expect(entry?.row.label).toBe(EDGY_ROLES[EDGY_ROLE[name]].labelFallback);
    }
  });

  it('lists the four base elements in the fill the palette gives them', () => {
    const base = EDGY_AUTO_LEGEND.sections.find(
      s => s.title === 'Base elements'
    );
    expect(base?.entries.map(e => e.role)).toEqual([
      EDGY_ROLE.people,
      EDGY_ROLE.outcome,
      EDGY_ROLE.object,
      EDGY_ROLE.activity,
    ]);
    expect(base?.entries.map(e => e.row.color)).toEqual(
      Array(4).fill(NODE_FILL)
    );
    expect(base?.entries.map(e => e.row.label)).toEqual([
      NODE_LABEL.people,
      NODE_LABEL.outcome,
      NODE_LABEL.object,
      NODE_LABEL.activity,
    ]);
  });

  it('says "Relation" once, in the stroke relations are drawn with', () => {
    const relations = EDGY_AUTO_LEGEND.sections.find(
      s => s.title === 'Relations'
    );
    expect(relations?.entries).toHaveLength(1);
    const [entry] = relations!.entries;
    expect(entry.role).toBe(EDGY_ROLE.relation);
    expect(entry.row.swatch).toBe('line');
    expect(entry.row.color).toBe(NODE_STROKE);
    expect(entry.row.label).toBe(EDGY_ROLES[EDGY_ROLE.relation].labelFallback);
  });

  it('names only roles the vocabulary declares', () => {
    for (const entry of entries) {
      expect(EDGY_ROLES[entry.role], `undeclared role ${entry.role}`).toBeDefined();
    }
  });
});

describe('what an EDGY board puts in its legend', () => {
  const labels = (present: string[]) =>
    autoLegendSections(new Set(present), EDGY_AUTO_LEGEND).map(s => ({
      title: s.title,
      rows: s.rows.map(r => r.label),
    }));

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
    const exact = EDGY_AUTO_LEGEND.sections
      .flatMap(s => s.entries)
      .filter(e => e.exact)
      .map(e => e.role);
    expect(exact).toEqual([
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
      const titles = labels([EDGY_ROLE[name]]).map(s => s.title);
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
