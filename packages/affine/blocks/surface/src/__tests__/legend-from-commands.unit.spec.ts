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
import {
  createBoardLegend,
  LEGEND_ROLE,
  legendFromCommands,
} from '../extensions/legend';

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
  id?: string;
  role?: string;
  /** `'shape'` unless the case is about a group (a legend wrapper is one). */
  type?: string;
  xywh: string;
}

/**
 * An editor stub carrying registered commands and one role vocabulary, with a
 * REAL bound filter so "an artefact outside the perimeter is not in the legend"
 * is proved by the geometry rather than by the stub being told the answer.
 *
 * The group the engine creates is pushed BACK into the scanned perimeter, with
 * the bound its children give it, so a second `createBoardLegend` on the same
 * stub sees exactly what a second press on the real board sees (issue #391).
 */
function stub(
  commands: AnyCommandDescriptor[],
  elements: FixtureElement[] = [],
  catalogue?: Record<string, string>,
  { readonly = false }: { readonly?: boolean } = {}
) {
  const added: Record<string, unknown>[] = [];
  const grouped: Record<string, unknown>[] = [];
  const boundsById = new Map<string, Bound>();
  let n = 0;
  let g = 0;
  const overlaps = (a: Bound, b: Bound) =>
    a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
  const selection = { set: vi.fn() };
  const gfx = {
    surface: {
      addElement: (props: Record<string, unknown>) => {
        const id = `el-${n++}`;
        added.push(props);
        if (typeof props.xywh === 'string') {
          boundsById.set(id, Bound.deserialize(props.xywh));
        }
        return id;
      },
    },
    getElementsByBound: (bound: Bound) =>
      elements
        .filter(el => overlaps(bound, Bound.deserialize(el.xywh)))
        .map(el => ({
          ...el,
          id: el.id ?? 'fixture',
          type: el.type ?? 'shape',
          elementBound: Bound.deserialize(el.xywh),
        })),
    selection,
    layer: { canvasElements: [] as { type: string }[] },
  };
  const removeElement = vi.fn((id: string) => {
    const at = elements.findIndex(el => el.id === id);
    if (at >= 0) elements.splice(at, 1);
  });
  const crud = {
    addElement: (type: string, props: Record<string, unknown>) => {
      grouped.push({ ...props, type });
      const id = `group-${++g}`;
      // The wrapper's geometry is DERIVED from its children, as the real group
      // model's is — which is what puts it inside the board's perimeter.
      let box: Bound | undefined;
      for (const child of Object.keys(props.children as object)) {
        const childBox = boundsById.get(child);
        if (childBox) box = box ? box.unite(childBox) : childBox;
      }
      if (box) {
        elements.push({
          id,
          type,
          role: props.role as string | undefined,
          xywh: box.serialize(),
        });
      }
      return id;
    },
    removeElement,
  };
  const registry = new Map<string, AnyCommandDescriptor>(
    commands.map((c, i) => [`Command-${i}`, c])
  );
  const captureSync = vi.fn();
  const std = {
    get: (identifier: unknown) =>
      identifier === (EdgelessCRUDIdentifier as unknown) ? crud : gfx,
    getOptional: () =>
      catalogue ? { t: (key: string) => catalogue[key] } : undefined,
    store: { captureSync, readonly },
    provider: {
      getAll: (identifier: unknown) =>
        identifier === (CommandDescriptorIdentifier as unknown)
          ? registry
          : identifier === (RoleVocabularyIdentifier as unknown)
            ? new Map([['RoleVocabulary-1', ROLES]])
            : new Map(),
    },
  } as unknown as BlockStdScope;
  return {
    added,
    captureSync,
    elements,
    grouped,
    removeElement,
    selection,
    std,
  };
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

    /**
     * A legend is a KEY to a notation, so the same framework has to read in the
     * same order on every board — only the rows may change.
     *
     * The bucket is therefore opened for every DECLARED row, lit or not, and
     * emptied ones are dropped afterwards. Opening it on the first row that lit
     * made the order a property of the board: here "Flows" is declared after
     * "Stickies" but its row is the first to light, so it used to come out
     * first, and the same framework read one way with a bare event on the board
     * and another way without it.
     */
    it('orders the sub-titles by DECLARATION, not by which row lights first', () => {
      const { std } = stub([
        // Declares "Stickies" first — and this row does NOT light below.
        command({
          id: 'fx.addEvent',
          category: 'stickies',
          order: 1,
          legend: { role: 'fx:event', row: row() },
        }),
        command({
          id: 'fx.addFlow',
          kind: 'tool',
          category: 'flows',
          order: 2,
          legend: {
            role: 'fx:flow',
            row: { swatch: 'line', color: '#1f2328' },
          },
        }),
        // …and the row that actually fills "Stickies" comes later.
        command({
          id: 'fx.addCommand',
          category: 'stickies',
          order: 3,
          legend: { role: 'fx:command', row: row('#5BA3DB') },
        }),
      ]);
      const sections = legendFromCommands(
        std,
        'ddd-event-storming',
        new Set(['fx:flow', 'fx:command'])
      );
      expect(titles(sections)).toEqual(['Stickies', 'Flows']);
      // …and the ROWS inside a section keep command order, as before.
      expect(labels(sections)).toEqual([['Command'], ['Flow']]);
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
  const FLOW = command({
    id: 'fx.addFlow',
    kind: 'tool',
    category: 'flows',
    order: 2,
    legend: { role: 'fx:flow', row: { swatch: 'line', color: '#1f2328' } },
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

  it('takes one undo checkpoint before writing', () => {
    const { captureSync, std } = stub(
      [BOARD, EVENT],
      [at(100, 100, 'fx:event')]
    );
    createBoardLegend(std, BG, 'ddd-event-storming');
    expect(captureSync).toHaveBeenCalledTimes(1);
  });

  /**
   * The box used to be grouped through `createGroupCommand`
   * (`@labre/affine-gfx-group`), which this package cannot import: that package
   * depends on THIS one. The engine re-runs that command's body against the
   * same `EdgelessCRUDIdentifier`, seed title included, so a legend group is
   * still exactly what the gesture says a group is.
   */
  it('groups the box through the CRUD seam, under the group seed title', () => {
    const { added, grouped, std } = stub(
      [BOARD, EVENT],
      [at(100, 100, 'fx:event')]
    );
    createBoardLegend(std, BG, 'ddd-event-storming');

    expect(grouped).toHaveLength(1);
    expect(grouped[0].type).toBe('group');
    expect(grouped[0].title).toBe('Group 1');
    expect(Object.keys(grouped[0].children as object)).toHaveLength(
      added.length
    );
  });

  /**
   * …and the one thing a plain group is not. The glyphs stay role-less (the
   * invariant below), so the WRAPPER is the only structural handle anything has
   * on "this box is a legend" — which the `.bpmn` export needs, or it reports a
   * generated legend as a dozen things it left out of the file.
   */
  it('stamps the group with the legend role, and nothing else with it', () => {
    const { added, grouped, std } = stub(
      [BOARD, EVENT],
      [at(100, 100, 'fx:event')]
    );
    createBoardLegend(std, BG, 'ddd-event-storming');

    expect(grouped[0].role).toBe(LEGEND_ROLE);
    for (const element of added) expect(element).not.toHaveProperty('role');
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

  /**
   * Issue #391. The placement is derived from the BOARD alone, so a second
   * press used to drop an identical box at the very same pixel: one legend to
   * the eye, two groups and thirty-odd elements in the document, every one of
   * them exported, synced, and to be dragged away one at a time. Nothing in
   * this file would have caught it — it never pressed the button twice.
   *
   * Four of the seven below are red on the code that shipped 0.42; the other
   * three are guards on the filter that finds the outgoing box, and would go
   * red the day it started matching more than this board's own legend.
   */
  describe('a second press (#391)', () => {
    /** The legend groups the perimeter holds, whoever drew them. */
    const legendsOf = (perimeter: FixtureElement[]) =>
      perimeter.filter(el => el.type === 'group' && el.role === LEGEND_ROLE);

    it('replaces the board’s legend instead of stacking a second one', () => {
      const { elements, grouped, removeElement, std } = stub(
        [BOARD, EVENT],
        [at(100, 100, 'fx:event')]
      );
      const first = createBoardLegend(std, BG, 'ddd-event-storming');
      const second = createBoardLegend(std, BG, 'ddd-event-storming');

      expect(first).toBe('group-1');
      expect(second).toBe('group-2');
      // Two boxes were drawn, and exactly one is left on the board.
      expect(grouped).toHaveLength(2);
      expect(removeElement).toHaveBeenCalledTimes(1);
      expect(removeElement).toHaveBeenCalledWith('group-1');
      expect(legendsOf(elements)).toHaveLength(1);
      expect(legendsOf(elements)[0].id).toBe('group-2');
    });

    /**
     * The point of replacing rather than refusing: the box a user presses for
     * a second time is the one that now documents what he has just drawn.
     */
    it('redraws the rows from what is on the board NOW', () => {
      const { added, elements, std } = stub(
        [BOARD, EVENT, FLOW],
        [at(100, 100, 'fx:event')]
      );
      createBoardLegend(std, BG, 'ddd-event-storming');
      const afterFirst = added.filter(el => el.text === 'Flow');
      expect(afterFirst).toHaveLength(0);

      // An artefact drawn between the two presses.
      elements.push(at(200, 200, 'fx:flow'));
      createBoardLegend(std, BG, 'ddd-event-storming');

      // The row is drawn once, on the box that is left standing.
      expect(added.filter(el => el.text === 'Flow')).toHaveLength(1);
      expect(legendsOf(elements)).toHaveLength(1);
    });

    /**
     * Replacing is two writes, and a user who presses twice by accident must
     * get his box back with ONE Ctrl+Z — not an empty board on the first undo
     * and the old box on the second.
     */
    it('spends one undo checkpoint, taken before the removal', () => {
      const { captureSync, removeElement, std } = stub(
        [BOARD, EVENT],
        [at(100, 100, 'fx:event')]
      );
      createBoardLegend(std, BG, 'ddd-event-storming');
      captureSync.mockClear();
      createBoardLegend(std, BG, 'ddd-event-storming');

      expect(captureSync).toHaveBeenCalledTimes(1);
      expect(captureSync.mock.invocationCallOrder[0]).toBeLessThan(
        removeElement.mock.invocationCallOrder[0]
      );
    });

    /**
     * `getElementsByBound` answers with everything that OVERLAPS, and two
     * boards drawn edge to edge overlap each other's corner. Containment is
     * what keeps a press on one from eating the other's legend.
     */
    it('leaves the legend of the board next door alone', () => {
      const { elements, removeElement, std } = stub(
        [BOARD, EVENT],
        [at(100, 100, 'fx:event')]
      );
      // The neighbour's box: it reaches into this board, but hangs out of it.
      elements.push({
        id: 'neighbour-legend',
        type: 'group',
        role: LEGEND_ROLE,
        xywh: new Bound(-100, 600, 260, 120).serialize(),
      });
      createBoardLegend(std, BG, 'ddd-event-storming');

      expect(removeElement).not.toHaveBeenCalled();
      expect(legendsOf(elements).map(el => el.id)).toEqual([
        'neighbour-legend',
        'group-1',
      ]);
    });

    /**
     * The compatibility clause of ADR 0026, said out loud: `core:legend`
     * shipped in 0.42 and nothing is backfilled, so a box generated before it
     * is not recognised and the old stacking survives on those documents.
     */
    it('does not recognise a legend drawn before the role shipped', () => {
      const { elements, removeElement, std } = stub(
        [BOARD, EVENT],
        [at(100, 100, 'fx:event')]
      );
      elements.push({
        id: 'legacy-legend',
        type: 'group',
        xywh: new Bound(50, 600, 260, 120).serialize(),
      });
      createBoardLegend(std, BG, 'ddd-event-storming');

      expect(removeElement).not.toHaveBeenCalled();
      expect(elements.some(el => el.id === 'legacy-legend')).toBe(true);
    });

    /**
     * The outgoing wrapper is the one element of the perimeter carrying
     * `core:legend`, and the box replacing it describes the drawing, not
     * itself. No `RoleDefs` declares the role so no row could light from it —
     * but the extras hook is handed the same set, and a framework's hook is
     * free to read it.
     */
    it('keeps `core:legend` out of the roles the new box is derived from', () => {
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
      createBoardLegend(std, BG, 'ddd-event-storming');

      const ctx = extras.mock.calls[1][0] as unknown as {
        present: ReadonlySet<string>;
      };
      expect([...ctx.present]).toEqual(['fx:event']);
    });

    /**
     * The gesture DELETES now, so the readonly refusal moves into the engine
     * as well as the button: `removeElement` would refuse on its own and the
     * draw that follows would throw, which is the one order that loses a box.
     */
    it('writes nothing at all on a readonly store', () => {
      const { added, captureSync, grouped, removeElement, std } = stub(
        [BOARD, EVENT],
        [at(100, 100, 'fx:event')],
        undefined,
        { readonly: true }
      );
      expect(createBoardLegend(std, BG, 'ddd-event-storming')).toBeUndefined();

      expect(added).toHaveLength(0);
      expect(grouped).toHaveLength(0);
      expect(removeElement).not.toHaveBeenCalled();
      expect(captureSync).not.toHaveBeenCalled();
    });
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
