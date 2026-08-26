import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import type { RoleDefs } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import {
  type AutoLegendSpec,
  autoLegendSections,
  createAutoLegend,
  roleLabel,
  rolesInBound,
} from '../shared/legend-auto';

/**
 * A two-level fixture vocabulary: `fx:sticky` is the parent, `fx:event` and
 * `fx:command` specialise it, `fx:flow` is an unrelated edge. Enough to prove
 * the generic resolves specialisations and ignores what it does not know.
 */
const ROLES: RoleDefs = {
  'fx:sticky': { id: 'fx:sticky', kind: 'node', labelFallback: 'Sticky' },
  'fx:event': { id: 'fx:event', parent: 'fx:sticky', kind: 'node', labelFallback: 'Event' },
  'fx:command': { id: 'fx:command', parent: 'fx:sticky', kind: 'node', labelFallback: 'Command' },
  'fx:flow': { id: 'fx:flow', kind: 'edge', labelFallback: 'Flow' },
};

const SPEC: AutoLegendSpec = {
  title: 'Légende',
  roles: ROLES,
  sections: [
    {
      title: 'Stickies',
      entries: [
        { role: 'fx:event', row: { swatch: 'square', color: '#F5963B', label: 'Event' } },
        { role: 'fx:command', row: { swatch: 'square', color: '#5BA3DB', label: 'Command' } },
      ],
    },
    {
      title: 'Flow',
      entries: [
        { role: 'fx:flow', row: { swatch: 'line', color: '#1f2328', label: 'Flow' } },
      ],
    },
  ],
};

interface FixtureElement {
  role?: string;
  xywh: string;
}

/**
 * A gfx / std pair with a REAL bound filter, so "an artefact outside the
 * perimeter is not in the legend" is proved by the geometry rather than by the
 * stub being told the answer.
 */
function stub(elements: FixtureElement[]) {
  const added: Record<string, unknown>[] = [];
  let n = 0;
  const overlaps = (a: Bound, b: Bound) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const selection = { set: vi.fn() };
  const gfx = {
    surface: {
      addElement: (props: Record<string, unknown>) => {
        added.push(props);
        return `el-${n++}`;
      },
    },
    getElementsByBound: (bound: Bound) =>
      elements.filter(el => overlaps(bound, Bound.deserialize(el.xywh))),
    selection,
  };
  const captureSync = vi.fn();
  const std = {
    get: () => gfx,
    store: { captureSync },
    command: { exec: () => [null, { groupId: 'group-1' }] },
  } as unknown as BlockStdScope;
  return { added, captureSync, gfx, std, selection };
}

const at = (x: number, y: number, role?: string): FixtureElement => ({
  role,
  xywh: new Bound(x, y, 20, 20).serialize(),
});

/** The background every case below scans: 1000 × 800 at the origin. */
const BG = { xywh: new Bound(0, 0, 1000, 800).serialize() };

describe('rolesInBound', () => {
  it('collects the roles inside the perimeter and ignores those outside it', () => {
    const { gfx } = stub([
      at(100, 100, 'fx:event'),
      at(200, 200, 'fx:flow'),
      // Well past the background's right edge.
      at(5000, 100, 'fx:command'),
    ]);
    const present = rolesInBound(
      gfx as never,
      Bound.deserialize(BG.xywh)
    );
    expect([...present].sort()).toEqual(['fx:event', 'fx:flow']);
  });

  it('ignores neutral elements, so a board drawn before roles yields nothing', () => {
    const { gfx } = stub([at(100, 100), at(200, 200)]);
    expect(
      rolesInBound(gfx as never, Bound.deserialize(BG.xywh)).size
    ).toBe(0);
  });
});

describe('autoLegendSections', () => {
  it('lists only the rows whose role is present, in declaration order', () => {
    const sections = autoLegendSections(new Set(['fx:command', 'fx:flow']), SPEC);
    expect(sections).toEqual([
      {
        title: 'Stickies',
        rows: [{ swatch: 'square', color: '#5BA3DB', label: 'Command' }],
      },
      {
        title: 'Flow',
        rows: [{ swatch: 'line', color: '#1f2328', label: 'Flow' }],
      },
    ]);
  });

  it('drops an empty section, sub-title included', () => {
    const sections = autoLegendSections(new Set(['fx:flow']), SPEC);
    expect(sections.map(s => s.title)).toEqual(['Flow']);
  });

  it('resolves a specialisation: a parent entry appears for a child role', () => {
    const parentSpec: AutoLegendSpec = {
      title: 'Légende',
      roles: ROLES,
      sections: [
        {
          entries: [
            { role: 'fx:sticky', row: { swatch: 'square', color: '#fff', label: 'Sticky' } },
          ],
        },
      ],
    };
    expect(autoLegendSections(new Set(['fx:event']), parentSpec)).toHaveLength(1);
    expect(autoLegendSections(new Set(['fx:flow']), parentSpec)).toHaveLength(0);
  });

  it('says nothing about roles it does not know', () => {
    expect(autoLegendSections(new Set(['other:thing']), SPEC)).toEqual([]);
  });
});

describe('roleLabel', () => {
  it('takes the vocabulary’s own wording', () => {
    expect(roleLabel(ROLES, 'fx:flow')).toBe('Flow');
  });

  it('falls back to the id rather than inventing prose', () => {
    expect(roleLabel(ROLES, 'fx:unknown')).toBe('fx:unknown');
  });
});

describe('createAutoLegend', () => {
  it('drops the box bottom-left of the background, grouped and selected', () => {
    const { added, std, selection } = stub([at(100, 100, 'fx:event')]);
    const id = createAutoLegend(std, BG, SPEC);

    // One section (title + one row): PAD*2 + TITLE_H + SUB_H + ROW_H.
    const H = 16 * 2 + 32 + 26 + 28;
    const frame = added[0];
    expect(frame.xywh).toBe(new Bound(0 + 50, 0 + 800 - 56 - H, 260, H).serialize());
    expect(id).toBe('group-1');
    expect(selection.set).toHaveBeenCalledWith({
      elements: ['group-1'],
      editing: false,
    });
  });

  it('draws a titled box with no rows on a board it recognises nothing on', () => {
    // Wardley's behaviour, replicated: an empty map still yields a framed
    // "Legend" — the legend lists what is drawn, and nothing is drawn.
    const { added, std } = stub([at(100, 100)]);
    createAutoLegend(std, BG, SPEC);

    expect(added).toHaveLength(2); // frame + title, nothing else
    expect(added[1].text).toBe('Légende');
    const H = 16 * 2 + 32;
    expect(added[0].xywh).toBe(new Bound(50, 800 - 56 - H, 260, H).serialize());
  });

  it('takes one undo checkpoint before writing', () => {
    const { captureSync, std } = stub([at(100, 100, 'fx:event')]);
    createAutoLegend(std, BG, SPEC);
    expect(captureSync).toHaveBeenCalledTimes(1);
  });
});
