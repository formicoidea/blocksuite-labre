import { getSurfaceBlock } from '@labre/affine-block-surface';
import {
  THREAD_EXCERPT_MAX,
  type ThreadMarkTargetType,
  type ThreadTextRange,
} from '@labre/affine-shared/services';
import {
  selectionPaneRowLabel,
  selectionPaneTypeLabel,
} from '@labre/affine-widget-edgeless-toolbar';
import type { BlockStdScope } from '@labre/std';
import { GfxBlockElementModel } from '@labre/std/gfx';
import type { BlockModel } from '@labre/store';

import { resolveThreadRange } from './text-range.js';

/**
 * A block or a canvas element, by the id the library gave it, and for a
 * block optionally a run of its text (ADR 0038, amendment of 2026-10-15).
 */
export interface ThreadTarget {
  targetType: ThreadMarkTargetType;
  targetId: string;
  range?: ThreadTextRange;
}

const ELLIPSIS = '…';

/**
 * Collapse whitespace and cut to {@link THREAD_EXCERPT_MAX} code points, the
 * ellipsis included. Code points, not UTF-16 units, so an emoji is never cut
 * in half and a host counting characters (Postgres `char_length`) agrees.
 */
export function truncateThreadExcerpt(raw: string): string {
  const text = raw.replace(/\s+/g, ' ').trim();
  const chars = Array.from(text);
  if (chars.length <= THREAD_EXCERPT_MAX) return text;
  return (
    chars
      .slice(0, THREAD_EXCERPT_MAX - 1)
      .join('')
      .trimEnd() + ELLIPSIS
  );
}

/**
 * A block's own text, then its descendants' in document order (a note, a
 * callout, a list item with children), until there is more than an excerpt
 * can hold.
 */
function blockText(model: BlockModel): string {
  const parts: string[] = [];
  let length = 0;
  const visit = (block: BlockModel) => {
    if (length > THREAD_EXCERPT_MAX) return;
    const own = block.text?.toString() ?? '';
    if (own.trim()) {
      parts.push(own);
      length += own.length + 1;
    }
    for (const child of block.children) visit(child);
  };
  visit(model);
  return parts.join(' ');
}

function rawExcerpt(std: BlockStdScope, target: ThreadTarget): string {
  if (target.targetType === 'block') {
    const model = std.store.getModelById(target.targetId);
    if (!model) return '';
    // A run of text reads as itself: the quote a reader selected. A range
    // that no longer resolves falls back to the block, like its mark.
    const yText = model.text?.yText;
    const run =
      target.range && yText ? resolveThreadRange(yText, target.range) : null;
    if (yText && run) {
      return yText.toString().slice(run.index, run.index + run.length);
    }
    const text = blockText(model);
    if (text.trim()) return text;
    // A canvas block with no text reads as the selection pane names it: a
    // frame by its title, an image or a note by its kind.
    if (model instanceof GfxBlockElementModel) {
      return selectionPaneRowLabel(std, model);
    }
    return selectionPaneTypeLabel(std, model.flavour);
  }
  const element = getSurfaceBlock(std.store)?.getElementById(target.targetId);
  return element ? selectionPaneRowLabel(std, element) : '';
}

/**
 * The excerpt handed to `openThread` (ADR 0038): what the target says, as a
 * reader would recognise it, at most {@link THREAD_EXCERPT_MAX} characters.
 * Read only: nothing is written, nothing is cached.
 */
export function threadExcerpt(
  std: BlockStdScope,
  target: ThreadTarget
): string {
  return truncateThreadExcerpt(rawExcerpt(std, target));
}
