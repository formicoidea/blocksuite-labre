/**
 * Why this spec exists: `generateFractionalIndexingKeyBetween(a, b)` must
 * return a key strictly between its neighbours, because the table block
 * sorts its stored rows and columns by these keys. When the two subkeys
 * share a prefix it falls back to `generateKeyBetween(a, b) + '0' + postfix`,
 * and when `b` itself continues with that key plus `'0'` the random postfix
 * decided the order: the new row could land AFTER `b` (issue #655, upstream
 * toeverything/AFFiNE#15709). Inserting right after the first key reached
 * that case within about twenty inserts.
 *
 * The loop that moves the key towards `b` is bounded: a forged `order`
 * (from a peer, a pasted or imported snapshot) shaped as `a10` + `10` x N
 * made it run once per repetition, quadratic in the length of `b`, and a
 * 100 KB key froze the tab for about 50 s on a table row insert. Legitimate
 * keys reach that bound too (inserting right after the first row needs 32
 * steps by the 150th insert): past it the key must keep its random postfix.
 * A first bound returned the bare middle key instead, the same on every
 * peer, so two peers inserting at the same place got equal keys and a later
 * insert between them threw `a should be smaller than b`.
 *
 * Keys are also bounded in length (4096 characters): the package's
 * `midpoint` recurses once per character of a run of `z`, so a forged
 * `a0` + `z` x 20000 overflowed the stack with an anonymous `RangeError`.
 * Such a key now fails with a named `BlockSuiteError` whose message does not
 * quote the key, before the package is called; legitimate keys never reach
 * the bound (the longest series measured, 20000 inserts right before the
 * same row, ends at 4035 characters; every other pattern stays under 310).
 *
 * The fix only changes which NEW keys are generated; stored keys are read and
 * compared exactly as before, so nothing here touches the stored format.
 */
import { BlockSuiteError } from '@labre/global/exceptions';
import { describe, expect, it } from 'vitest';

import { generateFractionalIndexingKeyBetween } from '../../utils/fractional-indexing.js';

const between = generateFractionalIndexingKeyBetween;

/**
 * Generates a key between a and b and records the triple when it is out of
 * order. One assertion per test: an `expect` per generated key made the
 * spec slow enough to time out on a loaded machine.
 */
function insertBetween(
  misordered: string[],
  a: string | null,
  b: string | null
) {
  const key = between(a, b);
  if ((a !== null && a >= key) || (b !== null && key >= b)) {
    misordered.push(`${a} < ${key} < ${b}`);
  }
  return key;
}

describe('generateFractionalIndexingKeyBetween', () => {
  it('stays before b when b continues with the middle key and a zero (issue #655)', () => {
    // generateKeyBetween(a, b) is 'Zz1' here and b starts with 'Zz10': the
    // random postfix used to sort the key after b about four times in ten.
    const a = 'Zz0KDAn9nhfbtFAOnyTqT45wXkV4SGW7XBh';
    const b = 'Zz10c5IY1TbnCK75NE22mfQEp2rpu6q1n6Z7';
    const misordered: string[] = [];
    for (let i = 0; i < 100; i++) {
      insertBetween(misordered, a, b);
    }
    expect(misordered).toEqual([]);
  });

  it('keeps keys ordered when inserting right after the first key', () => {
    const misordered: string[] = [];
    for (let round = 0; round < 30; round++) {
      const keys = [between(null, null)];
      keys.unshift(between(null, keys[0]));
      for (let i = 0; i < 40; i++) {
        keys.splice(1, 0, insertBetween(misordered, keys[0], keys[1]));
      }
    }
    expect(misordered).toEqual([]);
  });

  it('keeps a < key < b for random insertion points', () => {
    const misordered: string[] = [];
    for (let round = 0; round < 20; round++) {
      const keys = [between(null, null)];
      for (let i = 0; i < 60; i++) {
        // index 0 inserts before the first key, keys.length after the last
        const at = Math.floor(Math.random() * (keys.length + 1));
        const a = at === 0 ? null : keys[at - 1];
        const b = at === keys.length ? null : keys[at];
        keys.splice(at, 0, insertBetween(misordered, a, b));
      }
    }
    expect(misordered).toEqual([]);
  });

  it('returns fast and in order for a forged b just under the length bound (bounded loop)', () => {
    const postfix = 'x'.repeat(32);
    const a = 'a100' + postfix;
    // 4037 characters: the unbounded loop ran once per '10'
    const b = 'a10' + '10'.repeat(2_000) + '10' + postfix;
    expect(b.length).toBeLessThanOrEqual(4096);
    const started = performance.now();
    const key = between(a, b);
    const elapsed = performance.now() - started;
    expect(a < key && key < b).toBe(true);
    // a wide budget: the unbounded loop took tens of seconds on 100 KB
    expect(elapsed).toBeLessThan(200);
  });

  it('refuses a forged key past the length bound with a named error, not a RangeError', () => {
    const forged = 'a0' + 'z'.repeat(20_000);
    const failures = [
      () => between(forged, 'a1'),
      () => between('a0', 'a10' + '10'.repeat(50_000) + 'x'.repeat(32)),
      () => between(forged, null),
      () => between(null, 'a1' + 'z'.repeat(5_000)),
    ].map(generate => {
      try {
        generate();
        return null;
      } catch (error) {
        return error;
      }
    });
    for (const error of failures) {
      expect(error).toBeInstanceOf(BlockSuiteError);
      expect((error as Error).message).not.toContain('zzzz');
      expect((error as Error).message).not.toContain('1010');
    }
  });

  it('never refuses a key from a long series of legitimate inserts', () => {
    const lengths: number[] = [];
    // random places, the usual pattern
    let keys = [between(null, null)];
    for (let i = 0; i < 8_000; i++) {
      const at = Math.floor(Math.random() * (keys.length + 1));
      const a = at === 0 ? null : keys[at - 1];
      const b = at === keys.length ? null : keys[at];
      const key = between(a, b);
      lengths.push(key.length);
      keys.splice(at, 0, key);
    }
    // again and again right after the first row (the #655 path), then right
    // before the same row (the only pattern whose keys keep growing)
    for (const side of ['after first', 'before last'] as const) {
      keys = [between(null, null)];
      keys.push(between(keys[0], null));
      for (let i = 0; i < 2_000; i++) {
        const key = between(keys[0], keys[1]);
        lengths.push(key.length);
        keys.splice(1, 0, key);
        if (side === 'before last') keys.shift();
      }
    }
    // the bound is 4096 characters
    expect(Math.max(...lengths)).toBeLessThan(1_000);
  });

  it('keeps every key postfixed and unique past the step bound', () => {
    // A generated key ends with '0' and a 32-character random postfix.
    const postfixed = (key: string) =>
      key.length > 33 && key[key.length - 33] === '0';
    const faulty: string[] = [];
    for (let round = 0; round < 2; round++) {
      const keys = [between(null, null)];
      keys.unshift(between(null, keys[0]));
      const seen = new Set(keys);
      // the bound is reached from about the 80th insert on
      for (let i = 0; i < 200; i++) {
        const key = insertBetween(faulty, keys[0], keys[1]);
        if (!postfixed(key) || seen.has(key)) faulty.push(key);
        seen.add(key);
        keys.splice(1, 0, key);
      }
    }
    expect(faulty).toEqual([]);
  });
});
