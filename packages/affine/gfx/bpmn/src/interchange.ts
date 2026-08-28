import type {
  InterchangeCapability,
  InterchangeExportCapability,
  InterchangeExporter,
  InterchangeFormat,
  InterchangeImportCapability,
} from '@labre/affine-block-surface';
import { interchangeCapabilityId } from '@labre/affine-block-surface';
import {
  BpmnNodeElementModel,
  BpmnPoolElementModel,
  ConnectorElementModel,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import {
  BPMN_FORMAT_ID,
  type BpmnExportBoard,
  exportBpmnXmlWithWarnings,
} from './export.js';
import { importBpmnXml } from './import.js';

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

/* ── The format ───────────────────────────────────────────────────────── */

/**
 * BPMN 2.0 XML. **Semantic** — the file carries a model, not a picture, so it
 * takes the whole preservation contract the day an importer is written.
 *
 * `application/xml` and not `text/xml`: the file is not meant to be read as
 * text by whatever opens it, and `.bpmn` is the extension every BPMN tool
 * watches for.
 */
export const BPMN_XML_EXTENSION = '.bpmn';
export const BPMN_XML_MIME = 'application/xml';

export const BPMN_XML_FORMAT: InterchangeFormat = {
  id: BPMN_FORMAT_ID,
  tier: 'semantic',
  extensions: [BPMN_XML_EXTENSION],
  mime: BPMN_XML_MIME,
};

/* ── Pure board helpers ───────────────────────────────────────────────── */

/**
 * The artefacts the exporter speaks about, picked out of a surface's elements
 * and kept in the order they were given.
 *
 * Document order matters twice and both times for the same reason: `bpmnPoolOf`
 * gives a centre inside two overlapping pools to the FIRST one, and the audit's
 * `attribute()` does the same. Sorting here would make the export disagree with
 * the badge the user can see.
 */
export function bpmnBoardFrom(
  elements: readonly GfxPrimitiveElementModel[]
): BpmnExportBoard {
  const pools: BpmnPoolElementModel[] = [];
  const nodes: BpmnNodeElementModel[] = [];
  const connectors: ConnectorElementModel[] = [];

  for (const element of elements) {
    if (element instanceof BpmnPoolElementModel) pools.push(element);
    else if (element instanceof BpmnNodeElementModel) nodes.push(element);
    else if (element instanceof ConnectorElementModel) connectors.push(element);
  }

  return { pools, nodes, connectors };
}

/**
 * A name a file system will accept, minus the extension.
 *
 * Every character a file system reserves becomes `-`, whitespace runs collapse,
 * and the result is capped: `process` is a better download than one a browser
 * silently refuses.
 *
 * The trailing `[. ]` trim is the Windows tail case and it is not decorative: a
 * board called "Order to cash." would otherwise download as
 * `Order to cash..bpmn`, and Windows strips trailing dots and spaces from a
 * name anyway — so the extension is what would get eaten. Trimmed AFTER the
 * cap, because the cap can create one.
 */
export function bpmnSafeFilename(raw: string | undefined): string {
  const safe = (raw ?? '')
    .trim()
    .replaceAll(/[\\/:*?"<>|]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  return safe || 'process';
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
    ...(warnings.length > 0 ? { warnings } : {}),
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

/**
 * `bpmn:bpmn:import` — a `.bpmn` file as a board.
 *
 * A thin adapter over {@link importBpmnXml} and nothing else, which is the
 * whole of what a capability is: the parser is a pure function of a string, so
 * the registry entry has nothing to add to it and deliberately adds nothing.
 * A reader that threw its arms around a surface here would be a reader
 * labre-mcp could not call.
 */
export const BPMN_XML_IMPORT: InterchangeImportCapability = {
  id: interchangeCapabilityId('bpmn', BPMN_XML_FORMAT.id, 'import'),
  framework: 'bpmn',
  format: BPMN_XML_FORMAT,
  direction: 'import',
  run: importBpmnXml,
};

/** Everything BPMN registers, in one list the view extension can hand over. */
export const BPMN_INTERCHANGE: readonly InterchangeCapability[] = [
  BPMN_XML_EXPORT,
  BPMN_XML_IMPORT,
];
