import type { InterchangeFormat } from '@labre/affine-block-surface/interchange';
import { safeFilename } from '@labre/affine-shared/headless';

/**
 * `@labre/affine-gfx-c4/interchange` — C4's format declaration, with no editor
 * behind it (ADR 0012, P3 as amended 2026-10-14).
 *
 * C4 has one capability, mermaid OUT, and it is not here: the writer reads
 * live element models (`c4BoardFrom` by `instanceof`, `roleIsA`), which is the
 * editor graph this entry exists to leave out. What a host without an editor
 * can still use is the declaration — which extension, which media type, which
 * file name — to route or name a file. `interchange.ts` re-exports all of it.
 *
 * Held by `interchange-headless.unit.spec.ts` in `packages/affine/all`.
 */

/**
 * mermaid C4 source. **Semantic** — the file carries a model, not a picture, so
 * it takes the whole preservation contract the day an importer is written.
 *
 * `.mmd` is the extension the mermaid CLI and every editor plugin watch for.
 * The format carries no `mime`, where `BPMN_XML_FORMAT` carries
 * `application/xml`, and the difference is the truth rather than an oversight:
 * mermaid has no registered media type, so there is none to declare. What a
 * DOWNLOAD is served as is a different question with an answer — `text/plain`,
 * because an invented type is a file some browsers refuse to save — and that
 * answer is stated on the export result, where it belongs.
 *
 * The charset rides along with it because the text is the whole payload: unlike
 * XML, a mermaid file has no prolog to declare its own encoding in.
 */
export const C4_MERMAID_EXTENSION = '.mmd';
export const C4_MERMAID_MIME = 'text/plain;charset=utf-8';

export const C4_MERMAID_FORMAT: InterchangeFormat = {
  id: 'mermaid',
  tier: 'semantic',
  extensions: [C4_MERMAID_EXTENSION],
};

/**
 * A name a file system will accept, minus the extension: the shared
 * `safeFilename` with C4's fallback, `diagram`. Held to it by
 * `safe-filename-parity.unit.spec.ts`.
 */
export function c4SafeFilename(raw: string | undefined): string {
  return safeFilename(raw, 'diagram');
}
