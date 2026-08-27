import type {
  InterchangeCapability,
  InterchangeExportContext,
  InterchangeExportResult,
  InterchangeFormat,
} from '@labre/affine-block-surface';
import { interchangeCapabilityId } from '@labre/affine-block-surface';
import {
  BpmnNodeElementModel,
  BpmnPoolElementModel,
  ConnectorElementModel,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { type BpmnExportBoard, exportBpmnXml } from './export.js';

/**
 * BPMN's entries in the interchange registry (`docs/adr/0012`, P1).
 *
 * One entry today — `.bpmn` OUT, shipped in #149 — and that is the point of
 * declaring the triple rather than the format: BPMN can write a `.bpmn` and
 * cannot yet read one, and the registry now says exactly that instead of
 * leaving a reader to infer a symmetry nobody implemented.
 *
 * Everything here is pure. {@link exportBpmnXml} was already a pure function
 * with no `std` in sight, and this file adds no editor to it: it only picks the
 * artefacts the serializer speaks about out of a surface's elements, which is
 * the half of `bpmnBoardOf` that never needed a `BlockStdScope`.
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
export const BPMN_XML_FORMAT: InterchangeFormat = {
  id: 'bpmn',
  tier: 'semantic',
  extensions: ['.bpmn'],
  mime: 'application/xml',
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
 * {@link exportBpmnXml} takes and names the file. The XML is the shipped
 * function's, byte for byte — `bpmn.exportXml` and this capability are two
 * doors onto one serializer, and `interchange.unit.spec.ts` pins that they
 * cannot drift apart.
 */
const runBpmnXmlExport = (
  elements: readonly GfxPrimitiveElementModel[],
  context: InterchangeExportContext
): InterchangeExportResult => {
  const name = bpmnSafeFilename(context.name);
  return {
    text: exportBpmnXml(bpmnBoardFrom(elements), { name }),
    filename: `${name}${BPMN_XML_FORMAT.extensions[0]}`,
    mime: BPMN_XML_FORMAT.mime!,
  };
};

/** `bpmn:bpmn:export` — the registry's first capability. */
export const BPMN_XML_EXPORT: InterchangeCapability = {
  id: interchangeCapabilityId('bpmn', BPMN_XML_FORMAT.id, 'export'),
  framework: 'bpmn',
  format: BPMN_XML_FORMAT,
  direction: 'export',
  run: runBpmnXmlExport,
};

/** Everything BPMN registers, in one list the view extension can hand over. */
export const BPMN_INTERCHANGE: readonly InterchangeCapability[] = [
  BPMN_XML_EXPORT,
];
