import type { NoteBlockModel } from '@labre/affine-model';
import { type BlockStdScope, ConfigExtensionFactory } from '@labre/std';
import type { nothing, TemplateResult } from 'lit';

type NoteBlockContext = {
  note: NoteBlockModel;
  std: BlockStdScope;
};

export type NoteConfig = {
  edgelessNoteHeader: (context: NoteBlockContext) => TemplateResult;
  /**
   * The title at the head of the page note on the canvas. Absent, the note
   * draws the document title itself (`<doc-title>`, editable like the rest
   * of the note); a host that draws its own title elsewhere returns
   * `nothing`. Optional since 0.59: a config typed against 0.58 still
   * compiles (`note-config-shape.unit.spec.ts`).
   */
  pageBlockTitle?: (
    context: NoteBlockContext
  ) => TemplateResult | typeof nothing;
  /**
   * @returns if the viewport fit animation executed
   */
  pageBlockViewportFitAnimation?: (context: NoteBlockContext) => boolean;
};

export const NoteConfigExtension =
  ConfigExtensionFactory<NoteConfig>('affine:note');
