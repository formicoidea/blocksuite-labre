import {
  type AutoLegendEntry,
  type AutoLegendSpec,
  type LegendRow,
  roleLabel,
} from '@labre/affine-gfx-ddd-shared';
import { StrokeStyle, type UmlNodeKind } from '@labre/affine-model';
import type { RoleId } from '@labre/std/gfx';

import {
  UML_CARD,
  UML_FRAME_INK,
  UML_INK,
  UML_NODE_BOX,
  UML_NODE_STROKE_WIDTH,
} from './consts.js';
import { UML_EDGE_STYLE, type UmlEdgeRole } from './edge-styles.js';
import { umlNodeProps } from './presets.js';
import { UML_ROLE, UML_ROLE_OF_KIND, UML_ROLES } from './roles.js';

/**
 * What the UML diagram frame's automatic legend can say — a TABLE, and nothing
 * else: the scan, the placement and the box are `createAutoLegend`'s job, shared
 * with the C4 board and the three DDD boards.
 *
 * Every row's WORDING is derived from the role vocabulary's own `labelFallback`
 * ({@link roleLabel}) rather than restated here, so renaming a role renames its
 * legend row — which is what keeps a legend a description of the board rather
 * than a second opinion about it.
 *
 * ## A monochrome legend, and what carries the meaning instead
 *
 * The other packs' legends are colour keys: a C4 row is a blue square, an EDGY
 * row a facet's hue. UML defines no palette — every figure in the specification
 * is black on white — so no swatch below can carry meaning in its colour, and
 * every one of them is the same card white with the same ink round it.
 *
 * What carries the meaning is the SILHOUETTE, and the PO's recette of
 * 2026-09-15 is what made that non-negotiable: « les pictogrammes de la légende
 * ne sont pas correctement importés, il n'y a que des rectangles pour class et
 * actors alors qu'ils ont des pictos bien particuliers ». A key of identical
 * white chips documents nothing at all in a notation whose whole vocabulary is
 * pictures — a class is a divided box, an actor a stick figure, a use case an
 * ellipse, a package a tabbed folder, an aggregation a hollow diamond.
 *
 * ## So every row draws the artefact itself
 *
 * A node row is a `glyph` swatch carrying {@link umlNodeProps} — the SAME preset
 * the toolbox creates the artefact with, minus its role and its box — so the
 * picture in the legend is painted by `UmlNodeRendererExtension` from the same
 * declaration as the picture on the sheet. Nothing here draws a second copy of
 * the notation, which is the rule this pack has followed since `background.ts`:
 * a legend that redrew its own classes would be a second opinion about them, and
 * it would drift the first time somebody touched a glyph.
 *
 * A relation row is an `edge` swatch carrying its own line from
 * {@link UML_EDGE_STYLE} — the one table the toolbox and the morph already
 * share — so a hollow diamond, a hollow triangle, a filled head and a broken
 * line are drawn by the connector renderer at swatch size rather than
 * approximated by a bar.
 *
 * The aspect of each glyph is the artefact's own footprint
 * ({@link UML_NODE_BOX}), fitted inside the swatch box: an actor is drawn
 * portrait, a class landscape, a fork as the bar §15.3.4 draws.
 *
 * ## The one thing a swatch must NOT carry
 *
 * A role. The legend is drawn ON the frame it documents and the scan is by role
 * (`rolesInBound`), so a swatch stamped with one would list ITSELF the next time
 * a legend was generated — a class row conjured by the class row before it.
 * {@link nodeRow} strips it, deliberately and in one place.
 *
 * ## `exact` on the association and on the node, and nowhere else
 *
 * `uml:aggregation` and `uml:composition` specialise `uml:association`
 * (`roles.ts`), so an inclusive entry on the parent would put an "Association"
 * row — a plain undecorated line — on a board carrying nothing but diamonds. The
 * row would name a line that is nowhere on the diagram. `exact` makes the base
 * and its two specialisations three separate statements, each listed when it is
 * the thing the author actually drew.
 *
 * `uml:node` is the second and last, for the same sentence one clause later:
 * §19.4.4 makes a Device and an ExecutionEnvironment kinds of Node, and a
 * deployment sheet of keyworded cubes would otherwise carry a bare "Node" row
 * naming a box nobody drew.
 *
 * The other chains need no such care, because none of their parents gets a row
 * at all: `uml:classifier`, `uml:control-node`, `uml:pseudostate` and
 * `uml:message` are ancestors nothing is ever drawn as, and a "Classifier" or a
 * "Message" row would name a shape that exists only in the vocabulary.
 *
 * ## The frame gets no row either
 *
 * `uml:diagram` is the sheet the legend is drawn ON. Listing it would be listing
 * the paper — the same call the C4 board's legend makes about itself.
 */

/* ── The three kinds of row ────────────────────────────────────────────── */

/**
 * A node row: the artefact itself, drawn at swatch size by its own renderer.
 *
 * `role` and `xywh` are dropped from the preset and for two different reasons.
 * The BOX is the legend's to decide — the layout fits the aspect below inside
 * the swatch column — and the ROLE must not be on a swatch at all, or the
 * legend starts documenting itself (see the note above).
 */
function nodeRow(kind: UmlNodeKind): LegendRow {
  const {
    role: _role,
    xywh: _xywh,
    ...props
  } = umlNodeProps(kind, {
    xywh: '[0,0,0,0]',
  });
  const box = UML_NODE_BOX[kind];
  return {
    swatch: 'glyph',
    // Read by nothing for a glyph row — the element carries its own fill and
    // stroke — and written all the same, because `LegendRow` asks for a colour
    // and a row that lied about which one it uses would be worse than one that
    // repeats the paper.
    color: UML_CARD,
    label: roleLabel(UML_ROLES, UML_ROLE_OF_KIND[kind]),
    props,
    aspect: box.h > 0 ? box.w / box.h : 1,
  };
}

/** One element entry, with the role the vocabulary itself binds to that kind. */
function nodeEntry(kind: UmlNodeKind, exact = false): AutoLegendEntry {
  return {
    role: UML_ROLE_OF_KIND[kind],
    row: nodeRow(kind),
    ...(exact ? { exact } : {}),
  };
}

/**
 * A relation row: the line the toolbox actually arms, endpoints and all.
 *
 * `dashed` is kept beside the props although the connector already carries its
 * own `strokeStyle`: it is the one fact about a relation row a pure test can
 * read without a renderer, and it is DERIVED from the same table rather than
 * restated, so the two can never disagree.
 */
function edgeRow(role: UmlEdgeRole): LegendRow {
  const style = UML_EDGE_STYLE[role];
  return {
    swatch: 'edge',
    color: UML_INK,
    label: roleLabel(UML_ROLES, UML_ROLE[role]),
    dashed: style.strokeStyle === StrokeStyle.Dash,
    props: { ...style },
  };
}

function edgeEntry(role: UmlEdgeRole, exact = false): AutoLegendEntry {
  return {
    role: UML_ROLE[role],
    row: edgeRow(role),
    ...(exact ? { exact } : {}),
  };
}

/**
 * A frame row: a hollow rectangle in the frame ink.
 *
 * None of the four has a body — a subject, a swimlane, a composite state and a
 * combined fragment are each a rectangle drawn ROUND part of the drawing — so
 * the swatch is an OUTLINE and never a filled chip, which is the same statement
 * the `line` swatch used to make and a better picture of it.
 */
function frameRow(role: RoleId, radius = 0): LegendRow {
  return {
    swatch: 'glyph',
    color: UML_FRAME_INK,
    label: roleLabel(UML_ROLES, role),
    props: {
      type: 'shape',
      shapeType: 'rect',
      filled: false,
      fillColor: UML_CARD,
      strokeColor: UML_FRAME_INK,
      strokeWidth: UML_NODE_STROKE_WIDTH,
      strokeStyle: StrokeStyle.Solid,
      roughness: 0,
      radius,
    },
    // The sheets are drawn wider than they are tall, and the swatch says so.
    aspect: 1.5,
  };
}

/* ── The table ─────────────────────────────────────────────────────────── */

/**
 * Every node kind that gets a row, in the order the pack grew.
 *
 * The list is the ELEMENTS section, and it is written as kinds rather than as
 * roles because a kind is what a picture needs: `UML_ROLE_OF_KIND` binds each to
 * the role the scan matches on, so the two halves cannot drift.
 *
 *  - phase 1, the class and use case families;
 *  - phase 2, the structural artefacts (§11.6.4, §11.3.4, §10.4.4), the
 *    deployment targets (§19.3.4, §19.4.4), the activity vocabulary (§15.3.4,
 *    §15.4.4, §16.3.4) and the state machine's (§14.2.4);
 *  - phase 3, the three marks a sequence diagram is drawn out of.
 */
const ELEMENT_KINDS: readonly UmlNodeKind[] = [
  'class',
  'interface',
  'enumeration',
  'object',
  'package',
  'note',
  'actor',
  'use-case',
  'component',
  'port',
  'provided-interface',
  'required-interface',
  'artifact',
  'node',
  'device',
  'execution-environment',
  'action',
  'initial',
  'activity-final',
  'flow-final',
  'decision',
  'fork',
  'object-node',
  'send-signal',
  'accept-event',
  'time-event',
  'state',
  'final-state',
  'choice',
  'junction',
  'shallow-history',
  'deep-history',
  'entry-point',
  'exit-point',
  'terminate',
  'lifeline',
  'execution',
  'destruction',
];

/** The relations, in the order `edge-styles.ts` grew them. */
const RELATION_ROLES: readonly UmlEdgeRole[] = [
  'association',
  'aggregation',
  'composition',
  'generalization',
  'realization',
  'dependency',
  'anchor',
  'include',
  'extend',
  'deploy',
  'manifest',
  'communication-path',
  'control-flow',
  'object-flow',
  'transition',
  'message-sync',
  'message-async',
  'message-reply',
  'message-create',
  'message-delete',
];

export const UML_AUTO_LEGEND: AutoLegendSpec = {
  title: 'Legend',
  width: 300,
  // A picture needs room a colour chip does not: 34 × 24 is enough for a class
  // to show its two compartment rules and for an actor to show a head, arms and
  // legs, and 34 is the pitch that leaves them breathing space between rows.
  rowHeight: 34,
  swatchWidth: 34,
  swatchHeight: 24,
  roles: UML_ROLES,
  sections: [
    {
      title: 'Elements',
      entries: ELEMENT_KINDS.map(kind => nodeEntry(kind, kind === 'node')),
    },
    {
      title: 'Frames',
      entries: [
        { role: UML_ROLE.subject, row: frameRow(UML_ROLE.subject) },
        { role: UML_ROLE.partition, row: frameRow(UML_ROLE.partition) },
        // §14.2.4 draws a composite state with rounded corners, like the state
        // it is one of — the one frame whose outline is not square.
        { role: UML_ROLE.region, row: frameRow(UML_ROLE.region, 4) },
        { role: UML_ROLE.fragment, row: frameRow(UML_ROLE.fragment) },
      ],
    },
    {
      title: 'Relations',
      entries: RELATION_ROLES.map(role =>
        edgeEntry(role, role === 'association')
      ),
    },
  ],
};
