import {
  FontWeight,
  ShapeElementModel,
  ShapeStyle,
  TextAlign,
  WardleyNodeElementModel,
} from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import { describe, expect, it, vi } from 'vitest';

import { createWardleyAccelerator } from '../actions';
import { wardleyCommands } from '../commands';
import { exportWardleyOwm } from '../export';
import { importWardleyOwm } from '../import';
import { createWardleyLegend } from '../legend';
import { WARDLEY_MORPH_FAMILIES, type WardleyMorphKind } from '../morph';
import {
  ACCELERATOR_FILL,
  ACCELERATOR_SIZE,
  ACCELERATOR_STROKE_WIDTH,
  ACCELERATOR_VERTICES,
  DECELERATOR_VERTICES,
  LABEL_GAP,
  NODE_STROKE,
} from '../node/consts';
import {
  WARDLEY_MORPHABLE_KINDS,
  WARDLEY_NODE_LABEL,
  WARDLEY_NODE_SIZE,
  wardleyMorphClears,
  wardleyNodeProps,
} from '../presets';
import { WARDLEY_ROLE } from '../roles';
import { boardFromProps } from './owm-board-stub';

/**
 * Accelerators and decelerators — the climate annotations.
 *
 * Neither is a link in the value chain, and neither is a pressure on it either:
 * they say how FAST the map is moving. Two facts follow and are what this file
 * is about. They are the first Wardley kinds drawn as a native POLYGON, so they
 * are the first to write `vertices` — which is why the morph's key union had to
 * stop being "every kind in the pack". And their DIRECTION is the notation, so
 * the mirror is two vertex lists rather than one plus a rotation, and the label
 * follows the shaft rather than always sitting on the right.
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

/* ── What an arrow IS, as props ───────────────────────────────────────── */

describe('the accelerator presets', () => {
  it('are born at one canonical size, fat and grey-filled', () => {
    expect(ACCELERATOR_SIZE).toEqual({ w: 48, h: 40 });
    expect(WARDLEY_NODE_SIZE.accelerator).toEqual(ACCELERATOR_SIZE);
    expect(WARDLEY_NODE_SIZE.decelerator).toEqual(ACCELERATOR_SIZE);
  });

  it.each(['accelerator', 'decelerator'] as const)(
    'draws %s as a closed polygon with a thick dark rim',
    kind => {
      const props = wardleyNodeProps(kind, { xywh: '[0,0,48,40]' });

      expect(props).toMatchObject({
        type: 'wardleyNode',
        kind,
        role: WARDLEY_ROLE[kind],
        shapeType: 'polygon',
        isClosed: true,
        filled: true,
        fillColor: ACCELERATOR_FILL,
        strokeColor: NODE_STROKE,
        // Thick, and that is the whole of what makes a flat grey fill read as
        // the reference's solid arrow on a canvas with no gradient.
        strokeWidth: ACCELERATOR_STROKE_WIDTH,
        shapeStyle: ShapeStyle.General,
        roughness: 0,
      });
      expect(ACCELERATOR_FILL).toBe('#bfbfbf');
      expect(ACCELERATOR_STROKE_WIDTH).toBe(2);
      // A polygon, so no `radius` — only the pipeline has corners.
      expect(props).not.toHaveProperty('radius');
      // No words on the shape: the name is the text element beside it.
      expect(props).not.toHaveProperty('text');
    }
  );

  it('points right, and the decelerator is that outline mirrored', () => {
    // Seven points: the shaft's two left corners, the head's upper barb, the
    // tip, the lower barb, and back along the shaft.
    expect(ACCELERATOR_VERTICES).toHaveLength(7);
    expect(ACCELERATOR_VERTICES[3]).toEqual([1, 0.5]);
    // …and the mirror is `x → 1 − x`, which puts the tip on the left edge.
    expect(DECELERATOR_VERTICES).toEqual(
      ACCELERATOR_VERTICES.map(([x, y]) => [1 - x, y])
    );
    expect(DECELERATOR_VERTICES[3]).toEqual([0, 0.5]);
    // Both are NORMALIZED, so the same seven points draw a legend row and a
    // canvas arrow; nothing here is a pixel.
    for (const [x, y] of [...ACCELERATOR_VERTICES, ...DECELERATOR_VERTICES]) {
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(1);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(1);
    }
  });

  it('hands every element its own vertex arrays', () => {
    // `vertices` goes into a Y document. Two elements sharing one literal would
    // be two elements sharing one array — a resize of either moving both.
    const a = wardleyNodeProps('accelerator', { xywh: '[0,0,48,40]' });
    const b = wardleyNodeProps('accelerator', { xywh: '[0,0,48,40]' });
    expect(a.vertices).toEqual(b.vertices);
    expect(a.vertices).not.toBe(b.vertices);
    expect((a.vertices as number[][])[0]).not.toBe(ACCELERATOR_VERTICES[0]);
  });

  it('names both, unlike the porter', () => {
    // They DO carry a name: an accelerator is a thing the author points at and
    // says what it is. Only the force is nameless.
    expect(WARDLEY_NODE_LABEL.accelerator).toBe('Accelerator');
    expect(WARDLEY_NODE_LABEL.decelerator).toBe('Decelerator');
  });

  it('carries a role with no parent, so no value-chain rule reaches it', () => {
    // An accelerator is drawn exactly where the components it accelerates are,
    // so a parent of `wardley:component` would make W3 report an overlap on
    // every correctly drawn map.
    expect(WARDLEY_ROLE.accelerator).toBe('wardley:accelerator');
    expect(WARDLEY_ROLE.decelerator).toBe('wardley:decelerator');
  });
});

/* ── The morph is untouched, which is the point of restricting the union ─ */

describe('the morph', () => {
  it('offers neither kind: they join no family', () => {
    expect(WARDLEY_MORPH_FAMILIES.flat()).not.toContain('accelerator');
    expect(WARDLEY_MORPH_FAMILIES.flat()).not.toContain('decelerator');
  });

  it('declares the same morphable kinds on both sides of the import cut', () => {
    // `presets.ts` restates the family so `morph.ts` can keep importing it
    // rather than the other way round. This is what stops the restatement
    // drifting — the only thing that could.
    expect([...WARDLEY_MORPHABLE_KINDS].sort()).toEqual(
      [...new Set(WARDLEY_MORPH_FAMILIES.flat() as WardleyMorphKind[])].sort()
    );
  });

  it('never leaks `vertices` into what a morphable kind clears', () => {
    // The bug the restriction exists to prevent. A union over the WHOLE pack
    // would put `vertices` and `isClosed` — keys of two polygons nothing may
    // ever morph into — in every morphable kind's delete list.
    for (const kind of WARDLEY_MORPHABLE_KINDS) {
      expect(wardleyMorphClears(kind)).not.toContain('vertices');
      expect(wardleyMorphClears(kind)).not.toContain('isClosed');
    }
    // …and the one key that IS cleared is the one the pipeline alone writes.
    expect(wardleyMorphClears('component')).toEqual(['radius']);
    expect(wardleyMorphClears('pipeline')).toEqual([]);
  });
});

/* ── Drawing one ──────────────────────────────────────────────────────── */

describe('creating an accelerator', () => {
  const nodeOf = (added: Added[]) =>
    added.find(el => el.type === 'wardleyNode')!;
  const labelOf = (added: Added[]) => added.find(el => el.type === 'text')!;

  it.each(['accelerator', 'decelerator'] as const)(
    'makes one object of %s and its name',
    kind => {
      const { gfx, added, grouped } = fakeGfx();
      createWardleyAccelerator(gfx, kind);

      expect(added).toHaveLength(2);
      expect(grouped).toEqual([['el-0', 'el-1']]);

      const node = nodeOf(added);
      expect(node.kind).toBe(kind);
      expect(node.role).toBe(WARDLEY_ROLE[kind]);
      expect(node.shapeType).toBe('polygon');
      // The canonical box, centred on the viewport.
      expect(node.xywh).toBe(
        new Bound(
          100 - ACCELERATOR_SIZE.w / 2,
          200 - ACCELERATOR_SIZE.h / 2,
          ACCELERATOR_SIZE.w,
          ACCELERATOR_SIZE.h
        ).serialize()
      );

      const label = labelOf(added);
      expect(label.text).toBe(WARDLEY_NODE_LABEL[kind]);
      expect(label.role).toBe(WARDLEY_ROLE.label);
      // SemiBold: an annotation laid over a map already full of names.
      expect(label.fontWeight).toBe(FontWeight.SemiBold);
    }
  );

  it('puts the accelerator’s name on its right, reading into the arrow', () => {
    const { gfx, added } = fakeGfx();
    createWardleyAccelerator(gfx, 'accelerator');

    const label = labelOf(added);
    expect(label.textAlign).toBe('left');
    const [x] = Bound.deserialize(String(label.xywh)).toXYWH();
    expect(x).toBe(100 + ACCELERATOR_SIZE.w / 2 + LABEL_GAP);
  });

  it('puts the decelerator’s name on its left, ending against the shaft', () => {
    const { gfx, added } = fakeGfx();
    createWardleyAccelerator(gfx, 'decelerator');

    const label = labelOf(added);
    // Right-aligned, so the words end where the arrow begins whatever their
    // length — the box is a fixed width and does not shrink to them.
    expect(label.textAlign).toBe('right');
    const [x, , w] = Bound.deserialize(String(label.xywh)).toXYWH();
    expect(x + w).toBe(100 - ACCELERATOR_SIZE.w / 2 - LABEL_GAP);
  });

  it('places both names on the same line as the arrow they belong to', () => {
    for (const kind of ['accelerator', 'decelerator'] as const) {
      const { gfx, added } = fakeGfx();
      createWardleyAccelerator(gfx, kind);
      const [, y, , h] = Bound.deserialize(
        String(labelOf(added).xywh)
      ).toXYWH();
      expect(y + h / 2).toBe(200);
    }
  });
});

/* ── The sub-menu ─────────────────────────────────────────────────────── */

describe('the two commands', () => {
  const find = (id: string) => wardleyCommands.find(c => c.id === id)!;

  it.each([
    ['wardley.addAccelerator', 'Accelerator', 'node:accelerator'],
    ['wardley.addDecelerator', 'Decelerator', 'node:decelerator'],
  ])('declares %s', (id, label, element) => {
    const command = find(id);
    expect(command).toBeDefined();
    expect(command.labelFallback).toBe(label);
    expect(command.category).toBe('nodes');
    expect(command.telemetry?.element).toBe(element);
    // Keyless by intent: the `w` chord already seats eight artefacts, and a
    // framework binds past that by host override.
    expect(command.defaultKeys).toEqual({ mac: [], other: [] });
    // Both nominate the row — the PO's amendment of 2026-09-03 to ADR 0014 R4.
    expect(command.surfaces).toContain('senior-menu');
    expect(command.surfaces).toContain('catalogue');
  });

  it('declares them after the porter, last of the artefacts', () => {
    const ids = wardleyCommands.map(c => c.id);
    expect(ids.indexOf('wardley.addAccelerator')).toBe(
      ids.indexOf('wardley.addPorter') + 1
    );
    expect(ids.indexOf('wardley.addDecelerator')).toBe(
      ids.indexOf('wardley.addAccelerator') + 1
    );
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

  const arrowOnBoard = (kind: 'accelerator' | 'decelerator') =>
    Object.create(WardleyNodeElementModel.prototype, {
      kind: { value: kind },
    }) as ShapeElementModel;

  it('adds one row per kind, saying which way evolution moves', () => {
    const texts = legendOf([
      arrowOnBoard('accelerator'),
      arrowOnBoard('decelerator'),
    ])
      .filter(el => el.type === 'text')
      .map(el => String(el.text));

    expect(texts).toContain('Accelerator (speeds evolution up)');
    expect(texts).toContain('Decelerator (slows evolution down)');
  });

  it('draws each row with the map’s own outline, mirrored', () => {
    const added = legendOf([
      arrowOnBoard('accelerator'),
      arrowOnBoard('decelerator'),
    ]);
    const glyphs = added.filter(el => el.type === 'wardleyNode');

    expect(glyphs.map(el => el.kind)).toEqual(['accelerator', 'decelerator']);
    for (const glyph of glyphs) {
      expect(glyph.shapeType).toBe('polygon');
      expect(glyph.isClosed).toBe(true);
      expect(glyph.fillColor).toBe(ACCELERATOR_FILL);
      expect(glyph.strokeWidth).toBe(ACCELERATOR_STROKE_WIDTH);
      // Role-LESS, like every glyph in this box: a legend documents the map, it
      // is not part of it, so nothing here counts as an artefact under a rule.
      expect(glyph).not.toHaveProperty('role');
    }
    expect(glyphs[0].vertices).toEqual(
      ACCELERATOR_VERTICES.map(([x, y]) => [x, y])
    );
    expect(glyphs[1].vertices).toEqual(
      DECELERATOR_VERTICES.map(([x, y]) => [x, y])
    );
  });

  it('says nothing about a map that carries neither', () => {
    const texts = legendOf([
      Object.create(WardleyNodeElementModel.prototype, {
        kind: { value: 'component' },
      }),
    ])
      .filter(el => el.type === 'text')
      .map(el => String(el.text));

    expect(texts).not.toContain('Accelerator (speeds evolution up)');
    expect(texts).not.toContain('Decelerator (slows evolution down)');
  });
});

/* ── The OWM DSL, both directions ─────────────────────────────────────── */

const BOTH_OWM = `title Climate
accelerator Faster [0.70, 0.40]
deaccelerator Slower [0.30, 0.60]
`;

describe('the OWM interchange', () => {
  it('reads both keywords, under OWM’s own spelling of the second', () => {
    const { elements, report } = importWardleyOwm(BOTH_OWM);
    const nodes = elements.filter(props => props.type === 'wardleyNode');

    expect(nodes.map(props => props.kind)).toEqual([
      'accelerator',
      'decelerator',
    ]);
    // Drawn, not carried: the two lines are statements the pack understands.
    expect(report.notes.filter(note => note.kind === 'carried')).toEqual([]);
    for (const node of nodes) {
      expect(node.shapeType).toBe('polygon');
      expect(node.isClosed).toBe(true);
      const [, , w, h] = Bound.deserialize(String(node.xywh)).toXYWH();
      expect([w, h]).toEqual([ACCELERATOR_SIZE.w, ACCELERATOR_SIZE.h]);
    }
  });

  it('gives each arrow its name, on the side its shaft is on', () => {
    const { elements } = importWardleyOwm(BOTH_OWM);
    const labels = elements.filter(props => props.type === 'text');

    expect(labels.map(props => props.text)).toEqual(['Faster', 'Slower']);
    expect(labels[0].textAlign).toBe(TextAlign.Left);
    expect(labels[1].textAlign).toBe(TextAlign.Right);
  });

  it('round-trips: two arrows out, two arrows back, in place', () => {
    const once = importWardleyOwm(BOTH_OWM);
    const written = exportWardleyOwm(boardFromProps(once.elements), {});

    // The coordinates come back to two decimals, which is the tolerance every
    // other round-trip test in this suite uses — and the keyword each is
    // written under is OWM's, `deaccelerator` for a decelerator.
    expect(written).toContain('accelerator Faster [0.70, 0.40]');
    expect(written).toContain('deaccelerator Slower [0.30, 0.60]');

    // …and it is a FIXED POINT from there, which is the strongest claim this
    // suite makes about any statement it draws.
    const twice = exportWardleyOwm(
      boardFromProps(importWardleyOwm(written).elements),
      {}
    );
    expect(twice).toBe(written);
  });
});
