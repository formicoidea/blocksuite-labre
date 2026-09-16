import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
  type Template,
  type TemplateCategory,
  templateFromCommand,
} from '@labre/affine-gfx-template';
import { FontFamily, ShapeStyle, TextAlign } from '@labre/affine-model';
import { NOTATION_NEUTRALS } from '@labre/affine-shared/consts';
import {
  type ChromeWording,
  translateKey,
} from '@labre/affine-shared/services';
import type { BlockStdScope, CommandDescriptor } from '@labre/std';

import { cynefinEstuarineCommands } from '../commands';
import { HEX_SIZE } from '../estuarine/consts';
import {
  CYNEFIN_H,
  CYNEFIN_W,
  cynefinBackgroundProps,
  ESTUARINE_MAP_H,
  ESTUARINE_MAP_W,
  estuarineHexagonBox,
  estuarineHexagonProps,
  estuarineMapProps,
  MAP_SCALE,
} from '../presets';

/**
 * The Cynefin / Estuarine palettes — DERIVED from the toolbox, one template per
 * command.
 *
 * Every single-artefact entry below is what its command actually draws, run
 * once against a recording surface. Hand-written, they had drifted exactly as
 * far as a copy drifts: the hexagons had lost the `textFitMode` #52 gave them,
 * and the estuarine background was drawn at scale 1 (690×801) where the button
 * draws it at 1.2 (828×961). Derived, neither can happen again — and
 * `templates-parity.unit.spec.ts` re-runs each command and compares.
 *
 * The two COMPOSITIONS stay hand-written: a sorting board and a constraint map
 * are arrangements no single command draws. They are built on the same presets,
 * and the same test checks their composition.
 */

/** The command a derived template is the picture of. Throws rather than skips. */
function byId(id: string): CommandDescriptor {
  const command = cynefinEstuarineCommands.find(entry => entry.id === id);
  if (!command) throw new Error(`[cynefin-estuarine] templates: no "${id}"`);
  return command;
}

function sticky(x: number, y: number, text: string) {
  return {
    type: 'shape',
    shapeType: 'rect',
    filled: true,
    fillColor: '#fff3b0',
    strokeColor: '#d9b740',
    strokeWidth: 1.5,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: 8,
    text: surfaceText(text),
    color: NOTATION_NEUTRALS.ink,
    fontFamily: FontFamily.Inter,
    fontSize: 18,
    textAlign: TextAlign.Center,
    xywh: `[${x},${y},200,70]`,
  };
}

/**
 * A constraint on the shipped map, placed by its CENTRE in the map's reference
 * space (690×801) — the frame the drawing was laid out in — carried onto the
 * box the map is actually born at.
 */
const hexAt = (cx: number, cy: number) =>
  estuarineHexagonProps({
    xywh: estuarineHexagonBox(cx * MAP_SCALE, cy * MAP_SCALE),
  });

const CAPTION_W = 120;
const CAPTION_H = 24;
/** Room between a hexagon's bottom edge and the name under it. */
const CAPTION_GAP = 8;

/**
 * The name UNDER the hexagon centred on the same point.
 *
 * The offset is `HEX_SIZE`, never a literal: this used to be a `+64` computed
 * for a 60-wide hexagon, and #55 doubled the hexagon to 120 without touching
 * it — so every caption ended up drawn INSIDE the shape it names. Derived, the
 * caption follows the hexagon whatever size it is given next.
 *
 * Neutral, and staying so: a name is nobody's artefact.
 */
function caption(cx: number, cy: number, str: string) {
  const x = cx * MAP_SCALE - CAPTION_W / 2;
  const y = cy * MAP_SCALE + HEX_SIZE / 2 + CAPTION_GAP;
  return {
    type: 'text',
    text: surfaceText(str),
    color: NOTATION_NEUTRALS.ink,
    fontFamily: FontFamily.Inter,
    fontSize: 16,
    textAlign: TextAlign.Center,
    xywh: `[${x},${y},${CAPTION_W},${CAPTION_H}]`,
  };
}

/**
 * The seeds the two hand-composed templates below write into the document:
 * the "Decision sorting" board's four domain stickies, and the "Constraint
 * map" board's three hexagon captions. Exported so `translations.ts` derives
 * the manifest entries from the SAME constants rather than restating them.
 */
export const CYNEFIN_SEED_PROBE_LEARN: ChromeWording = [
  'com.labre.cynefin-estuarine.seed.probe-learn',
  'Probe & learn',
];
export const CYNEFIN_SEED_EXPERT_ANALYSIS: ChromeWording = [
  'com.labre.cynefin-estuarine.seed.expert-analysis',
  'Expert analysis',
];
export const CYNEFIN_SEED_ACT_NOW: ChromeWording = [
  'com.labre.cynefin-estuarine.seed.act-now',
  'Act now',
];
export const CYNEFIN_SEED_KNOWN_ISSUE: ChromeWording = [
  'com.labre.cynefin-estuarine.seed.known-issue',
  'Known issue',
];
export const ESTUARINE_SEED_POLICY: ChromeWording = [
  'com.labre.cynefin-estuarine.seed.policy',
  'Policy',
];
export const ESTUARINE_SEED_HABIT: ChromeWording = [
  'com.labre.cynefin-estuarine.seed.habit',
  'Habit',
];
export const ESTUARINE_SEED_BUDGET: ChromeWording = [
  'com.labre.cynefin-estuarine.seed.budget',
  'Budget',
];

/** All seven, for `translations.ts`'s manifest contribution. */
export const CYNEFIN_ESTUARINE_TEMPLATE_SEEDS: readonly ChromeWording[] = [
  CYNEFIN_SEED_PROBE_LEARN,
  CYNEFIN_SEED_EXPERT_ANALYSIS,
  CYNEFIN_SEED_ACT_NOW,
  CYNEFIN_SEED_KNOWN_ISSUE,
  ESTUARINE_SEED_POLICY,
  ESTUARINE_SEED_HABIT,
  ESTUARINE_SEED_BUDGET,
];

/**
 * The two Templates-panel tab names — new keys, since Cynefin and Estuarine
 * share one senior-button key (`com.labre.framework.cynefin-estuarine`) that
 * names neither individually (see `TemplateCategory.nameKey`). Both are proper
 * nouns; the PO's French proposal for each is the identical word.
 */
export const CYNEFIN_TEMPLATE_CATEGORY_NAME: ChromeWording = [
  'com.labre.cynefin-estuarine.template.category.cynefin',
  'Cynefin',
];
export const ESTUARINE_TEMPLATE_CATEGORY_NAME: ChromeWording = [
  'com.labre.cynefin-estuarine.template.category.estuarine',
  'Estuarine',
];

/**
 * The two Templates-panel tab names (chrome, not seeds — a widget-resolved
 * label, never written into a document), for `translations.ts`'s manifest.
 */
export const CYNEFIN_ESTUARINE_TEMPLATE_CATEGORY_WORDINGS: readonly ChromeWording[] =
  [CYNEFIN_TEMPLATE_CATEGORY_NAME, ESTUARINE_TEMPLATE_CATEGORY_NAME];

/**
 * The two hand-composed templates' own tile names (`Template.nameKey`):
 * chrome, resolved by the panel widget every time it opens, never written
 * into a document — distinct from {@link CYNEFIN_ESTUARINE_TEMPLATE_SEEDS}
 * above, which the templates WRITE.
 */
export const CYNEFIN_TEMPLATE_NAME_DECISION_SORTING: ChromeWording = [
  'com.labre.cynefin-estuarine.template.decision-sorting',
  'Decision sorting',
];
export const ESTUARINE_TEMPLATE_NAME_CONSTRAINT_MAP: ChromeWording = [
  'com.labre.cynefin-estuarine.template.constraint-map',
  'Constraint map',
];

/** Both tile names, for `translations.ts`'s manifest. */
export const CYNEFIN_ESTUARINE_TEMPLATE_NAME_WORDINGS: readonly ChromeWording[] =
  [
    CYNEFIN_TEMPLATE_NAME_DECISION_SORTING,
    ESTUARINE_TEMPLATE_NAME_CONSTRAINT_MAP,
  ];

/** Resolve a wording through the host, or its English fallback with no host. */
function tr(std: BlockStdScope | undefined, wording: ChromeWording): string {
  return std ? translateKey(std, ...wording) : wording[1];
}

/**
 * A hand-composed template — what is left once the artefacts are derived.
 *
 * The seeds a template writes into the document go through the translation
 * seam at placement (ADR 0016); `content` stays the English build, and
 * `localize` rebuilds the same snapshot with translated seeds.
 */
function tpl(
  name: string,
  preview: string,
  build: (std?: BlockStdScope) => SurfaceElementsJSON,
  nameKey?: string
): Template {
  return {
    name,
    type: 'template',
    preview,
    nameKey,
    content: makeTemplateSnapshot(build(), name),
    localize: std => makeTemplateSnapshot(build(std), name),
  };
}

const ATTRS =
  'width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"';

export const cynefinTemplateCategory: TemplateCategory = {
  name: 'Cynefin',
  nameKey: CYNEFIN_TEMPLATE_CATEGORY_NAME[0],
  templates: [
    tpl(
      'Decision sorting',
      `<svg ${ATTRS} fill="none"><rect x="8" y="10" width="119" height="60" rx="4" stroke="#2a9d99" stroke-width="1.5"/><path d="M67 10 V70 M8 40 H127" stroke="${NOTATION_NEUTRALS.divider}"/><rect x="18" y="18" width="34" height="14" rx="2" fill="#fff3b0"/><rect x="83" y="18" width="34" height="14" rx="2" fill="#fff3b0"/><rect x="18" y="48" width="34" height="14" rx="2" fill="#fff3b0"/><rect x="83" y="48" width="34" height="14" rx="2" fill="#fff3b0"/></svg>`,
      std => ({
        bg: cynefinBackgroundProps({
          xywh: `[0,0,${CYNEFIN_W},${CYNEFIN_H}]`,
        }),
        s1: sticky(190, 175, tr(std, CYNEFIN_SEED_PROBE_LEARN)),
        s2: sticky(690, 175, tr(std, CYNEFIN_SEED_EXPERT_ANALYSIS)),
        s3: sticky(190, 505, tr(std, CYNEFIN_SEED_ACT_NOW)),
        s4: sticky(690, 505, tr(std, CYNEFIN_SEED_KNOWN_ISSUE)),
      }),
      CYNEFIN_TEMPLATE_NAME_DECISION_SORTING[0]
    ),
    // No name override: it would only restate `addCynefin`'s own
    // `labelFallback` as a second literal the panel could not translate — see
    // `resolveTemplateName`, which now reads the command's `labelKey` instead.
    templateFromCommand(
      byId('cynefin-estuarine.addCynefin'),
      `<svg ${ATTRS} fill="none"><rect x="14" y="12" width="107" height="56" rx="4" stroke="#2a9d99" stroke-width="1.6"/><path d="M67 12 V68 M14 40 H121" stroke="${NOTATION_NEUTRALS.divider}"/></svg>`
    ),
  ],
};

export const estuarineTemplateCategory: TemplateCategory = {
  name: 'Estuarine',
  nameKey: ESTUARINE_TEMPLATE_CATEGORY_NAME[0],
  templates: [
    tpl(
      'Constraint map',
      `<svg ${ATTRS} fill="none"><path d="M20 12 V70 M20 70 H120" stroke="#941253" stroke-width="2"/><g fill="#34c724" stroke="#1f1f1f"><path d="M44 28 l6 4 l0 8 l-6 4 l-6 -4 l0 -8 z"/><path d="M74 40 l6 4 l0 8 l-6 4 l-6 -4 l0 -8 z"/><path d="M56 52 l6 4 l0 8 l-6 4 l-6 -4 l0 -8 z"/></g></svg>`,
      std => ({
        bg: estuarineMapProps({
          xywh: `[0,0,${ESTUARINE_MAP_W},${ESTUARINE_MAP_H}]`,
        }),
        h1: hexAt(210, 280),
        c1: caption(210, 280, tr(std, ESTUARINE_SEED_POLICY)),
        h2: hexAt(390, 420),
        c2: caption(390, 420, tr(std, ESTUARINE_SEED_HABIT)),
        h3: hexAt(290, 580),
        c3: caption(290, 580, tr(std, ESTUARINE_SEED_BUDGET)),
      }),
      ESTUARINE_TEMPLATE_NAME_CONSTRAINT_MAP[0]
    ),
    // No name override: same reason as `addCynefin` above.
    templateFromCommand(
      byId('cynefin-estuarine.addEstuarineMap'),
      `<svg ${ATTRS} fill="none"><path d="M24 10 V70 M24 70 H120" stroke="#941253" stroke-width="2.4"/><path d="M30 52 q40 -30 84 -34" stroke="#5ecc44" stroke-width="2" fill="none"/></svg>`
    ),
    // Kept, unlike the two overrides above: `addConstraintHexagon`'s own
    // label is "Hexagon node" (the generic node-picker's wording), and this
    // tile is specifically the CONSTRAINT preset of it — a name of its own,
    // not a restatement. `resolveTemplateName` still resolves it through the
    // command's `labelKey`, with THIS literal (not the command's) as the
    // fallback, so the tile keeps its own English wording with no catalogue.
    templateFromCommand(
      byId('cynefin-estuarine.addConstraintHexagon'),
      `<svg ${ATTRS} fill="none"><path d="M67 24 l18 11 l0 22 l-18 11 l-18 -11 l0 -22 z" fill="#34c724" stroke="#1f1f1f" stroke-width="2"/></svg>`,
      'Hexagon constraint'
    ),
  ],
};
