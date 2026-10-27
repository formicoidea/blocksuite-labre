import type {
  FrameworkToolbox,
  SerializedElementProps,
  ToolboxItem,
  ToolboxLink,
  ToolboxPoint,
} from '@labre/affine-block-surface/interchange';
import type { C4BoundaryVariant, C4NodeKind } from '@labre/affine-model';
import {
  ConnectorMode,
  FontFamily,
  FontStyle,
  FontWeight,
  PointStyle,
  StrokeStyle,
  TextAlign,
} from '@labre/affine-model/headless';
import { Bound } from '@labre/global/gfx';

import { c4CommandsManifest } from './commands-manifest';
import { type C4TierBox, c4TierBoxes } from './tier-boxes';
import {
  BOARD_REF_HEIGHT,
  BOARD_REF_WIDTH,
  BOUNDARY_LABEL,
  BOUNDARY_REF_HEIGHT,
  BOUNDARY_REF_WIDTH,
  DESCRIPTION_FONT_SIZE,
  DESCRIPTION_PLACEHOLDER,
  NODE_LABEL,
  NODE_PALETTE,
  NODE_SIZE,
  RELATIONSHIP_STROKE,
  RELATIONSHIP_WIDTH,
  TITLE_FONT_SIZE,
  TYPE_FONT_SIZE,
} from './consts';
import { c4NodeProps } from './presets';
import { C4_BOUNDARY_ROLE, C4_ROLE } from './roles';
import { C4_TYPE_PLACEHOLDER, C4_TYPE_WORD, typeLineOf } from './type-word';

/**
 * C4's toolbar as pure builders (`docs/adr/0045`): what `createC4Node`,
 * `createC4Board`, `createC4Boundary` and the relationship tool place, with no
 * editor behind them. The actions call these, so a component built here and
 * one placed from the toolbar are the same five elements.
 */

/**
 * One of a component's three written tiers, as a canvas TEXT element.
 *
 * Every style prop is passed EXPLICITLY, and that is not belt and braces: both
 * creation APIs run the new props through `EditPropsStore.applyLastProps('text',
 * …)`, which merges whatever the user last set on a free text element
 * underneath — a 24px face, a colour from another diagram, a left alignment.
 * Explicit props win the merge, so the only ones that survive it are the ones
 * written here. A type line inheriting the colour of the last sticky note
 * somebody typed would be a notation set by accident.
 *
 * `hasMaxWidth` is what keeps a long sentence inside the element instead of
 * running out over the canvas: the box wraps at its own width and grows
 * downward, and the group grows with it, so a component always contains its own
 * words.
 */
function tier(
  id: string,
  role: string,
  text: string,
  fontSize: number,
  fontWeight: FontWeight,
  color: string,
  box: C4TierBox
): SerializedElementProps {
  return {
    type: 'text',
    id,
    role,
    text,
    color,
    fontFamily: FontFamily.Inter,
    fontSize,
    fontWeight,
    fontStyle: FontStyle.Normal,
    textAlign: TextAlign.Center,
    hasMaxWidth: true,
    xywh: new Bound(box.x, box.y, box.w, box.h).serialize(),
  };
}

/** The text slots of a component, in reading order. */
export interface C4NodeTexts {
  /** The name; the kind's English label when absent. */
  title?: string;
  /** The technology of a container or component (`Java`, `PostgreSQL`). */
  technology?: string;
  /**
   * The whole middle tier, verbatim: the editor's creation site passes the
   * prompt resolved in the host's language (`c4TypePlaceholder`). Wins over
   * `technology`.
   */
  typeLine?: string;
  description?: string;
}

/**
 * A C4 component at `at` (its top-left): the shape, its three tiers and the
 * group that makes them one thing — the five elements `createC4Node`
 * documents. Ids are local (`<local>:shape`…), the group last.
 */
export function c4NodeElements(
  kind: C4NodeKind,
  at: ToolboxPoint,
  texts: C4NodeTexts = {},
  local: string = kind
): SerializedElementProps[] {
  const { w, h } = NODE_SIZE[kind];
  const paint = NODE_PALETTE[kind];
  const boxes = c4TierBoxes(kind, at.x, at.y, w, h);
  const id = (part: string) => `${local}:${part}`;
  const technology = texts.technology?.trim();
  const members = [
    {
      ...c4NodeProps(kind, { xywh: new Bound(at.x, at.y, w, h).serialize() }),
      id: id('shape'),
    },
    tier(
      id('title'),
      C4_ROLE.title,
      texts.title?.trim() || NODE_LABEL[kind],
      TITLE_FONT_SIZE,
      FontWeight.SemiBold,
      paint.text,
      boxes.title
    ),
    tier(
      id('type-line'),
      C4_ROLE['type-line'],
      texts.typeLine ??
        (technology
          ? typeLineOf(C4_TYPE_WORD[kind], technology)
          : C4_TYPE_PLACEHOLDER[kind]),
      TYPE_FONT_SIZE,
      FontWeight.Regular,
      paint.text,
      boxes.typeLine
    ),
    tier(
      id('description'),
      C4_ROLE.description,
      texts.description?.trim() || DESCRIPTION_PLACEHOLDER,
      DESCRIPTION_FONT_SIZE,
      FontWeight.Regular,
      paint.text,
      boxes.description
    ),
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

/** The sheet one C4 diagram is drawn on, at `at`. */
export function c4BoardElement(
  at: ToolboxPoint,
  name = 'C4 diagram',
  local = 'board'
): SerializedElementProps {
  return {
    type: 'c4Board',
    id: local,
    // The FRAME the elements are drawn on, and a role of its own: a rule
    // written on the artefacts must never fall on the sheet holding them.
    role: C4_ROLE.board,
    name,
    xywh: new Bound(at.x, at.y, BOARD_REF_WIDTH, BOARD_REF_HEIGHT).serialize(),
  };
}

/**
 * A boundary at `at`. The variant and the child role are written together,
 * from the same argument, as `createC4Boundary` requires.
 */
export function c4BoundaryElement(
  variant: C4BoundaryVariant,
  at: ToolboxPoint,
  name = BOUNDARY_LABEL[variant],
  local = `${variant}-boundary`
): SerializedElementProps {
  return {
    type: 'c4Boundary',
    id: local,
    // The CHILD role matching the variant — never the parent, which is the
    // role of a boundary drawn before the split and of nothing created now.
    role: C4_BOUNDARY_ROLE[variant],
    name,
    variant,
    xywh: new Bound(
      at.x,
      at.y,
      BOUNDARY_REF_WIDTH,
      BOUNDARY_REF_HEIGHT
    ).serialize(),
  };
}

/** The connector the relationship tool is armed with, between two ends. */
export function c4RelationshipElement(
  from: string,
  to: string,
  label?: string
): SerializedElementProps {
  return {
    type: 'connector',
    mode: ConnectorMode.Straight,
    role: C4_ROLE.relationship,
    stroke: RELATIONSHIP_STROKE,
    strokeStyle: StrokeStyle.Dash,
    strokeWidth: RELATIONSHIP_WIDTH,
    frontEndpointStyle: PointStyle.None,
    rearEndpointStyle: PointStyle.Triangle,
    source: { id: from },
    target: { id: to },
    ...(label?.trim() ? { text: label.trim() } : {}),
  };
}

/** The toolbar command's label, so a host names an item as the toolbar does. */
function label(commandId: string) {
  const row = c4CommandsManifest.find(r => r.id === commandId);
  return {
    labelKey: row?.labelKey ?? commandId,
    labelFallback: row?.labelFallback ?? commandId,
  };
}

const NODE_COMMANDS: Record<C4NodeKind, string> = {
  person: 'c4.addPerson',
  'person-ext': 'c4.addPersonExt',
  system: 'c4.addSystem',
  'system-ext': 'c4.addSystemExt',
  container: 'c4.addContainer',
  component: 'c4.addComponent',
  database: 'c4.addDatabase',
  mobile: 'c4.addMobile',
  browser: 'c4.addBrowser',
};

const nodeItem = (kind: C4NodeKind): ToolboxItem => ({
  id: kind,
  ...label(NODE_COMMANDS[kind]),
  texts: ['title', 'technology', 'description'],
  size: NODE_SIZE[kind],
  build: (at, texts, local) => c4NodeElements(kind, at, texts, local),
});

const boundaryItem = (variant: C4BoundaryVariant): ToolboxItem => ({
  id: `${variant}-boundary`,
  ...label(
    variant === 'system' ? 'c4.addSystemBoundary' : 'c4.addContainerBoundary'
  ),
  texts: ['name'],
  size: { w: BOUNDARY_REF_WIDTH, h: BOUNDARY_REF_HEIGHT },
  build: (at, texts, local) => [
    c4BoundaryElement(variant, at, texts?.name?.trim() || undefined, local),
  ],
});

const relationship: ToolboxLink = {
  id: 'relationship',
  ...label('c4.relationshipTool'),
  build: c4RelationshipElement,
};

/** Every item of the C4 toolbar, in the toolbar's order. */
export const C4_TOOLBOX: FrameworkToolbox = {
  framework: 'c4',
  items: [
    {
      id: 'board',
      ...label('c4.addBoard'),
      texts: ['name'],
      size: { w: BOARD_REF_WIDTH, h: BOARD_REF_HEIGHT },
      build: (at, texts, local) => [
        c4BoardElement(at, texts?.name?.trim() || undefined, local),
      ],
    },
    ...(Object.keys(NODE_COMMANDS) as C4NodeKind[]).map(nodeItem),
    boundaryItem('system'),
    boundaryItem('container'),
  ],
  links: [relationship],
};
