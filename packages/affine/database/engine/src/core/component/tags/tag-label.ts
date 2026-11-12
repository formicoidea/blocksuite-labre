import type { ChromeWording } from '@labre/affine-shared/services';

import { TAG_UNTITLED } from '../../../translations.js';

/**
 * What a select option is drawn as: its name, or the fallback label when the
 * name is empty or blank, so the pill keeps a content to see and to click
 * (#657). Display only: the stored name is never rewritten, and a rename
 * starts from it.
 */
export const tagLabel = (
  name: string | undefined,
  say: (wording: ChromeWording) => string
): string => (name?.trim() ? name : say(TAG_UNTITLED));
