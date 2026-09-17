import { readElement, readingProfileFor } from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { CONTEXT_MAP_READING } from '../reading.js';
import {
  CM_PATTERN_ROLE,
  CONTEXT_MAP_ROLE,
  CONTEXT_MAP_ROLES,
} from '../roles.js';

/**
 * MF3 — what the Context Map declaration lets the tool read.
 *
 * The engine's own behaviour is tested in `blocks/surface`, against a made-up
 * framework. This one owns the DATA: that the bounded context is the subject,
 * that the board is not, and that the nine patterns are reached through their
 * parent rather than named one by one.
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
  bound = [0, 0, 160, 60],
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
  readingProfileFor(element({ id: 'x', role }), [CONTEXT_MAP_READING]);

describe('what a Context Map is read as', () => {
  it('gives every role-carrying NODE a profile, the board and the cloud none', () => {
    // `context-map:system` exists so the legend can list the cloud, and for
    // nothing else: the map does not model what is inside it, so there is
    // nothing to read of it — it stays as unread as when it carried no role.
    const frames: string[] = [CONTEXT_MAP_ROLE.board, CONTEXT_MAP_ROLE.system];
    expect(profileOf(CONTEXT_MAP_ROLE.system)).toBeNull();
    const unread = Object.values(CONTEXT_MAP_ROLES)
      .filter(def => def.kind === 'node' && !frames.includes(def.id))
      .filter(def => profileOf(def.id) === null)
      .map(def => def.id);
    expect(unread).toEqual([]);

    // The board is the frame the contexts sit on, exactly so that what is
    // written about them never falls on the card.
    expect(profileOf(CONTEXT_MAP_ROLE.board)).toBeNull();
    expect(profileOf(undefined)).toBeNull();
    expect(profileOf(CONTEXT_MAP_ROLE.relationship)).toBeNull();
  });

  it('reads a context, a root role with nothing above it', () => {
    expect(
      readElement(
        element({ id: 'c', role: CONTEXT_MAP_ROLE.context, text: 'Billing' }),
        [],
        CONTEXT_MAP_READING
      )!.nodeType
    ).toEqual({
      roleId: CONTEXT_MAP_ROLE.context,
      labelKey: 'com.labre.ddd-context-map.role.context',
      specialises: [],
    });
  });

  it('reaches all nine patterns through their parent, and names the two sides', () => {
    // `roles.ts`: the source is the UPSTREAM context on the five U/D patterns.
    // So an edge leaving the subject names what is downstream of it.
    const me = element({
      id: 'me',
      role: CONTEXT_MAP_ROLE.context,
      text: 'Catalogue',
    });
    const down = element({
      id: 'd',
      role: CONTEXT_MAP_ROLE.context,
      text: 'Storefront',
    });
    const up = element({
      id: 'u',
      role: CONTEXT_MAP_ROLE.context,
      text: 'Pricing',
    });

    const relations = readElement(
      me,
      [
        me,
        down,
        up,
        element({
          id: 'r1',
          role: CM_PATTERN_ROLE.customerSupplier,
          source: 'me',
          target: 'd',
        }),
        // A SYMMETRIC pattern, which declares no `direction` at all: it is
        // still listed, under whichever side the drawing put it on. That is
        // where the link starts, not a claim about upstream — the asymmetry is
        // the notation's, and `roles.ts` is where it is argued.
        element({
          id: 'r2',
          role: CM_PATTERN_ROLE.partnership,
          source: 'u',
          target: 'me',
        }),
      ],
      CONTEXT_MAP_READING
    )!.relations;

    expect(relations.map(r => [r.otherName, r.side])).toEqual([
      ['Storefront', 'supplier'],
      ['Pricing', 'consumer'],
    ]);
    expect(CONTEXT_MAP_READING.relation?.sides).toEqual({
      consumer: {
        labelKey: 'com.labre.ddd-context-map.reading.relations.consumer',
        labelFallback: 'Upstream',
      },
      supplier: {
        labelKey: 'com.labre.ddd-context-map.reading.relations.supplier',
        labelFallback: 'Downstream',
      },
    });
  });

  it('never contradicts the drawing, proposes no nature, reads no phase', () => {
    // A context map has no axis: two contexts one above the other say nothing
    // about who is upstream, so the framework declares no `geometry`.
    expect(CONTEXT_MAP_READING.relation?.geometry).toBeUndefined();
    expect(CONTEXT_MAP_READING.nature).toBeUndefined();
    expect(CONTEXT_MAP_READING.frame).toBeUndefined();

    const low = element({
      id: 'lo',
      role: CONTEXT_MAP_ROLE.context,
      bound: [0, 300, 160, 60],
    });
    const high = element({
      id: 'hi',
      role: CONTEXT_MAP_ROLE.context,
      bound: [0, 0, 160, 60],
    });
    const reading = readElement(
      low,
      [
        low,
        high,
        element({
          id: 'r',
          role: CM_PATTERN_ROLE.customerSupplier,
          source: 'lo',
          target: 'hi',
        }),
      ],
      CONTEXT_MAP_READING
    )!;
    expect(reading.relations.every(r => !r.contradictsGeometry)).toBe(true);
    expect(reading.nature).toBeUndefined();
    expect(reading.naming).toBeUndefined();
    expect(reading.phase).toBeUndefined();
  });
});
