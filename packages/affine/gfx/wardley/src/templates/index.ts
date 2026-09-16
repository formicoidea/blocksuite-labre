import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  type Template,
  type TemplateCategory,
  templateFromCommand,
} from '@labre/affine-gfx-template';
import { ConnectorMode, PointStyle, StrokeStyle } from '@labre/affine-model';
import type { ChromeWording } from '@labre/affine-shared/services';
import type { CommandDescriptor } from '@labre/std';
import { GfxControllerIdentifier } from '@labre/std/gfx';

import { lowerWardleyArea } from '../actions';
import { wardleyCommands } from '../commands';
import { COLORS } from '../consts';
import {
  INERTIA_COLOR,
  LINK_GREY,
  LINK_STROKE_WIDTH,
  NODE_FILL,
  NODE_STROKE,
  WARDLEY_RED,
} from '../node/consts';
import { WARDLEY_AREA_SIZE, wardleyAreaProps } from '../presets';
import { WARDLEY_ROLE } from '../roles';
import { wardleyMaps } from './maps';

/**
 * The Wardley palette — DERIVED from the toolbox, one template per command.
 *
 * Every single-artefact entry below is what its command actually draws, run
 * once against a recording surface. It used to be a hand-written restatement of
 * the same artefacts, and it had drifted exactly as far as a copy drifts: the
 * four backgrounds had lost `role: wardley:map` and `resizeEnabled` (#77), no
 * composite carried the `group` the toolbox has written since #51, the inertia
 * bar had lost its `textFitMode`, label boxes were 140 against a `LABEL_W` of
 * 120, and five commands had no template at all. Derived, none of that can
 * happen again — and `templates-parity.unit.spec.ts` re-runs each command and
 * compares, so the day a creation site changes the palette changes with it.
 *
 * The two shipped MAPS stay hand-composed (`maps.ts`): a canonical map is an
 * arrangement of a dozen artefacts, which no single command draws. They are
 * built on the same presets, and the same test checks their composition.
 */

/** The command a derived template is the picture of. Throws rather than skips. */
function byId(id: string): CommandDescriptor {
  const command = wardleyCommands.find(entry => entry.id === id);
  if (!command) throw new Error(`[wardley] templates: no command "${id}"`);
  return command;
}

/**
 * A Wardley connector for the palette samples.
 *
 * `evolution` is the ONE predicate that decides what the stroke means, here and
 * in `maps.ts` alike — `docs/adr/0010` § Compatibility. The two kits used to
 * test different things (`opts.red` here, `o.arrow` there), which was a style
 * inconsistency until W4 started reading these edges and became a SEMANTIC one:
 * what a rule governs must not depend on which authoring helper a template
 * borrowed. Colour is a consequence of the meaning, never its source.
 *
 * `typed: false` drops the role altogether — for a sample that makes no claim
 * about anything (see the "Link" swatch below).
 */
function connect(
  source: Record<string, unknown>,
  target: Record<string, unknown>,
  opts: { evolution?: boolean; typed?: boolean } = {}
) {
  const role = opts.evolution
    ? WARDLEY_ROLE.changeArrow
    : WARDLEY_ROLE.dependency;
  return {
    type: 'connector',
    mode: ConnectorMode.Straight,
    // A template must produce the same typed artefacts as the toolbox, or a map
    // started from a preset would validate differently from a hand-drawn one.
    // `undefined` writes nothing: a neutral stroke keeps no `role` key.
    role: opts.typed === false ? undefined : role,
    stroke: opts.evolution ? WARDLEY_RED : LINK_GREY,
    strokeStyle: opts.evolution ? StrokeStyle.Dash : StrokeStyle.Solid,
    strokeWidth: LINK_STROKE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: opts.evolution ? PointStyle.Triangle : PointStyle.None,
    source,
    target,
  };
}

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';
const bgPreview = (extra = '') =>
  `<svg ${ATTRS} fill="none"><path d="M22 12 V64 H120" stroke="${COLORS.axis}" stroke-width="2"/><path d="M44 12 V64 M68 12 V64 M94 12 V64" stroke="${COLORS.divider}" stroke-width="0.8"/>${extra}</svg>`;
const dotPreview = (fill: string, sw = 2) =>
  `<svg ${ATTRS} fill="none"><circle cx="67" cy="40" r="13" fill="${fill}" stroke="${NODE_STROKE}" stroke-width="${sw}"/></svg>`;

/** The two fat arrows: the same outline, mirrored — the direction IS the kind. */
const arrowPreview = (rightwards: boolean) =>
  `<svg ${ATTRS} fill="none"><path d="${
    rightwards
      ? 'M32 32 H80 V23 L103 40 L80 57 V48 H32 Z'
      : 'M103 32 H55 V23 L32 40 L55 57 V48 H103 Z'
  }" fill="#bfbfbf" stroke="${NODE_STROKE}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;

/** The zone, in its Peace wash — the pair differs on the outline and on nothing else. */
const areaPreview = (outline: string) =>
  `<svg ${ATTRS} fill="none">${outline}</svg>`;

/**
 * The three hand-drawn palette swatches' own tile names (`Template.nameKey`):
 * none derives from a command, since `linkTool` / `evolutionArrow` /
 * `addAreaPolygon` activate a tool rather than draw anything (see `tpl` below
 * and its docstring).
 */
export const WARDLEY_TEMPLATE_NAME_LINK: ChromeWording = [
  'com.labre.wardley.template.link',
  'Link',
];
export const WARDLEY_TEMPLATE_NAME_EVOLUTION_ARROW: ChromeWording = [
  'com.labre.wardley.template.evolution-arrow',
  'Evolution arrow',
];
export const WARDLEY_TEMPLATE_NAME_AREA_POLYGON: ChromeWording = [
  'com.labre.wardley.template.area-polygon',
  'Area (polygon)',
];

/** A hand-composed template — what is left once the artefacts are derived. */
function tpl(
  name: string,
  preview: string,
  elements: SurfaceElementsJSON,
  nameKey?: string
): Template {
  return {
    name,
    type: 'template',
    preview,
    nameKey,
    content: makeTemplateSnapshot(elements, name),
  };
}

/**
 * A zone card, plus the one thing a snapshot cannot say.
 *
 * `createWardleyArea` lowers the zone the moment it exists, to just above the
 * framework backgrounds it covers — otherwise the wash sits on top of every
 * component it groups and eats their clicks. That depth is relative to the map
 * ALREADY ON THE BOARD, which a snapshot knows nothing about, so the panel
 * replays it on the freshly inserted element instead.
 */
function areaTemplate(template: Template): Template {
  return {
    ...template,
    afterInsert: (std, insertedIds) =>
      lowerWardleyArea(std.get(GfxControllerIdentifier), insertedIds[0]),
  };
}

export const wardleyTemplateCategory: TemplateCategory = {
  name: 'Wardley',
  // Reuses the senior button's own key — see `TemplateCategory.nameKey`.
  nameKey: 'com.labre.framework.wardley',
  templates: [
    ...wardleyMaps,
    templateFromCommand(
      byId('wardley.addBackground'),
      bgPreview(),
      'Map background'
    ),
    templateFromCommand(
      byId('wardley.addOpportunityBackground'),
      bgPreview(
        '<rect x="22" y="12" width="98" height="52" fill="#eef4fb" opacity="0.6"/>'
      ),
      'Opportunity gradient'
    ),
    templateFromCommand(
      byId('wardley.addBenefitBackground'),
      bgPreview(
        '<rect x="22" y="12" width="98" height="26" fill="#e6eef8" opacity="0.6"/>'
      ),
      'Benefit gradient'
    ),
    templateFromCommand(
      byId('wardley.addEvolutionBackground'),
      bgPreview(
        '<rect x="22" y="12" width="98" height="52" fill="#e3e2e4" opacity="0.5"/>'
      ),
      'Evolution gradient'
    ),
    templateFromCommand(
      byId('wardley.addComponent'),
      dotPreview(NODE_FILL, 1.5),
      'Component'
    ),
    templateFromCommand(
      byId('wardley.addMethod'),
      `<svg ${ATTRS} fill="none"><circle cx="67" cy="40" r="15" fill="#d9d9d9" stroke="${NODE_STROKE}" stroke-width="1.5"/><circle cx="67" cy="40" r="7" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/></svg>`,
      'Method'
    ),
    templateFromCommand(
      byId('wardley.addMarket'),
      `<svg ${ATTRS} fill="none"><circle cx="67" cy="40" r="16" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/><circle cx="67" cy="30" r="3.5" fill="${NODE_FILL}" stroke="${NODE_STROKE}" stroke-width="1.5"/><circle cx="75" cy="46" r="3.5" fill="${NODE_FILL}" stroke="${NODE_STROKE}" stroke-width="1.5"/><circle cx="59" cy="46" r="3.5" fill="${NODE_FILL}" stroke="${NODE_STROKE}" stroke-width="1.5"/><path d="M67 30 L75 46 L59 46 Z" stroke="${NODE_STROKE}" stroke-width="0.8" fill="none"/></svg>`,
      'Market'
    ),
    templateFromCommand(
      byId('wardley.addEcosystem'),
      `<svg ${ATTRS} fill="none"><circle cx="67" cy="40" r="15" fill="${NODE_FILL}" stroke="${NODE_STROKE}" stroke-width="1.5"/><circle cx="67" cy="40" r="11" fill="none" stroke="${NODE_STROKE}"/><circle cx="67" cy="40" r="5" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/></svg>`,
      'Ecosystem'
    ),
    templateFromCommand(
      byId('wardley.addAnchor'),
      `<svg ${ATTRS} fill="none"><circle cx="67" cy="40" r="13" fill="${NODE_FILL}" stroke="${NODE_STROKE}" stroke-width="1.5"/><circle cx="67" cy="36" r="3.5" fill="${NODE_STROKE}"/><path d="M59 48 q8 -9 16 0" stroke="${NODE_STROKE}" stroke-width="1.5" fill="none"/></svg>`,
      'Anchor'
    ),
    templateFromCommand(
      byId('wardley.addPipeline'),
      `<svg ${ATTRS} fill="none"><rect x="34" y="40" width="66" height="14" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/><rect x="60" y="33" width="14" height="14" fill="${NODE_FILL}" stroke="${NODE_STROKE}"/></svg>`,
      'Pipeline'
    ),
    templateFromCommand(
      byId('wardley.addInertia'),
      `<svg ${ATTRS} fill="none"><rect x="63" y="22" width="8" height="36" fill="${INERTIA_COLOR}"/></svg>`,
      'Inertia'
    ),
    templateFromCommand(
      byId('wardley.addPorter'),
      `<svg ${ATTRS} fill="none"><circle cx="67" cy="40" r="13" fill="${NODE_FILL}" stroke="${NODE_STROKE}" stroke-width="1.5"/><g stroke="${WARDLEY_RED}" stroke-width="2" stroke-linecap="round"><line x1="67" y1="26" x2="67" y2="19"/><line x1="81" y1="40" x2="88" y2="40"/><line x1="67" y1="54" x2="67" y2="61"/><line x1="53" y1="40" x2="46" y2="40"/></g><g fill="${WARDLEY_RED}"><path d="M67 13 L71 21 H63 Z"/><path d="M94 40 L86 44 V36 Z"/><path d="M67 67 L63 59 H71 Z"/><path d="M40 40 L48 36 V44 Z"/></g></svg>`
    ),
    templateFromCommand(byId('wardley.addAccelerator'), arrowPreview(true)),
    templateFromCommand(byId('wardley.addDecelerator'), arrowPreview(false)),
    // NEUTRAL on purpose (`docs/adr/0010` § Compatibility). This is a horizontal
    // stroke bound to nothing — a sample of a STYLE, in a palette. It was typed
    // `wardley:dependency` only because the helper defaults to that role, and a
    // sample of a stroke makes no claim about who depends on whom. Same call the
    // market glyph's own wiring already makes.
    //
    // Hand-written, and the one pair that cannot derive: `linkTool` and
    // `evolutionArrow` ACTIVATE a tool rather than draw anything, so there is no
    // artefact to record — the user draws it.
    tpl(
      'Link',
      `<svg ${ATTRS} fill="none"><path d="M24 40 H110" stroke="${LINK_GREY}" stroke-width="2.4"/></svg>`,
      {
        a: connect(
          { position: [0, 0] },
          { position: [160, 0] },
          { typed: false }
        ),
      },
      WARDLEY_TEMPLATE_NAME_LINK[0]
    ),
    tpl(
      'Evolution arrow',
      `<svg ${ATTRS} fill="none"><path d="M24 40 H100" stroke="${WARDLEY_RED}" stroke-width="2.4" stroke-dasharray="6 4"/><path d="M98 33 L112 40 L98 47 Z" fill="${WARDLEY_RED}"/></svg>`,
      {
        a: connect(
          { position: [0, 0] },
          { position: [160, 0] },
          { evolution: true, typed: false }
        ),
      },
      WARDLEY_TEMPLATE_NAME_EVOLUTION_ARROW[0]
    ),
    areaTemplate(
      templateFromCommand(
        byId('wardley.addAreaRect'),
        areaPreview(
          '<rect x="24" y="16" width="87" height="48" rx="2" fill="#c6dbfc" fill-opacity="0.25" stroke="#5b9cf6" stroke-width="1.5"/>'
        )
      )
    ),
    // Hand-composed, like the two connector swatches and for the same reason:
    // `wardley.addAreaPolygon` arms the polygon tool (#343) and draws nothing,
    // so there is no action to record. A panel card cannot arm a tool — it
    // inserts a snapshot — so the card keeps offering the zone ready-made, and
    // the author who wants to place the corners uses the sub-menu. The props
    // still come from the pack, so the two zones cannot disagree.
    areaTemplate(
      tpl(
        WARDLEY_TEMPLATE_NAME_AREA_POLYGON[1],
        areaPreview(
          '<path d="M67 12 L110 43 L94 68 H40 L24 43 Z" fill="#c6dbfc" fill-opacity="0.25" stroke="#5b9cf6" stroke-width="1.5" stroke-linejoin="round"/>'
        ),
        {
          area: wardleyAreaProps('polygon', {
            xywh: `[0,0,${WARDLEY_AREA_SIZE.polygon.w},${WARDLEY_AREA_SIZE.polygon.h}]`,
          }),
        },
        WARDLEY_TEMPLATE_NAME_AREA_POLYGON[0]
      )
    ),
  ],
};
