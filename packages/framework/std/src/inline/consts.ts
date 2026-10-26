import { IS_SAFARI } from '@labre/global/env';

export const ZERO_WIDTH_FOR_EMPTY_LINE = IS_SAFARI ? '\u200C' : '\u200B';
export const ZERO_WIDTH_FOR_EMBED_NODE = IS_SAFARI ? '\u200B' : '\u200C';

export const INLINE_ROOT_ATTR = 'data-v-root';

/**
 * Set on the editor host while its viewer shows the special characters; the
 * line ends are drawn from it (`v-text.ts`).
 */
export const SHOW_INVISIBLES_ATTR = 'data-show-invisibles';
