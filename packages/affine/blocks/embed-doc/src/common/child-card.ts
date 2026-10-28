import type { ReferenceParams } from '@labre/affine-model';
import {
  DocDisplayMetaProvider,
  TitleBandProvider,
} from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import type { TemplateResult } from 'lit';

type CardStd = Pick<BlockStdScope, 'get' | 'getOptional'>;

/**
 * Whether a card of page `pageId` held by document `docId` is the child's own
 * card rather than a reference (labre ADR-0045, amended 2026-10-27): the host
 * lists the document's children through `TitleBandService.children$`. The
 * library never computes a parent or a child. Read inside a `computed`, so a
 * move in the host's tree redraws the card. Without the seam, or without
 * `children$`, every card is a reference, as in 0.59.
 */
export function isChildCard(
  std: Pick<CardStd, 'getOptional'>,
  docId: string,
  pageId: string
): boolean {
  const children$ = std.getOptional(TitleBandProvider)?.children$?.(docId);
  return children$?.value.includes(pageId) ?? false;
}

/**
 * The icon of a card (`embed-linked-doc`, `embed-synced-doc`): a child's own
 * card shows the plain page or canvas icon; any other card, like an inline
 * `@` reference, keeps the linked icon with its arrow (product owner,
 * recette 3 P2-7c). An alias or a block link keeps its own icon.
 */
export function cardIcon(
  std: CardStd,
  docId: string,
  info: { pageId: string; params?: ReferenceParams; title?: string }
): TemplateResult {
  const { pageId, params, title } = info;
  return std.get(DocDisplayMetaProvider).icon(pageId, {
    params,
    title,
    referenced: !isChildCard(std, docId, pageId),
  }).value;
}
