import { TextFitMode } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import {
  CD_SUBDOMAINS,
  CM_RELATIONSHIPS,
  ES_HOTSPOT,
  ES_STICKIES,
} from '../shared/consts';
import {
  addBubble,
  addConnector,
  addDot,
  addSticky,
} from '../shared/prefabs';

const HEX = /^#([0-9a-f]{6}|[0-9a-f]{8})$/i;

/**
 * CIE76 colour distance, so a palette claim like "these two yellows are
 * distinguishable" is measured rather than asserted by eye. Roughly: under 2 is
 * invisible, around 10 is a clear difference, over 30 is another colour.
 */
function deltaE(a: string, b: string): number {
  const lab = (hex: string): [number, number, number] => {
    const linear = (channel: number) => {
      const c = channel / 255;
      return c > 0.04045 ? Math.pow((c + 0.055) / 1.055, 2.4) : c / 12.92;
    };
    const [r, g, bl] = [1, 3, 5].map(i =>
      linear(parseInt(hex.substr(i, 2), 16))
    );
    const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116);
    const x = f((r * 0.4124 + g * 0.3576 + bl * 0.1805) / 0.95047);
    const y = f(r * 0.2126 + g * 0.7152 + bl * 0.0722);
    const z = f((r * 0.0193 + g * 0.1192 + bl * 0.9505) / 1.08883);
    return [116 * y - 16, 500 * (x - y), 200 * (y - z)];
  };
  const [l1, a1, b1] = lab(a);
  const [l2, a2, b2] = lab(b);
  return Math.hypot(l1 - l2, a1 - a2, b1 - b2);
}

describe('ddd shared presets', () => {
  it('every Event Storming sticky has hex fill + text colours', () => {
    for (const s of ES_STICKIES) {
      expect(s.fill).toMatch(HEX);
      expect(s.text).toMatch(HEX);
      expect(s.label.length).toBeGreaterThan(0);
    }
    expect(ES_HOTSPOT.fill).toMatch(HEX);
  });

  it('carries the aggregate sticky, without which the ES grammar is unsayable', () => {
    // `Command → Aggregate → Domain event` is the canonical sentence, and it
    // could not be drawn at all until WS5 added this preset.
    const aggregate = ES_STICKIES.find(s => s.kind === 'aggregate');
    expect(aggregate?.label).toBe('Aggregate');
    expect(aggregate?.fill).toMatch(HEX);
  });

  it('keeps the three yellows apart', () => {
    // The plan's indicative `#FDF0A0` measured ΔE 3.5 from the actor — two
    // stickies nobody could tell apart. The palette is a LADDER: constraint
    // saturated, actor light, aggregate palest. See `consts.ts`.
    const fill = (kind: string) =>
      ES_STICKIES.find(s => s.kind === kind)!.fill;
    const aggregate = fill('aggregate');
    expect(deltaE(aggregate, fill('actor'))).toBeGreaterThan(12);
    expect(deltaE(aggregate, fill('constraint'))).toBeGreaterThan(30);
    // ...and still visible on the white board it is stuck to.
    expect(deltaE(aggregate, '#ffffff')).toBeGreaterThan(15);
  });

  it('exposes the nine context-map relationship patterns', () => {
    expect(CM_RELATIONSHIPS).toHaveLength(9);
    const kinds = CM_RELATIONSHIPS.map(r => r.kind);
    expect(new Set(kinds).size).toBe(9); // no duplicate units across the menu
    expect(kinds).toContain('acl');
    expect(kinds).toContain('bbom');
  });

  it('every Core Domain sub-domain has a hex fill', () => {
    for (const d of CD_SUBDOMAINS) expect(d.fill).toMatch(HEX);
  });
});

describe('prefab text fit defaults', () => {
  const surfaceStub = () => {
    const added: Record<string, unknown>[] = [];
    let n = 0;
    return {
      added,
      surface: {
        addElement: vi.fn((props: Record<string, unknown>) => {
          added.push(props);
          return `el-${n++}`;
        }),
      } as never,
    };
  };
  const stdStub = () =>
    ({
      command: { exec: () => [null, { groupId: 'group-1' }] },
    }) as unknown as BlockStdScope;

  // A standalone Y.Text stays empty until integrated into a doc (in
  // production surface.addElement does it); integrate to read the content.
  const materialize = (text: Y.Text) => {
    new Y.Doc().getMap('m').set('t', text);
    return text.toString();
  };

  it('a sticky is shadow + face whose OWN text is contained (no third element)', () => {
    const { surface, added } = surfaceStub();
    addSticky(surface, stdStub(), 0, 0, {
      fill: '#fef08a',
      text: '#1f2328',
      label: 'Domain event',
    });

    expect(added).toHaveLength(2); // shadow + face only
    const face = added[1];
    expect(face.textFitMode).toBe(TextFitMode.Contained);
    expect(face.text).toBeInstanceOf(Y.Text);
    expect(materialize(face.text as Y.Text)).toBe('Domain event');
  });

  it('a context-map bubble owns its label in overflow mode', () => {
    const { surface, added } = surfaceStub();
    addBubble(surface, 0, 0, 'Bounded Context');

    expect(added).toHaveLength(1);
    expect(added[0].textFitMode).toBe(TextFitMode.Overflow);
    expect(materialize(added[0].text as Y.Text)).toBe('Bounded Context');
  });
});

/**
 * The optional `role` parameter (WS2 / WS5). Two properties, and the second one
 * is the compatibility promise: a caller that passes nothing must produce
 * exactly the element it produced before the parameter existed.
 */
describe('prefabs stamp a role only when asked', () => {
  const surfaceStub = () => {
    const added: Record<string, unknown>[] = [];
    let n = 0;
    return {
      added,
      surface: {
        addElement: vi.fn((props: Record<string, unknown>) => {
          added.push(props);
          return `el-${n++}`;
        }),
      } as never,
    };
  };
  const stdStub = () =>
    ({
      command: { exec: () => [null, { groupId: 'group-1' }] },
    }) as unknown as BlockStdScope;

  it('puts a sticky role on the FACE and never on the shadow', () => {
    const { surface, added } = surfaceStub();
    addSticky(surface, stdStub(), 0, 0, {
      fill: '#fef08a',
      text: '#1f2328',
      label: 'Domain event',
      role: 'es:domain-event',
    });

    const [shadow, face] = added;
    expect(shadow.role).toBeUndefined();
    expect(face.role).toBe('es:domain-event');
  });

  it('puts a bubble role on the pill', () => {
    const { surface, added } = surfaceStub();
    addBubble(surface, 0, 0, 'Billing', 'context-map:context');
    expect(added[0].role).toBe('context-map:context');
  });

  it('puts a dot role on the ellipse', () => {
    const { surface, added } = surfaceStub();
    addDot(surface, stdStub(), 0, 0, '#9933ff', undefined, 'core-domain:big-bet');
    expect(added[0].role).toBe('core-domain:big-bet');
  });

  it('puts a connector role on the connector', () => {
    const { surface, added } = surfaceStub();
    addConnector(surface, 0, 0, 10, 10, { role: 'es:flow' });
    expect(added[0].role).toBe('es:flow');
  });

  it('writes no role key at all when none is passed', () => {
    const { surface, added } = surfaceStub();
    addBubble(surface, 0, 0, 'Billing');
    addConnector(surface, 0, 0, 10, 10);
    addDot(surface, stdStub(), 0, 0, '#9933ff');
    for (const props of added) expect(props.role).toBeUndefined();
  });
});
