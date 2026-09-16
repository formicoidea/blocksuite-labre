import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';
import {
  backgroundLabelHits,
  backgroundSize,
  backgroundTexts,
  hitTestBackgroundLabel,
} from '@labre/affine-block-surface';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import { beforeAll, describe, expect, it } from 'vitest';

import {
  UML_DIAGRAM_FRAME,
  UML_FRAGMENT_FRAME,
  UML_PARTITION_FRAME_H,
  UML_PARTITION_FRAME_V,
  UML_REGION_FRAME,
  UML_SUBJECT_FRAME,
} from '../background.js';
import {
  UML_DIAGRAM_MARGIN,
  UML_FRAGMENT_BAND,
  UML_FRAGMENT_BORDER_WIDTH,
  UML_FRAGMENT_BOX,
  UML_FRAGMENT_MARGIN,
  UML_FRAGMENT_OPERAND_DASH,
  UML_FRAME_BAND_HEIGHT,
  UML_FRAME_BORDER_WIDTH,
  UML_FRAME_HEADING_FONT_SIZE,
  UML_FRAME_TAG_CUT,
  UML_FRAME_TAG_FOOT,
  UML_NAME_FONT_SIZE,
  UML_PARTITION_BAND,
  UML_PARTITION_BOX,
  UML_REGION_BAND,
  UML_REGION_BOX,
  UML_REGION_RADIUS,
  UML_SUBJECT_MARGIN,
} from '../consts.js';
import {
  umlDiagram,
  umlFragment,
  umlFragmentAsPainted,
  umlPartition,
  umlRegion,
  umlSubject,
} from '../element-renderer.js';
import { UML_ROLE } from '../roles.js';
import { recordingCtx, stubMatrix } from './canvas-stub.js';

/**
 * The UML frames, as DECLARATIONS and as pictures.
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
  // The two behaviour frames of phase 2, the partition in both orientations:
  // a lane turned on its side is a second DECLARATION, not a variant, so it
  // has to walk the same checks as any other.
  ['vertical partition', UML_PARTITION_FRAME_V, 'name'],
  ['horizontal partition', UML_PARTITION_FRAME_H, 'name'],
  ['composite state', UML_REGION_FRAME, 'name'],
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
      // No frame has variants: a UML frame is one rectangle with one heading,
      // §18.1.4 gives the subject no flavours at all, and a partition's
      // orientation is TWO DECLARATIONS rather than a variant — a side band's
      // edge and the geometry's deep margin are not things `variantProp` can
      // vary (see `background.ts`).
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

describe('the UML partition', () => {
  const W = UML_PARTITION_BOX.w;
  const H = UML_PARTITION_BOX.h;

  const lane = (orientation: string, w: number = W, h: number = H) =>
    render(umlPartition, { name: 'Vendeur', orientation }, w, h);

  it('is a transparent lane with a ruled-off header', () => {
    const rec = lane('vertical');

    // NO fill anywhere: a swimlane is drawn OVER a flow, and an opaque card
    // would hide the actions it is attributing.
    expect(rec.fills).toEqual([]);
    expect(rec.rects).toEqual([]);
    // The band's divider and the frame's border. The divider is what makes a
    // column of actions read as belonging to somebody (§15.6.4) — and it is
    // the one thing a partition has that the diagram frame's band deliberately
    // does not.
    //
    // Divider FIRST: a side band is painted with the card — over its fill,
    // under its border — so the frame closes over the strip rather than being
    // cut by it.
    expect(rec.strokes).toEqual([
      NOTATION_NEUTRALS.divider,
      NOTATION_NEUTRALS.frameInk,
    ]);
    expect(rec.dashes).toEqual([]);
    // Square: a rounded lane would read as a composite state.
    expect(rec.paths[0].r).toBe(0);
  });

  it('writes the lane name across the top of a vertical partition', () => {
    const rec = lane('vertical');
    const [name] = rec.texts;

    expect(rec.texts).toHaveLength(1);
    expect(name.text).toBe('Vendeur');
    expect(name.vertical).toBe(false);
    // INSIDE the band, above the plot it reserves.
    expect(name.y).toBeGreaterThan(0);
    expect(name.y).toBeLessThan(UML_PARTITION_BAND);
    expect(name.color).toBe(NOTATION_NEUTRALS.frameInk);
  });

  /**
   * …and a HORIZONTAL lane moves the whole header to the left edge — the band,
   * the divider and the words.
   *
   * The case the two declarations exist for: `variantProp` selects washes and
   * zones, and neither a side band's edge nor the geometry's deep margin is
   * something it can vary, so the renderer picks a declaration off the
   * element's own prop.
   */
  it('moves the header to the left edge of a horizontal partition', () => {
    const rec = lane('horizontal', H, W);
    const [name] = rec.texts;

    expect(rec.texts).toHaveLength(1);
    expect(name.text).toBe('Vendeur');
    // Written in the LEFT band: left of where the plot starts, and clear of
    // the top the vertical lane writes across.
    expect(name.x).toBeLessThan(UML_PARTITION_BAND);
    expect(name.y).toBeLessThan(UML_PARTITION_BAND * 2);
  });

  /**
   * An orientation this build has never heard of paints the VERTICAL lane
   * rather than nothing — the promise the diagram frame's heading makes about
   * an unknown kind, kept for the other prop a document can carry a newer value
   * of.
   */
  it('falls back to the vertical lane for an orientation it does not know', () => {
    const known = lane('vertical');
    const unknown = lane('diagonal');
    expect(unknown.texts[0].x).toBe(known.texts[0].x);
    expect(unknown.texts[0].y).toBe(known.texts[0].y);
    // …and an element carrying no orientation at all draws one too.
    const absent = render(umlPartition, { name: 'Vendeur' }, W, H);
    expect(absent.texts[0].y).toBe(known.texts[0].y);
  });

  it('is the partition role, and the umlPartition element type', () => {
    for (const def of [UML_PARTITION_FRAME_V, UML_PARTITION_FRAME_H]) {
      expect(def.type).toBe('umlPartition');
      expect(def.role).toBe(UML_ROLE.partition);
    }
    // One persisted type for both: the orientation is a PROP on the element,
    // not a second kind of element.
    expect(UML_PARTITION_FRAME_V.type).toBe(UML_PARTITION_FRAME_H.type);
  });
});

describe('the UML composite state', () => {
  const W = UML_REGION_BOX.w;
  const H = UML_REGION_BOX.h;

  it('is a transparent ROUNDED frame with a ruled-off name compartment', () => {
    const rec = render(umlRegion, { name: 'Commande' }, W, H);

    // Transparent, like every frame drawn over work that is already there.
    expect(rec.fills).toEqual([]);
    expect(rec.rects).toEqual([]);
    // The name compartment's rule, then the frame over it — §14.2.4 rules a
    // composite state off under its name exactly as a simple state is ruled off
    // above its internal activities.
    expect(rec.strokes).toEqual([
      NOTATION_NEUTRALS.divider,
      NOTATION_NEUTRALS.frameInk,
    ]);
    expect(rec.dashes).toEqual([]);
    // ROUNDED, and that is the whole point of it: §14.2.4 draws every state
    // with rounded corners, and a square one would read as a partition.
    expect(rec.paths[0].r).toBe(UML_REGION_RADIUS);
    expect(UML_REGION_RADIUS).toBeGreaterThan(0);
  });

  it('writes the state name in its band', () => {
    const rec = render(umlRegion, { name: 'Commande' }, W, H);
    const [name] = rec.texts;

    expect(rec.texts).toHaveLength(1);
    expect(name.text).toBe('Commande');
    expect(name.y).toBeGreaterThan(0);
    expect(name.y).toBeLessThan(UML_REGION_BAND);
    expect(name.color).toBe(NOTATION_NEUTRALS.frameInk);
  });

  it('is the region role, and the umlRegion element type', () => {
    expect(UML_REGION_FRAME.type).toBe('umlRegion');
    expect(UML_REGION_FRAME.role).toBe(UML_ROLE.region);
  });
});

/**
 * The COMBINED FRAGMENT (§17.6.4) — the second frame in the pack to wear Annex
 * A's pentagon, and the first to carry an INSTANCE partition.
 *
 * It sits outside the shared `describe.each` above rather than joining it,
 * because it breaks two of that block's assertions on purpose: it declares
 * `instanceZones` (a fragment is cut into operands BY ITS AUTHOR, which is
 * exactly what an instance partition is for), and it carries two labels rather
 * than one — the operator in the tag and the guard in the plot. Both are
 * asserted below in their own right.
 */
describe('the UML combined fragment', () => {
  const W = UML_FRAGMENT_BOX.w;
  const H = UML_FRAGMENT_BOX.h;

  const split = [
    { id: 'a', name: '[stock > 0]', size: 1 },
    { id: 'b', name: '[else]', size: 1 },
  ];

  it('resolves every colour it names', () => {
    const palette = UML_FRAGMENT_FRAME.chrome?.palette ?? {};
    const refs = paletteRefs(UML_FRAGMENT_FRAME);
    expect(refs.length).toBeGreaterThan(0);
    for (const ref of refs) {
      expect(Object.keys(palette), `@${ref}`).toContain(ref);
    }
    for (const value of Object.values(palette)) {
      expect(value.startsWith('@')).toBe(false);
    }
  });

  it('is the fragment role, and the umlFragment element type', () => {
    expect(UML_FRAGMENT_FRAME.type).toBe('umlFragment');
    expect(UML_FRAGMENT_FRAME.role).toBe(UML_ROLE.fragment);
    expect(UML_FRAGMENT_FRAME.geometry.lockAspectRatio).toBe(false);
    expect(UML_FRAGMENT_FRAME.geometry.resizable).toBe(true);
    // The band's thickness is the margin it covers and never a second number —
    // and the model's own hit test reads the very same one.
    expect(UML_FRAGMENT_FRAME.geometry.margin.top).toBe(UML_FRAGMENT_BAND);
  });

  /**
   * Transparent and SOLID: §17.6.4 draws one unbroken rectangle over a
   * conversation that is already there, and the only broken lines in the
   * picture are the ones BETWEEN the operands.
   */
  it('is a transparent frame with a solid square border', () => {
    const rec = render(umlFragment, { operator: 'alt' }, W, H);

    expect(rec.fills).toEqual([]);
    expect(rec.rects).toEqual([]);
    // The frame, then the tag drawn round the operator.
    expect(rec.strokes).toEqual([
      NOTATION_NEUTRALS.frameInk,
      NOTATION_NEUTRALS.frameInk,
    ]);
    // No dash at all while the fragment is unsplit.
    expect(rec.dashes).toEqual([]);
    expect(rec.paths[0].r).toBe(0);
  });

  /**
   * The word in the tag is the OPERATOR, and it is the whole of what a fragment
   * says: `alt` and `loop` are one picture and two entirely different
   * statements.
   */
  it('writes the operator in the tag, and nothing else in the band', () => {
    for (const operator of ['alt', 'loop', 'ref'] as const) {
      const rec = render(umlFragment, { operator }, W, H);
      const [tag] = rec.texts;
      expect(tag.text, operator).toBe(operator);
      expect(tag.vertical).toBe(false);
      expect(tag.x).toBe(UML_FRAGMENT_MARGIN);
      expect(tag.y).toBeGreaterThan(0);
      expect(tag.y).toBeLessThan(UML_FRAGMENT_BAND);
      expect(tag.color).toBe(NOTATION_NEUTRALS.frameInk);
    }
  });

  /**
   * …and the pentagon is drawn round it: four segments and a `closePath`, the
   * fifth edge being the frame's own left border, which the tag shares.
   */
  it('cuts the tag corner and sizes it to the measured operator', () => {
    const rec = render(umlFragment, { operator: 'alt' }, W, H);
    const inset = UML_FRAGMENT_BORDER_WIDTH / 2;
    const w =
      measured('alt', UML_FRAME_HEADING_FONT_SIZE) + UML_FRAGMENT_MARGIN * 2;
    const h = UML_FRAGMENT_BAND - UML_FRAME_TAG_FOOT;
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
  });

  /**
   * The band paints NOTHING of its own — no tint, no divider — exactly as the
   * diagram frame's does not: what a reader sees there is the pentagon.
   */
  it('reserves the operator band without painting one', () => {
    const bands = UML_FRAGMENT_FRAME.chrome?.sideBands ?? [];
    expect(bands).toHaveLength(1);
    expect(bands[0].side).toBe('top');
    expect(bands[0].fill).toBeUndefined();
    expect(bands[0].divider).toBeUndefined();
    expect(bands[0].label?.prop).toBe('operator');
  });

  /**
   * The OPERANDS: the BPMN pool's lanes, with two differences the notation
   * dictates — the separators are DASHED (§17.6.4 rules its operands off with a
   * broken line so the frame round them stays unbroken), and the guard is
   * written in the operand's CORNER rather than down a title strip.
   */
  it('declares its operands as a dashed instance partition', () => {
    const zones = UML_FRAGMENT_FRAME.instanceZones;
    expect(zones?.prop).toBe('operands');
    expect(zones?.stack).toBe('y');
    expect(zones?.idPrefix).toBe('operand');
    expect(zones?.divider?.dash).toEqual([...UML_FRAGMENT_OPERAND_DASH]);
    // The corner placement — no title strip. See the header.
    expect(zones?.label?.band).toBeUndefined();
  });

  it('rules a dashed separator between two operands, and writes both guards', () => {
    const rec = render(umlFragment, { operator: 'alt', operands: split }, W, H);

    // One separator for two operands — the outer edges are the frame's own.
    expect(rec.dashes).toEqual([[...UML_FRAGMENT_OPERAND_DASH]]);
    // …drawn across the plot, halfway down it, the two weights being equal.
    const plot = { y0: UML_FRAGMENT_BAND, y1: H - UML_FRAGMENT_MARGIN };
    const separator = rec.segments.find(
      segment => segment.y1 === segment.y2 && segment.x1 < segment.x2
    );
    expect(separator?.y1).toBeCloseTo((plot.y0 + plot.y1) / 2);

    // The operator, then a guard per operand.
    expect(rec.texts.map(text => text.text)).toEqual([
      'alt',
      '[stock > 0]',
      '[else]',
    ]);
  });

  /**
   * ONE guard per band, whatever the document holds.
   *
   * The contract `background.ts` states and `actions.ts` keeps: splitting a
   * fragment MOVES `name` into `operands[0].name` and clears it. A document
   * that carries BOTH — an older board, or a reader that wrote the guard in two
   * places — would otherwise paint two strings in the very same corner, the
   * declared `name` label and operand zero's, one over the other. This is the
   * assertion that says the corner holds one string.
   */
  it('writes one guard per band when a split fragment still names one', () => {
    const rec = render(
      umlFragment,
      { operator: 'alt', name: '[stock > 0]', operands: split },
      W,
      H
    );

    expect(rec.texts.map(text => text.text)).toEqual([
      'alt',
      '[stock > 0]',
      '[else]',
    ]);
  });

  /**
   * Both labels are editable-label HITS — the operator so a future gesture can
   * find it, the guard because the frame view's rename lands on it. The view
   * takes only `name`: an operator is a closed discriminant picked from the
   * toolbar, not free text (see `element-view.ts`).
   */
  it('carries the operator and the guard as its two labels', () => {
    const hits = backgroundLabelHits(
      UML_FRAGMENT_FRAME,
      { operator: 'alt', name: '[stock > 0]' },
      W,
      H
    );
    expect(hits.map(hit => hit.prop).sort()).toEqual(['name', 'operator']);
    const guard = hits.find(hit => hit.prop === 'name')!;
    expect(
      hitTestBackgroundLabel(
        hits,
        (guard.minX + guard.maxX) / 2,
        (guard.minY + guard.maxY) / 2
      )?.prop
    ).toBe('name');
  });

  /**
   * …and the corner that paints nothing answers NOTHING.
   *
   * The other half of the assertion above. Hiding the declared `name` in the
   * renderer alone would leave the rename hit box behind: `backgroundLabelHits`
   * given the STORED model still derives a box for it, anchored in the very
   * corner operand zero's guard was drawn in, so a double-click there would
   * open an editor on a string the canvas does not paint — invisible, and
   * committing it writes a guard nobody can see. The view therefore derives its
   * boxes from `umlFragmentAsPainted`, the same declaration the renderer is
   * handed (`element-view.ts`, `UmlFrameView._painted`).
   */
  it('derives no rename box for the guard the renderer suppresses', () => {
    const stored = { operator: 'alt', name: '[stock > 0]', operands: split };

    // What the canvas writes: the operator and one guard per band. The
    // declared `name` is not among them — it is painted nowhere.
    const painted = render(umlFragment, stored, W, H).texts.map(
      text => text.text
    );
    expect(painted).toEqual(['alt', '[stock > 0]', '[else]']);

    // The STORED model sizes a box to the declared words, across the corner
    // operand zero's guard was drawn in. That is the ghost: a wide rename
    // target over a string the canvas does not draw.
    const raw = backgroundLabelHits(UML_FRAGMENT_FRAME, stored, W, H);
    const ghost = raw.find(hit => hit.prop === 'name')!;
    expect(ghost.text).toBe('[stock > 0]');

    // The PAINTED one — what the view hit-tests against — carries no words, so
    // every box that spans any is a box the renderer actually wrote.
    const hits = backgroundLabelHits(
      UML_FRAGMENT_FRAME,
      umlFragmentAsPainted(stored as never) as unknown as Record<
        string,
        unknown
      >,
      W,
      H
    );
    for (const hit of hits) {
      if (hit.text !== '') expect(painted, hit.prop).toContain(hit.text);
    }

    // An emptied label keeps a bare anchor box, and that is deliberate
    // everywhere else in the library — it is how an unnamed frame is named. What
    // it must not keep is the WIDTH the stored words bought it.
    const quiet = hits.find(hit => hit.prop === 'name')!;
    expect(quiet.text).toBe('');
    expect(quiet.maxX).toBeLessThan(ghost.maxX);

    // The proof: a point the ghost answered and the drawn words never reached
    // now aims at no name at all, so the double-click falls to the operand
    // gesture that owns the corner instead of opening an invisible editor.
    expect(
      hitTestBackgroundLabel(
        hits,
        (quiet.maxX + ghost.maxX) / 2,
        (ghost.minY + ghost.maxY) / 2
      )?.prop
    ).not.toBe('name');
  });

  /** A fragment is a graph's frame like every other: no axis, no wash, no tint. */
  it('declares no axis and no frame of reference', () => {
    expect(UML_FRAGMENT_FRAME.axes).toBeUndefined();
    expect(UML_FRAGMENT_FRAME.chrome?.washes).toBeUndefined();
    expect(UML_FRAGMENT_FRAME.variantProp).toBeUndefined();
    for (const zone of UML_FRAGMENT_FRAME.zones ?? []) {
      expect(zone.fill, zone.id).toBeUndefined();
      expect(zone.rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    }
  });
});
