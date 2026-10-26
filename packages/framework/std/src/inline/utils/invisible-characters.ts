import { createIdentifier } from '@labre/global/di';
import type { ReadonlySignal } from '@preact/signals-core';

/**
 * The characters a reader cannot see and a writer rarely typed: the ones an
 * AI text generator, a copy from a web page or a "watermarking" tool leaves in
 * a paragraph. `text.invisibles.remove` strips them and the "show special
 * characters" display marks them.
 *
 * - U+200B zero width space, U+2060 word joiner, U+FEFF zero width no-break
 *   space — a BOM inside a text is a watermark, never a byte order mark;
 * - U+00AD soft hyphen, U+180E Mongolian vowel separator;
 * - U+2061–U+2064 the invisible math operators;
 * - U+E0000–U+E007F the tag characters ("ASCII smuggling");
 * - U+200D zero width joiner — see {@link findInvisibleCharacters} for the
 *   two contexts where it and the tags are kept.
 *
 * Deliberately NOT here: U+200C zero width non-joiner, which Persian and the
 * Indic scripts need, and the no-break spaces U+00A0 and U+202F, which French
 * typography needs before `: ; ! ?` and inside quotation marks.
 */
export const INVISIBLE_CHARACTERS: ReadonlySet<number> = new Set([
  0x200b,
  0x200d,
  0x2060,
  0xfeff,
  0x00ad,
  0x180e,
  0x2061,
  0x2062,
  0x2063,
  0x2064,
  ...Array.from({ length: 0x80 }, (_, i) => 0xe0000 + i),
]);

/** A character to strip or mark, as a UTF-16 slice of the string. */
export interface InvisibleCharacterRun {
  index: number;
  length: number;
}

const ZWJ = 0x200d;
const VARIATION_SELECTOR_16 = 0xfe0f;
const BLACK_FLAG = 0x1f3f4;
const CANCEL_TAG = 0xe007f;
const EXTENDED_PICTOGRAPHIC = /\p{Extended_Pictographic}/u;

function isPictographic(codePoint: number | undefined): boolean {
  return (
    codePoint !== undefined &&
    EXTENDED_PICTOGRAPHIC.test(String.fromCodePoint(codePoint))
  );
}

function isSkinTone(codePoint: number): boolean {
  return codePoint >= 0x1f3fb && codePoint <= 0x1f3ff;
}

function codePointBefore(str: string, index: number): number | undefined {
  if (index <= 0) return undefined;
  const low = str.charCodeAt(index - 1);
  if (low >= 0xdc00 && low <= 0xdfff && index >= 2) {
    const high = str.charCodeAt(index - 2);
    if (high >= 0xd800 && high <= 0xdbff) return str.codePointAt(index - 2);
  }
  return low;
}

/**
 * A ZWJ between two pictographs is the glue of an emoji sequence (woman
 * technologist, heart on fire, family): the emoji before it may carry a
 * variation selector or a skin tone.
 */
function joinsEmoji(str: string, index: number): boolean {
  let before = index;
  let previous = codePointBefore(str, before);
  while (
    previous !== undefined &&
    (previous === VARIATION_SELECTOR_16 || isSkinTone(previous))
  ) {
    before -= previous > 0xffff ? 2 : 1;
    previous = codePointBefore(str, before);
  }
  return isPictographic(previous) && isPictographic(str.codePointAt(index + 1));
}

/**
 * The tags after a black flag, closed by CANCEL TAG, spell a subdivision
 * flag (Scotland, Wales, England): answers the index just past the sequence, or `-1`.
 */
function endOfFlagTags(str: string, start: number): number {
  let index = start;
  while (index < str.length) {
    const codePoint = str.codePointAt(index)!;
    if (codePoint < 0xe0020 || codePoint > 0xe007e) break;
    index += 2;
  }
  if (index === start || str.codePointAt(index) !== CANCEL_TAG) return -1;
  return index + 2;
}

/**
 * Every character of {@link INVISIBLE_CHARACTERS} in `str`, one run per code
 * point, in order. Kept, so never reported: a ZWJ joining two pictographs, and
 * the tag sequence of a subdivision flag — stripping either would break an
 * emoji the writer meant.
 */
export function findInvisibleCharacters(str: string): InvisibleCharacterRun[] {
  const runs: InvisibleCharacterRun[] = [];
  let index = 0;
  while (index < str.length) {
    const codePoint = str.codePointAt(index)!;
    const size = codePoint > 0xffff ? 2 : 1;
    if (codePoint === BLACK_FLAG) {
      const end = endOfFlagTags(str, index + size);
      index = end === -1 ? index + size : end;
      continue;
    }
    if (
      INVISIBLE_CHARACTERS.has(codePoint) &&
      !(codePoint === ZWJ && joinsEmoji(str, index))
    ) {
      runs.push({ index, length: size });
    }
    index += size;
  }
  return runs;
}

/** What the "show special characters" display draws over a character. */
export type InvisibleCharacterKind = 'space' | 'tab' | 'nbsp' | 'invisible';

export interface InvisibleCharacterSegment {
  text: string;
  /** Absent: ordinary text, rendered as it is. */
  kind?: InvisibleCharacterKind;
}

const MAYBE_SPECIAL =
  /[ \t\u00A0\u202F\u00AD\u180E\u200B\u200D\u2060-\u2064\uFEFF]|\udb40[\udc00-\udc7f]/;

function whitespaceKind(char: string): InvisibleCharacterKind | null {
  if (char === ' ') return 'space';
  if (char === '\t') return 'tab';
  if (char === '\u00A0' || char === '\u202F') return 'nbsp';
  return null;
}

/**
 * `str` cut so that every space, tab, no-break space and invisible character
 * stands alone in its own segment, the rest kept in runs. `null` when there is
 * nothing to mark, so the common case allocates nothing.
 *
 * The segments concatenate back to `str` exactly: the display keeps every
 * character as it is and only draws over it.
 */
export function segmentInvisibleCharacters(
  str: string
): InvisibleCharacterSegment[] | null {
  if (!MAYBE_SPECIAL.test(str)) return null;
  const invisible = new Map<number, number>();
  for (const run of findInvisibleCharacters(str)) {
    invisible.set(run.index, run.length);
  }
  const segments: InvisibleCharacterSegment[] = [];
  let plainStart = 0;
  const flush = (end: number) => {
    if (end > plainStart) segments.push({ text: str.slice(plainStart, end) });
  };
  let index = 0;
  while (index < str.length) {
    const length = invisible.get(index);
    const kind = length ? 'invisible' : whitespaceKind(str[index]);
    if (!kind) {
      index += 1;
      continue;
    }
    const size = length ?? 1;
    flush(index);
    segments.push({ text: str.slice(index, index + size), kind });
    index += size;
    plainStart = index;
  }
  if (segments.length === 0) return null;
  flush(str.length);
  return segments;
}

/**
 * Whether THIS viewer asked to see the special characters. Provided by the
 * editor (`InvisibleCharacters` in `@labre/affine-shared/services`), read by
 * every `v-text` under the editor host; absent, nothing is marked.
 */
export interface InvisibleCharactersDisplay {
  readonly showInvisibles$: ReadonlySignal<boolean>;
}

export const InvisibleCharactersDisplayIdentifier =
  createIdentifier<InvisibleCharactersDisplay>('InvisibleCharactersDisplay');
