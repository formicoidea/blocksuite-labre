import {
  ParagraphBlockModel,
  type CalloutBlockModel,
} from '@labre/affine-model';
import { matchModels } from '@labre/affine-shared/utils';

/**
 * How far the emoji has to drop to sit on the first line's baseline.
 *
 * The emoji is a fixed 24px box next to a column whose first line can be
 * anything from an H1 to an ordinary paragraph. A single margin therefore
 * cannot be right twice: level with a paragraph it floats above an H1, level
 * with an H1 it sinks below a paragraph. These are the drops measured per
 * heading level.
 */
const EMOJI_MARGIN_TOP_BY_TYPE: Record<string, string> = {
  h1: '23px',
  h2: '20px',
  h3: '16px',
  h4: '15px',
  h5: '14px',
  h6: '13px',
};

/** What a paragraph, a list, or an empty callout gets. */
const DEFAULT_EMOJI_MARGIN_TOP = '10px';

/**
 * The emoji's `margin-top` for a callout, read from its FIRST child — the only
 * line the emoji is ever level with.
 *
 * Reading `type$` rather than `type` keeps the caller reactive: turning the
 * first line into a heading re-renders the callout and moves the emoji with it.
 */
export function getCalloutEmojiMarginTop(model: CalloutBlockModel): string {
  const first = model.children[0];
  if (!first || !matchModels(first, [ParagraphBlockModel])) {
    return DEFAULT_EMOJI_MARGIN_TOP;
  }
  return (
    EMOJI_MARGIN_TOP_BY_TYPE[first.props.type$.value] ??
    DEFAULT_EMOJI_MARGIN_TOP
  );
}
