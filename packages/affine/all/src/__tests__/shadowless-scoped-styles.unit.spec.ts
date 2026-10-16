import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

import { describe, expect, test } from 'vitest';

import { allSourceFiles, toRepoRelative } from './translations/source-files.js';

/**
 * GUARD — the styles of a light-DOM element (`ShadowlessElement`) are scoped
 * by hand.
 *
 * `ShadowlessElement.finalizeStyles` appends the class's `styles` to
 * `document.head` as soon as the element is defined, rendered or not. A rule
 * that starts with a bare element (`input { flex: 1 }`) therefore applies to
 * every `<input>` of the HOST page.
 *
 * What it would have caught: `reference-popup` declared `input { display:
 * flex; flex: 1; border: none; background: transparent }`, which stretched the
 * Labre asset dialog's search field to the dialog's width once an editor was
 * mounted; `link-popup` declared `input:focus { outline: none }`, which
 * removed the focus ring of every input of the host page (P7, 2026-10-16).
 *
 * How it checks: every file that declares a `ShadowlessElement` subclass, plus
 * the style modules it imports relatively (`./styles.js`), has each `css`
 * template parsed; a top-level selector that starts with a plain HTML tag
 * fails, attribute or not (`div[data-orientation]`). A custom element tag
 * (`reference-popup input`), a class or an id (`input.my-input` too) or
 * `:host` is a scope. A style helper's selector argument
 * (`fontXSStyle('input')`) is checked like a selector.
 */

const BARE = /^[a-z][a-z0-9]*(?=$|[\s:[>+~])/;

function bareSelectors(source: string): string[] {
  const out: string[] = [];
  for (const match of source.matchAll(/\bcss`((?:[^`\\]|\\.)*)`/g)) {
    const body = match[1]!
      .replace(
        /\$\{\s*\w+\(\s*(['"])([^'"]+)\1[^}]*\}/g,
        (_, _q: string, selector: string) => `${selector} {}`
      )
      .replace(/\$\{[^}]*\}/g, '')
      .replace(/\/\*[\s\S]*?\*\//g, '');
    const stack: Array<'rule' | 'at' | 'keyframes'> = [];
    let prelude = '';
    for (const ch of body) {
      if (ch === '{') {
        const selector = prelude.trim();
        prelude = '';
        const parent = stack.at(-1);
        if (
          !selector.startsWith('@') &&
          parent !== 'rule' &&
          parent !== 'keyframes'
        ) {
          for (const part of selector.split(',')) {
            if (BARE.test(part.trim())) out.push(part.trim());
          }
        }
        stack.push(
          selector.startsWith('@keyframes')
            ? 'keyframes'
            : selector.startsWith('@')
              ? 'at'
              : 'rule'
        );
      } else if (ch === '}') {
        stack.pop();
        prelude = '';
      } else if (ch === ';') {
        prelude = '';
      } else {
        prelude += ch;
      }
    }
  }
  return out;
}

function shadowlessStyleFiles(): string[] {
  const files = new Set<string>();
  for (const file of allSourceFiles()) {
    const source = readFileSync(file, 'utf8');
    if (!/extends\s[^{]*\bShadowlessElement\b/.test(source)) continue;
    files.add(file);
    for (const [, spec] of source.matchAll(
      /from\s+'(\.{1,2}\/[^']*styles?(?:\.js)?)'/g
    )) {
      const path = resolve(dirname(file), spec!.replace(/\.js$/, '') + '.ts');
      files.add(path);
    }
  }
  return [...files];
}

describe('light-DOM styles are scoped', () => {
  test('the detector reads selectors, helpers and nesting', () => {
    expect(bareSelectors('css`input { flex: 1; }`')).toEqual(['input']);
    expect(bareSelectors("css`${fontXSStyle('input')}`")).toEqual(['input']);
    expect(
      bareSelectors(
        'css`reference-popup input, .x button, :host a { } @media (x) { button:focus { } } @keyframes k { from { } to { } }`'
      )
    ).toEqual(['button:focus']);
  });

  test('no ShadowlessElement styles a bare HTML element', () => {
    const files = shadowlessStyleFiles();
    expect(files.length).toBeGreaterThan(20);
    const offenders: string[] = [];
    for (const file of files) {
      let source: string;
      try {
        source = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      for (const selector of bareSelectors(source)) {
        offenders.push(`${toRepoRelative(file)}: ${selector}`);
      }
    }
    expect(
      offenders,
      'A light-DOM element styles every matching element of the host page. ' +
        "Prefix the selector with the element's own tag or class."
    ).toEqual([]);
  }, 90_000);
});
