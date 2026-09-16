/**
 * `deserializeXYWH` is read several times per frame per element — from
 * `deserializedXYWH`, from `elementBound`, from every `Bound.deserialize`. It
 * therefore has to tell two cases apart:
 *
 * - the value is ABSENT (a document with pending structs hands us an element
 *   whose `xywh` key never arrived): a zero-size bound, in silence. The surface
 *   reports such an element once, at mount; a getter on the render path must
 *   not repeat it thousands of times a second.
 * - the value is a genuinely MALFORMED string: still a zero-size bound, but the
 *   console keeps the trace, because nothing else will report it.
 */
import { describe, expect, test, vi } from 'vitest';

import { deserializeXYWH } from '../gfx/xywh.js';

describe('deserializeXYWH', () => {
  test('parses a serialized bound', () => {
    expect(deserializeXYWH('[1,2,3,4]')).toEqual([1, 2, 3, 4]);
  });

  test('reads an absent value as a zero-size bound, in silence', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(deserializeXYWH(undefined as never)).toEqual([0, 0, 0, 0]);
    expect(deserializeXYWH(null as never)).toEqual([0, 0, 0, 0]);

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  test('stays silent over a render loop of absent reads', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    for (let i = 0; i < 100; i++) {
      deserializeXYWH(undefined as never);
    }

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  test('still reports a malformed string', () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(deserializeXYWH('not a bound')).toEqual([0, 0, 0, 0]);

    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});
