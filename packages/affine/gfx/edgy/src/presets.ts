import type { EdgyNodeKind } from '@labre/affine-model';
// Values from the headless entry, never the model index: the toolbox
// (`toolbox.ts`, `docs/adr/0045`) builds on these presets from the
// editor-free `./interchange` entry.
import {
  FontFamily,
  ShapeStyle,
  TextAlign,
} from '@labre/affine-model/headless';
import { Bound } from '@labre/global/gfx';

import {
  ACTIVITY_VERTICES,
  INNER_FONT_SIZE,
  LABEL_FONT_SIZE,
  NODE_FILL,
  NODE_STROKE,
  NODE_STROKE_WIDTH,
  OUTCOME_RADIUS,
} from './node/consts';
import { EDGY_ROLE } from './roles';

/**
 * What an EDGY artefact IS, as props — the ONE description the creation sites
 * and the templates both read.
 *
 * Split out of `actions.ts` for the reason Wardley's and BPMN's `presets.ts`
 * give, and which the 2026-09-09 template audit measured on this pack: the
 * palette restated by hand what a node is, and the copy drifted. The four
 * single-element templates had lost the `role` the toolbox has written since
 * the EDGY roles landed (so `edgy.overlapping-artefacts` saw nothing, the auto
 * legend legended nothing and the info panel would not open), People arrived
 * ungrouped from its name, and the label box was 16/24/+70 against the
 * toolbox's 18/26/+72. Those templates are DERIVED now
 * (`templateFromCommand`), and the compositions that cannot derive are built
 * on the helpers below — so there is nothing left to restate.
 */

/** The three kinds the palette drops as a labelled box (People is not one). */
export type EdgyBoxKind = 'outcome' | 'object' | 'activity';

/**
 * Default facets-diagram size (REF aspect, scaled up so it reads on canvas).
 *
 * Here rather than at the creation site because the "Facets diagram" template
 * used to spell the same `1.5` out a second time.
 */
export const FACETS_SCALE = 1.5;

/** Default blank-board size. */
export const EDGY_BOARD_SIZE = { w: 1600, h: 1000 } as const;

/** Stroke width the 24 template relations are drawn with. */
export const RELATION_STROKE_WIDTH = 2;

/**
 * An EDGY node, as props.
 *
 * The `role` is the PERSISTED KIND and nothing more: somebody picking "Object"
 * in the palette has said "this is an object", not "this is a Channel". The
 * twelve official elements are named by the metamodel template, which knows
 * which of them it is drawing; a base element created here specialises
 * `edgy:element` through its kind and is judged by every rule written on the
 * root — the overlap rule — and by none written on a leaf.
 *
 * No `text`: the inner words are content, added by the caller through
 * {@link edgyNodeTextProps} (at placement, translated once) or overridden by an
 * illustrative template.
 */
export function edgyNodeProps(
  kind: EdgyNodeKind,
  box: { xywh: string }
): Record<string, unknown> & { type: string } {
  const people = kind === 'people';
  return {
    type: 'edgyNode',
    kind,
    role: EDGY_ROLE[kind],
    filled: true,
    fillColor: NODE_FILL,
    strokeColor: NODE_STROKE,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    shapeType: people ? 'ellipse' : kind === 'activity' ? 'polygon' : 'rect',
    // No visible outline on People — it IS the glyph the renderer draws, and
    // the ellipse is only its bound.
    strokeWidth: people ? 0 : NODE_STROKE_WIDTH,
    // The two keys only a BOX has: People carries neither, and a key some
    // kinds write and others do not is the truth about the shapes.
    ...(people
      ? {}
      : {
          radius: kind === 'outcome' ? OUTCOME_RADIUS : 0,
          vertices: kind === 'activity' ? ACTIVITY_VERTICES : null,
        }),
    xywh: box.xywh,
  };
}

/**
 * The words INSIDE a box, as props.
 *
 * `text` is a plain STRING, as `Surface.addElement` takes it; a snapshot writes
 * the same field as a serialized `Y.Text`, which is the one key a hand-written
 * template overrides on the way in.
 */
export function edgyNodeTextProps(
  text: string,
  fontSize: number = INNER_FONT_SIZE
) {
  return {
    text,
    color: NODE_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize,
    textAlign: TextAlign.Center,
  };
}

/** Width of the free-text label a People node travels with. */
export const EDGY_LABEL_W = 120;

/** Height of that label (Inter, size 18). */
export const EDGY_LABEL_H = LABEL_FONT_SIZE + 8;

/**
 * The NAME under a People node, as a native free-text element — the one EDGY
 * artefact whose name is not stored on the shape itself.
 */
export function edgyLabelProps(
  text: string,
  x: number,
  y: number
): Record<string, unknown> & { type: string } {
  return {
    type: 'text',
    text,
    fontFamily: FontFamily.Inter,
    fontSize: LABEL_FONT_SIZE,
    color: NODE_STROKE,
    textAlign: TextAlign.Center,
    xywh: new Bound(x, y, EDGY_LABEL_W, EDGY_LABEL_H).serialize(),
  };
}
