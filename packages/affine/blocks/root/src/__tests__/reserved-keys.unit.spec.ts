import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

import { RESERVED_EDGELESS_KEYS } from '../edgeless/reserved-keys.js';

/**
 * The test that keeps the mirror honest.
 *
 * `RESERVED_EDGELESS_KEYS` claims to list the imperative edgeless bindings a
 * framework chord prefix could shadow. Nothing enforces that claim at runtime —
 * those bindings are a raw `bindHotKey({...})` object, invisible to
 * `resolveKeymap` — so it is enforced HERE, against the source, the same way
 * `scripts/build-bundles.mjs` guards the anchors it patches.
 *
 * When surface (e) is folded into real descriptors (ADR 0008 § What stays
 * sequenced), both the constant and this test are deleted.
 */
// Repo-relative: the transform rewrites `import.meta.url` to a non-file URL,
// and vitest runs from the workspace root.
const SOURCE = readFileSync(
  'packages/affine/blocks/root/src/edgeless/edgeless-keyboard.ts',
  'utf8'
);

/** Top-level keys of the `bindHotKey({...})` object literal (8-space indent). */
function boundKeys(): string[] {
  const keys = [...SOURCE.matchAll(/^ {8}'?([^\s':]+)'?: /gm)].map(m => m[1]);
  if (keys.length < 20) {
    throw new Error(
      'could not read the edgeless bindHotKey bindings — the source moved, ' +
        're-review `RESERVED_EDGELESS_KEYS` against it'
    );
  }
  return keys;
}

/**
 * A binding can only collide with a framework chord prefix if it is a BARE
 * keystroke: one character, optionally `Shift-`ed. Modifier combos (`Mod-g`,
 * `Control-d`, `Alt-0`) and named keys (`Escape`, `ArrowUp`, `Tab`) cannot.
 */
const collidable = (key: string) => /^(Shift-)?.$/.test(key);

describe('RESERVED_EDGELESS_KEYS mirrors edgeless-keyboard.ts', () => {
  test('every reserved key is really bound there', () => {
    const bound = new Set(boundKeys());
    for (const key of RESERVED_EDGELESS_KEYS) {
      expect(bound.has(key), `${key} is reserved but not bound`).toBe(true);
    }
  });

  test('every bare binding is reserved — a new one fails this test', () => {
    const bare = boundKeys().filter(collidable).sort();
    expect(bare).toEqual([...RESERVED_EDGELESS_KEYS].sort());
  });
});
