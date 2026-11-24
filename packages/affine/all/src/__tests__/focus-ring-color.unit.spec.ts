import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  ROOT,
  SCAN_DIRS,
  sourceFiles,
  toRepoRelative,
} from './translations/source-files.js';

/**
 * Every keyboard focus ring reads `--affine-focus-ring-color` first, then the
 * colour it used before (issue #724, `DESIGN.md`, The Focus Ring Rule).
 *
 * The ring shared `--affine-primary-color` with fills that carry a white
 * label (a date picker's selected day, an embed card's "Save"). In dark, no
 * single value gives the ring 3:1 under the canvas toolbar's hover veil and
 * the label 4.5:1 on the fill (the Labre host measured both on 4.1.0). So a
 * ring reads its own variable, falling back to the old token: a host that
 * does not set it sees no change.
 *
 * **This spec would have caught** a new focus rule whose outline or
 * box-shadow takes a colour token without the ring's variable read first,
 * or a toolbar ring (`[data-keyboard-highlight]`, `.cell-ring`, a tool
 * button's `::after`) whose border does. A declaration is judged whole,
 * however Prettier wraps it. Out of scope: a text field's own border on
 * `:focus` (its active state, not a ring); a ring drawn from a selector
 * without `:focus` (the date picker's halo, the menus' `.focused`), held by
 * review alone.
 */

const SCAN_TIMEOUT_MS = 90_000;
const RING_VARIABLE = '--affine-focus-ring-color';

// A selector a focus outline hangs on. Matches ".x:focus-visible",
// "input:focus"; rejects ".field-content.is-focus".
// https://regex101.com/?regex=%3Afocus&testString=.x%3Afocus-visible%0A.field-content.is-focus
const FOCUS_SELECTOR = /:focus/;
// A selector whose BORDER is a keyboard ring. Matches
// "[data-keyboard-highlight]", ".cell-ring",
// ":host(:focus-visible) .icon-container::after"; rejects ".cell-rings" and
// ".chip::after".
// https://regex101.com/?regex=%5C%5Bdata-keyboard-highlight%5C%5D%7C%5C.cell-ring%5Cb%7C%3Afocus%5B%5E%7B%5D*%3A%3Aafter&testString=.cell-ring%0A%3Ahost(%3Afocus-visible)%20.icon-container%3A%3Aafter%0A.cell-rings%0A.chip%3A%3Aafter
const RING = /\[data-keyboard-highlight\]|\.cell-ring\b|:focus[^{]*::after/;
// Every opening brace. Matches the "{" of ".x {"; rejects "}".
// https://regex101.com/?regex=%5C%7B&testString=.x%20%7B%0A%7D
const OPEN_BRACE = /\{/g;
// A template interpolation, braces and all. Matches "${unsafeCSS(W)}";
// rejects "{ outline: none }".
// https://regex101.com/?regex=%5C%24%5C%7B%5B%5E%7D%5D*%5C%7D&testString=%24%7BunsafeCSS(W)%7D%0A%7B%20outline%3A%20none%20%7D
const INTERPOLATION = /\$\{[^}]*\}/g;
// An outline declaration taking a colour token (interpolations read as
// "TOKEN"). Matches "outline: 2px solid var(--x);", "outline-color: TOKEN;";
// rejects "outline-offset: -2px;" and "outline: none;".
// https://regex101.com/?regex=%5E%5Cs*outline%28%3F%3A-color%29%3F%5Cs*%3A%5B%5E%3B%5D*%28%3F%3Avar%5C%28%7CTOKEN%29&testString=outline%3A%202px%20solid%20var%28--x%29%3B%0Aoutline-color%3A%20TOKEN%3B%0Aoutline-offset%3A%20-2px%3B%0Aoutline%3A%20none%3B
const OUTLINE_COLOUR = /^\s*outline(?:-color)?\s*:[^;]*(?:var\(|TOKEN)/;
// The same for a border. Matches "border: 2px solid var(--x);"; rejects
// "border-radius: 8px;".
// https://regex101.com/?regex=%5E%5Cs*border%28%3F%3A-color%29%3F%5Cs*%3A%5B%5E%3B%5D*%28%3F%3Avar%5C%28%7CTOKEN%29&testString=border%3A%202px%20solid%20var%28--x%29%3B%0Aborder-radius%3A%208px%3B
const BORDER_COLOUR = /^\s*border(?:-color)?\s*:[^;]*(?:var\(|TOKEN)/;
// A box-shadow taking a colour token. Matches
// "box-shadow: 0 0 0 3px var(--x)"; rejects "box-shadow: none".
// https://regex101.com/?regex=%5E%5Cs*box-shadow%5Cs*%3A%5B%5E%3B%5D*%28%3F%3Avar%5C%28%7CTOKEN%29&testString=box-shadow%3A%200%200%200%203px%20var%28--x%29%0Abox-shadow%3A%20none
const SHADOW_COLOUR = /^\s*box-shadow\s*:[^;]*(?:var\(|TOKEN)/;
// Whitespace, and the whitespace after an opening parenthesis, as Prettier
// wraps a long value. Matches the newline and indent of "var(\n  --x";
// rejects "x".
// https://regex101.com/?regex=%5C%28%5Cs%2B%7C%5Cs%2B&testString=var(%0A%20%20--x
const WRAPPING = /\(\s+|\s+/g;
// The first colour a declaration reads. Matches the "var(" of
// "solid var(--x)" and the "TOKEN" of "solid TOKEN"; rejects "solid red".
// https://regex101.com/?regex=var%5C%28%7CTOKEN&testString=solid%20var(--x)%0Asolid%20TOKEN%0Asolid%20red
const FIRST_COLOUR = /var\(|TOKEN/;

/** A declaration on one line: `var(\n  --x` reads `var(--x`. */
const unwrap = (declaration: string) =>
  declaration.replace(WRAPPING, space => (space.startsWith('(') ? '(' : ' '));

/** Whether the ring's variable is the first `var(` a declaration reads. */
const readsRingFirst = (declaration: string) => {
  // The first colour read, a `var(` or an interpolation (`TOKEN`): a
  // declaration coloured by an interpolation alone holds no `var(` at all.
  const first = declaration.search(FIRST_COLOUR);
  return first !== -1 && first === declaration.indexOf(`var(${RING_VARIABLE}`);
};

/**
 * Every `selector { body }` of a source, as CSS-in-TS writes them. An
 * interpolation is read as `TOKEN` first: its braces would otherwise close
 * the rule early (a width computed with `unsafeCSS` before the ring's border).
 */
function rules(raw: string) {
  const source = raw.replace(INTERPOLATION, 'TOKEN');
  return [...source.matchAll(OPEN_BRACE)].flatMap(match => {
    const open = match.index;
    const close = source.indexOf('}', open);
    if (close === -1) return [];
    const before = source.slice(0, open);
    const start = Math.max(
      before.lastIndexOf('}'),
      before.lastIndexOf(';'),
      before.lastIndexOf('`')
    );
    return [
      {
        selector: before.slice(start + 1),
        body: source.slice(open + 1, close),
        line: before.split('\n').length,
      },
    ];
  });
}

function offendersIn(
  file: string,
  source = readFileSync(join(ROOT, file), 'utf8')
): string[] {
  return rules(source).flatMap(rule => {
    const checks = [
      ...(FOCUS_SELECTOR.test(rule.selector) ? [OUTLINE_COLOUR] : []),
      // A shadow on `:focus` / `:focus-within` is a text field's active glow
      // (`--affine-active-shadow`); on `:focus-visible` it is a ring.
      ...(rule.selector.includes(':focus-visible') ? [SHADOW_COLOUR] : []),
      ...(RING.test(rule.selector) ? [BORDER_COLOUR] : []),
    ];
    return rule.body
      .split(';')
      .map(unwrap)
      .filter(
        declaration =>
          checks.some(check => check.test(declaration)) &&
          !readsRingFirst(declaration)
      )
      .map(declaration => `${file}:${rule.line} ${declaration.trim()}`);
  });
}

describe('focus ring colour', () => {
  test(
    'every focus ring reads --affine-focus-ring-color first',
    () => {
      const offenders = SCAN_DIRS.flatMap(dir =>
        sourceFiles(join(ROOT, dir)).map(toRepoRelative)
      )
        .filter(file => !file.includes('__tests__'))
        .flatMap(file => offendersIn(file));
      expect(offenders).toEqual([]);
    },
    SCAN_TIMEOUT_MS
  );

  // The guard tests itself on rules written the ways the code base does.
  test.each([
    ['one line', '.x:focus-visible { outline: 2px solid var(--a); }', 1],
    [
      'wrapped by Prettier',
      '.x:focus-visible {\n  outline: 2px solid\n    var(--a);\n}',
      1,
    ],
    [
      'an interpolation alone',
      '.x:focus-visible { outline: 2px solid ${token}; }',
      1,
    ],
    [
      'the ring read second',
      '.x:focus-visible { outline: 2px solid var(--a, var(--affine-focus-ring-color)); }',
      1,
    ],
    [
      'a ring shadow',
      '.x:focus-visible { box-shadow: 0 0 0 2px var(--a); }',
      1,
    ],
    [
      'a toolbar ring border',
      '.cell-ring { width: ${w}px; border: 2px solid var(--a); }',
      1,
    ],
    [
      'the ring read first, wrapped',
      '.x:focus-visible {\n  outline: 2px solid\n    var(\n      --affine-focus-ring-color,\n      ${token}\n    );\n}',
      0,
    ],
    [
      "a text field's active glow",
      '.x:focus { box-shadow: var(--affine-active-shadow); }',
      0,
    ],
  ])('%s', (_case, source, count) => {
    expect(offendersIn('fixture.ts', source)).toHaveLength(count);
  });
});
