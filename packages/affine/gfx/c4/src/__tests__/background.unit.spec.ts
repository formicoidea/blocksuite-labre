import type { FrameworkBackgroundDef } from '@labre/affine-block-surface';
import {
  backgroundInVariant,
  backgroundLabelHits,
  backgroundLabelText,
  backgroundSize,
  backgroundTexts,
  hitTestBackgroundLabel,
} from '@labre/affine-block-surface';
import { describe, expect, it } from 'vitest';

import { C4_BOARD_BACKGROUND, C4_BOUNDARY_BACKGROUND } from '../background';
import {
  BOARD_BAND_FILL,
  BOUNDARY_DASH,
  C4_BOARD_TITLE_BAND_HEIGHT,
} from '../consts';
import { c4Board, c4Boundary } from '../element-renderer';
import { C4_ROLE } from '../roles';
import { recordingCtx, stubMatrix } from './canvas-stub';

/**
 * The two C4 frames, as DECLARATIONS and as pictures.
 *
 * A declaration is data, so most of what can go wrong with one is a typo: a
 * colour naming a palette entry that does not exist paints loud magenta and
 * warns (`backgroundColor`), and nothing else notices. The first block below
 * walks every `@ref` in both declarations for exactly that. The rest drives the
 * primitive with a canvas stub and reads back what it painted — the card, the
 * dash, and the one editable word each frame carries.
 */

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

describe.each([
  ['board', C4_BOARD_BACKGROUND],
  ['boundary', C4_BOUNDARY_BACKGROUND],
] as const)('the C4 %s declaration', (_name, def: FrameworkBackgroundDef) => {
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

  it('carries exactly one editable label, bound to `name`', () => {
    const hits = backgroundLabelHits(
      def,
      { name: 'Internet banking' },
      def.geometry.width,
      def.geometry.height
    );
    expect(hits).toHaveLength(1);
    expect(hits[0].prop).toBe('name');
    expect(hits[0].text).toBe('Internet banking');
    // The box the user aims at is the box the words were drawn in.
    expect(
      hitTestBackgroundLabel(
        hits,
        (hits[0].minX + hits[0].maxX) / 2,
        (hits[0].minY + hits[0].maxY) / 2
      )?.prop
    ).toBe('name');
  });

  it('declares no axis and no frame of reference', () => {
    // A C4 diagram is a graph: a system drawn top left says nothing more than
    // one drawn bottom right, and graduating the card would invent a semantic.
    expect(def.axes).toBeUndefined();
    expect(def.instanceZones).toBeUndefined();
    expect(def.chrome?.washes).toBeUndefined();
    // Any zone either declares is a label carrier, never a tint — and the
    // board declares none at all, since its title moved into its header band.
    for (const zone of def.zones ?? []) {
      expect(zone.fill, zone.id).toBeUndefined();
      expect(zone.rect).toEqual({ x: 0, y: 0, w: 1, h: 1 });
    }
  });
});

describe('the C4 board', () => {
  const W = 1400;
  const H = 900;
  const BAND = C4_BOARD_TITLE_BAND_HEIGHT;

  it('paints an opaque white card with a titled header BAND', () => {
    const rec = render(c4Board, { name: 'Context diagram' }, W, H);

    // Card first, the band over its fill, the frame over both — the
    // primitive's own order, so the border keeps outlining the whole element.
    expect(rec.ops).toEqual([
      'fill',
      'fillRect',
      'stroke',
      'stroke',
      'fillText',
    ]);
    expect(rec.fills).toEqual(['#ffffff']);
    // Two strokes now: the band's divider, then the card's border. Both the
    // card's own line, so the strip reads as the frame continued.
    expect(rec.strokes).toEqual(['#d5d9e0', '#d5d9e0']);
    // Solid: a board is not a boundary.
    expect(rec.dashes).toHaveLength(0);

    // The band IS the top margin, full width — one number, and it is painted.
    // A strip a user cannot see is a strip they cannot aim at, and this one is
    // what a click selects (`C4BoardElementModel.includesPoint`).
    expect(rec.rects).toEqual([
      { x: 0, y: 0, w: W, h: BAND, fill: BOARD_BAND_FILL },
    ]);
    // …and the rule under it runs the whole width, at the band's foot.
    expect(rec.segments).toEqual([{ x1: 0, y1: BAND, x2: W, y2: BAND }]);

    const [title] = rec.texts;
    expect(title.text).toBe('Context diagram');
    expect(title.vertical).toBe(false);
    // Left-aligned with the plot, written INSIDE the band above it — the same
    // pixels as before the band was painted: the anchor never moved.
    expect(title.x).toBe(C4_BOARD_BACKGROUND.geometry.margin.left);
    expect(title.y).toBeGreaterThan(0);
    expect(title.y).toBeLessThan(BAND);
  });

  /**
   * The title is the BAND's label, not a zone's.
   *
   * It used to be a full-plot zone that tinted nothing and existed only to
   * carry a name, because a board had no band to write one in. It has one now —
   * the deep top margin, painted — so the name is the band's in exactly the
   * sense the BPMN pool's participant name is, and the zone went with it.
   */
  it('writes its title in the band, and declares no zone at all', () => {
    expect(C4_BOARD_BACKGROUND.zones).toBeUndefined();

    const bands = C4_BOARD_BACKGROUND.chrome?.sideBands ?? [];
    expect(bands).toHaveLength(1);
    expect(bands[0].side).toBe('top');
    expect(bands[0].label?.prop).toBe('name');
    // The band's thickness is never declared beside the margin it covers: the
    // primitive reads the margin, so the two cannot drift apart.
    expect(C4_BOARD_BACKGROUND.geometry.margin.top).toBe(BAND);
  });

  it('clamps the band on a board shorter than its own header', () => {
    // The degenerate case: the band is the element. The model's carve-out
    // clamps the same way, so what is picked stays what is painted.
    const rec = render(c4Board, { name: 'Squashed' }, W, 20);
    expect(rec.rects).toEqual([
      { x: 0, y: 0, w: W, h: 20, fill: BOARD_BAND_FILL },
    ]);
  });

  it('is the board role, and the c4Board element type', () => {
    expect(C4_BOARD_BACKGROUND.type).toBe('c4Board');
    expect(C4_BOARD_BACKGROUND.role).toBe(C4_ROLE.board);
  });
});

describe('the C4 boundary', () => {
  const W = 520;
  const H = 360;

  it('is a dashed frame with nothing behind it', () => {
    const rec = render(c4Boundary, { name: 'Internet banking' }, W, H);

    // NO fill anywhere: a boundary is drawn OVER a diagram, and an opaque card
    // would hide the very elements it is pointing at.
    expect(rec.ops).toEqual(['stroke', 'fillText']);
    expect(rec.fills).toEqual([]);
    expect(rec.rects).toEqual([]);

    expect(rec.strokes).toEqual(['#444444']);
    // The dash IS the distinction between a boundary and a board.
    expect(rec.dashes).toEqual([[...BOUNDARY_DASH]]);
  });

  it('writes its name in the bottom-left corner, inside the plot', () => {
    const rec = render(c4Boundary, { name: 'Internet banking' }, W, H);
    const [name] = rec.texts;
    const { margin } = C4_BOUNDARY_BACKGROUND.geometry;

    expect(name.text).toBe('Internet banking');
    expect(name.x).toBe(margin.left);
    // Above the bottom edge of the plot, and below its middle: the one corner
    // of a frame least likely to have an element sitting in it.
    expect(name.y).toBeLessThan(H - margin.bottom);
    expect(name.y).toBeGreaterThan(H / 2);
    // Black, and a size larger than the pack's first pass: the stencil's own
    // `.st8`, which is what it takes to read a boundary's name over the diagram
    // the frame is drawn on top of.
    expect(name.color).toBe('#000000');
  });

  it('is the boundary role, and the c4Boundary element type', () => {
    expect(C4_BOUNDARY_BACKGROUND.type).toBe('c4Boundary');
    expect(C4_BOUNDARY_BACKGROUND.role).toBe(C4_ROLE.boundary);
  });

  /**
   * The bracket line the stencil writes under a boundary's name.
   *
   * The gate is the DERIVED `variantOrDefault`, never the optional `variant`
   * itself: an unstated one stringifies to `"undefined"` and would match no
   * variant, so a boundary already on disk — which stored nothing — would get no
   * line at all. Which is the trap this declaration used to route round by
   * declaring no `variantProp`; the getter removes it instead.
   */
  it('writes the level under the name, and reads a stored one as a system', () => {
    expect(C4_BOUNDARY_BACKGROUND.variantProp).toBe('variantOrDefault');

    const words = (variantOrDefault: string) =>
      backgroundTexts(C4_BOUNDARY_BACKGROUND)
        .filter(text =>
          backgroundInVariant(C4_BOUNDARY_BACKGROUND, text.variants, {
            variantOrDefault,
          })
        )
        .map(text => backgroundLabelText(text, { variantOrDefault }));

    // Exactly one bracket line per variant, and it is the stencil's wording.
    expect(words('system')).toContain('[Software System]');
    expect(words('system')).not.toContain('[Container]');
    expect(words('container')).toContain('[Container]');
    expect(words('container')).not.toContain('[Software System]');
    // The getter itself — that an unstated variant reads as a system, which is
    // what makes the gate above fire on a boundary already on disk — is the
    // model's own promise, and `models.unit.spec.ts` holds it to it.
  });

  it('offers the level to no editor: it is vocabulary, not the author’s words', () => {
    // The author names a boundary; what KIND of boundary it is was said by
    // picking the tool. Declared with a `labelKey` and no `prop`, so it is
    // translatable through the host's catalogue and `backgroundLabelHits`
    // never hands it a box.
    for (const text of backgroundTexts(C4_BOUNDARY_BACKGROUND)) {
      if (text.id === 'name') continue;
      expect(text.prop, text.id).toBeUndefined();
      expect(text.labelKey, text.id).toMatch(
        /^com\.labre\.c4\.boundary\.type\./
      );
    }
  });
});
