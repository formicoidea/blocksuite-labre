import { readFileSync } from 'node:fs';
import { describe, expect, test } from 'vitest';

/**
 * Shift+wheel must scroll the canvas sideways on every platform.
 *
 * The decision is one boolean inside `_initWheelEvent`, and that method is
 * unreachable from a unit test: it hangs off a live `EdgelessRootBlockComponent`
 * — a custom element with a store, a gfx controller and a viewport behind it.
 * So this test reads the decision out of the source, the same way
 * `reserved-keys.unit.spec.ts` reads the edgeless hotkey bindings: the
 * expression itself is the contract, and it is checked against the truth table
 * of the input devices it is meant to serve.
 */
// Repo-relative: the transform rewrites `import.meta.url` to a non-file URL,
// and vitest runs from the workspace root.
const SOURCE = readFileSync(
  'packages/affine/blocks/root/src/edgeless/edgeless-root-block.ts',
  'utf8'
);

/**
 * The right-hand side of `const simulateHorizontalScroll = …;`, compiled into
 * a predicate over the two things it is allowed to read.
 */
function horizontalScrollPredicate(): (
  e: { shiftKey: boolean; deltaX: number },
  isWindows: boolean
) => boolean {
  const match = SOURCE.match(/const simulateHorizontalScroll =([^;]+);/);
  if (!match) {
    throw new Error(
      'could not find `simulateHorizontalScroll` in edgeless-root-block.ts — ' +
        'the wheel handler moved, re-point this test at it'
    );
  }
  return new Function(
    'e',
    'IS_WINDOWS',
    `return Boolean(${match[1]});`
  ) as ReturnType<typeof horizontalScrollPredicate>;
}

const WINDOWS = true;
const OTHER = false;

describe('shift + wheel scrolls horizontally', () => {
  const simulate = horizontalScrollPredicate();

  test('a plain mouse gets a horizontal scroll on every platform', () => {
    // Nothing but a vertical wheel: the browser reports no horizontal delta,
    // so the vertical one has to stand in for it — Windows or not.
    expect(simulate({ shiftKey: true, deltaX: 0 }, WINDOWS)).toBe(true);
    expect(simulate({ shiftKey: true, deltaX: 0 }, OTHER)).toBe(true);
  });

  test('a native horizontal delta is left alone off Windows', () => {
    // Trackpads and tilt-wheel mice already turn shift+wheel into deltaX on
    // macOS and Linux; reinterpreting deltaY there would scroll twice.
    expect(simulate({ shiftKey: true, deltaX: -40 }, OTHER)).toBe(false);
  });

  test('Windows always needs the substitution', () => {
    // Windows never produces a horizontal delta for shift+wheel.
    expect(simulate({ shiftKey: true, deltaX: -40 }, WINDOWS)).toBe(true);
  });

  test('without shift, the wheel scrolls vertically', () => {
    expect(simulate({ shiftKey: false, deltaX: 0 }, WINDOWS)).toBe(false);
    expect(simulate({ shiftKey: false, deltaX: 0 }, OTHER)).toBe(false);
    expect(simulate({ shiftKey: false, deltaX: -40 }, OTHER)).toBe(false);
  });
});
