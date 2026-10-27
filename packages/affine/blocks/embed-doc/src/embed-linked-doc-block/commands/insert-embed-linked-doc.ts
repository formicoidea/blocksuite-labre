import { insertEmbedCard } from '@labre/affine-block-embed';
import type { EmbedCardStyle, ReferenceParams } from '@labre/affine-model';
import { LINKED_DOC_NOTE_STYLE } from '@labre/affine-shared/consts';
import type { Command } from '@labre/std';

export type LinkableFlavour =
  | 'affine:bookmark'
  | 'affine:embed-linked-doc'
  | 'affine:embed-synced-doc'
  | 'affine:embed-iframe'
  | 'affine:embed-figma'
  | 'affine:embed-github'
  | 'affine:embed-loom'
  | 'affine:embed-youtube';

export type InsertedLinkType = {
  flavour: LinkableFlavour;
} | null;

export const insertEmbedLinkedDocCommand: Command<
  {
    docId: string;
    params?: ReferenceParams;
  },
  { blockId: string }
> = (ctx, next) => {
  const { docId, params, std } = ctx;
  const flavour = 'affine:embed-linked-doc';
  const targetStyle: EmbedCardStyle = 'vertical';
  // In a note the card is a line; on the canvas `targetStyle` wins.
  const props: Record<string, unknown> = {
    pageId: docId,
    style: LINKED_DOC_NOTE_STYLE,
  };
  if (params) props.params = params;
  const blockId = insertEmbedCard(std, { flavour, targetStyle, props });
  if (!blockId) return;
  next({ blockId });
};
