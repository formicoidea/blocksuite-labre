import {
  type ChromeWording,
  UNKNOWN_LABEL,
} from '@labre/affine-shared/services';

/** `@labre/affine-inline-mention`'s own wordings — the @-mention chip's states. */

export const MENTION_UNKNOWN_MEMBER: ChromeWording = [
  'com.labre.mention.unknown-member',
  '@Unknown Member',
];
export const MENTION_INACTIVE_MEMBER: ChromeWording = [
  'com.labre.mention.inactive-member',
  '@Inactive Member',
];
export const MENTION_LOADING: ChromeWording = [
  'com.labre.mention.loading',
  '@loading',
];
/**
 * The fallback name shown when a resolved member's own name is empty — the
 * member's REAL name (`userInfo$.value.name`) is never translated, only this
 * one word that stands in for it.
 */
export const MENTION_UNKNOWN_NAME_FALLBACK = UNKNOWN_LABEL;

/**
 * Every wording declared above, in declaration order — walked by
 * `PACKAGE_WORDINGS` in `packages/affine/all/src/translations.ts`.
 */
export const MENTION_WORDINGS: readonly ChromeWording[] = [
  MENTION_UNKNOWN_MEMBER,
  MENTION_INACTIVE_MEMBER,
  MENTION_LOADING,
];
