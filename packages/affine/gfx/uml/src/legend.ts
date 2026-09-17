import { StrokeStyle, type UmlNodeKind } from '@labre/affine-model';
import type { ChromeWording } from '@labre/affine-shared/services';
import type { CommandLegendEntry, CommandLegendRow } from '@labre/std';
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
import { UML_ROLE, UML_ROLE_OF_KIND } from './roles.js';

/**
 * What the UML diagram frame's automatic legend can say — not a table, but the
 * ROW each of the toolbox's own commands subscribes (`docs/adr/0026`).
 * `commands.ts` calls {@link umlLegendEntry} once per entry and the surface
 * block's engine does the rest: the scan, the order, the sections, the
 * placement and the box.
 *
 * Every row's WORDING is the role vocabulary's own and is nowhere in here, so
 * renaming a role renames its legend row — which is what keeps a legend a
 * description of the board rather than a second opinion about it.
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
 * {@link nodeRow} strips it, deliberately and in one place, and the drawing side
 * strips it again for anything that slipped through.
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
 * ## What subscribes nothing, and why
 *
 * `uml.addDiagram` — `uml:diagram` is the sheet the legend is drawn ON, and
 * listing it would be listing the paper. It declares the BOX instead
 * (`CommandDescriptor.legendBox`).
 *
 * `uml.addInteractionUse` — it draws the very same combined fragment with `ref`
 * in its tag (§17.7.4) and therefore stamps `uml:fragment`, which the fragment's
 * own row already covers. A second row would name one frame twice.
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
function nodeRow(kind: UmlNodeKind): CommandLegendRow {
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
    // stroke — and written all the same, because `CommandLegendRow` asks for a
    // colour and a row that lied about which one it uses would be worse than
    // one that repeats the paper.
    color: UML_CARD,
    props,
    aspect: box.h > 0 ? box.w / box.h : 1,
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
function edgeRow(role: UmlEdgeRole): CommandLegendRow {
  const style = UML_EDGE_STYLE[role];
  return {
    swatch: 'edge',
    color: UML_INK,
    dashed: style.strokeStyle === StrokeStyle.Dash,
    props: { ...style },
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
function frameRow(radius: number): CommandLegendRow {
  return {
    swatch: 'glyph',
    color: UML_FRAME_INK,
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

/* ── The three sections ────────────────────────────────────────────────── */

/**
 * This legend's own three section titles.
 *
 * Declared here beside the rows they head, and keyed per FRAMEWORK rather than
 * shared with C4's identical three: a framework never imports another's wording
 * (`translation-service/README.md`), so "Elements" is UML's own word about UML's
 * own vocabulary, and a host is free to word it differently on a class diagram
 * than on a context diagram.
 *
 * They are DECLARED rather than left to the commands' `category`, which since
 * 2026-09-16 files the catalogue by DIAGRAM KIND: nine headers from "Class
 * diagram" to "Sequence diagram" would tell a reader which toolbox drawer a
 * gesture lives in, not whether the thing on the sheet is a shape, a frame or a
 * line. The box's own title is the one exception — every board that has a legend
 * says the same generic "Legend", and reuses `BOARD_LEGEND_TITLE` for it.
 */
const SECTION_ELEMENTS: ChromeWording = [
  'com.labre.uml.legend.section.elements',
  'Elements',
];
const SECTION_FRAMES: ChromeWording = [
  'com.labre.uml.legend.section.frames',
  'Frames',
];
const SECTION_RELATIONS: ChromeWording = [
  'com.labre.uml.legend.section.relations',
  'Relations',
];

/** Every section `titleKey` above, for `translations.ts`'s manifest. */
export const UML_LEGEND_SECTION_WORDINGS: readonly ChromeWording[] = [
  SECTION_ELEMENTS,
  SECTION_FRAMES,
  SECTION_RELATIONS,
];

/**
 * The four frames that get a row, with the corner §14.2.4 draws them with: a
 * composite state is rounded like the state it is one of, and it is the one
 * frame whose outline is not square.
 *
 * `interaction-use` is deliberately absent — see the header.
 */
const FRAME_ROWS: Readonly<Record<string, { role: RoleId; radius: number }>> = {
  subject: { role: UML_ROLE.subject, radius: 0 },
  partition: { role: UML_ROLE.partition, radius: 0 },
  region: { role: UML_ROLE.region, radius: 4 },
  fragment: { role: UML_ROLE.fragment, radius: 0 },
};

/**
 * The legend row a toolbox entry subscribes, read off the `element` value it
 * already declares for telemetry (`node:class`, `connector:association`,
 * `boundary:region`) — so the row and the gesture cannot drift, and a kind
 * added to the pack gets its row on the day its command lands.
 *
 * `undefined` for an entry that owes none: the frame itself, and the
 * interaction use whose role another row already covers.
 *
 * The box's layout is the board command's to declare, not this function's: see
 * {@link UML_LEGEND_BOX}.
 */
export function umlLegendEntry(
  element: string
): CommandLegendEntry | undefined {
  const [type, name] = element.split(':');
  if (type === 'node' && name in UML_ROLE_OF_KIND) {
    const kind = name as UmlNodeKind;
    return {
      role: UML_ROLE_OF_KIND[kind],
      row: nodeRow(kind),
      ...(kind === 'node' ? { exact: true } : {}),
      section: SECTION_ELEMENTS,
    };
  }
  if (type === 'connector' && name in UML_EDGE_STYLE) {
    const role = name as UmlEdgeRole;
    return {
      role: UML_ROLE[role],
      row: edgeRow(role),
      ...(role === 'association' ? { exact: true } : {}),
      section: SECTION_RELATIONS,
    };
  }
  const frame = type === 'boundary' ? FRAME_ROWS[name] : undefined;
  return frame
    ? { role: frame.role, row: frameRow(frame.radius), section: SECTION_FRAMES }
    : undefined;
}

/**
 * The BOX, declared once on the command that puts the frame down.
 *
 * A picture needs room a colour chip does not: 34 × 24 is enough for a class to
 * show its two compartment rules and for an actor to show a head, arms and legs,
 * and 34 is the pitch that leaves them breathing space between rows.
 */
export const UML_LEGEND_BOX = {
  width: 300,
  rowHeight: 34,
  swatchWidth: 34,
  swatchHeight: 24,
} as const;
