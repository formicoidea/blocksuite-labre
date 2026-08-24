import { readElement } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { WARDLEY_NATURE, WARDLEY_NATURE_TAG_ID } from '../natures';
import { WARDLEY_NAMING_CONVENTIONS, WARDLEY_READING } from '../reading';
import { WARDLEY_ROLE } from '../roles';

/**
 * MF3 — what the WARDLEY declaration lets the tool read.
 *
 * The engine's own behaviour is tested in `blocks/surface`, against a made-up
 * framework, so that neither suite can hide a Wardley assumption inside the
 * engine. This one owns the DATA: that the profile points at the real roles,
 * the real nature tag and the real map, and that the naming convention retained
 * is the one the PR describes — one motif, four entries, no word list.
 */

/** The reference map: 1600 × 900 at the origin, as the corpus draws it. */
const MAP = new Bound(0, 0, 1600, 900);

type Stub = {
  id: string;
  role?: string;
  bound: Bound;
  tags?: Record<string, string[]>;
  text?: string;
  source?: string;
  target?: string;
};

function element({
  id,
  role,
  bound,
  tags,
  text,
  source,
  target,
}: Stub): GfxPrimitiveElementModel {
  const el = Object.create(
    GfxPrimitiveElementModel.prototype
  ) as GfxPrimitiveElementModel;
  const define = (key: string, value: unknown) =>
    Object.defineProperty(el, key, { value, configurable: true });

  define('id', id);
  define('role', role);
  define('tags', tags);
  define('text', text);
  define('group', null);
  define('elementBound', bound);
  if (source !== undefined) define('source', { id: source });
  if (target !== undefined) define('target', { id: target });
  return el;
}

const map = () =>
  element({ id: 'map', role: WARDLEY_ROLE.map, bound: MAP });

/** A node whose CENTRE sits at the given fraction of the map. */
const node = (
  id: string,
  fx: number,
  fy: number,
  props: Partial<Stub> = {}
): GfxPrimitiveElementModel =>
  element({
    id,
    role: WARDLEY_ROLE.component,
    bound: new Bound(MAP.x + fx * MAP.w - 9, MAP.y + fy * MAP.h - 9, 18, 18),
    ...props,
  });

/**
 * The naming conventions declare `lang: 'en'`, so the language the host serves
 * is part of every reading that reaches them. English unless a test says
 * otherwise — that is the scope this pack ships for.
 */
const read = (
  subject: GfxPrimitiveElementModel,
  rest: GfxPrimitiveElementModel[],
  /** `null` is a host that says nothing — distinct from the default. */
  lang: string | null = 'en'
) =>
  readElement(subject, [subject, ...rest], WARDLEY_READING, {
    lang: lang ?? undefined,
  });

describe('what a Wardley map is read as', () => {
  it('reads a component, and a market through its specialisation', () => {
    expect(read(node('a', 0.5, 0.5), [])!.nodeType.roleId).toBe(
      WARDLEY_ROLE.component
    );

    const market = node('m', 0.5, 0.5);
    Object.defineProperty(market, 'role', {
      value: WARDLEY_ROLE.market,
      configurable: true,
    });
    expect(read(market, [])!.nodeType).toMatchObject({
      roleId: WARDLEY_ROLE.market,
      specialises: [WARDLEY_ROLE.component],
    });
  });

  it('does not read an anchor: a need has a demand, not a nature', () => {
    const anchor = node('a', 0.5, 0.2);
    Object.defineProperty(anchor, 'role', {
      value: WARDLEY_ROLE.anchor,
      configurable: true,
    });
    expect(read(anchor, [map()])).toBeNull();
  });

  it('reads the four evolution phases off the map’s own zones', () => {
    const phaseAt = (fx: number) => read(node('a', fx, 0.5), [map()])!.phase;

    expect(phaseAt(0.08)?.zoneId).toBe('genesis');
    expect(phaseAt(0.3)?.zoneId).toBe('custom-built');
    expect(phaseAt(0.55)?.zoneId).toBe('product');
    expect(phaseAt(0.9)?.zoneId).toBe('commodity');
  });

  it('names the zone of punctuated equilibrium at a frontier', () => {
    // `transitionBandWidth: 0.1` — ±5% of the plot around the divider at 0.4,
    // which is the band the PO recette of 01/08/2026 calibrated.
    const phase = read(node('a', 0.41, 0.5), [map()])!.phase;
    expect(phase).toMatchObject({
      zoneId: 'product',
      inTransitionBand: true,
      bandId: 'custom-built|product',
    });
  });

  it('reads a dependency as consumer above and supplier below', () => {
    const me = node('me', 0.5, 0.4);
    const supplier = node('db', 0.5, 0.8);
    const consumer = node('ui', 0.5, 0.1);
    const down = element({
      id: 'e1',
      role: WARDLEY_ROLE.dependency,
      bound: MAP,
      source: 'me',
      target: 'db',
    });
    const up = element({
      id: 'e2',
      role: WARDLEY_ROLE.dependency,
      bound: MAP,
      source: 'ui',
      target: 'me',
    });

    const relations = read(me, [map(), supplier, consumer, down, up])!.relations;
    expect(
      relations.map(relation => [relation.otherId, relation.side])
    ).toEqual([
      ['db', 'supplier'],
      ['ui', 'consumer'],
    ]);
    expect(relations.some(relation => relation.contradictsGeometry)).toBe(false);
  });

  it('reports an upside-down dependency without picking a winner', () => {
    // ADR 0010 § 2: the source is the consumer. Drawn with its supplier ABOVE
    // it, the edge says the opposite of the positions — and the reading says
    // exactly that, on the fiche, before any rule fires.
    const me = node('me', 0.5, 0.8);
    const supplier = node('db', 0.5, 0.2);
    const edge = element({
      id: 'e',
      role: WARDLEY_ROLE.dependency,
      bound: MAP,
      source: 'me',
      target: 'db',
    });

    expect(read(me, [map(), supplier, edge])!.relations[0]).toMatchObject({
      side: 'supplier',
      contradictsGeometry: true,
    });
  });

  it('never invents a nature', () => {
    const reading = read(node('a', 0.5, 0.5), [map()])!;
    expect(reading.nature).toBeUndefined();
    expect(reading.naming).toBeUndefined();
  });
});

describe('the naming convention, as data', () => {
  const named = (name: string, nature: string) =>
    node('a', 0.5, 0.5, {
      text: name,
      tags: { [WARDLEY_NATURE_TAG_ID]: [nature] },
    });

  const conforms = (name: string, nature: string) =>
    read(named(name, nature), [map()])!.naming?.conforms;

  it('covers the four natures and nothing else', () => {
    expect(WARDLEY_NAMING_CONVENTIONS.map(c => c.valueId).sort()).toEqual(
      Object.values(WARDLEY_NATURE).sort()
    );
  });

  it('expects an activity to read as an action', () => {
    expect(conforms('Brewing tea', WARDLEY_NATURE.activity)).toBe(true);
    expect(conforms('Tea', WARDLEY_NATURE.activity)).toBe(false);
  });

  it('expects data, practice and knowledge to read as things', () => {
    expect(conforms('Customer register', WARDLEY_NATURE.data)).toBe(true);
    expect(conforms('Registering customers', WARDLEY_NATURE.data)).toBe(false);
    expect(conforms('Agile method', WARDLEY_NATURE.practice)).toBe(true);
    expect(conforms('Thermodynamics', WARDLEY_NATURE.knowledge)).toBe(true);
  });

  it('is a suggestion with its own words, never a verdict', () => {
    const naming = read(
      named('Tea', WARDLEY_NATURE.activity),
      [map()]
    )!.naming!;
    expect(naming.conforms).toBe(false);
    expect(naming.hintKey).toBe('com.labre.wardley.reading.naming.activity');
    expect(naming.hintFallback).toContain('verb');
  });

  it('declares its language, and is silent outside it', () => {
    // The gerund is a fact about English. On a board named in French the same
    // motif is wrong in both directions — "Facturation" told to use a verb,
    // "Planning" told it reads as an action — so the pack scopes itself and the
    // engine keeps quiet, including when the host says nothing at all.
    expect(WARDLEY_NAMING_CONVENTIONS.every(c => c.lang === 'en')).toBe(true);

    const french = named('Facturation', WARDLEY_NATURE.activity);
    expect(read(french, [map()], 'fr')!.naming).toBeUndefined();
    expect(read(french, [map()], null)!.naming).toBeUndefined();
    // …and in scope it answers, which is what makes the silence a scope and not
    // a bug.
    expect(read(french, [map()], 'en')!.naming?.conforms).toBe(false);
  });

  it('judges a wrapped name on what it says', () => {
    // A Wardley label is a free text element and wraps.
    expect(conforms('Customer\nregister', WARDLEY_NATURE.data)).toBe(true);
    expect(conforms('Brewing\ntea', WARDLEY_NATURE.activity)).toBe(true);
    expect(conforms('Registering\ncustomers', WARDLEY_NATURE.data)).toBe(false);
  });

  it('ships one motif, applied positively once and negatively three times', () => {
    // The property that keeps the two forms from drifting: the negative
    // conventions are the positive motif under a lookahead.
    const positive = WARDLEY_NAMING_CONVENTIONS.filter(
      c => !c.pattern.startsWith('^(?!')
    );
    expect(positive.map(c => c.valueId)).toEqual([WARDLEY_NATURE.activity]);
    for (const convention of WARDLEY_NAMING_CONVENTIONS) {
      expect(convention.pattern).toContain('ing');
    }
  });
});
