import { Bound } from '@labre/global/gfx';
import type { RoleDefs } from '@labre/std/gfx';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import type { FrameworkBackgroundDef } from '../framework-background/def.js';
import {
  compareReading,
  type ElementReading,
  readElement,
  readingProfileFor,
  type ReadingProfile,
} from '../extensions/reading.js';

/**
 * MF3 — the reversed reading, field by field.
 *
 * This suite owns the ENGINE: what each of the five fields says, what it says
 * when the document does not carry the answer, and the one case the panel
 * exists for — an edge whose declaration contradicts the drawing. What only a
 * real editor can answer (the panel opens on a click, writes nothing, and its
 * confirmations reach the two commands) belongs to the `all` and integration
 * suites.
 *
 * Everything here is declared LOCALLY rather than imported from `gfx/wardley`:
 * the engine must not know a framework, and a test that borrows the real
 * profile would stop noticing if it did.
 */

const ROLES: RoleDefs = {
  'test:component': { id: 'test:component', kind: 'node', labelKey: 'k.comp' },
  'test:market': {
    id: 'test:market',
    parent: 'test:component',
    kind: 'node',
    labelKey: 'k.market',
  },
  'test:anchor': { id: 'test:anchor', kind: 'node' },
  'test:label': { id: 'test:label', kind: 'node' },
  'test:dependency': { id: 'test:dependency', kind: 'edge' },
  'test:map': { id: 'test:map', kind: 'node' },
};

/** Two zones and a band, so the phase reading has something to read. */
const BACKGROUND: FrameworkBackgroundDef = {
  type: 'test',
  role: 'test:map',
  geometry: {
    width: 1000,
    height: 500,
    lockAspectRatio: true,
    resizable: false,
    margin: { top: 0, right: 0, bottom: 0, left: 0 },
  },
  zones: [
    { id: 'early', rect: { x: 0, y: 0, w: 0.5, h: 1 } },
    {
      id: 'late',
      rect: { x: 0.5, y: 0, w: 0.5, h: 1 },
      label: { id: 'l', labelKey: 'k.late', fallback: 'Late', anchor: { x: 0.5, y: 1 }, style: { size: 10, color: '#000' } },
    },
  ],
  // ±5% of the plot around the single transition at 0.5 — i.e. x ∈ [450, 550]
  // on a 1000-wide instance.
  transitionBandWidth: 0.1,
};

const NATURE_TAG = 'test:nature';
const DOING = `${NATURE_TAG}/doing`;
const THING = `${NATURE_TAG}/thing`;

const PROFILE: ReadingProfile = {
  id: 'test',
  framework: 'wardley',
  roles: ROLES,
  appliesTo: 'test:component',
  labelRole: 'test:label',
  nature: {
    tagId: NATURE_TAG,
    conventions: [
      {
        valueId: DOING,
        pattern: String.raw`\b\p{L}+ing\b`,
        hintKey: 'k.doing',
        hintFallback: 'Name it with a verb.',
      },
      {
        valueId: THING,
        pattern: String.raw`^(?!.*\b\p{L}+ing\b).+$`,
        hintKey: 'k.thing',
        hintFallback: 'Name it as a thing.',
      },
    ],
  },
  relation: { edgeRole: 'test:dependency' },
  frame: { backgroundRole: 'test:map', background: BACKGROUND, axis: 'x' },
  recordKeys: { nature: 'nature', phase: 'phase' },
};

type Stub = {
  id: string;
  role?: string;
  bound?: [number, number, number, number];
  tags?: Record<string, string[]>;
  text?: string;
  source?: string;
  target?: string;
  children?: GfxPrimitiveElementModel[];
};

/**
 * An element that satisfies the engine without dragging a surface, a Y.Doc and
 * a renderer into a unit test. `tags` is given in its DEGRADED plain-object
 * shape, which `readElementTags` normalizes — the shape a client predating the
 * field produces, and the one worth exercising here.
 */
function element({
  id,
  role,
  bound = [0, 0, 10, 10],
  tags,
  text,
  source,
  target,
  children,
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
  define('elementBound', new Bound(...bound));
  if (source !== undefined) define('source', { id: source });
  if (target !== undefined) define('target', { id: target });
  if (children) define('childElements', children);
  return el;
}

/** A group whose single roled member is the node — what one click selects. */
function grouped(
  node: GfxPrimitiveElementModel,
  label: GfxPrimitiveElementModel
) {
  const group = element({ id: `${node.id}-group`, children: [node, label] });
  Object.defineProperty(node, 'group', { value: group, configurable: true });
  return group;
}

const map = () => element({ id: 'map', role: 'test:map', bound: [0, 0, 1000, 500] });

const read = (
  subject: GfxPrimitiveElementModel,
  rest: GfxPrimitiveElementModel[] = []
) => readElement(subject, [subject, ...rest], PROFILE);

describe('which elements have a reading at all', () => {
  it('reads the subject role, and its specialisations', () => {
    expect(read(element({ id: 'a', role: 'test:component' }))).not.toBeNull();
    // `market` specialises `component`, so it is read for free — the entire
    // reason role hierarchy is data.
    expect(read(element({ id: 'b', role: 'test:market' }))).not.toBeNull();
  });

  it('reads neither a neutral element nor an unrelated role', () => {
    expect(read(element({ id: 'a' }))).toBeNull();
    expect(read(element({ id: 'b', role: 'test:anchor' }))).toBeNull();
  });

  it('resolves the governing profile the same way', () => {
    expect(
      readingProfileFor(element({ id: 'a', role: 'test:market' }), [PROFILE])
    ).toBe(PROFILE);
    expect(
      readingProfileFor(element({ id: 'a', role: 'test:anchor' }), [PROFILE])
    ).toBeNull();
  });
});

describe('the type of node', () => {
  it('is the role, with the chain it specialises', () => {
    const reading = read(element({ id: 'a', role: 'test:market' }))!;
    expect(reading.nodeType).toEqual({
      roleId: 'test:market',
      labelKey: 'k.market',
      specialises: ['test:component'],
    });
  });

  it('has an empty chain on a root role', () => {
    const reading = read(element({ id: 'a', role: 'test:component' }))!;
    expect(reading.nodeType.specialises).toEqual([]);
  });
});

describe('the nature', () => {
  it('is what the element carries', () => {
    const reading = read(
      element({ id: 'a', role: 'test:component', tags: { [NATURE_TAG]: [THING] } })
    )!;
    expect(reading.nature).toEqual({ tagId: NATURE_TAG, valueIds: [THING] });
  });

  it('is EMPTY when the element carries none — nothing is derived', () => {
    // The heart of the arbitration: no nature is inferred from the shape, the
    // name or the position. An unqualified component reads as unqualified.
    const reading = read(element({ id: 'a', role: 'test:component' }))!;
    expect(reading.nature).toBeUndefined();
    expect(reading.naming).toBeUndefined();
  });
});

describe('the parent-child relations', () => {
  const subject = () =>
    element({ id: 'me', role: 'test:component', bound: [100, 200, 20, 20] });

  it('reads an outgoing edge as a supplier, below', () => {
    const me = subject();
    const supplier = element({
      id: 'db',
      role: 'test:component',
      bound: [100, 400, 20, 20],
    });
    const edge = element({
      id: 'e',
      role: 'test:dependency',
      source: 'me',
      target: 'db',
    });

    const [relation] = read(me, [supplier, edge])!.relations;
    expect(relation).toMatchObject({
      edgeId: 'e',
      otherId: 'db',
      side: 'supplier',
      contradictsGeometry: false,
    });
  });

  it('reads an incoming edge as a consumer, above', () => {
    const me = subject();
    const consumer = element({
      id: 'ui',
      role: 'test:component',
      bound: [100, 50, 20, 20],
    });
    const edge = element({
      id: 'e',
      role: 'test:dependency',
      source: 'ui',
      target: 'me',
    });

    const [relation] = read(me, [consumer, edge])!.relations;
    expect(relation).toMatchObject({ side: 'consumer', contradictsGeometry: false });
  });

  it('says so when the declaration contradicts the drawing', () => {
    // W4 seen from the record's side: the edge says "me depends on db", the
    // positions say db is above me. The reading reports the disagreement and
    // picks no winner — the user decides which of the two was the mistake.
    const me = subject();
    const supplier = element({
      id: 'db',
      role: 'test:component',
      bound: [100, 10, 20, 20],
    });
    const edge = element({
      id: 'e',
      role: 'test:dependency',
      source: 'me',
      target: 'db',
    });

    const [relation] = read(me, [supplier, edge])!.relations;
    expect(relation.contradictsGeometry).toBe(true);
  });

  it('skips an edge with an unbound end, a neutral connector and a self-loop', () => {
    const me = subject();
    const other = element({
      id: 'db',
      role: 'test:component',
      bound: [100, 400, 20, 20],
    });
    const dangling = element({
      id: 'e1',
      role: 'test:dependency',
      source: 'me',
    });
    const neutral = element({ id: 'e2', source: 'me', target: 'db' });
    const loop = element({
      id: 'e3',
      role: 'test:dependency',
      source: 'me',
      target: 'me',
    });

    expect(read(me, [other, dangling, neutral, loop])!.relations).toEqual([]);
  });

  it('names the other end when it has a name', () => {
    const me = subject();
    const other = element({
      id: 'db',
      role: 'test:component',
      bound: [100, 400, 20, 20],
      text: 'Customer register',
    });
    const edge = element({
      id: 'e',
      role: 'test:dependency',
      source: 'me',
      target: 'db',
    });

    expect(read(me, [other, edge])!.relations[0].otherName).toBe(
      'Customer register'
    );
  });
});

describe('the evolution phase', () => {
  const at = (x: number) =>
    element({ id: 'a', role: 'test:component', bound: [x, 100, 20, 20] });

  it('is the declared zone the element sits in', () => {
    const reading = read(at(690), [map()])!;
    expect(reading.phase).toMatchObject({
      zoneId: 'late',
      labelKey: 'k.late',
      labelFallback: 'Late',
      inTransitionBand: false,
    });
  });

  it('names the band when the element sits at a frontier', () => {
    // The zone of punctuated equilibrium: the frontier is a REGION declared by
    // the background, not the coordinate the renderer draws.
    const reading = read(at(480), [map()])!;
    expect(reading.phase).toMatchObject({
      inTransitionBand: true,
      bandId: 'early|late',
    });
  });

  it('is absent with no frame under the element', () => {
    // A component on a blank canvas is a sketch. Reading a phase off a map it
    // is not on would be an invented fact.
    expect(read(at(690))!.phase).toBeUndefined();
  });

  it('is absent for an element beside the frame', () => {
    expect(read(element({ id: 'a', role: 'test:component', bound: [2000, 100, 20, 20] }), [map()])!.phase).toBeUndefined();
  });
});

describe('the naming convention', () => {
  const named = (name: string, valueId: string) =>
    element({
      id: 'a',
      role: 'test:component',
      text: name,
      tags: { [NATURE_TAG]: [valueId] },
    });

  it('accepts a name that follows the motif', () => {
    expect(read(named('Brewing tea', DOING))!.naming).toMatchObject({
      name: 'Brewing tea',
      conforms: true,
    });
  });

  it('suggests, with the convention’s own words, when it does not', () => {
    expect(read(named('Tea', DOING))!.naming).toEqual({
      name: 'Tea',
      conforms: false,
      hintKey: 'k.doing',
      hintFallback: 'Name it with a verb.',
    });
  });

  it('reads the negative form too', () => {
    expect(read(named('Customer register', THING))!.naming?.conforms).toBe(true);
    expect(read(named('Registering customers', THING))!.naming?.conforms).toBe(
      false
    );
  });

  it('takes the name from the grouped label when the node has none', () => {
    const node = element({
      id: 'n',
      role: 'test:component',
      tags: { [NATURE_TAG]: [DOING] },
    });
    const label = element({ id: 'l', role: 'test:label', text: 'Brewing tea' });
    grouped(node, label);

    expect(readElement(node, [node, label], PROFILE)!.naming).toMatchObject({
      name: 'Brewing tea',
      conforms: true,
    });
  });

  it('says nothing about an unnamed element', () => {
    const reading = read(
      element({ id: 'a', role: 'test:component', tags: { [NATURE_TAG]: [DOING] } })
    )!;
    expect(reading.naming).toBeUndefined();
  });

  it('says nothing when no convention describes the nature', () => {
    const reading = read(
      element({
        id: 'a',
        role: 'test:component',
        text: 'Anything',
        tags: { [NATURE_TAG]: ['test:nature/unknown'] },
      })
    )!;
    expect(reading.naming).toBeUndefined();
  });
});

describe('comparing a reading with a record', () => {
  const reading = (over: Partial<ElementReading> = {}): ElementReading => ({
    ...read(
      element({
        id: 'a',
        role: 'test:component',
        bound: [690, 100, 20, 20],
        tags: { [NATURE_TAG]: [THING] },
      }),
      [map()]
    )!,
    ...over,
  });

  it('is silent when the record carries neither property', () => {
    expect(compareReading(reading(), { pivotDocId: 'r' })).toEqual([]);
  });

  it('is silent when both agree, whichever spelling the host uses', () => {
    expect(
      compareReading(reading(), {
        pivotDocId: 'r',
        nature: [THING],
        phase: 'Late',
      })
    ).toEqual([]);
  });

  it('reports a nature the element does not carry', () => {
    const fields = compareReading(reading(), {
      pivotDocId: 'r',
      nature: [DOING],
    });
    expect(fields).toEqual([{ field: 'nature', read: THING, record: DOING }]);
  });

  it('reports a phase the board no longer agrees with', () => {
    const fields = compareReading(reading(), {
      pivotDocId: 'r',
      phase: 'early',
    });
    expect(fields).toEqual([{ field: 'phase', read: 'Late', record: 'early' }]);
  });

  it('never reports a phase the board cannot read', () => {
    // A component dragged off the map has no phase to be in conflict with.
    expect(
      compareReading(reading({ phase: undefined }), {
        pivotDocId: 'r',
        phase: 'early',
      })
    ).toEqual([]);
  });
});
