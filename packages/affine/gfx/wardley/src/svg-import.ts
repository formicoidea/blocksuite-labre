import type {
  InterchangeImportContext,
  InterchangeImportResult,
  InterchangeNote,
  SerializedElementProps,
  SvgSketchFrame,
} from '@labre/affine-block-surface';
import {
  sanitizeSvg,
  sketchSvgTree,
  SvgSketchNotebook,
} from '@labre/affine-block-surface';
import { FontFamily, TextAlign } from '@labre/affine-model';
import { fillPlaceholders } from '@labre/affine-shared/services';

import {
  OWM_DEFAULT_MAP_WIDTH,
  owmCoordsOf,
  owmDefaultPlot,
  type OwmPlot,
  WARDLEY_OWM_FORMAT_ID,
} from './export.js';
import { layoutWardleyStatements, type WardleyStatements } from './import.js';
import { NODE_STROKE } from './node/consts.js';
import type { DrawnWardleyMap } from './svg-read.js';
import { recogniseOnlineWardleyMaps } from './svg-recognise-owm.js';
import { recogniseWardleyMapRenderer } from './svg-recognise-renderer.js';
import { WARDLEY_SVG_IMPORT_REMARKS } from './svg-remarks.js';

/**
 * **A Wardley SVG, read as the map it is a picture of** (ADR 0032).
 *
 * ## The heuristics statement, and its known failure modes
 *
 * _ADR 0012's open question 2, answered for Wardley beside the parser that
 * makes the guesses. What reaches the shared sketch walk is covered by that
 * walk's own statement (`blocks/surface/src/extensions/svg-sketch.ts`); this
 * one covers what is CLAIMED before it._
 *
 * **What it guesses, and from what.** Roles, relations and coordinates — and
 * only when it can say where they came from. A producer is detected by a
 * structural marker on the sanitised tree, never by searching the text, in a
 * fixed order that stops at the first certain match: wardley-map-renderer
 * (its `axes` and `nodes` layers, `svg-recognise-renderer.ts`), then
 * OnlineWardleyMaps (an element marker inside its own movable wrapper,
 * `svg-recognise-owm.ts`). A recogniser reads the producer's components,
 * anchors, markets, ecosystems, climate arrows, pipelines, evolved twins,
 * inertia bars, notes, dependencies and title, and the PLOT they sit on;
 * `[visibility, evolution]` is then read off that plot (`owmCoordsOf`) and
 * laid on a new native board at the reference size with the OWM importer's own
 * layout (`layoutWardleyStatements`), so a map that arrives as a picture and
 * one that arrives as `.owm` text are the same elements.
 *
 * **Where it is known to be wrong.** A name is what the producer DREW: a
 * truncated or wrapped label arrives truncated or joined. A producer certain
 * but plot-less file (its `fillArea` stripped) is laid out over the extent of
 * its own components, and the report says those coordinates were ESTIMATED
 * (`invented-layout`). OnlineWardleyMaps draws a climate arrow with no name, so
 * one arrives unnamed. The renderer's dependencies name no node — their
 * `data-id` is the relation's own — so their ends are bound by geometry in
 * both modes, each within its node's reach; its static output carries no id
 * at all, so a name is the label drawn nearest its node, closest pairs first,
 * and two nodes crowded closer than their labels can swap names. The renderer
 * draws no evolved twin, so the twin takes the moving node's name. Methods,
 * annotations, PST boxes, steps and flow labels have no native
 * artefact and arrive as a sketch. The title is drawn as a free text above the
 * board, because a board stores no title of its own. Nothing of the source
 * tool's MODEL beyond the drawing survives: the OWM DSL stays the reference
 * Wardley import.
 *
 * **Everything else is the sketch's.** What the recogniser did not consume —
 * a logo, a hand-drawn remark, an artefact it has no sentence for — is read by
 * the shared walk exactly as before, placed so that the file's plot lands on
 * the board's plot (a uniform scale, centred), in the SAME result: one import,
 * one undo step. The report counts it in one `warning`.
 *
 * ## Still the visual tier
 *
 * No `interchange` payload on any element, `carried` and `quarantined` always
 * `0`, no round-trip promised (ADR 0012 P2, which ADR 0032 §1 keeps). The OWM
 * layout attaches `interchange.owm` to the elements a later statement refers
 * to; here that identity becomes a provisional local `id` the materializer
 * replaces with a nanoid, and the payload is dropped.
 *
 * ## Ids are ids
 *
 * A producer's id, forged or not, is only ever a provisional local name and a
 * `Map` key (`svg-read.ts`); a name is the text the sanitised tree holds; a
 * coordinate that is not a finite number sends its element to the sketch with
 * a remark. Nothing is evaluated: the sanitiser has already removed what could
 * run, and this reads attributes and text content only.
 *
 * Pure, like every reader (P3): exported from the package index, so
 * labre-mcp calls the same function the command does.
 */

/** Detection order (ADR 0032 §4): the first certain match wins. */
const RECOGNISERS: readonly ((root: Element) => DrawnWardleyMap | undefined)[] =
  [recogniseWardleyMapRenderer, recogniseOnlineWardleyMaps];

export function importWardleySvg(
  source: string,
  context: InterchangeImportContext = {}
): InterchangeImportResult {
  // What a board is called is the document's business; the map's own title,
  // when the picture drew one, is drawn back as a text.
  void context;

  const notebook = new SvgSketchNotebook();
  const root = sanitizeSvg(source, notebook);

  let drawn: DrawnWardleyMap | undefined;
  for (const recognise of RECOGNISERS) {
    drawn = recognise(root);
    if (drawn) break;
  }

  if (!drawn) return sketchOnly(root, notebook);
  return mapAndSketch(root, notebook, drawn);
}

/** Nothing recognised: today's sketch, word for word. */
function sketchOnly(
  root: Element,
  notebook: SvgSketchNotebook
): InterchangeImportResult {
  const elements = sketchSvgTree(root, notebook);
  return {
    elements,
    report: {
      mapped: elements.length,
      carried: 0,
      quarantined: 0,
      notes: notebook.notes,
    },
  };
}

/** The extent of what was drawn, standing in for a plot the file lost. */
function extentPlot(drawn: DrawnWardleyMap): OwmPlot {
  const xs = [
    ...drawn.nodes.map(node => node.x),
    ...drawn.notes.map(note => note.x),
  ];
  const ys = [
    ...drawn.nodes.map(node => node.y),
    ...drawn.notes.map(note => note.y),
  ];
  if (xs.length === 0) return { x0: 0, y0: 0, width: 1, height: 1 };
  const x0 = Math.min(...xs);
  const y0 = Math.min(...ys);
  return {
    x0,
    y0,
    width: Math.max(Math.max(...xs) - x0, 1),
    height: Math.max(Math.max(...ys) - y0, 1),
  };
}

/**
 * The frame that lands the file's plot on the board's: one uniform scale (a
 * sketch has no independent axes), centred — the default
 * `preserveAspectRatio` of the format itself.
 */
function placeOnBoard(file: OwmPlot, board: OwmPlot): SvgSketchFrame {
  const s = Math.min(board.width / file.width, board.height / file.height);
  return {
    s,
    ox: board.x0 + board.width / 2 - s * (file.x0 + file.width / 2),
    oy: board.y0 + board.height / 2 - s * (file.y0 + file.height / 2),
  };
}

function mapAndSketch(
  root: Element,
  notebook: SvgSketchNotebook,
  drawn: DrawnWardleyMap
): InterchangeImportResult {
  const notes: InterchangeNote[] = [...drawn.remarks];
  const plot = drawn.plot ?? extentPlot(drawn);
  if (!drawn.plot) {
    notes.push({
      kind: 'invented-layout',
      element: 'map',
      message: WARDLEY_SVG_IMPORT_REMARKS.inventedPlot[1],
      messageKey: WARDLEY_SVG_IMPORT_REMARKS.inventedPlot[0],
    });
  }
  const at = (x: number, y: number) => owmCoordsOf(plot, x, y);

  const byId = new Map(drawn.nodes.map(node => [node.id, node]));
  const statements: WardleyStatements = {
    nodes: drawn.nodes.map(node => ({
      keyword: node.kind,
      name: node.name,
      id: node.id,
      ...at(node.x, node.y),
      tail: '',
      invented: false,
    })),
    pipelines: drawn.pipelines.flatMap(pipeline => {
      if (!('of' in pipeline)) {
        return [
          {
            name: pipeline.name,
            id: pipeline.id,
            from: at(pipeline.x1, pipeline.top).evolution,
            to: at(pipeline.x2, pipeline.top).evolution,
            top: at(pipeline.x1, pipeline.top).visibility,
            tail: '',
            invented: false,
          },
        ];
      }
      const owner = byId.get(pipeline.of);
      if (!owner) return [];
      return [
        {
          name: owner.name,
          id: owner.id,
          from: at(pipeline.x1, owner.y).evolution,
          to: at(pipeline.x2, owner.y).evolution,
          tail: '',
          invented: false,
        },
      ];
    }),
    notes: drawn.notes.map(note => ({
      text: note.text,
      ...at(note.x, note.y),
      tail: '',
      invented: false,
    })),
    evolutions: drawn.evolutions.flatMap(evolution => {
      const owner = byId.get(evolution.of);
      if (!owner) return [];
      return [
        {
          name: owner.name,
          id: owner.id,
          becomes: evolution.name,
          evolution: at(evolution.x, owner.y).evolution,
          tail: '',
          invented: false,
        },
      ];
    }),
    links: drawn.links,
    inertias: drawn.inertias.map(inertia => at(inertia.x, inertia.y)),
  };

  const native = layoutWardleyStatements(statements, {
    onInvented: (element, name, why, whyKey) =>
      notes.push({
        kind: 'invented-layout',
        sourceId: name,
        element,
        message: why,
        ...(whyKey ? { messageKey: whyKey } : {}),
      }),
  }).map(provisional);

  if (drawn.title) native.push(titleProps(drawn.title));

  const board = owmDefaultPlot();
  const sketch = sketchSvgTree(root, notebook, {
    skip: drawn.consumed,
    place: placeOnBoard(plot, board),
  });
  if (sketch.length > 0) {
    notes.push({
      kind: 'warning',
      message: fillPlaceholders(
        WARDLEY_SVG_IMPORT_REMARKS.sketchedRemainder[1],
        {
          count: sketch.length,
        }
      ),
      messageKey: WARDLEY_SVG_IMPORT_REMARKS.sketchedRemainder[0],
      messageParams: { count: sketch.length },
    });
  }

  const elements = [...native, ...sketch];
  return {
    elements,
    report: {
      mapped: elements.length,
      carried: 0,
      quarantined: 0,
      notes: [...notes, ...notebook.notes],
      sourceVersion: drawn.producer,
    },
  };
}

/**
 * One laid-out element with its OWM identity turned into a provisional local
 * id, and the payload gone: the identity wires the connectors
 * (`materializeInterchangeImport`), and a picture carries nothing to round-trip.
 */
function provisional(props: SerializedElementProps): SerializedElementProps {
  const carried = props.interchange as
    | Record<string, { id?: unknown }>
    | undefined;
  if (carried === undefined) return props;
  const rest: SerializedElementProps = { ...props };
  delete rest.interchange;
  const id = carried[WARDLEY_OWM_FORMAT_ID]?.id;
  return typeof id === 'string' ? { ...rest, id } : rest;
}

/**
 * The map's title, where the shipped maps draw theirs: centred above the plot,
 * across the board (`templates/maps.ts`). A free text, because a board stores
 * no title of its own.
 */
function titleProps(text: string): SerializedElementProps {
  return {
    type: 'text',
    text,
    color: NODE_STROKE,
    fontFamily: FontFamily.Inter,
    fontSize: 28,
    textAlign: TextAlign.Center,
    xywh: `[${OWM_DEFAULT_MAP_WIDTH / 2 - 500},12,1000,40]`,
  };
}
