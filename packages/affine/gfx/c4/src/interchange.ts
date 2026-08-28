import type {
  InterchangeCapability,
  InterchangeExportCapability,
  InterchangeExporter,
  InterchangeFormat,
} from '@labre/affine-block-surface';
import { interchangeCapabilityId } from '@labre/affine-block-surface';
import {
  C4BoardElementModel,
  C4BoundaryElementModel,
  C4NodeElementModel,
  ConnectorElementModel,
} from '@labre/affine-model';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';

import { type C4ExportBoard, exportC4Mermaid } from './export.js';

/**
 * C4's entries in the interchange registry (`docs/adr/0012`, P1).
 *
 * One entry today — mermaid OUT — declared exactly as BPMN declares its `.bpmn`
 * export: C4 can write a mermaid C4 diagram and cannot yet read one, and the
 * registry says so instead of leaving a reader to infer a symmetry nobody
 * implemented.
 *
 * Everything here is pure. The serializer was already a pure function with no
 * `std` in sight, and this file adds no editor to it: it only picks the
 * artefacts the serializer speaks about out of the elements it is handed.
 *
 * One C4-specific reading of the contract: the SELECTION is expressed by the
 * caller through which boards it includes in the element list. A C4 board is
 * one level of one model, so `exportC4Mermaid` scopes to the boards it is
 * given — every `c4Board` in the list becomes a document, and the caller that
 * wants only the selected ones simply leaves the others out. A headless host
 * that hands over the whole surface gets every board, one document each, which
 * is the honest whole-surface answer for this framework.
 */

/* ── The format ───────────────────────────────────────────────────────── */

/**
 * mermaid C4 source. **Semantic** — the file carries a model, not a picture, so
 * it takes the whole preservation contract the day an importer is written.
 *
 * `.mmd` is the extension the mermaid CLI and every editor plugin watch for,
 * and `text/plain` because mermaid has no registered media type — an invented
 * one is a file some browsers refuse to save. The charset rides along because
 * the text is the whole payload: unlike XML, a mermaid file has no prolog to
 * declare its own encoding in.
 */
export const C4_MERMAID_EXTENSION = '.mmd';
export const C4_MERMAID_MIME = 'text/plain;charset=utf-8';

export const C4_MERMAID_FORMAT: InterchangeFormat = {
  id: 'mermaid',
  tier: 'semantic',
  extensions: [C4_MERMAID_EXTENSION],
};

/* ── Pure board helpers ───────────────────────────────────────────────── */

/**
 * The artefacts the exporter speaks about, picked out of a list of elements and
 * kept in the order they were given.
 *
 * Document order matters for the reason it does everywhere in this framework:
 * it is the tie-break attribution breaks on — a centre inside two overlapping
 * boundaries goes to the first — and the audit's `attribute()` breaks it the
 * same way. Sorting here would make the export disagree with the badge the
 * user can see.
 */
export function c4BoardFrom(
  elements: readonly GfxPrimitiveElementModel[]
): C4ExportBoard {
  const boards: C4BoardElementModel[] = [];
  const nodes: C4NodeElementModel[] = [];
  const boundaries: C4BoundaryElementModel[] = [];
  const connectors: ConnectorElementModel[] = [];

  for (const element of elements) {
    if (element instanceof C4BoardElementModel) boards.push(element);
    else if (element instanceof C4NodeElementModel) nodes.push(element);
    else if (element instanceof C4BoundaryElementModel)
      boundaries.push(element);
    else if (element instanceof ConnectorElementModel) connectors.push(element);
  }

  return { boards, nodes, boundaries, connectors };
}

/**
 * A name a file system will accept, minus the extension.
 *
 * The same transformations `bpmnSafeFilename` applies and for the same reasons
 * — reserved characters become `-`, whitespace runs collapse, the result is
 * capped, and the Windows tail of dots and spaces is trimmed AFTER the cap so
 * the extension is not the thing that gets eaten. Duplicated rather than
 * imported: a filename rule is not API, and coupling two frameworks to share
 * eight lines would be the worse trade.
 */
export function c4SafeFilename(raw: string | undefined): string {
  const safe = (raw ?? '')
    .trim()
    .replaceAll(/[\\/:*?"<>|]/g, '-')
    .replaceAll(/\s+/g, ' ')
    .trim()
    .slice(0, 120)
    .replace(/[. ]+$/, '');
  return safe || 'diagram';
}

/* ── The capability ───────────────────────────────────────────────────── */

/**
 * The board as a mermaid C4 document.
 *
 * A thin adapter and nothing else: it picks the C4 artefacts out of the
 * elements it was handed, runs {@link exportC4Mermaid} — unchanged — and names
 * the file. There is no second door: `c4.exportMermaid` calls THIS, so the
 * command and the registry cannot produce different bytes, different filenames
 * or different content types — there is nowhere for them to differ.
 */
const runC4MermaidExport: InterchangeExporter = (elements, context) => {
  const name = c4SafeFilename(context.name);
  return {
    text: exportC4Mermaid(c4BoardFrom(elements)),
    filename: `${name}${C4_MERMAID_EXTENSION}`,
    mime: C4_MERMAID_MIME,
  };
};

/** `c4:mermaid:export` — C4's first capability. */
export const C4_MERMAID_EXPORT: InterchangeExportCapability = {
  id: interchangeCapabilityId('c4', C4_MERMAID_FORMAT.id, 'export'),
  framework: 'c4',
  format: C4_MERMAID_FORMAT,
  direction: 'export',
  run: runC4MermaidExport,
};

/** Everything C4 registers, in one list the view extension can hand over. */
export const C4_INTERCHANGE: readonly InterchangeCapability[] = [
  C4_MERMAID_EXPORT,
];
