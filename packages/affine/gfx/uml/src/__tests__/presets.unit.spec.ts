import {
  FontFamily,
  FontStyle,
  FontWeight,
  ShapeStyle,
  StrokeStyle,
  TextAlign,
  type UmlNodeKind,
} from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import { describe, expect, it } from 'vitest';

import type { UmlBox } from '../component.js';
import {
  UML_NAME_FONT_SIZE,
  UML_NODE_BOX,
  UML_NODE_RADIUS,
  UML_NODE_STROKE_WIDTH,
} from '../consts.js';
import {
  GLYPH_BODY_KINDS,
  ROUNDED_KINDS,
  umlMorphClears,
  umlMorphProps,
  umlNodeProps,
  umlTextProps,
} from '../presets.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from '../roles.js';

const ALL_KINDS = Object.keys(UML_NODE_BOX) as UmlNodeKind[];

const BOX = { xywh: '[0,0,200,120]' };

describe('what a uml shape is created as', () => {
  it('stamps every kind with its own discriminant and its own role', () => {
    for (const kind of ALL_KINDS) {
      const props = umlNodeProps(kind, BOX);
      expect(props.type, kind).toBe('umlNode');
      expect(props.kind, kind).toBe(kind);
      // The role is the authority on what the box MEANS, and it is the only
      // thing that can say so: three of the eight kinds are the same rectangle.
      expect(props.role, kind).toBe(UML_ROLE_OF_KIND[kind]);
      expect(props.xywh, kind).toBe(BOX.xywh);
    }
  });

  it('draws a use case as an ellipse, two kinds as a diamond, the rest as rectangles', () => {
    // §18.1.4, §15.3.4, §14.2.4. All three are native `shapeType`s, so the
    // platform fills them, strokes them and hit-tests them with no glyph
    // involved — which is why none of the three is a glyph-bodied kind.
    expect(umlNodeProps('use-case', BOX).shapeType).toBe('ellipse');
    for (const kind of ['decision', 'choice'] as const) {
      expect(umlNodeProps(kind, BOX).shapeType, kind).toBe('diamond');
      expect(GLYPH_BODY_KINDS.has(kind), kind).toBe(false);
    }
    for (const kind of ALL_KINDS.filter(
      k => k !== 'use-case' && k !== 'decision' && k !== 'choice'
    )) {
      expect(umlNodeProps(kind, BOX).shapeType, kind).toBe('rect');
    }
  });

  it('hands the body to the glyph for every shape the platform cannot draw', () => {
    // A tabbed folder, a folded corner, a stick figure, a small square, a ball,
    // a socket and three 3-D cubes: none of them is a native shape, so the
    // shape underneath must paint nothing at all.
    expect([...GLYPH_BODY_KINDS].sort()).toEqual([
      'accept-event',
      'activity-final',
      'actor',
      'deep-history',
      'device',
      'entry-point',
      'execution-environment',
      'exit-point',
      'final-state',
      'flow-final',
      'fork',
      'initial',
      'junction',
      'node',
      'note',
      'package',
      'port',
      'provided-interface',
      'required-interface',
      'send-signal',
      'shallow-history',
      'terminate',
      'time-event',
    ]);
    // The phase-2 kinds that are NOT on the list, and every one of them looks
    // as if it should be: a component and an artifact are the native filled
    // rectangle with a small icon painted into the corner (§11.6.4, §19.3.4);
    // an action and a state are the native ROUNDED rect (§15.3.4, §14.2.4); a
    // decision and a choice are the native diamond; an object node is the plain
    // native rect of §15.4.4.
    for (const kind of [
      'component',
      'artifact',
      'action',
      'state',
      'decision',
      'choice',
      'object-node',
    ] as const) {
      expect(GLYPH_BODY_KINDS.has(kind), kind).toBe(false);
    }
    for (const kind of GLYPH_BODY_KINDS) {
      const props = umlNodeProps(kind, BOX);
      expect(props.filled, kind).toBe(false);
      expect(props.strokeStyle, kind).toBe(StrokeStyle.None);
    }
    for (const kind of ALL_KINDS.filter(k => !GLYPH_BODY_KINDS.has(k))) {
      const props = umlNodeProps(kind, BOX);
      expect(props.filled, kind).toBe(true);
      expect(props.strokeStyle, kind).toBe(StrokeStyle.Solid);
    }
  });

  it('draws every kind with a ruler, and rounds the two the notation rounds', () => {
    // UML's figures are drawn with an instrument. A hand-drawn roughness would
    // be this pack inventing a house style for a notation that has one.
    //
    // The CORNER is a different question, and the notation answers it per
    // artefact: square for a classifier (§11.4.4), rounded for an action
    // (§15.3.4) and a state (§14.2.4). So the zero is the classifier's rule
    // rather than a pack-wide one.
    expect([...ROUNDED_KINDS].sort()).toEqual(['action', 'state']);
    for (const kind of ROUNDED_KINDS) {
      expect(umlNodeProps(kind, BOX).radius, kind).toBe(UML_NODE_RADIUS);
      // A FRACTION, which is how the native rect renderer reads a value below
      // 1: of the box's shorter side, so a box dragged to any size keeps its
      // corner in proportion.
      expect(UML_NODE_RADIUS, kind).toBeLessThan(1);
    }
    for (const kind of ALL_KINDS) {
      const props = umlNodeProps(kind, BOX);
      expect(props.roughness, kind).toBe(0);
      if (!ROUNDED_KINDS.has(kind)) expect(props.radius, kind).toBe(0);
      expect(props.shapeStyle, kind).toBe(ShapeStyle.General);
      expect(props.strokeWidth, kind).toBe(UML_NODE_STROKE_WIDTH);
      expect(props.fontFamily, kind).toBe(FontFamily.Inter);
      expect(props.fontSize, kind).toBe(UML_NAME_FONT_SIZE);
      expect(props.textAlign, kind).toBe(TextAlign.Center);
    }
  });

  it('never seeds a shape with words: the compartments are children (R16)', () => {
    for (const kind of ALL_KINDS) {
      expect(umlNodeProps(kind, BOX), kind).not.toHaveProperty('text');
    }
  });

  it('reads one ink and one paper off the shared neutral scale (R33)', () => {
    // UML 2.5.1 defines no palette: every figure is black lines on white paper,
    // and what tells a class from an interface is the KEYWORD, not a hue. So
    // the whole pack is two neutrals, and both come from the one scale rather
    // than from a grey literal of this framework's own.
    for (const kind of ALL_KINDS) {
      const props = umlNodeProps(kind, BOX);
      expect(props.fillColor, kind).toBe(NOTATION_NEUTRALS.cardFill);
      expect(props.strokeColor, kind).toBe(NOTATION_NEUTRALS.ink);
      expect(props.color, kind).toBe(NOTATION_NEUTRALS.ink);
    }
    // ...and no kind gets a hue of its own, which is the half of R33 a future
    // "make interfaces blue" would break.
    const fills = new Set(ALL_KINDS.map(k => umlNodeProps(k, BOX).fillColor));
    expect(fills.size).toBe(1);
  });
});

describe('what a morph is allowed to rewrite', () => {
  it('never touches identity, geometry or the author words', () => {
    for (const kind of ALL_KINDS) {
      const props = umlMorphProps(kind);
      expect(props, kind).not.toHaveProperty('type');
      expect(props, kind).not.toHaveProperty('xywh');
      expect(props, kind).not.toHaveProperty('text');
    }
  });

  it('carries the WHOLE preset, because the pack visibly needs it to', () => {
    // Two keys would not do it: morphing a class to a package flips `filled`
    // and `strokeStyle`, and morphing either to a use case rewrites
    // `shapeType`. A morph that wrote `{kind, role}` would leave a filled
    // rectangle painted behind a tabbed folder.
    const class_ = umlMorphProps('class');
    const package_ = umlMorphProps('package');
    const useCase = umlMorphProps('use-case');
    expect(class_.filled).not.toBe(package_.filled);
    expect(class_.strokeStyle).not.toBe(package_.strokeStyle);
    expect(class_.shapeType).not.toBe(useCase.shapeType);
    for (const kind of ALL_KINDS) {
      expect(umlMorphProps(kind).kind, kind).toBe(kind);
      expect(umlMorphProps(kind).role, kind).toBe(UML_ROLE_OF_KIND[kind]);
    }
  });

  it('clears nothing today, because no preset spreads a key conditionally', () => {
    // Derived rather than hard-coded to `[]`: a patch cannot express absence,
    // and the day one kind stops writing a key the previous kind's value would
    // otherwise stay in the Y.Map, silently in force.
    for (const kind of ALL_KINDS) {
      expect(umlMorphClears(kind), kind).toEqual([]);
    }
  });
});

describe('what a compartment text is created as', () => {
  const box: UmlBox = { x: 10, y: 20, w: 30, h: 40 };

  it('writes its role, its box and a wrapping width', () => {
    const props = umlTextProps(UML_ROLE.attributes, box, {
      fontSize: 13,
      align: TextAlign.Left,
    });
    expect(props.type).toBe('text');
    expect(props.role).toBe(UML_ROLE.attributes);
    expect(props.xywh).toBe('[10,20,30,40]');
    // What keeps a long signature inside the classifier instead of running out
    // over the canvas.
    expect(props.hasMaxWidth).toBe(true);
    expect(props.color).toBe(NOTATION_NEUTRALS.ink);
    expect(props.fontFamily).toBe(FontFamily.Inter);
    expect(props.fontStyle).toBe(FontStyle.Normal);
    expect(props.fontSize).toBe(13);
    expect(props.textAlign).toBe(TextAlign.Left);
  });

  it('offers weight to the name tier and to nothing else', () => {
    // UML reserves its type variations for meanings the grammar reads —
    // italics for abstract (§9.2.4) — so a decorative weight anywhere but the
    // heading would compete with them.
    expect(
      umlTextProps(UML_ROLE.name, box, {
        fontSize: 16,
        align: TextAlign.Center,
        bold: true,
      }).fontWeight
    ).toBe(FontWeight.SemiBold);
    expect(
      umlTextProps(UML_ROLE.name, box, {
        fontSize: 16,
        align: TextAlign.Center,
      }).fontWeight
    ).toBe(FontWeight.Regular);
  });

  it('states every prop explicitly, so `applyLastProps` cannot win a merge', () => {
    // `surface.addElement` merges whatever the user last set on a free text
    // element underneath. Explicit props win that merge, so a prop this helper
    // does not name is a prop another diagram's styling can set.
    expect(
      Object.keys(
        umlTextProps(UML_ROLE.name, box, {
          fontSize: 16,
          align: TextAlign.Center,
        })
      ).sort()
    ).toEqual([
      'color',
      'fontFamily',
      'fontSize',
      'fontStyle',
      'fontWeight',
      'hasMaxWidth',
      'role',
      'textAlign',
      'type',
      'xywh',
    ]);
  });
});
