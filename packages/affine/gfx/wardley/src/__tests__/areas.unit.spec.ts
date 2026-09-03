import {
  DEFAULT_POLYGON_VERTICES,
  ShapeStyle,
  TextFitMode,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import { describe, expect, it, vi } from 'vitest';

import { createWardleyArea } from '../actions';
import { wardleyCommands } from '../commands';
import { exportWardleyOwmWithWarnings, wardleyBoardFrom } from '../export';
import { createWardleyLegend } from '../legend';
import { WARDLEY_MORPH_FAMILIES } from '../morph';
import {
  AREA_FILL,
  AREA_POLYGON_SIZE,
  AREA_RECT_SIZE,
  AREA_STROKE,
  AREA_STROKE_WIDTH,
  LABEL_FONT_SIZE,
  NODE_STROKE,
} from '../node/consts';
import {
  WARDLEY_AREA_SIZE,
  WARDLEY_MORPHABLE_KINDS,
  WARDLEY_NODE_LABEL,
  WARDLEY_NODE_SIZE,
  wardleyAreaProps,
  wardleyMorphClears,
} from '../presets';
import { WARDLEY_ROLE } from '../roles';
import {
  board,
  drawNode,
  fakeMap,
  fakeNode,
  flatten,
  PLOT,
} from './owm-board-stub';
import { owmPointOf } from '../export';

/**
 * Areas — the zones of the map.
 *
 * One kind drawn as two shapes, which is the fact everything here follows from.
 * A rectangular zone and a polygonal one are the same statement ("all of this
 * is one thing") with a different number of corners, so the `shapeType` carries
 * the difference and nothing else has to: one role, one legend row, one silence
 * in the OWM export.
 *
 * The other two facts are about what a zone DOES to the map it covers. Its name
 * is its own inner text rather than a label beside it, because a label parked
 * outside a boundary would name whatever else is there. And it is sent to the
 * BACK the moment it exists, because a wash drawn last sits on top of every
 * component it groups and eats their clicks.
 */

type Added = Record<string, unknown>;

/**
 * Minimal GfxController stand-in, recording what the action posted — plus the
 * layer, which is the piece no other Wardley creation site touches.
 */
function fakeGfx() {
  const added: Added[] = [];
  const grouped: string[][] = [];
  const elements = new Map<string, { id: string; index: string }>();
  const reordered: { id: string; direction: string }[] = [];
  let n = 0;

  const gfx = {
    surface: {
      addElement: (props: Added) => {
        const id = `el-${n++}`;
        added.push(props);
        elements.set(id, { id, index: 'a1' });
        return id;
      },
      getElementById: (id: string) => elements.get(id) ?? null,
      getElementsByType: () => [],
    },
    layer: {
      getReorderedIndex: (
        element: { id: string },
        direction: string
      ): string => {
        reordered.push({ id: element.id, direction });
        return 'a0';
      },
    },
    viewport: { centerX: 100, centerY: 200 },
    doc: { captureSync: vi.fn() },
    tool: { setTool: vi.fn() },
    selection: { set: vi.fn() },
    std: {
      getOptional: () => undefined,
      get: () => ({ recordLastProps: vi.fn() }),
      command: {
        exec: (_command: unknown, options: { elements: string[] }) => {
          grouped.push(options.elements);
          return [{}, { groupId: 'group-0' }];
        },
      },
    },
  };

  return { gfx: gfx as never, added, grouped, elements, reordered };
}

/* ── What a zone IS, as props ─────────────────────────────────────────── */

describe('the area presets', () => {
  it('is one kind at two sizes: a band of the map, and a square', () => {
    expect(AREA_RECT_SIZE).toEqual({ w: 240, h: 160 });
    expect(AREA_POLYGON_SIZE).toEqual({ w: 200, h: 200 });
    // The table keyed by KIND answers the rect's, which is the common area and
    // the one anything asking a kind for its canonical box should get.
    expect(WARDLEY_NODE_SIZE.area).toEqual(AREA_RECT_SIZE);
    expect(WARDLEY_AREA_SIZE).toEqual({
      rect: AREA_RECT_SIZE,
      polygon: AREA_POLYGON_SIZE,
    });
  });

  it.each(['rect', 'polygon'] as const)(
    'draws a %s zone as one translucent wardleyNode',
    shape => {
      const props = wardleyAreaProps(shape, { xywh: '[0,0,240,160]' });

      expect(props).toMatchObject({
        type: 'wardleyNode',
        kind: 'area',
        role: WARDLEY_ROLE.area,
        shapeType: shape,
        filled: true,
        fillColor: AREA_FILL,
        strokeColor: AREA_STROKE,
        strokeWidth: AREA_STROKE_WIDTH,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
      });
      // The load-bearing number: an 8-digit hex, so the fill carries ALPHA the
      // way `PIPELINE_FILL` does. A zone is drawn over the components it
      // groups, and the map has to stay readable through it.
      expect(AREA_FILL).toBe('#c6dbfc99');
      expect(AREA_FILL).toHaveLength(9);
      expect(AREA_STROKE).toBe('#5b9cf6');
      expect(AREA_STROKE_WIDTH).toBe(1);
      // No words: an area is created NAMELESS, so the editor a double-click
      // opens starts on an empty line.
      expect(props).not.toHaveProperty('text');
    }
  );

  it('gives the rect square corners and the polygon none', () => {
    // `radius` is a claim about corners, so only the shape that has them makes
    // it — the same reason `wardleyMorphProps` deletes rather than zeroes.
    expect(wardleyAreaProps('rect', { xywh: '[0,0,240,160]' }).radius).toBe(0);
    expect(
      wardleyAreaProps('polygon', { xywh: '[0,0,200,200]' })
    ).not.toHaveProperty('radius');
  });

  it('gives the polygon the editor’s own default outline, and only it', () => {
    const rect = wardleyAreaProps('rect', { xywh: '[0,0,240,160]' });
    expect(rect).not.toHaveProperty('vertices');
    expect(rect).not.toHaveProperty('isClosed');

    const polygon = wardleyAreaProps('polygon', { xywh: '[0,0,200,200]' });
    expect(polygon.vertices).toEqual(DEFAULT_POLYGON_VERTICES);
    expect(polygon.isClosed).toBe(true);
  });

  it('hands every zone its own vertex arrays', () => {
    // `vertices` goes into a Y document. Sharing the module-level literal would
    // be two zones sharing one array — moving a corner of either moving both,
    // and moving the editor's own default polygon along with them.
    const a = wardleyAreaProps('polygon', { xywh: '[0,0,200,200]' });
    const b = wardleyAreaProps('polygon', { xywh: '[0,0,200,200]' });
    expect(a.vertices).toEqual(b.vertices);
    expect(a.vertices).not.toBe(b.vertices);
    expect(a.vertices).not.toBe(DEFAULT_POLYGON_VERTICES);
    expect((a.vertices as number[][])[0]).not.toBe(DEFAULT_POLYGON_VERTICES[0]);
  });

  it.each(['rect', 'polygon'] as const)(
    'writes the %s zone’s name into its top-left corner, never resizing it',
    shape => {
      const props = wardleyAreaProps(shape, { xywh: '[0,0,240,160]' });

      expect(props).toMatchObject({
        color: NODE_STROKE,
        fontSize: LABEL_FONT_SIZE,
        textAlign: 'left',
        textVerticalAlign: 'top',
        // The load-bearing one: a zone is a boundary drawn around real
        // components, so a long name must never push that boundary out and
        // swallow one the author did not mean to include.
        textFitMode: TextFitMode.Overflow,
      });
    }
  );

  it('carries a role with no parent, so no value-chain rule reaches it', () => {
    // A zone is drawn precisely ON TOP of the components it names, so a parent
    // of `wardley:component` would make W3 report an overlap on every area that
    // does its job.
    expect(WARDLEY_ROLE.area).toBe('wardley:area');
  });

  it('has no label of its own in the placeholder table', () => {
    // The porter's neighbour in that omission, and for a related reason: a
    // placeholder is a word the author deletes before typing theirs, and an
    // area's name is inside the zone where they would have to.
    expect(WARDLEY_NODE_LABEL).not.toHaveProperty('area');
  });
});

/* ── The morph is untouched ───────────────────────────────────────────── */

describe('the morph', () => {
  it('offers the area in no family, in either direction', () => {
    // A zone is not a way of drawing a link in the value chain, so there is
    // nothing it could become and nothing that could become one.
    expect(WARDLEY_MORPH_FAMILIES.flat()).not.toContain('area');
    expect(WARDLEY_MORPHABLE_KINDS).not.toContain('area');
  });

  it('never leaks the zone’s keys into what a morphable kind clears', () => {
    // The union is computed over the MORPHABLE kinds, so an area's `vertices`,
    // `isClosed` and text props stay out of every delete list.
    for (const kind of WARDLEY_MORPHABLE_KINDS) {
      const cleared = wardleyMorphClears(kind);
      expect(cleared).not.toContain('vertices');
      expect(cleared).not.toContain('isClosed');
      expect(cleared).not.toContain('textFitMode');
    }
    // …and the one key that IS cleared is still the one the pipeline alone
    // writes, which is what says the union did not move.
    expect(wardleyMorphClears('component')).toEqual(['radius']);
    expect(wardleyMorphClears('pipeline')).toEqual([]);
  });
});

/* ── Drawing one ──────────────────────────────────────────────────────── */

describe('creating an area', () => {
  it.each(['rect', 'polygon'] as const)(
    'posts a single %s element and groups nothing',
    shape => {
      const { gfx, added, grouped } = fakeGfx();
      createWardleyArea(gfx, shape);

      // One element, which makes this the plainest creation site in the pack:
      // every other artefact is a group of two because its name lives beside
      // it, and a zone's name lives inside it.
      expect(added).toHaveLength(1);
      expect(grouped).toEqual([]);
      expect(added[0]).toMatchObject({
        type: 'wardleyNode',
        kind: 'area',
        role: WARDLEY_ROLE.area,
        shapeType: shape,
      });
    }
  );

  it.each(['rect', 'polygon'] as const)(
    'centres a %s zone on the viewport at its own size',
    shape => {
      const { gfx, added } = fakeGfx();
      createWardleyArea(gfx, shape);

      const { w, h } = WARDLEY_AREA_SIZE[shape];
      expect(added[0].xywh).toBe(
        new Bound(100 - w / 2, 200 - h / 2, w, h).serialize()
      );
    }
  );

  it('sends the zone to the BACK of the surface as it is drawn', () => {
    const { gfx, elements, reordered } = fakeGfx();
    createWardleyArea(gfx, 'rect');

    // The whole reason this action touches the layer at all: a zone added last
    // would paint over everything it groups and intercept every click meant for
    // a component inside it. Same mechanism as edgeless "Send to back".
    expect(reordered).toEqual([{ id: 'el-0', direction: 'back' }]);
    expect(elements.get('el-0')!.index).toBe('a0');
  });

  it('leaves the zone selected, so the author can name it at once', () => {
    const { gfx } = fakeGfx();
    createWardleyArea(gfx, 'polygon');

    expect(
      (gfx as unknown as { selection: { set: ReturnType<typeof vi.fn> } })
        .selection.set
    ).toHaveBeenCalledWith({ elements: ['el-0'], editing: false });
  });
});

/* ── The sub-menu ─────────────────────────────────────────────────────── */

describe('the two commands', () => {
  const find = (id: string) => wardleyCommands.find(c => c.id === id)!;

  it.each([
    ['wardley.addAreaRect', 'Area (rectangle)', 'node:area-rect'],
    ['wardley.addAreaPolygon', 'Area (polygon)', 'node:area-polygon'],
  ])('declares %s', (id, label, element) => {
    const command = find(id);
    expect(command).toBeDefined();
    expect(command.labelFallback).toBe(label);
    // A section of its own, for the reason the role has no parent: a zone is
    // not a node of the value chain and not a relation between two.
    expect(command.category).toBe('areas');
    expect(command.telemetry?.element).toBe(element);
    // Keyless by intent, like the porter and the two climate arrows.
    expect(command.defaultKeys).toEqual({ mac: [], other: [] });
    // Both nominate the row — the PO's amendment of 2026-09-03 to ADR 0014 R4.
    expect(command.surfaces).toContain('senior-menu');
    expect(command.surfaces).toContain('catalogue');
  });

  it('declares them last of the toolbox, after the connectors', () => {
    const ids = wardleyCommands.map(c => c.id);
    expect(ids.indexOf('wardley.addAreaPolygon')).toBe(
      ids.indexOf('wardley.addAreaRect') + 1
    );
    // After both connector tools: an area is drawn around a chain that is
    // already there, so it is the last gesture of a map.
    expect(ids.indexOf('wardley.addAreaRect')).toBeGreaterThan(
      ids.indexOf('wardley.evolutionArrow')
    );
    // …and the two are the last ARTEFACTS: only the interchange trio follows.
    expect(ids.slice(ids.indexOf('wardley.addAreaPolygon') + 1)).toEqual([
      'wardley.importOwm',
      'wardley.exportOwm',
      'wardley.importSvg',
    ]);
  });
});

/* ── The map legend ───────────────────────────────────────────────────── */

describe('the legend', () => {
  /** Run the legend over a board holding exactly the given elements. */
  function legendOf(present: unknown[]) {
    const added: Added[] = [];
    const gfx = {
      surface: { addElement: (props: Added) => (added.push(props), 'x') },
      getElementsByBound: () => present,
      selection: { set: vi.fn() },
    };
    const std = {
      get: () => gfx,
      store: { captureSync: vi.fn() },
      command: { exec: () => [{}, { groupId: 'g' }] },
    };
    createWardleyLegend(
      std as never,
      {
        deserializedXYWH: [0, 0, 1600, 900],
        xywh: '[0,0,1600,900]',
        variant: 'classic',
      } as never
    );
    return added;
  }

  const areaOnBoard = () =>
    Object.create(WardleyNodeElementModel.prototype, {
      kind: { value: 'area' },
    });

  it('adds one row saying what a zone is', () => {
    const texts = legendOf([areaOnBoard()])
      .filter(el => el.type === 'text')
      .map(el => String(el.text));

    expect(texts).toContain('Area (zone of the map)');
  });

  it('draws the row as a small translucent rect, whatever the map’s zones are', () => {
    const glyphs = legendOf([areaOnBoard()]).filter(
      el => el.type === 'wardleyNode'
    );

    expect(glyphs).toHaveLength(1);
    expect(glyphs[0]).toMatchObject({
      kind: 'area',
      // The rect even for a map full of polygons: the row says what a ZONE is,
      // and the number of corners is the author's choice rather than notation.
      shapeType: 'rect',
      fillColor: AREA_FILL,
      strokeColor: AREA_STROKE,
      strokeWidth: AREA_STROKE_WIDTH,
    });
    // Role-LESS, like every glyph in this box: a legend documents the map, it
    // is not part of it.
    expect(glyphs[0]).not.toHaveProperty('role');
  });

  it('says nothing about a map that carries none', () => {
    const texts = legendOf([
      Object.create(WardleyNodeElementModel.prototype, {
        kind: { value: 'component' },
      }),
    ])
      .filter(el => el.type === 'text')
      .map(el => String(el.text));

    expect(texts).not.toContain('Area (zone of the map)');
  });
});

/* ── What OWM cannot say ──────────────────────────────────────────────── */

describe('the OWM export', () => {
  const write = (parts: Parameters<typeof flatten>[0]) =>
    exportWardleyOwmWithWarnings(wardleyBoardFrom(flatten(parts) as never), {});

  /** A zone, drawn where it would cover a readable part of the plot. */
  function areaAt(visibility: number, evolution: number) {
    const [cx, cy] = owmPointOf(PLOT, visibility, evolution);
    const { w, h } = AREA_RECT_SIZE;
    return fakeNode('area-1', 'area', [cx - w / 2, cy - h / 2, w, h]);
  }

  it('leaves the zone out of the file and says why', () => {
    const kettle = drawNode('kettle', 'component', 'Kettle', 0.6, 0.7);

    const { text, warnings } = write(
      board({
        maps: [fakeMap()],
        nodes: [kettle.node, areaAt(0.3, 0.8)],
        labels: [kettle.label],
      })
    );

    expect(text).toContain('component Kettle');
    expect(text).not.toContain('area');
    expect(warnings).toContain(
      '1 area could not be written: OWM has no word for a zone of the map, so it was left out.'
    );
  });

  it('never christens a zone, so it raises no unnamed-artefact warning', () => {
    // The trap the skip is placed BEFORE `nameOf` to avoid: a zone's name is
    // its own inner text, so asking for one would call it "Component 1" and
    // report a loss that never happened, on a line the file does not contain.
    const { warnings } = write(
      board({ maps: [fakeMap()], nodes: [areaAt(0.4, 0.4)] })
    );

    expect(warnings.join('\n')).not.toContain('Component 1');
  });

  it('never takes a neighbour’s name for itself', () => {
    // The failure a zone could cause and a force could not: an area is drawn
    // AROUND components, so its box sits next to every label on the map. If it
    // claimed one, the artefact that owns it would lose its name — and the
    // stolen label would then be thrown away with the zone.
    const kettle = drawNode('kettle', 'component', 'Kettle', 0.6, 0.7);

    const { text } = write(
      board({
        maps: [fakeMap()],
        nodes: [kettle.node, areaAt(0.6, 0.7)],
        labels: [kettle.label],
      })
    );

    expect(text).toContain('component Kettle');
  });
});
