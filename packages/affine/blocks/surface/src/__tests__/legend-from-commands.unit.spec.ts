import { Bound } from '@labre/global/gfx';
import {
  CommandDescriptorIdentifier,
  type AnyCommandDescriptor,
  type BlockStdScope,
  type CommandLegendEntry,
} from '@labre/std';
import { RoleVocabularyIdentifier, type RoleDefs } from '@labre/std/gfx';
import { describe, expect, it, vi } from 'vitest';

import { EdgelessCRUDIdentifier } from '../extensions/crud-extension';
import { createBoardLegend, legendFromCommands } from '../extensions/legend';

/**
 * The DERIVED legend: what {@link legendFromCommands} makes of a framework's
 * own commands, on commands written for this file alone.
 *
 * Fake commands rather than a real framework's, on purpose: the engine is what
 * is under test, and a spec that imported `c4Commands` would fail the day C4
 * reorders its palette. The frameworks' own parity is each tranche's to prove.
 */

/**
 * A two-level fixture vocabulary: `fx:sticky` is the parent, `fx:event` and
 * `fx:command` specialise it, `fx:flow` is an unrelated edge.
 */
const ROLES: RoleDefs = {
  'fx:sticky': {
    id: 'fx:sticky',
    kind: 'node',
    labelKey: 'com.labre.fx.role.sticky',
    labelFallback: 'Sticky',
  },
  'fx:event': {
    id: 'fx:event',
    parent: 'fx:sticky',
    kind: 'node',
    labelKey: 'com.labre.fx.role.event',
    labelFallback: 'Event',
  },
  'fx:command': {
    id: 'fx:command',
    parent: 'fx:sticky',
    kind: 'node',
    labelFallback: 'Command',
  },
  'fx:flow': { id: 'fx:flow', kind: 'edge', labelFallback: 'Flow' },
  'fx:board': { id: 'fx:board', kind: 'node', labelFallback: 'Board' },
};

type CommandSeed = Partial<AnyCommandDescriptor> & { id: string };

/** A command with the mandatory scaffolding filled in and nothing else. */
function command(seed: CommandSeed): AnyCommandDescriptor {
  return {
    owner: 'ddd-event-storming',
    kind: 'artefact',
    labelKey: `com.labre.fx.command.${seed.id}`,
    labelFallback: seed.id,
    surfaces: ['senior-menu'],
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
    run: () => {},
    ...seed,
  } as AnyCommandDescriptor;
}

const row = (color = '#F5963B') => ({ swatch: 'square' as const, color });

interface FixtureElement {
  role?: string;
  xywh: string;
}

/**
 * An editor stub carrying registered commands and one role vocabulary, with a
 * REAL bound filter so "an artefact outside the perimeter is not in the legend"
 * is proved by the geometry rather than by the stub being told the answer.
 */
function stub(
  commands: AnyCommandDescriptor[],
  elements: FixtureElement[] = [],
  catalogue?: Record<string, string>
) {
  const added: Record<string, unknown>[] = [];
  const grouped: Record<string, unknown>[] = [];
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
    layer: { canvasElements: [] as { type: string }[] },
  };
  const crud = {
    addElement: (type: string, props: Record<string, unknown>) => {
      grouped.push({ ...props, type });
      return 'group-1';
    },
  };
  const registry = new Map<string, AnyCommandDescriptor>(
    commands.map((c, i) => [`Command-${i}`, c])
  );
  const std = {
    get: (identifier: unknown) =>
      identifier === (EdgelessCRUDIdentifier as unknown) ? crud : gfx,
    getOptional: () =>
      catalogue ? { t: (key: string) => catalogue[key] } : undefined,
    store: { captureSync: vi.fn() },
    provider: {
      getAll: (identifier: unknown) =>
        identifier === (CommandDescriptorIdentifier as unknown)
          ? registry
          : identifier === (RoleVocabularyIdentifier as unknown)
            ? new Map([['RoleVocabulary-1', ROLES]])
            : new Map(),
    },
  } as unknown as BlockStdScope;
  return { added, grouped, selection, std };
}

const at = (x: number, y: number, role?: string): FixtureElement => ({
  role,
  xywh: new Bound(x, y, 20, 20).serialize(),
});

/** The board every case below scans: 1000 × 800 at the origin. */
const BG = { xywh: new Bound(0, 0, 1000, 800).serialize() };

const titles = (sections: { title?: string }[]) => sections.map(s => s.title);
const labels = (sections: { rows: { label: string }[] }[]) =>
  sections.map(s => s.rows.map(r => r.label));

describe('legendFromCommands', () => {
  const STICKIES = [
    command({
      id: 'fx.addEvent',
      category: 'stickies',
      order: 1,
      legend: { role: 'fx:event', row: row() },
    }),
    command({
      id: 'fx.addCommand',
      category: 'stickies',
      order: 2,
      legend: { role: 'fx:command', row: row('#5BA3DB') },
    }),
    command({
      id: 'fx.addFlow',
      kind: 'tool',
      category: 'flows',
      order: 3,
      legend: { role: 'fx:flow', row: { swatch: 'line', color: '#1f2328' } },
    }),
  ];

  it('lists only the rows whose role is present, in command order', () => {
    const { std } = stub(STICKIES);
    const sections = legendFromCommands(
      std,
      'ddd-event-storming',
      new Set(['fx:flow', 'fx:command'])
    );
    expect(titles(sections)).toEqual(['Stickies', 'Flows']);
    expect(labels(sections)).toEqual([['Command'], ['Flow']]);
  });

  it('keeps the commands in `order`, whatever order they were registered in', () => {
    const { std } = stub([...STICKIES].reverse());
    const sections = legendFromCommands(
      std,
      'ddd-event-storming',
      new Set(['fx:event', 'fx:command'])
    );
    expect(labels(sections)).toEqual([['Event', 'Command']]);
  });

  it('never opens a section no present role fills', () => {
    const { std } = stub(STICKIES);
    expect(
      titles(
        legendFromCommands(std, 'ddd-event-storming', new Set(['fx:flow']))
      )
    ).toEqual(['Flows']);
  });

  it('says nothing about a board whose roles it does not know', () => {
    const { std } = stub(STICKIES);
    expect(
      legendFromCommands(std, 'ddd-event-storming', new Set(['other:thing']))
    ).toEqual([]);
  });

  it('reads only the owner asked for', () => {
    const { std } = stub([
      ...STICKIES,
      command({
        id: 'other.addThing',
        owner: 'c4',
        category: 'stickies',
        order: 0,
        legend: { role: 'fx:event', row: row('#000000') },
      }),
    ]);
    expect(
      labels(
        legendFromCommands(std, 'ddd-event-storming', new Set(['fx:event']))
      )
    ).toEqual([['Event']]);
  });

  describe('sections', () => {
    it('falls back to the command’s category, through the catalogue key', () => {
      const { std } = stub(STICKIES, [], {
        'com.labre.catalogue.category.stickies': 'Pense-bêtes',
      });
      expect(
        titles(
          legendFromCommands(std, 'ddd-event-storming', new Set(['fx:event']))
        )
      ).toEqual(['Pense-bêtes']);
    });

    /**
     * The case that forbids deriving the sub-title from `category` alone: the
     * three DDD frameworks put EVERY command in one category and still show two
     * or three sub-titles, and EDGY's twelve elements come from one command and
     * span four.
     */
    it('lets a row declare its own, ahead of the category', () => {
      const { std } = stub([
        command({
          id: 'fx.insertTemplate',
          category: 'diagrams',
          order: 1,
          legend: [
            {
              role: 'fx:event',
              row: row(),
              section: ['com.labre.fx.section.identity', 'Identity'],
            },
            {
              role: 'fx:flow',
              row: { swatch: 'line', color: '#1f2328' },
              section: ['com.labre.fx.section.relations', 'Relations'],
            },
          ] satisfies CommandLegendEntry[],
        }),
      ]);
      const sections = legendFromCommands(
        std,
        'ddd-event-storming',
        new Set(['fx:event', 'fx:flow'])
      );
      expect(titles(sections)).toEqual(['Identity', 'Relations']);
      expect(labels(sections)).toEqual([['Event'], ['Flow']]);
    });

    it('leaves a row with neither a section nor a category untitled', () => {
      const { std } = stub([
        command({ id: 'fx.bare', legend: { role: 'fx:event', row: row() } }),
      ]);
      expect(
        titles(
          legendFromCommands(std, 'ddd-event-storming', new Set(['fx:event']))
        )
      ).toEqual([undefined]);
    });
  });

  describe('which roles light a row up', () => {
    const PARENT = [
      command({
        id: 'fx.addSticky',
        category: 'stickies',
        order: 1,
        legend: { role: 'fx:sticky', row: row('#ffffff') },
      }),
    ];

    it('resolves a specialisation: a parent row appears for a child role', () => {
      const { std } = stub(PARENT);
      expect(
        labels(
          legendFromCommands(std, 'ddd-event-storming', new Set(['fx:event']))
        )
      ).toEqual([['Sticky']]);
      expect(
        legendFromCommands(std, 'ddd-event-storming', new Set(['fx:flow']))
      ).toEqual([]);
    });

    it('`exact` narrows it back to the bare role', () => {
      const { std } = stub([
        command({
          id: 'fx.addSticky',
          category: 'stickies',
          order: 1,
          legend: { role: 'fx:sticky', exact: true, row: row('#ffffff') },
        }),
      ]);
      expect(
        legendFromCommands(std, 'ddd-event-storming', new Set(['fx:event']))
      ).toEqual([]);
      expect(
        labels(
          legendFromCommands(std, 'ddd-event-storming', new Set(['fx:sticky']))
        )
      ).toEqual([['Sticky']]);
    });

    /**
     * Two Wardley commands draw an area (a rectangle and a polygon) and the
     * notation has ONE "Area". Without this the box would show the same row
     * twice, and the first declaration is the one that wins.
     */
    it('de-duplicates by role, first declaration winning', () => {
      const { std } = stub([
        command({
          id: 'fx.addEventRect',
          category: 'stickies',
          order: 1,
          legend: { role: 'fx:event', row: row('#111111') },
        }),
        command({
          id: 'fx.addEventPolygon',
          category: 'stickies',
          order: 2,
          legend: { role: 'fx:event', row: row('#222222') },
        }),
      ]);
      const sections = legendFromCommands(
        std,
        'ddd-event-storming',
        new Set(['fx:event'])
      );
      expect(sections[0].rows).toHaveLength(1);
      expect(sections[0].rows[0].color).toBe('#111111');
    });
  });

  describe('the words on a row', () => {
    it('takes the role’s wording, through the host’s catalogue', () => {
      const { std } = stub(STICKIES, [], {
        'com.labre.fx.role.event': 'Événement',
      });
      expect(
        labels(
          legendFromCommands(std, 'ddd-event-storming', new Set(['fx:event']))
        )
      ).toEqual([['Événement']]);
    });

    it('stitches a labelPrefix back on AFTER translation', () => {
      const { std } = stub(
        [
          command({
            id: 'fx.addEvent',
            category: 'stickies',
            order: 1,
            legend: { role: 'fx:event', labelPrefix: 'DE', row: row() },
          }),
        ],
        [],
        { 'com.labre.fx.role.event': 'Événement' }
      );
      expect(
        labels(
          legendFromCommands(std, 'ddd-event-storming', new Set(['fx:event']))
        )
      ).toEqual([['DE — Événement']]);
    });

    /**
     * Wardley's rows EXPLAIN the notation where the role merely names it
     * ("Need / capability (activity, practice, data…)" against "Component").
     * Without this seam the migration would silently replace thirteen shipped
     * sentences with thirteen role names.
     */
    it('prefers the row’s own wording over the role’s', () => {
      const { std } = stub(
        [
          command({
            id: 'fx.addEvent',
            category: 'stickies',
            order: 1,
            legend: {
              role: 'fx:event',
              labelWording: [
                'com.labre.fx.legend.desc.event',
                'Something that happened, in the past tense',
              ],
              row: row(),
            },
          }),
        ],
        [],
        { 'com.labre.fx.role.event': 'Événement' }
      );
      expect(
        labels(
          legendFromCommands(std, 'ddd-event-storming', new Set(['fx:event']))
        )
      ).toEqual([['Something that happened, in the past tense']]);
    });

    it('falls back to the command’s own wording for a role that declares none', () => {
      const { std } = stub([
        command({
          id: 'fx.addFlow',
          category: 'flows',
          order: 1,
          labelFallback: 'Draw a flow',
          legend: {
            role: 'fx:unknown',
            row: { swatch: 'line', color: '#1f2328' },
          },
        }),
      ]);
      // `fx:unknown` is in no vocabulary, so `roleIsA` only matches it
      // literally — which is exactly what a board carrying it does.
      expect(
        labels(
          legendFromCommands(std, 'ddd-event-storming', new Set(['fx:unknown']))
        )
      ).toEqual([['Draw a flow']]);
    });
  });
});

describe('createBoardLegend', () => {
  const BOARD = command({
    id: 'fx.addBoard',
    category: 'stickies',
    order: 0,
    telemetry: {
      framework: 'ddd-event-storming',
      element: 'board',
      board: true,
    },
  });
  const EVENT = command({
    id: 'fx.addEvent',
    category: 'stickies',
    order: 1,
    legend: { role: 'fx:event', row: row() },
  });

  it('drops the box bottom-left of the board, grouped and selected', () => {
    const { added, selection, std } = stub(
      [BOARD, EVENT],
      [at(100, 100, 'fx:event')]
    );
    const id = createBoardLegend(std, BG, 'ddd-event-storming');

    // One section (sub-title + one row): PAD*2 + TITLE_H + SUB_H + ROW_H.
    const H = 16 * 2 + 32 + 26 + 28;
    expect(added[0].xywh).toBe(new Bound(50, 800 - 56 - H, 260, H).serialize());
    expect(id).toBe('group-1');
    expect(selection.set).toHaveBeenCalledWith({
      elements: ['group-1'],
      editing: false,
    });
  });

  it('draws a titled box with no rows on a board it recognises nothing on', () => {
    const { added, std } = stub([BOARD, EVENT], [at(100, 100)]);
    createBoardLegend(std, BG, 'ddd-event-storming');

    expect(added).toHaveLength(2); // frame + title, nothing else
    expect(added[1].text).toBe('Legend');
    const H = 16 * 2 + 32;
    expect(added[0].xywh).toBe(new Bound(50, 800 - 56 - H, 260, H).serialize());
  });

  /**
   * THE invariant of the whole feature. A legend is drawn ON the board it
   * describes and the scan detects by role: a swatch carrying one would list
   * itself the next time a legend was generated, and would be counted by every
   * validation rule on the board. The engine strips it rather than trusting a
   * table to leave it out.
   */
  it('strips a role a table put on a glyph’s props', () => {
    const { added, std } = stub(
      [
        BOARD,
        command({
          id: 'fx.addEvent',
          category: 'stickies',
          order: 1,
          legend: {
            role: 'fx:event',
            row: {
              swatch: 'glyph',
              color: '#F5963B',
              // A table that got it wrong, on purpose.
              props: { type: 'shape', shapeType: 'rect', role: 'fx:event' },
            },
          },
        }),
      ],
      [at(100, 100, 'fx:event')]
    );
    createBoardLegend(std, BG, 'ddd-event-storming');

    for (const element of added) expect(element).not.toHaveProperty('role');
    expect(added.some(e => e.shapeType === 'rect' && e.type === 'shape')).toBe(
      true
    );
  });

  it('gives a `custom` swatch the box, and groups whatever it drew', () => {
    const draw = vi.fn(
      (
        surface: { addElement(props: Record<string, unknown>): string },
        box: { x: number; y: number; w: number; h: number }
      ) => [
        surface.addElement({ type: 'shape', xywh: `[${box.x},${box.y},1,1]` }),
        surface.addElement({ type: 'shape', xywh: `[0,0,${box.w},${box.h}]` }),
      ]
    );
    const { grouped, std } = stub(
      [
        command({
          id: 'fx.addBoard',
          category: 'stickies',
          order: 0,
          telemetry: {
            framework: 'ddd-event-storming',
            element: 'board',
            board: true,
          },
          legendBox: { swatchWidth: 46, swatchHeight: 30, rowHeight: 30 },
        }),
        command({
          id: 'fx.addEvent',
          category: 'stickies',
          order: 1,
          legend: {
            role: 'fx:event',
            row: { swatch: 'custom', color: '#F5963B', draw },
          },
        }),
      ],
      [at(100, 100, 'fx:event')]
    );
    createBoardLegend(std, BG, 'ddd-event-storming');

    expect(draw).toHaveBeenCalledTimes(1);
    expect(draw.mock.calls[0][1]).toEqual({
      x: 50 + 16,
      y: expect.any(Number),
      w: 46,
      h: 30,
    });
    // Both ids the composite returned joined the group, like any other row.
    const children = Object.keys(grouped[0].children as object);
    expect(children).toContain('el-4');
    expect(children).toContain('el-5');
  });

  /**
   * An extra states its height as a VALUE, not a second callback, because the
   * box has to be measured before it can be placed: Wardley's gradient and its
   * Porter panel both sit below the last row, and the anchor is the board's
   * bottom edge.
   */
  it('measures the board’s extras before placing the box, then draws them below', () => {
    const draw = vi.fn(() => ['extra-1']);
    const { added, std } = stub(
      [
        command({
          id: 'fx.addBoard',
          category: 'stickies',
          order: 0,
          telemetry: {
            framework: 'ddd-event-storming',
            element: 'board',
            board: true,
          },
          legendBox: { extras: () => [{ height: 90, draw }] },
        }),
        EVENT,
      ],
      [at(100, 100, 'fx:event')]
    );
    createBoardLegend(std, BG, 'ddd-event-storming');

    const H = 16 * 2 + 32 + 26 + 28 + 90;
    expect(added[0].xywh).toBe(new Bound(50, 800 - 56 - H, 260, H).serialize());
    // Drawn at the foot of the rows, in the box's own column.
    expect(draw).toHaveBeenCalledTimes(1);
    const [, , x, y, width] = draw.mock.calls[0] as unknown as [
      unknown,
      unknown,
      number,
      number,
      number,
    ];
    expect(x).toBe(50);
    expect(width).toBe(260);
    expect(y).toBe(800 - 56 - H + 16 + 32 + 26 + 28);
  });

  it('tells the extras hook which board and which roles it is describing', () => {
    const extras = vi.fn((_ctx: unknown) => []);
    const { std } = stub(
      [
        command({
          id: 'fx.addBoard',
          category: 'stickies',
          order: 0,
          telemetry: {
            framework: 'ddd-event-storming',
            element: 'board',
            board: true,
          },
          legendBox: { extras },
        }),
        EVENT,
      ],
      [at(100, 100, 'fx:event')]
    );
    createBoardLegend(std, BG, 'ddd-event-storming');

    expect(extras).toHaveBeenCalledTimes(1);
    const ctx = extras.mock.calls[0][0] as unknown as {
      board: unknown;
      present: ReadonlySet<string>;
    };
    expect(ctx.board).toBe(BG);
    expect([...ctx.present]).toEqual(['fx:event']);
  });

  it('takes the box title and its layout from the board’s own command', () => {
    const { added, std } = stub(
      [
        command({
          id: 'fx.addBoard',
          category: 'stickies',
          order: 0,
          telemetry: {
            framework: 'ddd-event-storming',
            element: 'board',
            board: true,
          },
          legendBox: {
            titleWording: ['com.labre.fx.legend.title', 'Key'],
            width: 300,
            rowHeight: 36,
          },
        }),
        EVENT,
      ],
      [at(100, 100, 'fx:event')]
    );
    createBoardLegend(std, BG, 'ddd-event-storming');

    expect(added[1].text).toBe('Key');
    const H = 16 * 2 + 32 + 26 + 36;
    expect(added[0].xywh).toBe(new Bound(50, 800 - 56 - H, 300, H).serialize());
  });
});
