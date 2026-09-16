import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
  type Template,
} from '@labre/affine-gfx-template';
import { ConnectorMode, PointStyle, StrokeStyle } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

import { CROP } from '../consts';
import {
  EDGY_DYNAMIC_NODES,
  EDGY_DYNAMIC_RELATIONS,
  EDGY_ZONE_FILL,
  edgyElementLabel,
  edgyElementLabelKey,
  type EdgyElementName,
  edgyVerbSeedKey,
} from '../metamodel';
import { NODE_SIZE, NODE_STROKE } from '../node/consts';
import { edgyNodeProps, edgyNodeTextProps } from '../presets';
import { EDGY_RELATION_LABEL_DISTANCE, edgyVerbLabelXYWH } from '../relation';
import { EDGY_ROLE, EDGY_VERB_ROLE } from '../roles';

/**
 * The "EDGY dynamic" template — the relational metamodel drawn on the facets
 * background, and the ONE template of this pack that cannot be derived from
 * its command: `edgy.insertDynamic` INSERTS this very object
 * (`createEdgyDynamic`), so deriving it from itself would be circular.
 *
 * Its own module for exactly that reason: `actions.ts` needs the template,
 * `templates/index.ts` needs the command registry to derive the rest of the
 * palette, and a single templates module would close the loop
 * templates → commands → actions → templates.
 */

/**
 * Background scale (from REF coords to model coords): large enough that the
 * default-size nodes breathe inside each zone. The background is cropped to
 * the circles (`cropToCircles`), so its xywh covers CROP × DYN_SCALE.
 */
export const DYN_SCALE = 4.8;

/**
 * Reference coords → template model coords: the background element sits at
 * (0,0) and renders the cropped circles box, so a reference point maps to
 * `(p - CROP.origin) × DYN_SCALE`.
 */
export function dynToModel(refX: number, refY: number): [number, number] {
  return [(refX - CROP.x) * DYN_SCALE, (refY - CROP.y) * DYN_SCALE];
}

/**
 * One label's resolved text — the host's catalogue when `std` is a real
 * inserting editor, the English fallback when building the module's own
 * `content` (no editor exists yet at that point).
 */
function seedText(
  std: BlockStdScope | undefined,
  key: string,
  fallback: string
): string {
  return std ? translateKey(std, key, fallback) : fallback;
}

function dynamic(std?: BlockStdScope): SurfaceElementsJSON {
  const out: SurfaceElementsJSON = {
    bg: {
      type: 'edgy',
      showLabels: false,
      showPictos: false,
      cropToCircles: true,
      // The frame a finding is attributed to. Stamped here and nowhere else in
      // this template: the background is what makes the board an EDGY board.
      role: EDGY_ROLE.facets,
      xywh: `[0,0,${CROP.w * DYN_SCALE},${CROP.h * DYN_SCALE}]`,
    },
  };
  for (const [key, { kind, cx, cy, w, zone }] of Object.entries(
    EDGY_DYNAMIC_NODES
  ) as [EdgyElementName, (typeof EDGY_DYNAMIC_NODES)[EdgyElementName]][]) {
    const nw = w ?? NODE_SIZE[kind].w;
    const nh = NODE_SIZE[kind].h;
    const [mx, my] = dynToModel(cx, cy);
    const name = seedText(std, edgyElementLabelKey(key), edgyElementLabel(key));
    out[key] = {
      // What an EDGY node IS — the same description the toolbox draws from.
      ...edgyNodeProps(kind, {
        xywh: `[${mx - nw / 2},${my - nh / 2},${nw},${nh}]`,
      }),
      ...edgyNodeTextProps(name),
      // A snapshot stores the words as a serialized `Y.Text`, where
      // `addElement` takes a plain string.
      text: surfaceText(name),
      fillColor: EDGY_ZONE_FILL[zone],
      // The OFFICIAL element, not just its kind: this template IS the
      // metamodel, so its Purpose is a Purpose and not merely an outcome.
      role: EDGY_ROLE[key],
    };
  }
  EDGY_DYNAMIC_RELATIONS.forEach(([src, dst, verb, t], i) => {
    const verbText = seedText(std, edgyVerbSeedKey(verb), verb);
    out[`rel${i}`] = {
      type: 'connector',
      mode: ConnectorMode.Straight,
      stroke: NODE_STROKE,
      strokeWidth: 2,
      strokeStyle: StrokeStyle.Solid,
      frontEndpointStyle: PointStyle.None,
      rearEndpointStyle: PointStyle.None,
      source: { id: src },
      target: { id: dst },
      // The verb, as a ROLE — one per canonical verb, derived from this very
      // table (`../roles.ts`). Source is the subject and target the object
      // (`docs/adr/0010` tier 1), which is exactly how the row above reads, so
      // `edgy.non-canonical-link` finds all 24 of these sentences legal.
      role: EDGY_VERB_ROLE[verb],
      // Native connector label: the verb travels with the link. The x/y are
      // re-centred on the path at the first layout, but the w/h ARE the label
      // box — size it to the verb so the text lays out on one line. The
      // distance slides the verb along the link like the reference diagram.
      //
      // The BOX (`edgyVerbLabelXYWH`) is still measured off the ENGLISH verb:
      // it is layout, sized once from the table this template already reads,
      // and a translated word longer than its English original wraps inside
      // that box like any other native text rather than resizing it.
      text: surfaceText(verbText),
      labelXYWH: edgyVerbLabelXYWH(verb),
      labelOffset: { distance: t ?? EDGY_RELATION_LABEL_DISTANCE },
    };
  });
  return out;
}

const NAME = 'EDGY dynamic';

/** Exported for direct insertion from the EDGY senior toolbar menu. */
export const edgyDynamicTemplate: Template = {
  name: NAME,
  type: 'template',
  preview: `<svg width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"><circle cx="55" cy="34" r="18" fill="#00ea4e" opacity="0.9"/><circle cx="80" cy="34" r="18" fill="#034cee" opacity="0.9"/><circle cx="67" cy="54" r="18" fill="#ff0056" opacity="0.9"/><path d="M55 30 H80 M56 31 L66 52 M79 31 L69 52" stroke="#fff" stroke-width="2"/><rect x="51" y="26" width="8" height="8" fill="#fff"/><circle cx="80" cy="30" r="4" fill="#fff"/><path d="M62 49 h6 l3 3 -3 3 h-6 z" fill="#fff"/></svg>`,
  // Stamped by hand, and it is the one `commandId` in this pack that is a
  // literal rather than a derivation: importing the registry here would close
  // the very loop this module exists to avoid. The coverage test pairs the two
  // and fails the day the command is renamed.
  commandId: 'edgy.insertDynamic',
  content: makeTemplateSnapshot(dynamic(), NAME),
  localize: std => makeTemplateSnapshot(dynamic(std), NAME),
};
