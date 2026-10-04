import { svgFrameOf } from '@labre/affine-block-surface';

import type { OwmPlot } from './export.js';
import type { WardleyNodeKeyword } from './import.js';
import {
  type DrawnWardleyMap,
  type DrawnWardleyNode,
  finiteAttr,
  idIndex,
  originOf,
  textOf,
} from './svg-read.js';
import { WARDLEY_SVG_IMPORT_REMARKS } from './svg-remarks.js';

/**
 * An OnlineWardleyMaps "Export SVG", recognised (ADR 0032 §4.3).
 *
 * Read against the export the tool actually writes (`MapEnvironment.tsx`
 * `downloadMapAsSVG`, and the corpus files rendered from its own components),
 * which is NOT quite what its source suggests at a glance:
 *
 * - every artefact is a `modern_movable_element_<id>` group translated to its
 *   centre, holding an `element_circle_<id>` (a component), an
 *   `element_square_<id>` (a component inside a pipeline), and for a market
 *   or an ecosystem a `market_circle_<id>` / `ecosystem_circle_<id>` on top;
 *   its name is the `<id>-text` text, drawn in a sibling group;
 * - `<id>` is the component's line in the DSL, so it is a number — but it is
 *   read as an opaque string, whatever a hostile file puts there;
 * - an anchor is a `modern_movable_anchor__<id>_` group with its name inside;
 * - a link is `modern_link_<from>_<to>`, drawn TWICE when one end is an anchor
 *   (once among the links, once among the anchor links);
 * - an evolved twin is the `<id>_evolved` artefact, its arrow
 *   `modern_evolving_link_<id>_<id>_evolved`;
 * - inertia is a `line.inertia-symbol`; a pipeline is `pipeline_box_<line>`
 *   with its two ends `modern_movable_pipeline_x1_<line>` / `x2_`, under the
 *   component whose square sits on its top edge;
 * - a note is `modern_movable_modern_note_<line>` around
 *   `modern_note_text_<line>`; a climate arrow is
 *   `modern_movable_accelerator_element_<line>`, turned by `rotate(180…)` when
 *   it is a decelerator, and drawn with NO name;
 * - the plot is `rect#fillArea`, the title `text#mapTitle`.
 *
 * Methods (`method_<id>`), annotations and the PST boxes have no native
 * artefact here and are left to the sketch, as is anything a person added.
 *
 * ## Certain, with or without the plot
 *
 * ADR 0032 §4 names `fillArea` plus one element marker as certain, and §5 then
 * reads an OWM file "whose `fillArea` was stripped" as certain too. Both hold
 * here: certainty comes from an element marker INSIDE OWM's own movable
 * wrapper — two structures only this tool writes together — and `fillArea`
 * decides whether the plot is read or estimated.
 */

const MOVABLE_ELEMENT = 'modern_movable_element_';
const MOVABLE_ANCHOR = /^modern_movable_anchor__(.*)_$/;
const MOVABLE_ACCELERATOR = 'modern_movable_accelerator_element_';
const MOVABLE_NOTE = 'modern_movable_modern_note_';
const PIPELINE_BOX = 'pipeline_box_';
const LINK = 'modern_link_';
const EVOLVING_LINK = 'modern_evolving_link_';
const EVOLVED = '_evolved';

/** The chrome every export carries, drawn by the native board instead. */
const CHROME_IDS = ['grid', 'fillArea', 'valueChain', 'Evolution', 'mapTitle'];

/** How far a pipeline's owner may sit from the box's top edge, in file units. */
const PIPELINE_OWNER_REACH = 15;

const after = (id: string, prefix: string) =>
  id.startsWith(prefix) ? id.slice(prefix.length) : undefined;

export function recogniseOnlineWardleyMaps(
  root: Element
): DrawnWardleyMap | undefined {
  const ids = idIndex(root);

  /* Certain: an OWM element marker inside OWM's own movable wrapper. */
  const certain = [...ids.keys()].some(id => {
    const own = after(id, MOVABLE_ELEMENT);
    return (
      own !== undefined &&
      [
        'element_circle_',
        'element_square_',
        'market_circle_',
        'ecosystem_circle_',
      ]
        .map(prefix => ids.get(`${prefix}${own}`))
        .some(marker => marker !== undefined && ids.get(id)!.contains(marker))
    );
  });
  if (!certain) return undefined;

  const drawn: DrawnWardleyMap = {
    producer: 'OnlineWardleyMaps SVG',
    nodes: [],
    pipelines: [],
    evolutions: [],
    links: [],
    notes: [],
    inertias: [],
    consumed: new Set(),
    remarks: [],
  };
  const consume = (element: Element | undefined) => {
    if (element) drawn.consumed.add(element);
  };
  const unreadable = (sourceId: string) => {
    drawn.remarks.push({
      kind: 'warning',
      sourceId,
      message: WARDLEY_SVG_IMPORT_REMARKS.unreadableCoordinates[1],
      messageKey: WARDLEY_SVG_IMPORT_REMARKS.unreadableCoordinates[0],
    });
  };

  /* The plot, in the coordinates of its parent group. */
  const fillArea = ids.get('fillArea');
  if (fillArea) {
    const frame = svgFrameOf(fillArea);
    const [x, y, w, h] = ['x', 'y', 'width', 'height'].map(name =>
      finiteAttr(fillArea, name)
    );
    if (w !== undefined && h !== undefined && w > 0 && h > 0) {
      const plot: OwmPlot = {
        x0: frame.ox + (x ?? 0) * frame.s,
        y0: frame.oy + (y ?? 0) * frame.s,
        width: w * frame.s,
        height: h * frame.s,
      };
      drawn.plot = plot;
    }
  }

  const title = textOf(ids.get('mapTitle'));
  if (title.length > 0) drawn.title = title;

  /* The chrome: drawn again by the native board, so never sketched. */
  for (const id of CHROME_IDS) consume(ids.get(id));
  // The pan-and-zoom canvas's own backdrops: the plain rects beside the
  // plot's ancestors, between it and the root (never the root's own children,
  // which is where anything somebody added to the file lands).
  for (
    let at = fillArea?.parentElement;
    at && at !== root && at.parentElement !== root;
    at = at.parentElement
  ) {
    for (const sibling of Array.from(at.parentElement?.children ?? [])) {
      if (sibling.localName === 'rect' && !sibling.hasAttribute('id')) {
        consume(sibling);
      }
    }
  }
  // Hover animations and gradient definitions draw nothing by themselves.
  for (const element of Array.from(root.querySelectorAll('defs, style'))) {
    consume(element);
  }

  /* The artefacts. */
  const byId = new Map<string, DrawnWardleyNode>();
  const twins: { of: string; group: Element }[] = [];
  for (const [id, group] of ids) {
    const own = after(id, MOVABLE_ELEMENT);
    if (own === undefined) continue;
    if (own.endsWith(EVOLVED)) {
      twins.push({ of: own.slice(0, -EVOLVED.length), group });
      continue;
    }
    const kind: WardleyNodeKeyword | undefined = ids.has(`market_circle_${own}`)
      ? 'market'
      : ids.has(`ecosystem_circle_${own}`)
        ? 'ecosystem'
        : ids.has(`element_circle_${own}`) || ids.has(`element_square_${own}`)
          ? 'component'
          : undefined;
    if (kind === undefined) continue;
    const at = originOf(group);
    if (!at) {
      unreadable(own);
      continue;
    }
    const label = ids.get(`${own}-text`);
    const node = { id: own, kind, name: textOf(label), x: at[0], y: at[1] };
    byId.set(own, node);
    drawn.nodes.push(node);
    consume(group);
    consume(ids.get(`modern_movable_${own}-text-movable`));
  }

  for (const [id, group] of ids) {
    const own = MOVABLE_ANCHOR.exec(id)?.[1];
    if (own === undefined) continue;
    const at = originOf(group);
    if (!at) {
      unreadable(own);
      continue;
    }
    const node: DrawnWardleyNode = {
      id: own,
      kind: 'anchor',
      name: textOf(ids.get(`${own}-text`)),
      x: at[0],
      y: at[1],
    };
    byId.set(own, node);
    drawn.nodes.push(node);
    consume(group);
  }

  for (const [id, group] of ids) {
    const own = after(id, MOVABLE_ACCELERATOR);
    if (own === undefined) continue;
    const at = originOf(group);
    if (!at) {
      unreadable(own);
      continue;
    }
    const arrow = ids.get(`accelerator_circle_${own}`);
    const turned = /rotate\(\s*180/.test(
      arrow?.getAttribute('transform') ?? ''
    );
    drawn.nodes.push({
      id: `accelerator ${own}`,
      kind: turned ? 'deaccelerator' : 'accelerator',
      name: '',
      x: at[0],
      y: at[1],
    });
    consume(group);
  }

  for (const { of, group } of twins) {
    const base = byId.get(of);
    const at = originOf(group);
    if (!base || !at) {
      if (!at) unreadable(`${of}${EVOLVED}`);
      continue;
    }
    drawn.evolutions.push({
      of,
      name: textOf(ids.get(`${of}${EVOLVED}-text`)) || base.name,
      x: at[0],
    });
    consume(group);
    consume(ids.get(`modern_movable_${of}${EVOLVED}-text-movable`));
    consume(ids.get(`${EVOLVING_LINK}${of}_${of}${EVOLVED}`));
  }

  /* Links, bound by the two ids in their own id. */
  const known = (end: string) =>
    byId.has(end)
      ? end
      : end.endsWith(EVOLVED) && byId.has(end.slice(0, -EVOLVED.length))
        ? end.slice(0, -EVOLVED.length)
        : undefined;
  const linked = new Set<string>();
  for (const element of Array.from(root.querySelectorAll('[id]'))) {
    const rest = after(element.getAttribute('id') ?? '', LINK);
    if (rest === undefined) continue;
    let ends: [string, string] | undefined;
    for (let at = rest.indexOf('_'); at >= 0; at = rest.indexOf('_', at + 1)) {
      const from = known(rest.slice(0, at));
      const to = known(rest.slice(at + 1));
      if (from !== undefined && to !== undefined) {
        ends = [from, to];
        break;
      }
    }
    if (!ends) {
      drawn.remarks.push({
        kind: 'warning',
        sourceId: rest,
        element: 'link',
        message: WARDLEY_SVG_IMPORT_REMARKS.danglingLink[1],
        messageKey: WARDLEY_SVG_IMPORT_REMARKS.danglingLink[0],
      });
      continue;
    }
    consume(element);
    // Drawn twice when an end is an anchor; one dependency all the same.
    const key = JSON.stringify(ends);
    if (linked.has(key)) continue;
    linked.add(key);
    drawn.links.push({ from: ends[0], to: ends[1] });
  }

  /* Inertia. */
  for (const line of Array.from(root.querySelectorAll('line.inertia-symbol'))) {
    const [x1, y1, x2, y2] = ['x1', 'y1', 'x2', 'y2'].map(name =>
      finiteAttr(line, name)
    );
    if ([x1, y1, x2, y2].some(value => value === undefined)) {
      unreadable('inertia');
      continue;
    }
    const frame = svgFrameOf(line);
    drawn.inertias.push({
      x: frame.ox + ((x1! + x2!) / 2) * frame.s,
      y: frame.oy + ((y1! + y2!) / 2) * frame.s,
    });
    consume(line);
  }

  /* Pipelines, hung under the component sitting on their top edge. */
  for (const [id, box] of ids) {
    const own = after(id, PIPELINE_BOX);
    if (own === undefined) continue;
    const top = originOf(box);
    const left = originOf(ids.get(`modern_movable_pipeline_x1_${own}`) ?? box);
    const right = ids.get(`modern_movable_pipeline_x2_${own}`);
    const end = right ? originOf(right) : undefined;
    if (!top || !left || !end) {
      unreadable(id);
      continue;
    }
    const owner = drawn.nodes
      .filter(
        node =>
          node.kind === 'component' &&
          Math.abs(node.y - top[1]) <= PIPELINE_OWNER_REACH &&
          node.x >= Math.min(left[0], end[0]) - PIPELINE_OWNER_REACH &&
          node.x <= Math.max(left[0], end[0]) + PIPELINE_OWNER_REACH
      )
      .sort((a, b) => Math.abs(a.y - top[1]) - Math.abs(b.y - top[1]))[0];
    if (!owner) continue;
    drawn.pipelines.push({ of: owner.id, x1: left[0], x2: end[0] });
    consume(box);
    consume(ids.get(`modern_movable_pipeline_x1_${own}`));
    consume(right);
  }

  /* Notes. */
  for (const [id, group] of ids) {
    const own = after(id, MOVABLE_NOTE);
    if (own === undefined) continue;
    const at = originOf(group);
    if (!at) {
      unreadable(id);
      continue;
    }
    const text = textOf(ids.get(`modern_note_text_${own}`) ?? group);
    if (text.length === 0) continue;
    drawn.notes.push({ text, x: at[0], y: at[1] });
    consume(group);
  }

  return drawn;
}
