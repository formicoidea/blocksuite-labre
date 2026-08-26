import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel, RoleDefs } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import type { FrameworkBackgroundDef } from '../framework-background/index.js';
import {
  evaluateRules,
  type ValidationRule,
} from '../extensions/validation.js';

/**
 * The `element-in-zone` family: the artefact is on the map — is it in the right
 * REGION of it?
 *
 * Everything measured here comes from the declaration the renderer paints from,
 * resolved against the bounds of the instance the subject actually sits on. So
 * the two properties the suite is really about are: a zone is a ratio of the
 * PLOT (never of the card), and a subject off every frame is silence rather
 * than a badly worded `element-in-background`.
 */

const ROLES: RoleDefs = {
  'test:chart': { id: 'test:chart', kind: 'node', labelKey: 'test.chart' },
  'test:subdomain': {
    id: 'test:subdomain',
    kind: 'node',
    labelKey: 'test.subdomain',
  },
  'test:outsourced': {
    id: 'test:outsourced',
    parent: 'test:subdomain',
    kind: 'node',
    labelKey: 'test.outsourced',
  },
};

/**
 * Four quadrants over a plot inset by 100 units on two sides — the inset is
 * there on purpose, so a ratio read against the CARD instead of the plot lands
 * in the wrong quadrant and the test says so.
 *
 * On a 1000 × 1000 instance at the origin the plot is `100…1000` both ways, so
 * `core` covers x 550…1000, y 100…550.
 */
const CHART: FrameworkBackgroundDef = {
  type: 'test',
  role: 'test:chart',
  geometry: {
    width: 1000,
    height: 1000,
    lockAspectRatio: false,
    resizable: true,
    margin: { top: 100, right: 0, bottom: 0, left: 100 },
  },
  zones: [
    { id: 'generic', rect: { x: 0, y: 0, w: 0.5, h: 0.5 } },
    {
      id: 'core',
      rect: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      fill: '#eeeeee',
      // The tint is a decoration the user can switch off; the quadrant stays a
      // quadrant. See the family's header.
      fillVisibleProp: 'showZones',
    },
    { id: 'supporting', rect: { x: 0, y: 0.5, w: 0.5, h: 0.5 } },
    { id: 'commodity', rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 } },
  ],
};

const RULE: ValidationRule = {
  id: 'test.outsourced-core',
  framework: 'test',
  family: 'element-in-zone',
  severity: 'warning',
  appliesTo: 'test:outsourced',
  roles: ROLES,
  messageKey: 'com.labre.test.outsourced-core',
  version: 1,
  backgroundRole: 'test:chart',
  background: CHART,
  inZone: { zoneIds: ['core'], expect: 'outside' },
};

const inside = (rule: ValidationRule = RULE): ValidationRule => ({
  ...rule,
  id: `${rule.id}-inside`,
  inZone: { ...rule.inZone!, expect: 'inside' },
});

const byExtent = (rule: ValidationRule): ValidationRule => ({
  ...rule,
  id: `${rule.id}-extent`,
  inZone: { ...rule.inZone!, measure: 'extent' },
});

function element(
  id: string,
  xywh: [number, number, number, number],
  props: Record<string, unknown> = {}
): GfxPrimitiveElementModel {
  const stub = {
    id,
    type: 'test',
    ...props,
    get elementBound() {
      return new Bound(...xywh);
    },
  };
  return stub as unknown as GfxPrimitiveElementModel;
}

const chart = (
  id = 'chart',
  xywh: [number, number, number, number] = [0, 0, 1000, 1000],
  props: Record<string, unknown> = {}
) => element(id, xywh, { role: 'test:chart', ...props });

const dot = (id: string, xywh: [number, number, number, number]) =>
  element(id, xywh, { role: 'test:outsourced' });

const found = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  evaluateRules([rule], elements);

const ids = (rule: ValidationRule, elements: GfxPrimitiveElementModel[]) =>
  found(rule, elements).map(violation => violation.elementIds.join('+'));

/** In the Core quadrant, centre and extent both. */
const inCore = (id: string) => dot(id, [600, 200, 100, 100]);
/** In the Generic quadrant, centre and extent both. */
const inGeneric = (id: string) => dot(id, [200, 200, 100, 100]);

describe('forbidden ground (expect: outside)', () => {
  it('indicts a subject whose centre is in the cited zone', () => {
    expect(ids(RULE, [chart(), inCore('d1')])).toEqual(['d1']);
  });

  it('names the zone the finding is about', () => {
    // "This is in the Core" is the whole message; the zone already knows its
    // own name, and nothing downstream could reconstruct which of four it was.
    const [violation] = found(RULE, [chart(), inCore('d1')]);

    expect(violation.boundaryId).toBe('core');
    expect(violation.backgroundId).toBe('chart');
  });

  it('says nothing about a subject anywhere else on the chart', () => {
    expect(ids(RULE, [chart(), inGeneric('d1')])).toEqual([]);
  });

  it('reads the ratios against the PLOT, not against the card', () => {
    // x 520 is past half the CARD (500) and short of half the plot (550): the
    // subject is in Generic, and a family measuring the element box would call
    // it Core.
    expect(ids(RULE, [chart(), dot('d1', [500, 200, 40, 40])])).toEqual([]);
  });

  it('follows the instance when the map is moved and resized', () => {
    // Same declaration, a 500 × 500 instance at (2000, 500): the plot is
    // 400 × 400 from (2100, 600), so Core covers x 2300…2500, y 600…800.
    const moved = chart('far', [2000, 500, 500, 500]);

    expect(ids(RULE, [moved, dot('d1', [2350, 650, 40, 40])])).toEqual(['d1']);
    expect(ids(RULE, [moved, dot('d2', [2150, 650, 40, 40])])).toEqual([]);
  });

  it('judges the quadrant with its tint switched off', () => {
    // The zone is SEMANTIC and the tint is decoration: a user who hid the
    // colours to print a clean chart has not told the tool that the Core
    // stopped being the Core.
    expect(
      ids(RULE, [
        chart('chart', [0, 0, 1000, 1000], { showZones: false }),
        inCore('d1'),
      ])
    ).toEqual(['d1']);
  });

  it('covers a specialisation through its parent role', () => {
    const onSubdomain: ValidationRule = {
      ...RULE,
      appliesTo: 'test:subdomain',
    };
    expect(ids(onSubdomain, [chart(), inCore('d1')])).toEqual(['d1']);
  });
});

describe('where a subject belongs (expect: inside)', () => {
  it('says nothing about a subject in the cited zone', () => {
    expect(ids(inside(), [chart(), inCore('d1')])).toEqual([]);
  });

  it('indicts one anywhere else, and names the zone it missed', () => {
    const [violation] = found(inside(), [chart(), inGeneric('d1')]);

    expect(violation.elementIds).toEqual(['d1']);
    // The nearest cited zone: the one the user was aiming at, and the only one
    // a suggestion can point back to.
    expect(violation.boundaryId).toBe('core');
  });

  it('accepts any ONE of several cited zones', () => {
    const anyLeft: ValidationRule = {
      ...inside(),
      id: 'test.left-half',
      inZone: { zoneIds: ['generic', 'supporting'], expect: 'inside' },
    };

    expect(ids(anyLeft, [chart(), inGeneric('d1')])).toEqual([]);
    expect(ids(anyLeft, [chart(), inCore('d2')])).toEqual(['d2']);
  });
});

describe('what is measured: the centre or the whole extent', () => {
  /** Centre in Generic (x 530), box reaching into Core (x 480…580). */
  const straddling = dot('d1', [480, 200, 100, 80]);

  it('reads the centre by default', () => {
    expect(ids(RULE, [chart(), straddling])).toEqual([]);
  });

  it('reads the whole box when the rule asks for it', () => {
    // `outside` on the extent is "shares no area with the zone at all".
    expect(ids(byExtent(RULE), [chart(), straddling])).toEqual(['d1']);
    expect(ids(byExtent(RULE), [chart(), inGeneric('d2')])).toEqual([]);
  });

  it('asks for FULL containment on the inside reading', () => {
    expect(ids(byExtent(inside()), [chart(), inCore('d1')])).toEqual([]);
    // Half in, half out: exactly the ambiguous case a strict rule wants to
    // hear about, and a union test would swallow it.
    expect(ids(byExtent(inside()), [chart(), straddling])).toEqual(['d1']);
  });
});

/**
 * VARIANTS: the same frame, read two ways.
 *
 * A zone belonging to the other reading is not painted on this instance, so it
 * is not a region of it either — the renderer and the label walk pass through
 * the same gate, and a rule measuring against a quadrant nobody can see would
 * be indicting an artefact for sitting where the chart shows nothing.
 */
const TWO_READINGS: FrameworkBackgroundDef = {
  ...CHART,
  variantProp: 'reading',
  zones: [
    { id: 'generic', rect: { x: 0, y: 0, w: 0.5, h: 0.5 } },
    // Top right in the investment reading; bottom right in the migration one.
    {
      id: 'core',
      rect: { x: 0.5, y: 0, w: 0.5, h: 0.5 },
      variants: ['investment'],
    },
    {
      id: 'lastToothpaste',
      rect: { x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
      variants: ['migration'],
    },
  ],
};

describe('a frame turned to one of its two readings', () => {
  const RULE_TR: ValidationRule = {
    ...RULE,
    id: 'test.outsourced-core-variant',
    background: TWO_READINGS,
  };
  /** Bottom right: the Last toothpaste quadrant of the migration reading. */
  const inToothpaste = (id: string) => dot(id, [600, 700, 100, 100]);

  it('measures against a zone the instance actually reads', () => {
    expect(
      ids(RULE_TR, [
        chart('c', [0, 0, 1000, 1000], { reading: 'investment' }),
        inCore('d1'),
      ])
    ).toEqual(['d1']);
  });

  it('says nothing about a zone belonging to the OTHER reading', () => {
    // The Core quadrant is not on this chart: the user is looking at the
    // migration page, where that ground is not Core ground.
    expect(
      ids(RULE_TR, [
        chart('c', [0, 0, 1000, 1000], { reading: 'migration' }),
        inCore('d1'),
      ])
    ).toEqual([]);
  });

  it('does not turn `inside` into "everything is wrong" when no cited zone is read', () => {
    // Every cited zone gone means there is nothing to be inside OF. Indicting
    // every subject on the frame would be the family answering a question the
    // instance never asked.
    expect(
      ids(inside(RULE_TR), [
        chart('c', [0, 0, 1000, 1000], { reading: 'migration' }),
        inCore('d1'),
        inGeneric('d2'),
      ])
    ).toEqual([]);
  });

  it('keeps the zones that are read and drops only the others', () => {
    // Both quadrants cited, one reading: the surviving one still judges, so the
    // gate is per zone and not all-or-nothing.
    const both: ValidationRule = {
      ...RULE_TR,
      id: 'test.either-right-hand-quadrant',
      inZone: { zoneIds: ['core', 'lastToothpaste'], expect: 'outside' },
    };
    const migration = chart('c', [0, 0, 1000, 1000], { reading: 'migration' });

    expect(ids(both, [migration, inCore('d1')])).toEqual([]);
    expect(ids(both, [migration, inToothpaste('d2')])).toEqual(['d2']);
  });

  it('reads each instance on its own page', () => {
    // Two charts on one board, turned to different readings: the regions are
    // resolved per instance, so one cannot serve the other's.
    const near = chart('c1', [0, 0, 1000, 1000], { reading: 'investment' });
    const far = chart('c2', [4000, 0, 1000, 1000], { reading: 'migration' });

    expect(
      ids(RULE_TR, [near, far, inCore('d1'), dot('d2', [4600, 200, 100, 100])])
    ).toEqual(['d1']);
  });

  it('reads an instance that names no variant as the pieces every reading has', () => {
    // An element created before the prop existed carries none — the same answer
    // the renderer gives it.
    expect(ids(RULE_TR, [chart('c'), inCore('d1')])).toEqual([]);
  });
});

describe('what the family stays silent about', () => {
  it('a subject off every frame — that is another rule’s question', () => {
    // Outside the card, a subject is outside every zone of it, which under
    // `expect: 'inside'` would make this a second, worse-worded
    // `element-in-background` raised on artefacts the framework may allow off
    // the frame entirely.
    const away = dot('d1', [5000, 5000, 40, 40]);

    expect(ids(RULE, [chart(), away])).toEqual([]);
    expect(ids(inside(), [chart(), away])).toEqual([]);
  });

  it('a board with no frame at all', () => {
    expect(ids(RULE, [inCore('d1')])).toEqual([]);
  });

  it('an element with no role, whatever it sits on', () => {
    expect(ids(RULE, [chart(), element('free', [600, 200, 40, 40])])).toEqual(
      []
    );
  });

  it('a subject carrying another role', () => {
    expect(
      ids(RULE, [
        chart(),
        element('n', [600, 200, 40, 40], { role: 'test:chart' }),
      ])
    ).toEqual([]);
  });

  it('a rule naming a zone the frame does not declare — once, out loud', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const broken: ValidationRule = {
      ...RULE,
      id: 'test.zone-from-the-future',
      inZone: { zoneIds: ['core', 'last-toothpaste'], expect: 'outside' },
    };

    // Not "measure against the zones it recognised": a smaller union is a
    // DIFFERENT rule, and nothing on the canvas would show the difference.
    expect(ids(broken, [chart(), inCore('d1')])).toEqual([]);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining('last-toothpaste')
    );

    // Evaluated again, the console stays quiet: a family runs at 8 Hz while
    // somebody drags.
    ids(broken, [chart(), inCore('d2')]);
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('a rule citing no zone at all', () => {
    const empty: ValidationRule = {
      ...RULE,
      id: 'test.no-zone',
      inZone: { zoneIds: [], expect: 'inside' },
    };

    expect(ids(empty, [chart(), inCore('d1')])).toEqual([]);
  });
});
