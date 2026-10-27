import type {
  FrameworkToolbox,
  SerializedElementProps,
  ToolboxItem,
  ToolboxLink,
  ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import {
  ConnectorMode,
  PointStyle,
  StrokeStyle,
} from '@labre/affine-model/headless';
import { Bound } from '@labre/global/gfx';

import { edgyCommandsManifest } from './commands-manifest';
import { CROP_LABELED } from './facets-crop';
import { edgyElementLabel } from './metamodel';
import { LABEL_GAP, NODE_LABEL, NODE_SIZE, NODE_STROKE } from './node/consts';
import {
  EDGY_BOARD_SIZE,
  EDGY_LABEL_H,
  EDGY_LABEL_W,
  type EdgyBoxKind,
  edgyLabelProps,
  edgyNodeProps,
  edgyNodeTextProps,
  FACETS_SCALE,
  RELATION_STROKE_WIDTH,
} from './presets';
import { EDGY_ROLE } from './roles';

/**
 * EDGY's toolbar as pure builders (`docs/adr/0045`): what `createEdgyFacets`,
 * `createEdgyBoard`, `createEdgyPeople`, `createEdgyBox` and the relation tool
 * place, with no editor behind them. The actions call these, so an element
 * built here and one placed from the toolbar are the same element.
 *
 * "EDGY dynamic" is NOT an item: it inserts a template snapshot through the
 * template job (`createEdgyDynamic`), not elements a builder can return.
 */

/** The facets background is drawn cropped to its circles and their names. */
export const EDGY_FACETS_SIZE = {
  w: CROP_LABELED.w * FACETS_SCALE,
  h: CROP_LABELED.h * FACETS_SCALE,
} as const;

/** People's box: the glyph on top, its name centred under it. */
export const EDGY_PEOPLE_SIZE = {
  w: Math.max(NODE_SIZE.people.w, EDGY_LABEL_W),
  h: NODE_SIZE.people.h + LABEL_GAP + EDGY_LABEL_H,
} as const;

/** The three facet names a facets background writes. */
export interface EdgyFacetsTexts {
  identity?: string;
  architecture?: string;
  experience?: string;
}

/**
 * The Enterprise Design facets background at `at`, cropped to the circles and
 * the facet names. The three names are WRITTEN on the element rather than left
 * to the model's defaults, as `createEdgyFacets` requires: the action passes
 * them resolved in the host's language, a host passes its own or gets the
 * English seed.
 */
export function edgyFacetsElement(
  at: ToolboxPoint,
  texts: EdgyFacetsTexts = {},
  local = 'facets'
): SerializedElementProps {
  const name = (zone: keyof EdgyFacetsTexts) =>
    texts[zone]?.trim() || edgyElementLabel(zone);
  return {
    type: 'edgy',
    id: local,
    cropToCircles: true,
    // The frame: what makes this an EDGY board rather than three circles, and
    // what a finding is attributed to.
    role: EDGY_ROLE.facets,
    identityLabel: name('identity'),
    architectureLabel: name('architecture'),
    experienceLabel: name('experience'),
    xywh: new Bound(
      at.x,
      at.y,
      EDGY_FACETS_SIZE.w,
      EDGY_FACETS_SIZE.h
    ).serialize(),
  };
}

/** A blank EDGY board (the hover spotlight host) at `at`. */
export function edgyBoardElement(
  at: ToolboxPoint,
  local = 'board'
): SerializedElementProps {
  return {
    type: 'edgyBoard',
    id: local,
    // The blank board is a frame too: the same rules apply to what is drawn on
    // it, and the same map-wide arbitration has to have somewhere to live.
    role: EDGY_ROLE.board,
    xywh: new Bound(
      at.x,
      at.y,
      EDGY_BOARD_SIZE.w,
      EDGY_BOARD_SIZE.h
    ).serialize(),
  };
}

/**
 * An Outcome, Object or Activity at `at`: one node carrying its name as the
 * shape's own inner text.
 */
export function edgyBoxElement(
  kind: EdgyBoxKind,
  at: ToolboxPoint,
  name?: string,
  local: string = kind
): SerializedElementProps {
  const { w, h } = NODE_SIZE[kind];
  return {
    ...edgyNodeProps(kind, {
      xywh: new Bound(at.x, at.y, w, h).serialize(),
    }),
    ...edgyNodeTextProps(name?.trim() || NODE_LABEL[kind]),
    id: local,
  };
}

/**
 * People at `at`, the top-left of {@link EDGY_PEOPLE_SIZE}: the glyph's
 * ellipse centred on top, its name as a free text under it, and the group
 * that makes the two one thing — last, holding both.
 *
 * The group carries no title: the numbered "Group N" the toolbar's group
 * command writes counts the document's groups and asks the host's catalogue,
 * which only an editor has (`createEdgyPeople`).
 */
export function edgyPeopleElements(
  at: ToolboxPoint,
  name?: string,
  local = 'people'
): SerializedElementProps[] {
  const { w, h } = NODE_SIZE.people;
  const id = (part: string) => `${local}:${part}`;
  const members = [
    {
      ...edgyNodeProps('people', {
        xywh: new Bound(
          at.x + (EDGY_PEOPLE_SIZE.w - w) / 2,
          at.y,
          w,
          h
        ).serialize(),
      }),
      id: id('node'),
    },
    {
      ...edgyLabelProps(
        name?.trim() || NODE_LABEL.people,
        at.x + (EDGY_PEOPLE_SIZE.w - EDGY_LABEL_W) / 2,
        at.y + h + LABEL_GAP
      ),
      id: id('label'),
    },
  ];
  return [
    ...members,
    {
      type: 'group',
      id: id('group'),
      children: Object.fromEntries(members.map(m => [m.id, true])),
    },
  ];
}

/**
 * The connector the relation tool is armed with, between two ends: straight,
 * the stencil ink, two units wide, no arrowhead, and the GENERIC role.
 *
 * The verb is not the builder's: in the editor, `EdgyRelationResolver` names a
 * generic relation from the roles of the two elements it joins, as a verb role
 * and a label. A `label` given here is written as the link's text and leaves
 * the role generic.
 */
export function edgyRelationElement(
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return {
    type: 'connector',
    mode: ConnectorMode.Straight,
    role: EDGY_ROLE.relation,
    stroke: NODE_STROKE,
    strokeStyle: StrokeStyle.Solid,
    strokeWidth: RELATION_STROKE_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.None,
    source: { id: from },
    target: { id: to },
    ...(label?.trim() ? { text: label.trim() } : {}),
  };
}

/** The toolbar command's label, so a host names an item as the toolbar does. */
function label(commandId: string) {
  const row = edgyCommandsManifest.find(r => r.id === commandId);
  return {
    labelKey: row?.labelKey ?? commandId,
    labelFallback: row?.labelFallback ?? commandId,
  };
}

const BOX_COMMANDS: Record<EdgyBoxKind, string> = {
  outcome: 'edgy.addOutcome',
  object: 'edgy.addObject',
  activity: 'edgy.addActivity',
};

const boxItem = (kind: EdgyBoxKind): ToolboxItem => ({
  id: kind,
  ...label(BOX_COMMANDS[kind]),
  texts: ['name'],
  size: NODE_SIZE[kind],
  build: (at, texts, local) => [edgyBoxElement(kind, at, texts?.name, local)],
});

const relation: ToolboxLink = {
  id: 'relation',
  ...label('edgy.addRelation'),
  build: edgyRelationElement,
};

/**
 * Every item of the EDGY toolbar that places elements, in the toolbar's order,
 * "EDGY dynamic" excepted (see the note at the top of this file).
 */
export const EDGY_TOOLBOX: FrameworkToolbox = {
  framework: 'edgy',
  items: [
    {
      id: 'facets',
      ...label('edgy.addFacets'),
      texts: ['identity', 'architecture', 'experience'],
      size: EDGY_FACETS_SIZE,
      build: (at, texts, local) => [edgyFacetsElement(at, texts, local)],
    },
    {
      id: 'board',
      ...label('edgy.addBoard'),
      texts: [],
      size: EDGY_BOARD_SIZE,
      build: (at, _texts, local) => [edgyBoardElement(at, local)],
    },
    {
      id: 'people',
      ...label('edgy.addPeople'),
      texts: ['name'],
      size: EDGY_PEOPLE_SIZE,
      build: (at, texts, local) => edgyPeopleElements(at, texts?.name, local),
    },
    boxItem('outcome'),
    boxItem('object'),
    boxItem('activity'),
  ],
  links: [relation],
};
