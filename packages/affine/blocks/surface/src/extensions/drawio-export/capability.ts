import {
  type InterchangeExportCapability,
  type InterchangeFormat,
  interchangeCapabilityId,
} from '../interchange.js';
import { DRAWIO_EXTENSION, DRAWIO_MIME, exportCanvasDrawio } from './writer.js';

/**
 * The owner of what the CANVAS writes, whatever drew on it (`docs/adr/0019`,
 * amendment of 2026-10-14).
 *
 * The registry's `framework` field names who owns the vocabulary a capability
 * speaks (`docs/adr/0012` P1). A generic rendering speaks none — a shape, a
 * line, a group — so its owner is the canvas itself, the owner `'core'` plays
 * for the canvas's PNG export in the command registry. Unlike a framework's,
 * this capability is registered UNCONDITIONALLY, from the surface's own view
 * extension: no flag gates a picture of what is on the canvas
 * (`interchange-gating.unit.spec.ts` pins that it survives every flag off).
 */
export const CANVAS_INTERCHANGE_OWNER = 'canvas';

/**
 * draw.io, as the canvas writes it. **Visual** (`docs/adr/0012` P2): the file
 * carries a drawing, so no round trip is promised and none is implied — the
 * same tier, id and extensions as UML's draw.io READER (`UML_DRAWIO_FORMAT`),
 * because it is the same format, read and written by two owners.
 */
export const CANVAS_DRAWIO_FORMAT: InterchangeFormat = {
  id: 'drawio',
  tier: 'visual',
  extensions: [DRAWIO_EXTENSION, '.drawio.xml', '.xml'],
  mime: DRAWIO_MIME,
};

/**
 * `canvas:drawio:export` — the canvas, or a selection of it, as one
 * uncompressed draw.io page. `run` is {@link exportCanvasDrawio}, the pure
 * writer labre-mcp can call directly; the `canvas.export.drawio` command
 * calls THIS, so the two cannot write different bytes.
 */
export const CANVAS_DRAWIO_EXPORT: InterchangeExportCapability = {
  id: interchangeCapabilityId(
    CANVAS_INTERCHANGE_OWNER,
    CANVAS_DRAWIO_FORMAT.id,
    'export'
  ),
  framework: CANVAS_INTERCHANGE_OWNER,
  format: CANVAS_DRAWIO_FORMAT,
  direction: 'export',
  run: exportCanvasDrawio,
};

/** Everything the canvas registers, for the surface's view extension. */
export const CANVAS_INTERCHANGE: readonly InterchangeExportCapability[] = [
  CANVAS_DRAWIO_EXPORT,
];
