import {
  DEFAULT_POLYGON_VERTICES,
  ShapeStyle,
  TextFitMode,
  WardleyBackgroundElementModel,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import { describe, expect, it, vi } from 'vitest';

import { createWardleyArea, wardleyAreaIndexOver } from '../actions';
import { wardleyFillColor } from '../toolbar/node-config';
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
 * outside a boundary would name whatever else is there. And it is LOWERED the
 * moment it exists, because a wash drawn last sits on top of every component it
 * groups and eats their clicks — to just above the framework background it
 * covers, which is the correction the recette of #213 asked for: "the back of
 * the surface" put it behind the opaque map and made it invisible.
 */

type Added = Record<string, unknown>;

/** One element already on the stubbed surface, in paint order. */
type Placed = {
  id: string;
  index: string;
  xywh: string;
  group: null;
};

/**
 * A framework background at that depth — a Wardley map, as far as this goes.
 *
 * `defineProperties` rather than `Object.assign`, as `owm-board-stub` does: the
 * model's props are prototype ACCESSORS, and assigning through them would run
 * the document machinery this test has none of.
 */
function fakeBackground(id: string, index: string, xywh: string): Placed {
  const model = Object.create(
    WardleyBackgroundElementModel.prototype
  ) as Placed;
  Object.defineProperties(model, {
    id: { value: id, enumerable: true },
    index: { value: index, enumerable: true },
    xywh: { value: xywh, enumerable: true },
    group: { value: null, enumerable: true },
  });
  return model;
}

/** Anything that is not a background: a component, a label, a connector. */
function fakePlain(id: string, index: string, xywh: string): Placed {
  return { id, index, xywh, group: null };
}

/**
 * Minimal GfxController stand-in, recording what the action posted — plus the
 * surface stack and the layer, the two pieces no other Wardley creation site
 * touches.
 */
function fakeGfx(standing: Placed[] = []) {
  const added: Added[] = [];
  const grouped: string[][] = [];
  const elements = new Map<string, Placed>();
  const reordered: { id: string; direction: string }[] = [];
  let n = 0;

  for (const element of standing) elements.set(element.id, element);

  const gfx = {
    surface: {
      get elementModels() {
        return [...elements.values()];
      },
      addElement: (props: Added) => {
        const id = `el-${n++}`;
        added.push(props);
        elements.set(id, {
          id,
          // The top of the stack, which is where a freshly added element lands
          // — and the whole reason the action then lowers it.
          index: 'zz',
          xywh: String(props.xywh),
          group: null,
        });
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

  it('sends a zone with nothing under it to the BACK of the surface', () => {
    const { gfx, elements, reordered } = fakeGfx();
    createWardleyArea(gfx, 'rect');

    // The whole reason this action touches the layer at all: a zone added last
    // would paint over everything it groups and intercept every click meant for
    // a component inside it. With no background beneath, the back of the
    // surface is right, and the LAYER mints the key so an empty board gets its
    // own initial index rather than one invented here.
    expect(reordered).toEqual([{ id: 'el-0', direction: 'back' }]);
    expect(elements.get('el-0')!.index).toBe('a0');
  });

  it('lands just above the map it is drawn on, below the components', () => {
    // The defect the recette of #213 found: a Wardley map is an OPAQUE
    // framework background, so a zone sent behind the whole surface went behind
    // the map and was invisible. What a zone must be under is the artefacts it
    // groups; what it must be over is the canvas they sit on.
    const map = fakeBackground('map', 'a0', '[0,0,1600,900]');
    const component = fakePlain('component', 'a1', '[90,190,18,18]');
    const { gfx, elements, reordered } = fakeGfx([map, component]);

    createWardleyArea(gfx, 'rect');

    // Not the back: the layer was never asked for one.
    expect(reordered).toEqual([]);
    const index = elements.get('el-0')!.index;
    expect(index > map.index).toBe(true);
    expect(index < component.index).toBe(true);
  });

  it('ignores a background it does not overlap', () => {
    // A board can carry another framework's canvas parked elsewhere. The zone
    // is drawn over ITS map, and a background it does not touch says nothing
    // about how deep it goes.
    const elsewhere = fakeBackground('other', 'a0', '[5000,5000,800,600]');
    const { gfx, reordered } = fakeGfx([elsewhere]);

    createWardleyArea(gfx, 'rect');

    expect(reordered).toEqual([{ id: 'el-0', direction: 'back' }]);
  });
});

/* ── How deep, exactly ────────────────────────────────────────────────── */

describe('where a zone goes in the stack', () => {
  const BOX = new Bound(100, 100, 200, 200);
  /** A background big enough to hold the zone — a map, in other words. */
  const covering = (index: string) => ({
    index,
    xywh: '[0,0,1600,900]',
    isBackground: true,
  });

  it('answers "the back" when nothing is under it', () => {
    expect(wardleyAreaIndexOver([], BOX)).toBeNull();
    expect(
      wardleyAreaIndexOver(
        [{ index: 'a1', xywh: '[0,0,1600,900]', isBackground: false }],
        BOX
      )
    ).toBeNull();
  });

  it('slots between the background it covers and what sits above it', () => {
    const index = wardleyAreaIndexOver(
      [
        covering('a0'),
        { index: 'a2', xywh: '[110,110,18,18]', isBackground: false },
      ],
      BOX
    )!;
    expect(index).not.toBeNull();
    expect(index > 'a0').toBe(true);
    expect(index < 'a2').toBe(true);
  });

  it('appends above a background that is the topmost element there is', () => {
    const index = wardleyAreaIndexOver([covering('a0')], BOX)!;
    expect(index > 'a0').toBe(true);
  });

  it('clears the TOPMOST background it covers, not the first drawn', () => {
    // Two maps stacked: the zone belongs above the one nearest the artefacts,
    // whichever of them was drawn first.
    const index = wardleyAreaIndexOver([covering('a0'), covering('a1')], BOX)!;
    expect(index > 'a1').toBe(true);
  });

  it('reads the paint order off the indexes, not off the array', () => {
    // Fractional indexes sort lexicographically, which IS the paint order — so
    // the caller may hand these over in document order and be right anyway.
    const index = wardleyAreaIndexOver(
      [
        { index: 'a2', xywh: '[110,110,18,18]', isBackground: false },
        covering('a0'),
      ],
      BOX
    )!;
    expect(index > 'a0').toBe(true);
    expect(index < 'a2').toBe(true);
  });
});

/* ── A recoloured zone is still a wash ────────────────────────────────── */

describe('the fill a picked swatch writes', () => {
  const node = (kind: string) =>
    Object.create(WardleyNodeElementModel.prototype, {
      kind: { value: kind },
    }) as never;

  it('keeps the zone’s alpha when a swatch is picked for an area', () => {
    // The nit the recette raised: a zone is drawn over the map it groups, so a
    // picker that wrote `#5b9cf6` as-is would hide the map behind an opaque
    // wash. Peace comes back as Peace at the zone's own opacity.
    expect(wardleyFillColor(node('area'), '#5b9cf6')).toBe('#5b9cf699');
    expect(wardleyFillColor(node('area'), '#C6DBFC')).toBe('#C6DBFC99');
  });

  it('leaves every other artefact’s fill exactly as picked', () => {
    for (const kind of ['component', 'market', 'accelerator', 'porter']) {
      expect(wardleyFillColor(node(kind), '#5b9cf6')).toBe('#5b9cf6');
    }
  });

  it('never touches a value that already carries alpha, or a theme token', () => {
    // An 8-digit hex is somebody's deliberate choice from the custom picker,
    // and a token is not a hex at all — it must reach the document intact.
    expect(wardleyFillColor(node('area'), '#5b9cf680')).toBe('#5b9cf680');
    expect(wardleyFillColor(node('area'), '--affine-palette-shape-blue')).toBe(
      '--affine-palette-shape-blue'
    );
  });

  it('leaves a plain shape alone: only a wardley zone is a wash', () => {
    expect(wardleyFillColor({} as never, '#5b9cf6')).toBe('#5b9cf6');
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
