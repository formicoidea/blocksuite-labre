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
 * The fix only changes which NEW keys are generated; stored keys are read and
 * compared exactly as before, so nothing here touches the stored format.
 */
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

  it('returns fast and in order for a forged 100 KB b (bounded loop)', () => {
    const postfix = 'x'.repeat(32);
    const a = 'a100' + postfix;
    const b = 'a10' + '10'.repeat(50_000) + '10' + postfix;
    const started = performance.now();
    const key = between(a, b);
    const elapsed = performance.now() - started;
    expect(a < key && key < b).toBe(true);
    // a wide budget: the unbounded loop took tens of seconds here
    expect(elapsed).toBeLessThan(200);
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
