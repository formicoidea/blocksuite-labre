import type { C4NodeKind } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import { BOUNDARY_LABEL, NODE_LABEL, NODE_PALETTE, NODE_SIZE } from '../consts';

/**
 * The per-kind tables.
 *
 * All three are `Record<C4NodeKind, …>`, so TypeScript already refuses a table
 * with a kind missing. What a test adds is the half the type cannot state: that
 * the nine kinds are actually the nine the pack means, that the colour code says
 * what C4's stencil says, and that nothing in a table is silently empty.
 */

const ALL_KINDS = [
  'person',
  'person-ext',
  'system',
  'system-ext',
  'container',
  'database',
  'mobile',
  'browser',
  'component',
] as const satisfies readonly C4NodeKind[];

const HEX6 = /^#[0-9a-f]{6}$/;

describe('the C4 per-kind tables', () => {
  it('covers the nine kinds, and no more', () => {
    for (const table of [NODE_SIZE, NODE_PALETTE, NODE_LABEL]) {
      expect(Object.keys(table).sort()).toEqual([...ALL_KINDS].sort());
    }
  });

  it('gives every kind a size a label can be read at', () => {
    for (const kind of ALL_KINDS) {
      const { w, h } = NODE_SIZE[kind];
      expect(w, kind).toBeGreaterThan(0);
      expect(h, kind).toBeGreaterThan(0);
      // Wide and squat: a C4 box holds a name, a technology and a sentence.
      expect(h, kind).toBeLessThanOrEqual(w);
    }
  });

  it('gives every kind words to start from', () => {
    for (const kind of ALL_KINDS) {
      expect(NODE_LABEL[kind], kind).toBeTruthy();
    }
  });

  it('paints the colour code C4 paints', () => {
    for (const kind of ALL_KINDS) {
      const paint = NODE_PALETTE[kind];
      for (const value of [paint.fill, paint.border, paint.text]) {
        expect(value, kind).toMatch(HEX6);
      }
    }

    // The two externals are one grey: "outside the scope of this diagram" is one
    // statement, and the level of the thing outside it is not the point.
    expect(NODE_PALETTE['person-ext']).toEqual(NODE_PALETTE['system-ext']);

    // The three drawn flavours are CONTAINERS and take the container's colour
    // exactly — what differs is the silhouette, never the level.
    for (const kind of ['database', 'mobile', 'browser'] as const) {
      expect(NODE_PALETTE[kind], kind).toEqual(NODE_PALETTE.container);
    }

    // The component is the one kind with black text: white on that pale wash is
    // unreadable, which is the stencil's own reason.
    expect(NODE_PALETTE.component.text).toBe('#000000');
    for (const kind of ALL_KINDS) {
      if (kind === 'component') continue;
      expect(NODE_PALETTE[kind].text, kind).toBe('#ffffff');
    }
  });

  it('names both boundary variants', () => {
    expect(Object.keys(BOUNDARY_LABEL).sort()).toEqual(['container', 'system']);
    for (const words of Object.values(BOUNDARY_LABEL)) {
      expect(words).toBeTruthy();
    }
  });
});
