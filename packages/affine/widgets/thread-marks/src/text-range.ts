import type { ThreadTextRange } from '@labre/affine-shared/services';
import * as Y from 'yjs';

/** Where a range sits in its block's text today, by index. */
export interface ResolvedThreadRange {
  index: number;
  length: number;
}

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function fromBase64(text: string): Uint8Array {
  return Uint8Array.from(atob(text), char => char.charCodeAt(0));
}

/**
 * The anchor of `length` characters from `index` in `yText` (ADR 0038,
 * amendment of 2026-10-15), or `null` for an empty run or one outside the
 * text.
 *
 * `start` sticks to the first selected character (`assoc = 0`) and `end` to
 * the last one (`assoc = -1`), so typing right after the run does not grow
 * it. Creating a relative position only reads the item ids: nothing is
 * written to the document (held by `text-range.unit.spec.ts`).
 */
export function encodeThreadRange(
  yText: Y.Text,
  index: number,
  length: number
): ThreadTextRange | null {
  if (!(length > 0) || index < 0 || index + length > yText.length) {
    return null;
  }
  const start = Y.createRelativePositionFromTypeIndex(yText, index, 0);
  const end = Y.createRelativePositionFromTypeIndex(yText, index + length, -1);
  return {
    start: toBase64(Y.encodeRelativePosition(start)),
    end: toBase64(Y.encodeRelativePosition(end)),
  };
}

function absoluteIndex(encoded: string, yText: Y.Text, doc: Y.Doc) {
  const position = Y.createAbsolutePositionFromRelativePosition(
    Y.decodeRelativePosition(fromBase64(encoded)),
    doc
  );
  // A position of another text (a host that mixed up two anchors) is not
  // this block's run.
  return position && position.type === yText ? position.index : null;
}

/**
 * Where `range` sits in `yText` now, or `null` when it cannot say: the text
 * is detached, a string is not a position, a position belongs to another
 * text, or the run collapsed because its text was deleted. Never throws: a
 * host's stored anchor may be anything, and an unresolvable range simply is
 * not drawn.
 */
export function resolveThreadRange(
  yText: Y.Text,
  range: ThreadTextRange
): ResolvedThreadRange | null {
  const doc = yText.doc;
  if (!doc) return null;
  try {
    const start = absoluteIndex(range.start, yText, doc);
    const end = absoluteIndex(range.end, yText, doc);
    if (start === null || end === null || end <= start) return null;
    return { index: start, length: end - start };
  } catch {
    return null;
  }
}
