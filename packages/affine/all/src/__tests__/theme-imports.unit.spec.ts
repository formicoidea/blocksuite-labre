import { readFileSync } from 'node:fs';

import { describe, expect, test } from 'vitest';

import { allSourceFiles, toRepoRelative } from './translations/source-files.js';

/**
 * The theme contract: the exact set of names the library imports from
 * `@toeverything/theme`, frozen.
 *
 * The theme is a host seam (issue #412, `docs/integrate/04-host-seams.md`).
 * The library keeps depending on the public `@toeverything/theme`, and a host
 * re-skins the editor by overriding that package name in its package manager
 * with a copy of its own (the Labre app links a private theme in its place).
 * The library compiles against whatever the override resolves to, so the
 * substitute has to export every name listed below, and nothing else tells
 * the host which names those are: `docs/integrate/01-install.md` § Styles
 * prints this list for them.
 *
 * **This spec would have caught** a new named import from the theme package
 * landing silently: the library builds green here against the upstream
 * package, every host that substitutes it breaks at its next build on a
 * missing export, and the documented list is stale. A namespace or default
 * import, a new subpath, or a dynamic `import()` fails too, because each one
 * widens the contract past a list of names. Changing `THEME_CONTRACT` is
 * allowed; it is a deliberate change that updates the docs in the same PR.
 *
 * ## Scope
 *
 * Every shipped `.ts` file under `packages/affine` and `packages/framework`,
 * through the walker the brand-hex and i18n guards share. The playground and
 * the integration suite are left out on purpose: their side-effect imports of
 * `style.css` and `fonts.css` are the host's job, documented as such, not
 * names the library compiles against.
 */

const THEME_CONTRACT: Record<string, readonly string[]> = {
  '@toeverything/theme': [
    'AffineCssVariables',
    'AffineTheme',
    'baseTheme',
    'combinedDarkCssVariables',
    'combinedLightCssVariables',
    'cssVar',
  ],
  '@toeverything/theme/v2': [
    'AffineThemeKeyV2',
    'cssVarV2',
    'darkThemeV2',
    'lightThemeV2',
    'themeToVar',
  ],
};

/**
 * One static `import … from` / `export … from` of the theme package, any
 * subpath. The clause cannot hold a quote, so a match never runs across an
 * earlier import of another module to reach this one.
 */
const STATIC_FROM =
  /\b(?:import|export)\s+(?:type\s+)?([^'"`;]*?)\s*from\s*['"](@toeverything\/theme(?:\/[^'"]*)?)['"]/g;

/** Every quoted reference to the package, whatever statement holds it. */
const ANY_REFERENCE = /['"]@toeverything\/theme(?:\/[^'"]*)?['"]/g;

/**
 * The imported names of a clause (`{ type A, b as c }` gives `A`, `b`), or
 * the raw clause when it is not a list of names (`* as theme`, a default
 * import), so that it shows up in the diff instead of being dropped.
 */
function importedNames(clause: string): string[] {
  const braces = /^\{([\s\S]*)\}$/.exec(clause.trim());
  if (!braces) return [`<${clause.trim().replace(/\s+/g, ' ')}>`];
  return braces[1]
    .split(',')
    .map(part => part.trim())
    .filter(part => part.length > 0)
    .map(part => part.replace(/^type\s+/, '').split(/\s+as\s+/)[0]);
}

function collectThemeImports(source: string, into: Map<string, Set<string>>) {
  let recognised = 0;
  for (const [, clause, specifier] of source.matchAll(STATIC_FROM)) {
    recognised++;
    const names = into.get(specifier) ?? new Set<string>();
    importedNames(clause).forEach(name => names.add(name));
    into.set(specifier, names);
  }
  return recognised;
}

function sorted(map: Map<string, Set<string>>): Record<string, string[]> {
  const out: Record<string, string[]> = Object.create(null);
  for (const key of [...map.keys()].sort()) {
    out[key] = [...map.get(key)!].sort();
  }
  return out;
}

describe('theme contract guard', () => {
  test('the parser reads every import shape the library writes', () => {
    const found = new Map<string, Set<string>>();
    const count = collectThemeImports(
      [
        `import { html } from 'lit';`,
        `import {`,
        `  type AffineCssVariables,`,
        `  cssVar,`,
        `} from '@toeverything/theme';`,
        `export { cssVar } from '@toeverything/theme';`,
        `import type { AffineThemeKeyV2 } from '@toeverything/theme/v2';`,
        `import { cssVarV2 as v } from "@toeverything/theme/v2";`,
        `import * as theme from '@toeverything/theme';`,
      ].join('\n'),
      found
    );

    expect(count).toBe(5);
    expect(sorted(found)).toEqual({
      '@toeverything/theme': ['<* as theme>', 'AffineCssVariables', 'cssVar'],
      '@toeverything/theme/v2': ['AffineThemeKeyV2', 'cssVarV2'],
    });
  });

  test('the library imports exactly the documented names from the theme package', () => {
    const files = allSourceFiles();
    expect(files.length).toBeGreaterThan(100);

    const found = new Map<string, Set<string>>();
    const unrecognised: string[] = [];
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      const references = source.match(ANY_REFERENCE)?.length ?? 0;
      if (references === 0) continue;
      const recognised = collectThemeImports(source, found);
      if (recognised !== references) {
        unrecognised.push(
          `${toRepoRelative(file)}: ${references - recognised} reference(s) ` +
            'outside a static import (a side-effect or dynamic import?)'
        );
      }
    }

    expect(
      unrecognised,
      'The theme package is reached outside a static named import. A host ' +
        'substitutes `@toeverything/theme` by overriding the package, so the ' +
        'library may only depend on the names listed in `THEME_CONTRACT`.'
    ).toEqual([]);
    expect(
      sorted(found),
      'The set of names imported from `@toeverything/theme` changed. Every ' +
        'host that substitutes the theme package must export these names: ' +
        'update `THEME_CONTRACT`, `docs/integrate/01-install.md` (Styles) and ' +
        '`docs/integrate/04-host-seams.md` (Theme) in the same PR.'
    ).toEqual(THEME_CONTRACT);
    // Same ceiling as `brand-hex.unit.spec.ts`: this walks the whole library
    // source, and under `yarn test:unit` every package's workers share the disk.
  }, 90_000);
});
