import { CommentIcon } from '@blocksuite/icons/lit';
import {
  type ToolbarContext,
  ToolbarModuleExtension,
  type ToolbarModuleConfig,
  toolbarModuleKey,
  ThreadMarksProvider,
} from '@labre/affine-shared/services';
import {
  type BlockStdScope,
  BlockFlavourIdentifier,
  BlockSelection,
  TextSelection,
} from '@labre/std';
import { GfxPrimitiveElementModel } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';

import { type ThreadTarget, threadExcerpt } from './excerpt.js';
import { THREAD_DISCUSS } from './translations.js';

/** Containers a discussion never anchors to: the page and the canvas itself. */
const NOT_A_TARGET = new Set(['affine:page', 'affine:surface']);

function blockTarget(id: string | undefined, ctx: ToolbarContext) {
  if (!id) return null;
  const model = ctx.store.getModelById(id);
  if (!model || NOT_A_TARGET.has(model.flavour)) return null;
  return { targetType: 'block', targetId: model.id } satisfies ThreadTarget;
}

/**
 * The ONE target a toolbar row speaks for, or `null` when it speaks for
 * several (a discussion anchors to one block or one element, labre ADR-0048).
 *
 * - On the canvas, exactly one selected model: a canvas element (shape,
 *   connector, group, framework board) is an `element`, a canvas block (note,
 *   frame, image, embed) a `block`.
 * - A text selection within one block: that block (the grain is the block,
 *   never a range of text).
 * - One selected block, or the block a hover toolbar is drawn for.
 */
export function threadTargetOf(ctx: ToolbarContext): ThreadTarget | null {
  if (ctx.hasSelectedSurfaceModels) {
    const models = ctx.getSurfaceModels();
    if (models.length !== 1) return null;
    const model = models[0];
    if (!model) return null;
    return model instanceof GfxPrimitiveElementModel
      ? { targetType: 'element', targetId: model.id }
      : blockTarget(model.id, ctx);
  }

  const text = ctx.selection.find(TextSelection);
  if (text) {
    const from = text.from.blockId;
    const to = text.to?.blockId ?? from;
    return from === to ? blockTarget(from, ctx) : null;
  }

  if (ctx.selection.filter(BlockSelection).length > 1) return null;
  return blockTarget(ctx.getCurrentModelBy(BlockSelection)?.id, ctx);
}

/**
 * Ask the host to open the discussion of `target`, with the excerpt the
 * library computes. Nothing is written: no prop, no id in the document.
 * Without the seam, nothing happens.
 */
export function openThreadOn(std: BlockStdScope, target: ThreadTarget) {
  const service = std.getOptional(ThreadMarksProvider);
  if (!service) return;
  service.openThread({
    docId: std.store.id,
    targetType: target.targetType,
    targetId: target.targetId,
    excerpt: threadExcerpt(std, target),
  });
}

export const THREAD_DISCUSS_ACTION_ID = 'g.thread-discuss';

/**
 * "Discuss" in the toolbar of every block and every canvas element (ADR 0038).
 * Shown only when the host registered the seam and the row speaks for one
 * target. It is not AFFiNE's `blockCommentToolbarButton`: that one writes the
 * comment id into the block.
 */
export const threadDiscussToolbarConfig = {
  when: ctx =>
    Boolean(ctx.std.getOptional(ThreadMarksProvider)) &&
    threadTargetOf(ctx) !== null,
  actions: [
    {
      id: THREAD_DISCUSS_ACTION_ID,
      icon: CommentIcon(),
      labelWording: THREAD_DISCUSS,
      tooltipWording: THREAD_DISCUSS,
      run: ctx => {
        const target = threadTargetOf(ctx);
        if (target) openThreadOn(ctx.std, target);
      },
    },
  ],
} as const satisfies ToolbarModuleConfig;

/**
 * Registered on the two wildcard rows, each under an owner key: the bare
 * `affine:surface:*` is the root's built-in canvas module, and an owner key
 * never collides with a bare one. `affine:*` is merged into every row the
 * toolbar draws; `affine:surface:*` names the canvas rows explicitly, so a
 * row that stopped merging `affine:*` would still offer it. Where both apply,
 * the toolbar merges entries by id, so the row shows "Discuss" once. A new
 * block or framework inherits it by doing nothing.
 */
export const threadDiscussToolbarExtensions: ExtensionType[] = [
  ToolbarModuleExtension({
    id: BlockFlavourIdentifier(toolbarModuleKey('affine:*', 'thread')),
    config: threadDiscussToolbarConfig,
  }),
  ToolbarModuleExtension({
    id: BlockFlavourIdentifier(toolbarModuleKey('affine:surface:*', 'thread')),
    config: threadDiscussToolbarConfig,
  }),
];
