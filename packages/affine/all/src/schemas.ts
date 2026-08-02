// Import models only, the bundled file should not include anything else.
import { DataViewBlockSchema } from '@labre/affine-block-data-view';
import { SurfaceBlockSchema } from '@labre/affine-block-surface';
import {
  AttachmentBlockSchema,
  BookmarkBlockSchema,
  CalloutBlockSchema,
  CodeBlockSchema,
  DatabaseBlockSchema,
  DividerBlockSchema,
  EdgelessTextBlockSchema,
  EmbedFigmaBlockSchema,
  EmbedGithubBlockSchema,
  EmbedHtmlBlockSchema,
  EmbedLinkedDocBlockSchema,
  EmbedLoomBlockSchema,
  EmbedSyncedDocBlockSchema,
  EmbedYoutubeBlockSchema,
  FrameBlockSchema,
  ImageBlockSchema,
  LatexBlockSchema,
  ListBlockSchema,
  NoteBlockSchema,
  ParagraphBlockSchema,
  RootBlockSchema,
  SurfaceRefBlockSchema,
  TableBlockSchema,
} from '@labre/affine-model';
import type { BlockSchema } from '@labre/store';
import type { z } from 'zod';

import type { LabreFlags } from './flags.js';

type AffineBlockSchema = z.infer<typeof BlockSchema>;

/**
 * First party block models built for affine.
 *
 * Schemas are registered UNCONDITIONALLY: a flag gates tooling, never the
 * ability to read a document (see {@link LabreFlags} and `docs/adr/0009`). The
 * `flags` parameter is kept for source compatibility with callers written
 * against the previous contract, and is deliberately ignored.
 */
export function getAffineSchemas(_flags?: LabreFlags): AffineBlockSchema[] {
  return [
    CodeBlockSchema,
    ParagraphBlockSchema,
    RootBlockSchema,
    ListBlockSchema,
    NoteBlockSchema,
    DividerBlockSchema,
    ImageBlockSchema,
    SurfaceBlockSchema,
    BookmarkBlockSchema,
    FrameBlockSchema,
    DatabaseBlockSchema,
    SurfaceRefBlockSchema,
    DataViewBlockSchema,
    AttachmentBlockSchema,
    EmbedYoutubeBlockSchema,
    EmbedFigmaBlockSchema,
    EmbedGithubBlockSchema,
    EmbedHtmlBlockSchema,
    EmbedLinkedDocBlockSchema,
    EmbedSyncedDocBlockSchema,
    EmbedLoomBlockSchema,
    EdgelessTextBlockSchema,
    LatexBlockSchema,
    TableBlockSchema,
    CalloutBlockSchema,
  ];
}

/** Built-in first party block models built for affine */
export const AffineSchemas: AffineBlockSchema[] = getAffineSchemas();
