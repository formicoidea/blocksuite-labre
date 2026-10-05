import { readElement, readingProfileFor } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { CORE_DOMAIN_BACKGROUND } from '../core-domain/background';
import {
  CORE_DOMAIN_MARKER_READING,
  CORE_DOMAIN_READING,
  CORE_DOMAIN_READINGS,
} from '../reading.js';
import { CORE_DOMAIN_ROLE, CORE_DOMAIN_ROLES } from '../roles.js';

/**
 * MF3 — what the Core Domain Chart declaration lets the tool read.
 *
 * The engine's own behaviour is tested in `blocks/surface`, against a made-up
 * framework. This one owns the DATA: that both node families are readable, that
 * the chart is not, and that the movement is read the way `roles.ts` declares
 * it.
 */

type Stub = {
  id: string;
  role?: string;
  bound?: [number, number, number, number];
  text?: string;
  source?: string;
  target?: string;
};

function element({
  id,
  role,
  bound = [0, 0, 40, 40],
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
  define('text', text);
  define('group', null);
  define('elementBound', new Bound(...bound));
  if (source !== undefined) define('source', { id: source });
  if (target !== undefined) define('target', { id: target });
  return el;
}

const profileOf = (role: string | undefined) =>
  readingProfileFor(element({ id: 'x', role }), CORE_DOMAIN_READINGS);

describe('what a Core Domain Chart is read as', () => {
  it('gives every role-carrying NODE a profile, and the chart none', () => {
    const unread = Object.values(CORE_DOMAIN_ROLES)
      .filter(def => def.kind === 'node' && def.id !== CORE_DOMAIN_ROLE.chart)
      .filter(def => profileOf(def.id) === null)
      .map(def => def.id);
    expect(unread).toEqual([]);

    expect(profileOf(CORE_DOMAIN_ROLE.chart)).toBeNull();
    expect(profileOf(undefined)).toBeNull();
  });

  it('keeps the two families apart, as the vocabulary does', () => {
    // A sub-domain is PLOTTED at a (differentiation, complexity) position; a
    // Team Topologies marker annotates the chart. Neither specialises the
    // other, so neither `appliesTo` may cover both.
    expect(profileOf(CORE_DOMAIN_ROLE.platform)?.id).toBe('core-domain');
    expect(profileOf(CORE_DOMAIN_ROLE.collaboration)?.id).toBe(
      'core-domain-marker'
    );
    expect(new Set(CORE_DOMAIN_READINGS.map(p => p.id)).size).toBe(
      CORE_DOMAIN_READINGS.length
    );
  });

  it('reads a dot through its specialisation', () => {
    expect(
      readElement(
        element({ id: 'd', role: CORE_DOMAIN_ROLE.bcCurrent }),
        [],
        CORE_DOMAIN_READING
      )!.nodeType
    ).toEqual({
      roleId: CORE_DOMAIN_ROLE.bcCurrent,
      labelKey: 'com.labre.core-domain.role.bc-current',
      specialises: [CORE_DOMAIN_ROLE.subdomain],
    });
  });

  it('reads a movement as where it goes and where it came from', () => {
    // ADR 0010 tier 2 on this role: the verb is "is moving to", so the SOURCE
    // is where the context stands today.
    const me = element({
      id: 'me',
      role: CORE_DOMAIN_ROLE.bcCurrent,
      text: 'Billing',
    });
    const future = element({
      id: 'f',
      role: CORE_DOMAIN_ROLE.bcFuture,
      text: 'Billing (target)',
    });

    const relations = readElement(
      me,
      [
        me,
        future,
        element({
          id: 'm',
          role: CORE_DOMAIN_ROLE.movement,
          source: 'me',
          target: 'f',
        }),
      ],
      CORE_DOMAIN_READING
    )!.relations;

    expect(relations.map(r => [r.otherName, r.side])).toEqual([
      ['Billing (target)', 'supplier'],
    ]);
    expect(CORE_DOMAIN_READING.relation?.sides).toEqual({
      consumer: {
        labelKey: 'com.labre.core-domain.reading.relations.consumer',
        labelFallback: 'Moved from',
      },
      supplier: {
        labelKey: 'com.labre.core-domain.reading.relations.supplier',
        labelFallback: 'Moves to',
      },
    });
  });

  it('never contradicts the drawing, proposes no nature, reads no phase', () => {
    // The chart's two axes are a PLANE: a movement drawn upwards is a claim
    // about complexity, not an ordering the engine may second-guess. What is
    // read off the chart is a quadrant, in the plane, never along an axis.
    for (const profile of CORE_DOMAIN_READINGS) {
      expect(profile.relation?.geometry, profile.id).toBeUndefined();
      expect(profile.nature, profile.id).toBeUndefined();
      expect(profile.frame?.axis, profile.id).toBeUndefined();
    }

    const low = element({
      id: 'lo',
      role: CORE_DOMAIN_ROLE.bcCurrent,
      bound: [0, 300, 40, 40],
    });
    const high = element({
      id: 'hi',
      role: CORE_DOMAIN_ROLE.bcFuture,
      bound: [0, 0, 40, 40],
    });
    const reading = readElement(
      low,
      [
        low,
        high,
        element({
          id: 'm',
          role: CORE_DOMAIN_ROLE.movement,
          source: 'lo',
          target: 'hi',
        }),
      ],
      CORE_DOMAIN_READING
    )!;
    expect(reading.relations.every(r => !r.contradictsGeometry)).toBe(true);
    expect(reading.nature).toBeUndefined();
    expect(reading.naming).toBeUndefined();
    expect(reading.phase).toBeUndefined();
  });
});

/**
 * Why this block exists: the reading panel could not say which quadrant a
 * sub-domain sits in, and the one reader that could (the audit) ignored the
 * chart's variant. The zone is read off the declaration's own rectangles, among
 * those of the reading the chart is turned to, and named the way the chart
 * names it — the user's renamed label included.
 */
describe('the zone a sub-domain sits in', () => {
  const { width, height, margin } = CORE_DOMAIN_BACKGROUND.geometry;
  const plotW = width - margin.left - margin.right;
  const plotH = height - margin.top - margin.bottom;

  /** A chart at its birth size at the origin, turned to `variant`. */
  const chart = (props: Record<string, unknown>) => {
    const el = element({
      id: 'chart',
      role: CORE_DOMAIN_ROLE.chart,
      bound: [0, 0, width, height],
    });
    for (const [key, value] of Object.entries(props)) {
      Object.defineProperty(el, key, { value, configurable: true });
    }
    return el;
  };

  /** A dot centred on the middle of the declared zone `id`. */
  const dotIn = (id: string) => {
    const zone = CORE_DOMAIN_BACKGROUND.zones!.find(z => z.id === id)!;
    const cx = margin.left + (zone.rect.x + zone.rect.w / 2) * plotW;
    const cy = margin.top + (zone.rect.y + zone.rect.h / 2) * plotH;
    return element({
      id: 'dot',
      role: CORE_DOMAIN_ROLE.bcCurrent,
      bound: [cx - 10, cy - 10, 20, 20],
    });
  };

  const zoneOf = (
    dot: GfxPrimitiveElementModel,
    frame: GfxPrimitiveElementModel
  ) => readElement(dot, [frame, dot], CORE_DOMAIN_READING)!.phase;

  it('is the classic quadrant the dot sits in, in the chart’s vocabulary', () => {
    expect(zoneOf(dotIn('core'), chart({ variant: 'classic' }))).toEqual({
      zoneId: 'core',
      labelKey: 'com.labre.core-domain.background.zone.core',
      labelFallback: 'Core',
      inTransitionBand: false,
    });
  });

  it('reads the migration quadrants on a chart turned to migration', () => {
    // The centre of the classic `core` quadrant is in the upper-right quarter
    // of the plot — `risk-seeking` in the migration reading.
    expect(zoneOf(dotIn('core'), chart({ variant: 'migration' }))?.zoneId).toBe(
      'risk-seeking'
    );
  });

  it('names a renamed quadrant the way the chart paints it', () => {
    expect(
      zoneOf(dotIn('core'), chart({ variant: 'classic', zoneCore: 'Cœur' }))
    ).toMatchObject({ zoneId: 'core', name: 'Cœur' });
  });

  it('reads no zone in the strip left of "Generic"', () => {
    // The classic quadrants start 10 reference units into the plot; this dot's
    // centre is 3 units in.
    const dot = element({
      id: 'dot',
      role: CORE_DOMAIN_ROLE.bcCurrent,
      bound: [margin.left, height / 2, 6, 6],
    });
    expect(zoneOf(dot, chart({ variant: 'classic' }))).toBeUndefined();
  });

  it('frames the sub-domains only, under the heading "Zone"', () => {
    expect(CORE_DOMAIN_READING.frame?.label).toEqual({
      labelKey: 'com.labre.core-domain.reading.field.zone',
      labelFallback: 'Zone',
    });
    // A Team Topologies marker annotates an interaction, not a position.
    expect(CORE_DOMAIN_MARKER_READING.frame).toBeUndefined();
  });
});
