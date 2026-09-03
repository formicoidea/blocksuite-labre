import {
  ConnectorElementModel,
  PointStyle,
  StrokeStyle,
  TextFitMode,
  WardleyNodeElementModel,
} from '@labre/affine-model';
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
  wardleyPorterArrowSegments,
} from '../presets';
import { WARDLEY_ROLE } from '../roles';
import {
  board,
  drawNode,
  fakeConnector,
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
  it('is born at the market circle size, white and thin-bordered', () => {
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

describe('the four arrows', () => {
  const R = PORTER_SIZE / 2;

  it('leave the rim by the gap and run the declared length outward', () => {
    const [north, east, south, west] = wardleyPorterArrowSegments(0, 0);
    const near = R + PORTER_ARROW.gap;
    const far = near + PORTER_ARROW.length;

    expect(north).toEqual({ source: [0, -near], target: [0, -far] });
    expect(east).toEqual({ source: [near, 0], target: [far, 0] });
    expect(south).toEqual({ source: [0, near], target: [0, far] });
    expect(west).toEqual({ source: [-near, 0], target: [-far, 0] });
  });

  it('are four, cardinal, and symmetric about the centre it is given', () => {
    const arrows = wardleyPorterArrowSegments(100, 200);
    expect(arrows).toHaveLength(4);

    // Every head is `gap + length` clear of the rim, in one of four directions.
    const far = R + PORTER_ARROW.gap + PORTER_ARROW.length;
    for (const { source, target } of arrows) {
      expect(Math.hypot(source[0] - 100, source[1] - 200)).toBeCloseTo(
        R + PORTER_ARROW.gap
      );
      expect(Math.hypot(target[0] - 100, target[1] - 200)).toBeCloseTo(far);
    }
    // Opposite pairs cancel: north with south, east with west.
    const sum = arrows.reduce(
      (acc, { target }) => [acc[0] + target[0], acc[1] + target[1]],
      [0, 0]
    );
    expect(sum).toEqual([400, 800]);
  });

  it('scale the whole glyph with the radius, gap and length included', () => {
    // What makes a legend row a small Porter rather than a small circle with
    // two map-sized spikes through it.
    const small = wardleyPorterArrowSegments(0, 0, R / 2);
    expect(small[0]).toEqual({
      source: [0, -(R + PORTER_ARROW.gap) / 2],
      target: [0, -(R + PORTER_ARROW.gap + PORTER_ARROW.length) / 2],
    });
  });
});

/* ── What the sub-menu draws ──────────────────────────────────────────── */

describe('createWardleyPorter', () => {
  it('draws one lettered circle and four red arrows, grouped as one', () => {
    const { gfx, added, grouped } = fakeGfx();
    createWardleyPorter(gfx);

    const nodes = added.filter(el => el.type === 'wardleyNode');
    const connectors = added.filter(el => el.type === 'connector');
    expect(nodes).toHaveLength(1);
    expect(connectors).toHaveLength(4);
    // Five elements, one group, and nothing else on the board: no label.
    expect(added).toHaveLength(5);
    expect(grouped).toHaveLength(1);
    expect(grouped[0]).toHaveLength(5);
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

  it('leaves the arrows role-less, solid red and headed outward', () => {
    const { gfx, added } = fakeGfx();
    createWardleyPorter(gfx);

    for (const arrow of added.filter(el => el.type === 'connector')) {
      // Role-less like the market's triangle: the glyph's own wiring, or every
      // composite reports an overlap with itself (W3).
      expect(arrow.role).toBeUndefined();
      expect(arrow.stroke).toBe(WARDLEY_RED);
      // Solid, never dashed — a dashed red line is an evolution arrow, and the
      // two must not be mistaken for one another on the same map.
      expect(arrow.strokeStyle).toBe(StrokeStyle.Solid);
      expect(arrow.strokeWidth).toBe(PORTER_ARROW.width);
      expect(arrow.frontEndpointStyle).toBe(PointStyle.None);
      expect(arrow.rearEndpointStyle).toBe(PointStyle.Triangle);
      // FREE at both ends: attaching them to the circle would let a resize drag
      // them out of square.
      expect(arrow.source).toHaveProperty('position');
      expect(arrow.target).toHaveProperty('position');
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
    ...wardleyPorterArrowSegments(0, 0).map(arrow =>
      Object.create(ConnectorElementModel.prototype, {
        role: { value: undefined },
        stroke: { value: WARDLEY_RED },
        strokeStyle: { value: StrokeStyle.Solid },
        source: { value: { position: arrow.source } },
        target: { value: { position: arrow.target } },
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

  it('does not call the glyph’s four red arrows an evolution', () => {
    const texts = legendOf(porterOnBoard())
      .filter(el => el.type === 'text')
      .map(el => String(el.text));

    // The row that would appear if the red test below `isPorterArrow` had
    // swallowed them. A map with a force on it and no arrow drawn claims no
    // movement at all.
    expect(texts).not.toContain('Evolution / movement (red = future)');
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

  /** A force, drawn where a component would be readable, plus its arrows. */
  function porterAt(visibility: number, evolution: number) {
    const [cx, cy] = owmPointOf(PLOT, visibility, evolution);
    return {
      node: fakeNode('porter-1', 'porter', [
        cx - PORTER_SIZE / 2,
        cy - PORTER_SIZE / 2,
        PORTER_SIZE,
        PORTER_SIZE,
      ]),
      arrows: wardleyPorterArrowSegments(cx, cy).map((_, index) =>
        fakeConnector(`porter-arrow-${index}`, undefined)
      ),
    };
  }

  it('leaves the force out of the file and says why', () => {
    const kettle = drawNode('kettle', 'component', 'Kettle', 0.6, 0.7);
    const porter = porterAt(0.3, 0.8);

    const { text, warnings } = write(
      board({
        maps: [fakeMap()],
        nodes: [kettle.node, porter.node],
        labels: [kettle.label],
        connectors: porter.arrows,
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
    const porter = porterAt(0.4, 0.4);
    const { warnings } = write(
      board({ maps: [fakeMap()], nodes: [porter.node] })
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
