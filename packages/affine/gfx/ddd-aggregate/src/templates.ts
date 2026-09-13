import {
  makeTemplateSnapshot,
  type SurfaceElementsJSON,
  surfaceText,
  type Template,
  type TemplateCategory,
} from '@labre/affine-gfx-template';
import { FontFamily, ShapeStyle, TextAlign } from '@labre/affine-model';
import { translateKey } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

import {
  AGGREGATE_SEED_CORRECTIVE_POLICIES,
  AGGREGATE_SEED_CREATED_EVENTS,
  AGGREGATE_SEED_DESCRIPTION,
  AGGREGATE_SEED_ENFORCED_INVARIANTS,
  AGGREGATE_SEED_HANDLED_COMMANDS,
  AGGREGATE_SEED_HEADER,
  AGGREGATE_SEED_NAME,
  AGGREGATE_SEED_SIZE,
  AGGREGATE_SEED_STATE_TRANSITIONS,
  AGGREGATE_SEED_THROUGHPUT,
} from './translations';

/** The nine section titles + the header, resolved once per build. */
interface AggregateSeeds {
  header: string;
  name: string;
  description: string;
  stateTransitions: string;
  enforcedInvariants: string;
  correctivePolicies: string;
  handledCommands: string;
  createdEvents: string;
  throughput: string;
  size: string;
}

const EN_SEEDS: AggregateSeeds = {
  header: AGGREGATE_SEED_HEADER[1],
  name: AGGREGATE_SEED_NAME[1],
  description: AGGREGATE_SEED_DESCRIPTION[1],
  stateTransitions: AGGREGATE_SEED_STATE_TRANSITIONS[1],
  enforcedInvariants: AGGREGATE_SEED_ENFORCED_INVARIANTS[1],
  correctivePolicies: AGGREGATE_SEED_CORRECTIVE_POLICIES[1],
  handledCommands: AGGREGATE_SEED_HANDLED_COMMANDS[1],
  createdEvents: AGGREGATE_SEED_CREATED_EVENTS[1],
  throughput: AGGREGATE_SEED_THROUGHPUT[1],
  size: AGGREGATE_SEED_SIZE[1],
};

/**
 * The seeds in the inserting editor's language — or the English default with
 * no host registered, which is exactly {@link EN_SEEDS} (`content`'s build).
 */
function seedsFor(std?: BlockStdScope): AggregateSeeds {
  if (!std) return EN_SEEDS;
  return {
    header: translateKey(std, ...AGGREGATE_SEED_HEADER),
    name: translateKey(std, ...AGGREGATE_SEED_NAME),
    description: translateKey(std, ...AGGREGATE_SEED_DESCRIPTION),
    stateTransitions: translateKey(std, ...AGGREGATE_SEED_STATE_TRANSITIONS),
    enforcedInvariants: translateKey(
      std,
      ...AGGREGATE_SEED_ENFORCED_INVARIANTS
    ),
    correctivePolicies: translateKey(
      std,
      ...AGGREGATE_SEED_CORRECTIVE_POLICIES
    ),
    handledCommands: translateKey(std, ...AGGREGATE_SEED_HANDLED_COMMANDS),
    createdEvents: translateKey(std, ...AGGREGATE_SEED_CREATED_EVENTS),
    throughput: translateKey(std, ...AGGREGATE_SEED_THROUGHPUT),
    size: translateKey(std, ...AGGREGATE_SEED_SIZE),
  };
}

const DARK = '#323d4f';
/**
 * The header band, and why it is not `DARK`.
 *
 * It was drawn dark on the dark ground, so the canvas's one title bar was
 * invisible — the white heading floated on nothing and the nine numbered
 * sections started straight under the top edge. Two steps lighter on the same
 * hue reads as a band without turning it into a tenth section.
 */
const HEADER_BAND = '#41506a';
const WHITE = '#ffffff';

function box(x: number, y: number, w: number, h: number) {
  return {
    type: 'shape',
    shapeType: 'rect',
    filled: true,
    fillColor: WHITE,
    strokeColor: DARK,
    strokeWidth: 1,
    shapeStyle: ShapeStyle.General,
    roughness: 0,
    radius: 0,
    xywh: `[${x},${y},${w},${h}]`,
  };
}

function title(x: number, y: number, str: string, color = DARK, fontSize = 20) {
  return {
    type: 'text',
    text: surfaceText(str),
    color,
    fontFamily: FontFamily.Inter,
    fontSize,
    textAlign: TextAlign.Left,
    xywh: `[${x},${y},340,28]`,
  };
}

/** The Aggregate Design Canvas v1.1 (Kacper Gunia / DDD Crew): nine sections. */
function aggregateCanvas(seeds: AggregateSeeds): SurfaceElementsJSON {
  return {
    bg: {
      type: 'shape',
      shapeType: 'rect',
      filled: true,
      fillColor: DARK,
      strokeColor: '#00000000',
      strokeWidth: 0,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      radius: 0,
      xywh: '[0,0,1060,770]',
    },
    headerBar: {
      type: 'shape',
      shapeType: 'rect',
      filled: true,
      fillColor: HEADER_BAND,
      strokeColor: '#00000000',
      strokeWidth: 0,
      shapeStyle: ShapeStyle.General,
      roughness: 0,
      radius: 0,
      xywh: '[9,10,1040,40]',
    },
    headerTitle: title(16, 18, seeds.header, WHITE, 30),

    nameBox: box(9, 60, 350, 50),
    nameTitle: title(18, 72, seeds.name),
    descBox: box(9, 120, 350, 170),
    descTitle: title(18, 132, seeds.description),
    stateBox: box(369, 60, 680, 230),
    stateTitle: title(378, 72, seeds.stateTransitions),
    invariantsBox: box(9, 300, 350, 210),
    invariantsTitle: title(18, 312, seeds.enforcedInvariants),
    policiesBox: box(9, 520, 350, 200),
    policiesTitle: title(18, 532, seeds.correctivePolicies),
    commandsBox: box(369, 300, 350, 210),
    commandsTitle: title(378, 312, seeds.handledCommands),
    eventsBox: box(369, 520, 350, 200),
    eventsTitle: title(378, 532, seeds.createdEvents),
    throughputBox: box(729, 300, 320, 210),
    throughputTitle: title(738, 312, seeds.throughput),
    sizeBox: box(729, 520, 320, 200),
    sizeTitle: title(738, 532, seeds.size),
  };
}

const PREVIEW = `<svg width="100%" height="100%" viewBox="0 0 135 80" xmlns="http://www.w3.org/2000/svg"><rect width="135" height="80" fill="#323d4f"/><rect x="3" y="3" width="129" height="6" fill="${HEADER_BAND}"/><g fill="#fff"><rect x="3" y="11" width="42" height="6"/><rect x="3" y="19" width="42" height="22"/><rect x="47" y="11" width="85" height="28"/><rect x="3" y="43" width="42" height="16"/><rect x="3" y="61" width="42" height="16"/><rect x="47" y="43" width="42" height="16"/><rect x="47" y="61" width="42" height="16"/><rect x="91" y="43" width="41" height="16"/><rect x="91" y="61" width="41" height="16"/></g></svg>`;

/**
 * Standalone Aggregate Design Canvas section (gated by `ddd-templates`). Unlike
 * the per-senior-button categories (which live in the shared package), this one
 * has no senior button — it ships only as a Templates-panel prefab.
 */
export const aggregateTemplateCategory: TemplateCategory = {
  name: 'Aggregate Design Canvas',
  // Reuses the canvas's own header seed key: the tab, the tile's tooltip
  // (unconverted — see `TemplateCategory.nameKey`'s own doc, hand-written
  // templates get no generic tooltip seam) and the header band all say the
  // exact same English word.
  nameKey: AGGREGATE_SEED_HEADER[0],
  templates: [
    {
      name: 'Aggregate Design Canvas',
      type: 'template',
      preview: PREVIEW,
      content: makeTemplateSnapshot(
        aggregateCanvas(EN_SEEDS),
        'Aggregate Design Canvas'
      ),
      // The nine section titles and the header are document content the
      // moment the template lands (ADR 0016); `content` stays the English
      // build.
      localize: std =>
        makeTemplateSnapshot(
          aggregateCanvas(seedsFor(std)),
          'Aggregate Design Canvas'
        ),
    } satisfies Template,
  ],
};
