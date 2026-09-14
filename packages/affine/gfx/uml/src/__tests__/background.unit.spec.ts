import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';
import {
  backgroundLabelHits,
  backgroundSize,
  backgroundTexts,
  hitTestBackgroundLabel,
} from '@labre/affine-block-surface';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import { beforeAll, describe, expect, it } from 'vitest';

import { UML_DIAGRAM_FRAME, UML_SUBJECT_FRAME } from '../background.js';
import {
  UML_DIAGRAM_MARGIN,
  UML_FRAME_BAND_HEIGHT,
  UML_FRAME_BORDER_WIDTH,
  UML_FRAME_HEADING_FONT_SIZE,
  UML_FRAME_TAG_CUT,
  UML_FRAME_TAG_FOOT,
  UML_NAME_FONT_SIZE,
  UML_SUBJECT_MARGIN,
} from '../consts.js';
import { umlDiagram, umlSubject } from '../element-renderer.js';
import { UML_ROLE } from '../roles.js';
import { recordingCtx, stubMatrix } from './canvas-stub.js';

/**
 * The two UML frames, as DECLARATIONS and as pictures.
 *
 * A declaration is data, so most of what can go wrong with one is a typo: a
 * colour naming a palette entry that does not exist paints loud magenta and
 * warns (`backgroundColor`), and nothing else notices. The first block below
 * walks every `@ref` in both declarations for exactly that. The rest drives the
 * primitive with a canvas stub and reads back what it painted — the card, the
 * cut-corner heading tag of Annex A, and the one editable word each frame
 * carries.
 */

beforeAll(() => {
  // The heading tag composes its own element-local frame with `DOMMatrix`,
  // which the DOM stub does not carry a usable one of. Read at draw time, never
  // at import time, so replacing it here is early enough.
  (globalThis as { DOMMatrix?: unknown }).DOMMatrix = {
    fromMatrix: () => stubMatrix(),
  };
});

/** Every `@name` colour reference anywhere in a declaration. */
function paletteRefs(node: unknown, found: string[] = []): string[] {
  if (typeof node === 'string') {
    if (node.startsWith('@')) found.push(node.slice(1));
    return found;
  }
  if (Array.isArray(node)) {
    for (const item of node) paletteRefs(item, found);
    return found;
  }
  if (node && typeof node === 'object') {
    for (const value of Object.values(node)) paletteRefs(value, found);
  }
  return found;
}

const render = (
  renderer: unknown,
  model: Record<string, unknown>,
  w: number,
  h: number
) => {
  const rec = recordingCtx();
  (renderer as (m: unknown, c: unknown, x: unknown) => void)(
    { deserializedXYWH: [0, 0, w, h], rotate: 0, ...model },
    rec.ctx,
    stubMatrix()
  );
  return rec;
};

/** What the canvas stub measures a string at — half an em per character. */
const measured = (text: string, size: number) => text.length * size * 0.5;

describe.each([
  ['diagram', UML_DIAGRAM_FRAME, 'heading'],
  ['subject', UML_SUBJECT_FRAME, 'name'],
] as const)(
  'the UML %s declaration',
  (_name, def: FrameworkBackgroundDef, prop: string) => {
    it('resolves every colour it names', () => {
      const palette = def.chrome?.palette ?? {};
      const refs = paletteRefs(def);
      // Not vacuous: both declarations use the colour code rather than hexes.
      expect(refs.length).toBeGreaterThan(0);
      for (const ref of refs) {
        expect(Object.keys(palette), `@${ref}`).toContain(ref);
      }
      // ...and nothing in the palette is itself another reference.
      for (const value of Object.values(palette)) {
        expect(value.startsWith('@')).toBe(false);
      }
    });

    it('declares a stamped role, a usable size and free handles', () => {
      expect(def.role).toBeDefined();
      expect(def.geometry.width).toBeGreaterThan(0);
      expect(def.geometry.height).toBeGreaterThan(0);
      // Neither frame is a chart: both are stretched to fit what they hold.
      expect(def.geometry.lockAspectRatio).toBe(false);
      expect(def.geometry.resizable).toBe(true);
      // A fresh one is never smaller than what it is asked to cover.
      expect(backgroundSize(def, 2000, 100)).toEqual({
        width: 2000,
        height: def.geometry.height,
      });
    });

    it('carries exactly one editable label', () => {
      const hits = backgroundLabelHits(
        def,
        { name: 'Orders', heading: 'class Orders' },
        def.geometry.width,
        def.geometry.height
      );
      expect(hits).toHaveLength(1);
      expect(hits[0].prop).toBe(prop);
      // The box the user aims at is the box the words were drawn in.
      expect(
        hitTestBackgroundLabel(
          hits,
          (hits[0].minX + hits[0].maxX) / 2,
          (hits[0].minY + hits[0].maxY) / 2
        )?.prop
      ).toBe(prop);
    });

    it('declares no axis and no frame of reference', () => {
      // A UML diagram is a graph: a class drawn top left says nothing more than
      // one drawn bottom right, and graduating the card would invent a
      // semantic UML does not have.
      expect(def.axes).toBeUndefined();
      expect(def.instanceZones).toBeUndefined();
      expect(def.chrome?.washes).toBeUndefined();
      // Any zone either declares is a label carrier, never a tint.
      for (const zone of def.zones ?? []) {
        expect(zone.fill, zone.id).toBeUndefined();
        expect(zone.rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
      }
      // Neither frame has variants: a UML frame is one rectangle with one
      // heading, and §18.1.4 gives the subject no flavours at all.
      expect(def.variantProp).toBeUndefined();
      for (const text of backgroundTexts(def)) {
        expect(text.variants, text.id).toBeUndefined();
      }
    });
  }
);

describe('the UML diagram frame', () => {
  const W = 1400;
  const H = 900;
  const BAND = UML_FRAME_BAND_HEIGHT;
  const HEADING = 'class Orders';

  const draw = (heading = HEADING, w = W, h = H) =>
    render(umlDiagram, { name: 'Orders', kind: 'class', heading }, w, h);

  it('paints a white card, a square border and the Annex A heading tag', () => {
    const rec = draw();

    // Card first, the frame over it, the heading, then the tag round the
    // heading — which is the only thing this pack adds to the primitive.
    expect(rec.ops).toEqual(['fill', 'stroke', 'fillText', 'stroke']);
    expect(rec.fills).toEqual([NOTATION_NEUTRALS.cardFill]);
    expect(rec.strokes).toEqual([
      NOTATION_NEUTRALS.frameInk,
      NOTATION_NEUTRALS.frameInk,
    ]);
    // Solid, and square: Annex A draws a frame as one plain rectangle.
    expect(rec.dashes).toHaveLength(0);
    expect(rec.paths[0].r).toBe(0);
  });

  it('writes `<kind> <name>` in the band, and nothing else in it', () => {
    const rec = draw();
    const [heading] = rec.texts;

    expect(rec.texts).toHaveLength(1);
    expect(heading.text).toBe(HEADING);
    expect(heading.vertical).toBe(false);
    // Left-aligned with the plot, written INSIDE the band above it.
    expect(heading.x).toBe(UML_DIAGRAM_MARGIN);
    expect(heading.y).toBeGreaterThan(0);
    expect(heading.y).toBeLessThan(BAND);
    expect(heading.color).toBe(NOTATION_NEUTRALS.frameInk);
  });

  /**
   * The band paints NOTHING of its own — no tint, no divider.
   *
   * Annex A draws a frame as one rectangle with a tag in its corner, and a rule
   * ruled across the sheet under the heading would be a line the notation does
   * not have. The band exists to place the words and to reserve the top margin;
   * what a reader sees there, and what a user aims at, is the tag.
   */
  it('reserves the band without painting one', () => {
    const rec = draw();
    expect(rec.rects).toEqual([]);

    const bands = UML_DIAGRAM_FRAME.chrome?.sideBands ?? [];
    expect(bands).toHaveLength(1);
    expect(bands[0].side).toBe('top');
    expect(bands[0].fill).toBeUndefined();
    expect(bands[0].divider).toBeUndefined();
    expect(bands[0].label?.prop).toBe('heading');
    // The band's thickness is never declared beside the margin it covers: the
    // primitive reads the margin, so the two cannot drift apart — and the
    // model's own hit test reads the very same number.
    expect(UML_DIAGRAM_FRAME.geometry.margin.top).toBe(BAND);
  });

  /**
   * The tag: a pentagon whose bottom-right corner is bitten off, sized to the
   * heading it is drawn round.
   *
   * Four segments and a `closePath`, so the fifth edge — the frame's own left
   * border, which the tag shares — is the one the recorder does not see.
   */
  it('cuts the tag’s corner and sizes it to the measured heading', () => {
    const rec = draw();
    const inset = UML_FRAME_BORDER_WIDTH / 2;
    const w =
      measured(HEADING, UML_FRAME_HEADING_FONT_SIZE) + UML_DIAGRAM_MARGIN * 2;
    const h = BAND - UML_FRAME_TAG_FOOT;
    const right = inset + w;
    const bottom = inset + h;

    expect(rec.segments).toEqual([
      { x1: inset, y1: inset, x2: right, y2: inset },
      { x1: right, y1: inset, x2: right, y2: bottom - UML_FRAME_TAG_CUT },
      {
        x1: right,
        y1: bottom - UML_FRAME_TAG_CUT,
        x2: right - UML_FRAME_TAG_CUT,
        y2: bottom,
      },
      { x1: right - UML_FRAME_TAG_CUT, y1: bottom, x2: inset, y2: bottom },
    ]);

    // The words are INSIDE it: the heading starts at the plot's left inset and
    // the tag is padded by the same number, so it is centred with one number.
    const [heading] = rec.texts;
    expect(heading.x).toBeGreaterThan(inset);
    expect(
      heading.x + measured(HEADING, UML_FRAME_HEADING_FONT_SIZE)
    ).toBeLessThan(right);
    // …and the tag sits clear of the band's foot, so it reads as a label
    // pinned to the sheet rather than as a second rectangle.
    expect(bottom).toBeLessThan(BAND);
  });

  it('grows the tag with the heading, and draws none without one', () => {
    const long = draw('uc A very long diagram name indeed');
    const short = draw('class A');
    const longWidth = long.segments[0].x2;
    const shortWidth = short.segments[0].x2;
    expect(longWidth).toBeGreaterThan(shortWidth);

    // A frame whose heading is empty gets no tag at all — an empty pentagon
    // pinned to the corner would be a label about nothing.
    const blank = draw('');
    expect(blank.segments).toEqual([]);
    expect(blank.ops).toEqual(['fill', 'stroke']);
  });

  it('clamps the tag on a frame dragged smaller than its own heading', () => {
    // The degenerate case: the tag is the element. The band clamps the same
    // way, and so does the model's carve-out.
    const rec = draw(HEADING, 60, 20);
    const inset = UML_FRAME_BORDER_WIDTH / 2;
    expect(rec.segments[0]).toEqual({
      x1: inset,
      y1: inset,
      x2: 60 - inset,
      y2: inset,
    });
    // Nothing at all is not a tag.
    expect(render(umlDiagram, { heading: HEADING }, 0, 0).segments).toEqual([]);
  });

  it('is the diagram role, and the umlDiagram element type', () => {
    expect(UML_DIAGRAM_FRAME.type).toBe('umlDiagram');
    expect(UML_DIAGRAM_FRAME.role).toBe(UML_ROLE.diagram);
  });
});

describe('the UML subject', () => {
  const W = 520;
  const H = 360;

  it('is a SOLID frame with nothing behind it', () => {
    const rec = render(umlSubject, { name: 'Order service' }, W, H);

    // NO fill anywhere: a subject is drawn OVER a diagram, and an opaque card
    // would hide the very use cases it is pointing at.
    expect(rec.ops).toEqual(['stroke', 'fillText']);
    expect(rec.fills).toEqual([]);
    expect(rec.rects).toEqual([]);
    expect(rec.strokes).toEqual([NOTATION_NEUTRALS.frameInk]);
    // Solid, unlike the C4 boundary: §18.1.4 draws one unbroken rectangle, and
    // a dash would say "logical grouping" where UML means a SYSTEM.
    expect(rec.dashes).toEqual([]);
    expect(rec.paths[0].r).toBe(0);
  });

  it('writes its name in the top-left corner, inside the plot', () => {
    const rec = render(umlSubject, { name: 'Order service' }, W, H);
    const [name] = rec.texts;

    expect(name.text).toBe('Order service');
    expect(name.x).toBe(UML_SUBJECT_MARGIN);
    // One line below the plot's top edge — the anchor is a baseline — and well
    // above the middle: the corner a use case ellipse cannot reach into.
    expect(name.y).toBe(UML_SUBJECT_MARGIN + UML_NAME_FONT_SIZE);
    expect(name.y).toBeLessThan(H / 2);
    expect(name.color).toBe(NOTATION_NEUTRALS.frameInk);
  });

  it('is the subject role, and the umlSubject element type', () => {
    expect(UML_SUBJECT_FRAME.type).toBe('umlSubject');
    expect(UML_SUBJECT_FRAME.role).toBe(UML_ROLE.subject);
  });
});
