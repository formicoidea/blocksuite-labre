import { createIdentifier } from '@labre/global/di';
import type { DocSnapshot, ExtensionType } from '@labre/store';

/**
 * What "Save as template" on a frame's toolbar hands the host: the frame and
 * everything it holds, serialized once, at the moment of the gesture.
 *
 * `snapshot` is a `DocSnapshot` the canvas's own template job inserts as is
 * (`createTemplateJob(std, 'template').insertTemplate(snapshot)`, which mints
 * fresh ids and lands every model in the viewer's active layer): keep it
 * verbatim and give it back through {@link FrameTemplateService.list}. It is
 * plain JSON. It names images and attachments by their blob id (`sourceId`)
 * and never carries the bytes: the copy references them.
 */
export interface FrameTemplateDraft {
  /** The document the frame was saved from. */
  docId: string;
  /** The frame's block id in that document. */
  frameId: string;
  /** The frame's title when it was saved (may be empty). */
  title: string;
  snapshot: DocSnapshot;
}

/** One saved frame, as the canvas's Templates panel lists it. */
export interface SavedFrameTemplate {
  /** Your own id for it; the panel uses it as the tile's identity. */
  id: string;
  title: string;
  /** The `snapshot` of the {@link FrameTemplateDraft} you were given. */
  snapshot: unknown;
  /** An inline `<svg…` or an image URL; the panel's generic tile otherwise. */
  preview?: string;
}

/** A saved frame inserted into a document, by your id for the template. */
export interface FrameTemplateInsertion {
  docId: string;
  templateId: string;
}

/** Ids of a frame whose life the host may follow. */
export interface FrameTemplateFrameRef {
  docId: string;
  frameId: string;
}

/**
 * Frames saved as templates (labre P4): the host keeps them, the library
 * serializes, lists and inserts them.
 *
 * - `save` is called by the frame toolbar's "Save as template"
 *   (`blocks/frame/src/frame-toolbar.ts`). The library tells the viewer how it
 *   went (a success or an error notification): do not notify yourself.
 * - `list` feeds one category of the canvas's Templates panel
 *   (`gfx/template`, `templateManagerFor`). It is called each time the panel
 *   shows that category or searches across categories, never before.
 * - `frameDeleted` is called when THIS viewer deletes a frame on a writable
 *   document, never for a deletion that arrives from another peer (that peer
 *   reported its own), so a deletion is reported once per author. It is called
 *   for every frame, saved or not: ignore the ids you do not know.
 * - `frameRestored` is called when this viewer brings back a frame it had
 *   deleted in this session (undo). Whatever `frameDeleted` did must be
 *   undoable by it: move a template to the trash, never destroy it.
 * - `frameInserted` is called once a saved frame from that category is on the
 *   canvas (the template job succeeded), with the document it landed in and
 *   your id for the template: link what the copy references (its images) to
 *   that document. Not called when the insertion failed.
 *
 * Both notifications may come twice for one gesture (two editors mounted on
 * one document): make them idempotent.
 */
export interface FrameTemplateService {
  save(draft: FrameTemplateDraft): Promise<void>;
  list(): Promise<SavedFrameTemplate[]>;
  frameDeleted?(frame: FrameTemplateFrameRef): void;
  frameRestored?(frame: FrameTemplateFrameRef): void;
  frameInserted?(insertion: FrameTemplateInsertion): void;
}

export const FrameTemplateProvider = createIdentifier<FrameTemplateService>(
  'AffineFrameTemplate'
);

/**
 * Host seam: keep frames saved as templates. Absent, the toolbar has no
 * "Save as template", the Templates panel has no "Saved frames" category and
 * nothing is reported when a frame is deleted.
 *
 * `di.override`, like `OutlinePanelExtension`, so a later registration always
 * wins and registering twice never throws at boot.
 */
export function FrameTemplateExtension(
  service: FrameTemplateService
): ExtensionType {
  return {
    setup: di => {
      di.override(FrameTemplateProvider, () => service);
    },
  };
}
