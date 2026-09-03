import {
  ShapeElementModel,
  ShapeStyle,
  TextFitMode,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import { describe, expect, it, vi } from 'vitest';

import { createWardleyPorter } from '../actions';
import { exportWardleyOwmWithWarnings, wardleyBoardFrom } from '../export';
import { createWardleyLegend } from '../legend';
import { WARDLEY_MORPH_FAMILIES } from '../morph';
import {
  NODE_FILL,
  NODE_STROKE,
  NODE_STROKE_WIDTH,
  PORTER_ARROW,
  PORTER_DEFAULT_LETTER,
  PORTER_LETTER_FONT_SIZE,
  PORTER_SIZE,
  WARDLEY_RED,
} from '../node/consts';
import {
  WARDLEY_NODE_LABEL,
  WARDLEY_NODE_SIZE,
  wardleyMorphClears,
  wardleyNodeProps,
  wardleyPorterArrows,
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
 * Porter's forces — the one Wardley artefact that is NOT part of the map.
 *
 * Everything in this file follows from that single fact. The circle is a role
 * of its own with no parent, so no rule about the value chain reaches it; it
 * carries no label, so the label table has one fewer key than the size table;
 * and OWM cannot write it down at all, so the export owes the person who
 * clicked Export a sentence rather than a silence.
 *
 * The four arrows are the glyph's own wiring, the way the market's triangle is:
 * role-less and free, which is what stops a composite reporting an overlap with
 * itself and what stops a legend calling four red spikes an evolution.
 */

type Added = Record<string, unknown>;

/** Minimal GfxController stand-in, recording what the action posted. */
function fakeGfx() {
  const added: Added[] = [];
  const grouped: string[][] = [];
  let n = 0;

  const gfx = {
    surface: {
      addElement: (props: Added) => {
        added.push(props);
        return `el-${n++}`;
      },
      getElementsByType: () => [],
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

  return { gfx: gfx as never, added, grouped };
}

/* ── What a force IS, as props ────────────────────────────────────────── */

describe('the porter preset', () => {
  it('is born large, white and thin-bordered', () => {
    // Twice the market's diameter (PO, recette of #210): a force bears on the
    // whole map and has to read as one at working zoom.
    expect(PORTER_SIZE).toBe(60);
    expect(WARDLEY_NODE_SIZE.porter).toEqual({
      w: PORTER_SIZE,
      h: PORTER_SIZE,
    });

    const props = wardleyNodeProps('porter', { xywh: '[0,0,30,30]' });
    expect(props).toMatchObject({
      type: 'wardleyNode',
      kind: 'porter',
      role: WARDLEY_ROLE.porter,
      shapeType: 'ellipse',
      fillColor: NODE_FILL,
      strokeColor: NODE_STROKE,
      strokeWidth: NODE_STROKE_WIDTH,
    });
    // An ellipse, so no `radius` — the same absence every non-pipeline kind has,
    // and the one `wardleyMorphClears` exists to delete.
    expect(props).not.toHaveProperty('radius');
    // No words in the preset: the letter is CONTENT, added at the creation site.
    expect(props).not.toHaveProperty('text');
  });

  it('carries a role with no parent, so no value-chain rule reaches it', () => {
    // The claim the whole artefact rests on, asserted where it is DECLARED. A
    // parent of `wardley:component` would put every force under W3's overlap
    // pairs, and a force sitting on the components it presses against is
    // exactly what pressing against them looks like.
    expect(WARDLEY_ROLE.porter).toBe('wardley:porter');
  });

  it('has no label, and the table says so by having no key for it', () => {
    // Narrowed key type rather than an empty string: an empty placeholder is a
    // name nobody has typed yet, which is precisely what the morph is allowed
    // to rewrite. A force's letter is the notation and belongs to no author.
    expect(WARDLEY_NODE_LABEL).not.toHaveProperty('porter');
  });

  it('joins no morph family and leaves the morph tables untouched', () => {
    expect(WARDLEY_MORPH_FAMILIES.flat()).not.toContain('porter');
    // Same shape as a plain component, so the union of keys the morph clears is
    // the one it was before this kind existed.
    expect(wardleyMorphClears('porter')).toEqual(
      wardleyMorphClears('component')
    );
  });
});

/* ── The geometry, read by the creation site and the legend alike ─────── */

/** An arrow's box as four numbers. */
const boxOf = (arrow: { xywh: string }) =>
  Bound.deserialize(arrow.xywh).toXYWH();

describe('the four arrows', () => {
  const R = PORTER_SIZE / 2;
  const near = R + PORTER_ARROW.gap;
  const { length: L, headWidth: W } = PORTER_ARROW;

  it('are four axis-aligned boxes, standing clear of the rim', () => {
    // North first, then clockwise. Each box's NEAR edge is `gap` outside the
    // rim and it runs `length` further out; its other axis is the head's width,
    // which is the widest the arrow ever gets.
    const [north, east, south, west] = wardleyPorterArrows(0, 0);

    expect(boxOf(north)).toEqual([-W / 2, -near - L, W, L]);
    expect(boxOf(east)).toEqual([near, -W / 2, L, W]);
    expect(boxOf(south)).toEqual([-W / 2, near, W, L]);
    expect(boxOf(west)).toEqual([-near - L, -W / 2, L, W]);
  });

  it('are symmetric about the centre it is given, and never rotated', () => {
    const arrows = wardleyPorterArrows(100, 200);
    expect(arrows).toHaveLength(4);

    // No `rotate`: each direction carries its own vertex list, so nothing
    // downstream has to de-rotate a bounding box to know where an arrow is.
    for (const arrow of arrows) {
      expect(arrow).not.toHaveProperty('rotate');
      expect(arrow.vertices).toHaveLength(7);
    }

    // The four boxes reflect into one another about (100, 200): the top of the
    // north box and the bottom of the south box are the same distance out.
    const [north, east, south, west] = arrows.map(boxOf);
    expect(north[1] + (south[1] + south[3])).toBe(2 * 200);
    expect(west[0] + (east[0] + east[2])).toBe(2 * 100);
    expect(north[0]).toBe(south[0]);
    expect(east[1]).toBe(west[1]);
  });

  it('outline a shaft with a head on it, tip first', () => {
    // Seven points: the tip, the two head corners, the four shaft corners. The
    // head is `headLength / length` of the box and the shaft `width / headWidth`
    // of it across — the numbers `consts.ts` declares, and nothing derived from
    // a stroke width, which is the whole reason these stopped being connectors.
    const head = PORTER_ARROW.headLength / PORTER_ARROW.length;
    const low = (1 - PORTER_ARROW.width / PORTER_ARROW.headWidth) / 2;

    const [north] = wardleyPorterArrows(0, 0);
    expect(north.vertices).toEqual([
      [0.5, 0],
      [1, head],
      [1 - low, head],
      [1 - low, 1],
      [low, 1],
      [low, head],
      [0, head],
    ]);
    // The tip of each arrow points AWAY from the centre: north's is on the box's
    // top edge, east's on its right edge, and so on.
    const [, east, south, west] = wardleyPorterArrows(0, 0);
    expect(east.vertices[0]).toEqual([1, 0.5]);
    expect(south.vertices[0]).toEqual([0.5, 1]);
    expect(west.vertices[0]).toEqual([0, 0.5]);
  });

  it('scale the whole glyph with the radius, gap and head included', () => {
    // What makes a legend row a small Porter rather than a small circle with
    // four map-sized spikes through it. The OUTLINE is normalized, so only the
    // boxes move — which is why one vertex table serves every size.
    const small = wardleyPorterArrows(0, 0, R / 2);
    expect(boxOf(small[0])).toEqual([-W / 4, (-near - L) / 2, W / 2, L / 2]);
    expect(small[0].vertices).toEqual(wardleyPorterArrows(0, 0)[0].vertices);
  });
});

/* ── What the sub-menu draws ──────────────────────────────────────────── */

describe('createWardleyPorter', () => {
  it('draws one lettered circle and four red arrows, grouped as one', () => {
    const { gfx, added, grouped } = fakeGfx();
    createWardleyPorter(gfx);

    const nodes = added.filter(el => el.type === 'wardleyNode');
    const arrows = added.filter(el => el.type === 'shape');
    expect(nodes).toHaveLength(1);
    expect(arrows).toHaveLength(4);
    // Five elements, one group, and nothing else on the board: no label.
    expect(added).toHaveLength(5);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toHaveLength(5);
    // Nothing a connector any more — the defect the recette of #210 found.
    expect(added.some(el => el.type === 'connector')).toBe(false);
  });

  it('writes the notation letter as the circle’s OWN inner text', () => {
    const { gfx, added } = fakeGfx();
    createWardleyPorter(gfx);

    const circle = added.find(el => el.type === 'wardleyNode')!;
    expect(circle.kind).toBe('porter');
    expect(circle.role).toBe(WARDLEY_ROLE.porter);
    expect(circle.text).toBe(PORTER_DEFAULT_LETTER);
    expect(circle.fontSize).toBe(PORTER_LETTER_FONT_SIZE);
    expect(circle.color).toBe(NODE_STROKE);
    expect(circle.textHorizontalAlign).toBe('center');
    expect(circle.textVerticalAlign).toBe('center');
    // The load-bearing one: the glyph has a canonical size that says "external
    // force" at a glance, so a longer letter must never inflate the circle.
    expect(circle.textFitMode).toBe(TextFitMode.Overflow);
    // Centred on the viewport at its canonical diameter.
    expect(circle.xywh).toBe(
      `[${100 - PORTER_SIZE / 2},${200 - PORTER_SIZE / 2},${PORTER_SIZE},${PORTER_SIZE}]`
    );
  });

  it('draws the arrows as role-less filled red polygons', () => {
    const { gfx, added } = fakeGfx();
    createWardleyPorter(gfx);

    const arrows = added.filter(el => el.type === 'shape');
    const circle = added.find(el => el.type === 'wardleyNode')!;
    const expected = wardleyPorterArrows(100, 200);

    arrows.forEach((arrow, index) => {
      // Role-less like the market's triangle: the glyph's own wiring, or every
      // composite reports an overlap with itself (W3).
      expect(arrow.role).toBeUndefined();
      expect(arrow.shapeType).toBe('polygon');
      expect(arrow.vertices).toEqual(expected[index].vertices);
      expect(arrow.xywh).toBe(expected[index].xywh);
      // Filled, and stroked at ZERO: nothing about this glyph is sized off a
      // line width, which is exactly what went wrong when it was a connector.
      expect(arrow.filled).toBe(true);
      expect(arrow.fillColor).toBe(WARDLEY_RED);
      expect(arrow.strokeColor).toBe(WARDLEY_RED);
      expect(arrow.strokeWidth).toBe(0);
      expect(arrow.roughness).toBe(0);
      expect(arrow.shapeStyle).toBe(ShapeStyle.General);
    });

    // …and not one of them overlaps the circle, which is what makes the letter
    // visible and the double-click at the centre reach the circle rather than
    // an arrow. The whole of BUG 1, asserted as geometry.
    const rim = Bound.deserialize(String(circle.xywh));
    for (const arrow of arrows) {
      const box = Bound.deserialize(String(arrow.xywh));
      expect(rim.isOverlapWithBound(box), String(arrow.xywh)).toBe(false);
    }
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

  /** A porter circle and its four arrows, as `instanceof` sees them. */
  const porterOnBoard = () => [
    Object.create(WardleyNodeElementModel.prototype, {
      kind: { value: 'porter' },
    }),
    // Plain shapes now, not connectors — which is precisely why the legend's
    // INERTIA test is the one that has to be checked below.
    ...wardleyPorterArrows(0, 0).map(() =>
      Object.create(ShapeElementModel.prototype, {
        role: { value: undefined },
        shapeType: { value: 'polygon' },
        fillColor: { value: WARDLEY_RED },
      })
    ),
  ];

  it('adds a porter row, spelling out what the three letters mean', () => {
    const added = legendOf(porterOnBoard());
    const texts = added
      .filter(el => el.type === 'text')
      .map(el => String(el.text));

    expect(texts).toContain(
      "Porter's forces (external competition: R relative, L survival, E establish)"
    );
    // Drawn as the real glyph, letter included — a legend that dropped it would
    // be describing a circle rather than the notation it stands for.
    const circle = added.find(el => el.kind === 'porter')!;
    expect(circle.text).toBe(PORTER_DEFAULT_LETTER);
  });

  it('describes nothing but the force: no evolution, no inertia', () => {
    const texts = legendOf(porterOnBoard())
      .filter(el => el.type === 'text')
      .map(el => String(el.text));

    // Two rows that must NOT appear. The arrows are red, so a legend reading
    // colour alone would call them an evolution; they are plain filled shapes,
    // so the inertia test — `ShapeElementModel` with a matching fill — is the
    // one they could trip now that they are polygons rather than connectors.
    // A map carrying a force and nothing else claims neither.
    expect(texts).not.toContain('Evolution / movement (red = future)');
    expect(texts).not.toContain('Inertia to change');
  });

  it('leaves every legend glyph neutral, arrows included', () => {
    // A legend documents the map; it is not part of it. Typing these would put
    // a phantom force under every rule written against roles.
    for (const el of legendOf(porterOnBoard())) {
      expect(el).not.toHaveProperty('role');
    }
  });
});

/* ── What OWM cannot say ──────────────────────────────────────────────── */

describe('the OWM export', () => {
  const write = (parts: Parameters<typeof flatten>[0]) =>
    exportWardleyOwmWithWarnings(wardleyBoardFrom(flatten(parts) as never), {});

  /** A force, drawn where a component would be readable. */
  function porterAt(visibility: number, evolution: number) {
    const [cx, cy] = owmPointOf(PLOT, visibility, evolution);
    return fakeNode('porter-1', 'porter', [
      cx - PORTER_SIZE / 2,
      cy - PORTER_SIZE / 2,
      PORTER_SIZE,
      PORTER_SIZE,
    ]);
  }

  it('leaves the force out of the file and says why', () => {
    const kettle = drawNode('kettle', 'component', 'Kettle', 0.6, 0.7);

    const { text, warnings } = write(
      board({
        maps: [fakeMap()],
        nodes: [kettle.node, porterAt(0.3, 0.8)],
        labels: [kettle.label],
      })
    );

    expect(text).toContain('component Kettle');
    expect(text).not.toContain('porter');
    expect(text).not.toContain("Porter's forces");
    expect(warnings).toContain(
      "1 Porter's forces glyph could not be written: OWM has no word for an external competition force, so it was left out."
    );
  });

  it('never christens a force, so it raises no unnamed-artefact warning', () => {
    // The trap this skip is placed BEFORE `nameOf` to avoid: a force carries no
    // name by design, so asking for one would call it "Component 1" and report
    // a loss that never happened, on a line the file does not contain.
    const { warnings } = write(
      board({ maps: [fakeMap()], nodes: [porterAt(0.4, 0.4)] })
    );

    expect(warnings.join('\n')).not.toContain('Component 1');
    expect(warnings.some(w => w.includes('no name on the map'))).toBe(false);
  });

  it('does not let a force steal the name of the component beside it', () => {
    // A force has no name, so any label it matched would be some neighbouring
    // artefact's — taken out of that artefact's mouth and then thrown away,
    // since the force is not written at all.
    const kettle = drawNode('kettle', 'component', 'Kettle', 0.6, 0.7);
    const [cx, cy] = owmPointOf(PLOT, 0.6, 0.7);
    // Sitting exactly on the component, which is where a force is MEANT to sit.
    const porter = fakeNode('porter-1', 'porter', [
      cx - PORTER_SIZE / 2,
      cy - PORTER_SIZE / 2,
      PORTER_SIZE,
      PORTER_SIZE,
    ]);

    const { text } = write(
      board({
        maps: [fakeMap()],
        // The force FIRST in document order: greedy matching breaks ties by it,
        // so this is the arrangement that would fail if it were a candidate.
        nodes: [porter, kettle.node],
        labels: [kettle.label],
      })
    );

    expect(text).toContain('component Kettle');
    expect(text).not.toContain('Component 1');
  });
});
