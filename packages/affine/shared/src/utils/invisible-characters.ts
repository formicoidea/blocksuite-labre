import {
  findInvisibleCharacters,
  INVISIBLE_CHARACTERS,
} from '@labre/std/inline';
import * as Y from 'yjs';

/**
 * Removing the invisible characters an AI text generator or a "watermarking"
 * tool leaves in a text (`text.invisibles.remove`). The character set and the
 * two contexts where a ZWJ or a tag is kept (emoji sequences, subdivision
 * flags) live in `@labre/std/inline`, where the "show special characters"
 * display reads the same list.
 */
export { INVISIBLE_CHARACTERS };

export interface StripInvisiblesOptions {
  /**
   * Also replace the no-break spaces U+00A0 and U+202F with a plain space.
   * Off by default: French typography puts them before `: ; ! ?` and inside
   * quotation marks on purpose. They are not counted in `removed`.
   */
  normalizeSpaces?: boolean;
}

/**
 * `str` without its invisible characters, and how many were removed (code
 * points, not UTF-16 units: a tag character counts once).
 */
export function stripInvisibles(
  str: string,
  options: StripInvisiblesOptions = {}
): { text: string; removed: number } {
  const runs = findInvisibleCharacters(str);
  let text = str;
  if (runs.length > 0) {
    let kept = '';
    let from = 0;
    for (const run of runs) {
      kept += str.slice(from, run.index);
      from = run.index + run.length;
    }
    text = kept + str.slice(from);
  }
  if (options.normalizeSpaces) text = text.replace(/[\u00A0\u202F]/g, ' ');
  return { text, removed: runs.length };
}

/**
 * Delete the invisible characters of a `Y.Text` in place, from the end so the
 * indices still to visit stay valid, one `delete` per contiguous run: the
 * formatting of the text around them is untouched. Answers how many were
 * removed. The caller owns the transaction (one gesture, one undo step).
 *
 * Indices follow Yjs: an embed counts as one, like the inline editor's.
 */
export function stripInvisiblesFromYText(yText: Y.Text): number {
  const ranges: { index: number; length: number }[] = [];
  let removed = 0;
  let offset = 0;
  for (const op of yText.toDelta() as { insert?: unknown }[]) {
    if (typeof op.insert !== 'string') {
      offset += 1;
      continue;
    }
    for (const run of findInvisibleCharacters(op.insert)) {
      removed += 1;
      const index = offset + run.index;
      const last = ranges[ranges.length - 1];
      if (last && last.index + last.length === index) last.length += run.length;
      else ranges.push({ index, length: run.length });
    }
    offset += op.insert.length;
  }
  for (let i = ranges.length - 1; i >= 0; i--) {
    yText.delete(ranges[i].index, ranges[i].length);
  }
  return removed;
}

/**
 * Every `Y.Text` held under a Yjs value, depth first: a block's `prop:text`
 * and `prop:title`, a table's cells, a database's rich-text cells, and under
 * the surface block every canvas element's text, labels and titles — whatever
 * the framework, without a list to keep in step.
 */
export function collectYTexts(value: unknown, into: Y.Text[] = []): Y.Text[] {
  if (value instanceof Y.Text) {
    into.push(value);
  } else if (value instanceof Y.Map) {
    value.forEach(child => collectYTexts(child, into));
  } else if (value instanceof Y.Array) {
    value.forEach(child => collectYTexts(child, into));
  }
  return into;
}
