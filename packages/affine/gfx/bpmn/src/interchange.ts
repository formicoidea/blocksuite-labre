import type {
  InterchangeCapability,
  InterchangeExportCapability,
  InterchangeExporter,
} from '@labre/affine-block-surface';
import {
  interchangeCapabilityId,
  LEGEND_ROLE,
} from '@labre/affine-block-surface';
import {
  BpmnNodeElementModel,
  BpmnPoolElementModel,
  ConnectorElementModel,
  GroupElementModel,
  TextElementModel,
} from '@labre/affine-model';
import { fillPlaceholders } from '@labre/affine-shared/services';
import { safeFilename } from '@labre/affine-shared/utils';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { type BpmnExportBoard, exportBpmnXmlWithWarnings } from './export.js';
import { bpmnPoolOf } from './facts.js';
import {
  BPMN_SVG_IMPORT,
  BPMN_XML_EXTENSION,
  BPMN_XML_FORMAT,
  BPMN_XML_IMPORT,
  BPMN_XML_MIME,
} from './interchange-headless.js';
import { BPMN_ROLE, BPMN_ROLE_OF_KIND } from './roles.js';

export {
  BPMN_SVG_FORMAT,
  BPMN_SVG_IMPORT,
  BPMN_XML_EXTENSION,
  BPMN_XML_FORMAT,
  BPMN_XML_IMPORT,
  BPMN_XML_MIME,
} from './interchange-headless.js';

/**
 * BPMN's entries in the interchange registry (`docs/adr/0012`, P1).
 *
 * Both directions of one format, declared as two capabilities and not as one
 * symmetric thing: `.bpmn` OUT shipped in #149, `.bpmn` IN is the worked
 * example D1–D6 specifies, and each makes its own promises. The registry says
 * so in the only way it can — a row per triple.
 *
 * They share the FORMAT object, deliberately. `bpmn` is the id under which
 * foreign matter rides on an element (D2), so a reader and a writer that
 * disagreed about it would write payloads the other could not find; there is
 * one `BPMN_XML_FORMAT` and both point at it.
 *
 * Everything here is pure. Neither serializer nor parser has ever had a `std`
 * in sight, and this file adds no editor to either: it picks the artefacts the
 * writer speaks about out of a surface's elements, and hands the reader's
 * output straight back to whoever asked for it.
 */

/* ── Pure board helpers ───────────────────────────────────────────────── */

/**
 * Everything a generated legend is made of: the group the legend gesture stamps
 * with {@link LEGEND_ROLE}, and everything under it.
 *
 * A legend is drawn INSIDE the board it documents (`createBoardLegend`) and is
 * made, on purpose, of role-less shapes, texts and swatches — so without this
 * it would be reported as fourteen things the `.bpmn` left out, which is
 * exactly the surprise that warning exists to prevent. The group's ROLE is what
 * it is read by: nothing here matches a title, a framework name or a box.
 *
 * Read defensively, like every other walk over stored data in this framework:
 * the children came out of a Y.Map and are whatever a peer wrote.
 */
function legendMemberIds(
  elements: readonly GfxPrimitiveElementModel[]
): ReadonlySet<string> {
  const byId = new Map(elements.map(element => [element.id, element]));
  const members = new Set<string>();

  const walk = (element: GfxPrimitiveElementModel) => {
    if (members.has(element.id)) return;
    members.add(element.id);
    const children = (element as { childIds?: unknown }).childIds;
    if (!Array.isArray(children)) return;
    for (const id of children) {
      const child = typeof id === 'string' ? byId.get(id) : undefined;
      if (child) walk(child);
    }
  };

  for (const element of elements) {
    if (element.role === LEGEND_ROLE) walk(element);
  }
  return members;
}

/**
 * Every node's gravitating name (R38), and the elements that carried it.
 *
 * A native group holding exactly one picked node and exactly one `bpmn:label`
 * text binds the two: the text is the node's name, whatever the geometry says
 * (the palette and the importer both write that pair). GROUP membership is the
 * binding, as it is for Wardley's composites (`labelOfComposite`, `morph.ts`),
 * because a label dragged aside is still the name and a stray text that
 * happens to sit under an event is not.
 *
 * `consumed` is what the file does carry after all — the bound label, and the
 * group when it holds nothing but BPMN nodes and their labels — so the
 * left-out count does not report a name that IS written. An unbound
 * `bpmn:label` stays counted: its words are in no file.
 *
 * Direct children only, read defensively: they came out of a Y.Map.
 */
function gravitatingLabels(
  elements: readonly GfxPrimitiveElementModel[],
  picked: ReadonlySet<string>
): { labels: Map<string, string>; consumed: Set<string> } {
  const byId = new Map(elements.map(element => [element.id, element]));
  const labels = new Map<string, string>();
  const consumed = new Set<string>();
  const isLabel = (element: GfxPrimitiveElementModel | undefined) =>
    element instanceof TextElementModel && element.role === BPMN_ROLE.label;

  for (const group of elements) {
    if (!(group instanceof GroupElementModel)) continue;
    const ids: unknown = (group as { childIds?: unknown }).childIds;
    if (!Array.isArray(ids)) continue;
    const members = ids.map(id =>
      typeof id === 'string' ? byId.get(id) : undefined
    );
    const nodes = members.filter(
      (member): member is GfxPrimitiveElementModel =>
        member !== undefined && picked.has(member.id)
    );
    const texts = members.filter((member): member is TextElementModel =>
      isLabel(member)
    );
    if (nodes.length === 1 && texts.length === 1) {
      labels.set(nodes[0].id, texts[0].text?.toString() ?? '');
      consumed.add(texts[0].id);
    }
    if (
      members.length > 0 &&
      members.every(
        member => member && (picked.has(member.id) || isLabel(member))
      )
    ) {
      consumed.add(group.id);
    }
  }
  return { labels, consumed };
}

/**
 * The artefacts the exporter speaks about, picked out of a surface's elements
 * and kept in the order they were given.
 *
 * Document order matters twice and both times for the same reason: `bpmnPoolOf`
 * gives a centre inside two overlapping pools to the FIRST one, and the audit's
 * `attribute()` does the same. Sorting here would make the export disagree with
 * the badge the user can see.
 *
 * ## The filter is the ROLE, not the class
 *
 * A `BpmnNodeElementModel` is a shape with a `kind`; the ROLE is the author's
 * statement that this circle IS the start of the process (`docs/adr/0010`, and
 * C4's `isC4Node` before it). The distinction became load-bearing the day the
 * pool grew a legend: a legend swatch is a real `bpmnNode` with a real `kind`
 * and deliberately NO role, so a class-based filter would have written eighteen
 * ghost `<task>` / `<startEvent>` / `<dataObject>` elements into the
 * participant's process and broken the bpmn.io round trip the pack is for. The
 * connectors have always been filtered this way (`EDGE_ELEMENT[connector.role]`
 * in `export.ts`); this is the nodes and the pools catching up.
 *
 * ## What it costs, and the PO took that cost
 *
 * The pack shipped on 2026-06-13 and roles on 2026-08-26, with nothing
 * backfilled (`roles.ts` says so in as many words). A process drawn between
 * those two dates carries no role on anything and therefore no longer exports.
 * Arbitrated on 2026-09-17: the alternative is an interchange file that cannot
 * be trusted, which is worse than one that is not written.
 *
 * ## …and what it now SAYS
 *
 * The same ruling of 2026-09-17 added the other half: everything inside a
 * pool's perimeter leaves in the board's generic SVG export (ADR 0025, R34),
 * and only the roled artefacts leave in the `.bpmn`. That asymmetry is wanted;
 * being silent about it was not. So the role-less things drawn INSIDE a pool
 * are counted here — this is the only place that sees what was not picked —
 * and `exportBpmnXmlWithWarnings` turns the count into one warning.
 *
 * Connectors are deliberately NOT counted: a neutral arrow states nothing
 * (`docs/adr/0010`), so there is nothing to lose, which is the reason
 * `export.ts` has always dropped one in silence. Neither is a generated legend
 * — see {@link legendMemberIds} — nor a gravitating label and the group that
 * binds it to its node, which the file DOES carry, as the node's `name` — see
 * {@link gravitatingLabels}.
 */
export function bpmnBoardFrom(
  elements: readonly GfxPrimitiveElementModel[]
): BpmnExportBoard {
  const pools: BpmnPoolElementModel[] = [];
  const nodes: BpmnNodeElementModel[] = [];
  const connectors: ConnectorElementModel[] = [];
  const roleless: GfxPrimitiveElementModel[] = [];

  for (const element of elements) {
    if (element instanceof BpmnPoolElementModel) {
      if (element.role === BPMN_ROLE.pool) pools.push(element);
      else roleless.push(element);
    } else if (element instanceof BpmnNodeElementModel) {
      if (element.role === BPMN_ROLE_OF_KIND[element.kind]) nodes.push(element);
      else roleless.push(element);
    } else if (element instanceof ConnectorElementModel) {
      connectors.push(element);
    } else {
      roleless.push(element);
    }
  }

  // Against the pools that are actually WRITTEN: "inside the pool" has to mean
  // inside a pool the file has, or the sentence names a perimeter the reader of
  // the `.bpmn` cannot see. `bpmnPoolOf` is the same whole-containment test the
  // audit and the serializer use, so what is reported left out is what the rest
  // of the framework agrees is in there.
  const legend = legendMemberIds(elements);
  const { labels, consumed } = gravitatingLabels(
    elements,
    new Set(nodes.map(node => node.id))
  );
  const leftOut = roleless.filter(
    element =>
      !legend.has(element.id) &&
      !consumed.has(element.id) &&
      bpmnPoolOf(pools, element.elementBound) !== null
  ).length;

  return {
    pools,
    nodes,
    connectors,
    ...(labels.size > 0 ? { labels } : {}),
    ...(leftOut > 0 ? { leftOut } : {}),
  };
}

/**
 * A name a file system will accept, minus the extension: the shared
 * `safeFilename` with BPMN's fallback — `process` is a better download than
 * one a browser silently refuses. Held to it by
 * `safe-filename-parity.unit.spec.ts`.
 */
export function bpmnSafeFilename(raw: string | undefined): string {
  return safeFilename(raw, 'process');
}

/* ── The capability ───────────────────────────────────────────────────── */

/**
 * The board as a BPMN 2.0 interchange document.
 *
 * A thin adapter and nothing else: it splits the surface into the three lists
 * {@link exportBpmnXmlWithWarnings} takes, names the file, and passes the
 * writer's losses straight through. There is no second door — `bpmn.exportXml`
 * calls THIS, so the command and the registry cannot produce different bytes,
 * different filenames or different warnings: there is nowhere for them to
 * differ.
 *
 * `warnings` is omitted rather than empty when the board came out whole, so a
 * caller can ask `if (result.warnings)` and mean it.
 */
const runBpmnXmlExport: InterchangeExporter = (elements, context) => {
  const name = bpmnSafeFilename(context.name);
  const { text, warnings } = exportBpmnXmlWithWarnings(
    bpmnBoardFrom(elements),
    { name }
  );
  return {
    text,
    filename: `${name}${BPMN_XML_EXTENSION}`,
    mime: BPMN_XML_MIME,
    // `InterchangeExportResult.warnings` is `readonly string[]` — a seam this
    // capability shares with every other format and does not own — so each
    // KEYED warning (`BpmnExportWarning`, `export.ts`) is resolved to its
    // English fallback here. This adapter is `std`-free like the exporter it
    // wraps (P3), so it cannot ask a host's catalogue either; the translated
    // command path is `exportBpmnXmlFile` (`actions.ts`), which reads the
    // structured warnings directly instead of going through this capability.
    ...(warnings.length > 0
      ? {
          warnings: warnings.map(w => fillPlaceholders(w.fallback, w.params)),
        }
      : {}),
  };
};

/** `bpmn:bpmn:export` — the registry's first capability. */
export const BPMN_XML_EXPORT: InterchangeExportCapability = {
  id: interchangeCapabilityId('bpmn', BPMN_XML_FORMAT.id, 'export'),
  framework: 'bpmn',
  format: BPMN_XML_FORMAT,
  direction: 'export',
  run: runBpmnXmlExport,
};

/** Everything BPMN registers, in one list the view extension can hand over. */
export const BPMN_INTERCHANGE: readonly InterchangeCapability[] = [
  BPMN_XML_EXPORT,
  BPMN_XML_IMPORT,
  BPMN_SVG_IMPORT,
];
