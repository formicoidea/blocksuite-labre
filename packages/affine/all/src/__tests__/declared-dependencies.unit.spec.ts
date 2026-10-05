import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { builtinModules } from 'node:module';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import {
  ROOT,
  sourceFiles,
  toRepoRelative,
} from './translations/source-files.js';

/**
 * Every package an `src` file imports is declared in that package's own
 * `dependencies` (or `peerDependencies`).
 *
 * `scripts/build-bundles.mjs` derives each published bundle's `dependencies`
 * from the manifests of the workspace packages it vendors (`thirdPartyDeps`),
 * never from the imports. A runtime import the manifest does not declare
 * still works inside this workspace, because Yarn hoists the package from a
 * sibling, and ships broken: the bundle a host installs does not ask for it.
 * A `devDependencies` entry is not enough either, the script reads only
 * `dependencies`. Workspace edges matter as much: an undeclared `@labre/*`
 * import is an edge `tsc -b` and the bundle script cannot see, which is how
 * six type-only `@labre/affine/*` imports in lower layers put every package
 * of the workspace on a cycle through the umbrella.
 *
 * **This spec would have caught** `@labre/affine-gfx-ddd-shared` importing
 * `yjs` at run time (`src/shared/prefabs.ts`) with no `yjs` in its manifest:
 * the `@formicoidea/labre-ddd-shared` bundle depended on `yjs` being hoisted
 * by the host.
 *
 * ## Scope
 *
 * The shipped source of every workspace package: its `src`, through the
 * walker the i18n and brand-hex guards share, so tests, benches, stories and
 * declarations are out. Type-only imports count, since the published bundles
 * ship their `.d.ts`. A bare `hast` is satisfied by `@types/hast`.
 */

/**
 * Module specifiers in statement position: `import … from`, `export … from`,
 * a side-effect `import '…'`, a dynamic `import('…')` and a
 * `declare module '…'` augmentation. Static clauses start a line and cannot
 * hold a quote, so prose that says "from 'x'" in a string never matches.
 */
const SPECIFIERS = [
  /^[ \t]*(?:import|export)\b[^'"`;]*?\bfrom\s*['"]([^'"]+)['"]/gm,
  /^[ \t]*import\s*['"]([^'"]+)['"]/gm,
  /\bimport\(\s*['"]([^'"]+)['"]\s*\)/g,
  /^[ \t]*declare\s+module\s+['"]([^'"]+)['"]/gm,
];

const BUILTINS = new Set(builtinModules);

/** The package a bare specifier names, or `null` for anything else. */
function packageOf(specifier: string): string | null {
  if (/^[./*]|^[a-z]+:/.test(specifier)) return null;
  const parts = specifier.split('?')[0].split('/');
  const name = specifier.startsWith('@')
    ? parts.slice(0, 2).join('/')
    : parts[0];
  return BUILTINS.has(name) ? null : name;
}

function importedSpecifiers(source: string): Set<string> {
  const found = new Set<string>();
  for (const pattern of SPECIFIERS) {
    for (const [, specifier] of source.matchAll(pattern)) found.add(specifier);
  }
  return found;
}

function importedPackages(source: string): Set<string> {
  const found = new Set<string>();
  for (const specifier of importedSpecifiers(source)) {
    const name = packageOf(specifier);
    if (name) found.add(name);
  }
  return found;
}

function manifestDirs(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    if (entry.name === 'node_modules' || entry.name === 'dist') continue;
    if (entry.name === 'src') continue;
    const path = join(dir, entry.name);
    if (existsSync(join(path, 'package.json'))) out.push(path);
    manifestDirs(path, out);
  }
  return out;
}

describe('declared dependencies guard', () => {
  test('the parser reads every import shape and no prose', () => {
    const found = importedPackages(
      [
        `import { html } from 'lit';`,
        `import {`,
        `  type Root,`,
        `} from 'mdast';`,
        `import type * as Y from 'yjs';`,
        `export { z } from 'zod/v4';`,
        `import '@labre/std/effects';`,
        `const k = await import('katex');`,
        `declare module '@labre/store' {}`,
        `import { a } from './local.js';`,
        `import { b } from 'node:fs';`,
        `const text = 'take it from "there" and from \\'here\\'';`,
        ` * import { c } from 'in-a-docblock';`,
      ].join('\n')
    );

    expect([...found].sort()).toEqual([
      '@labre/std',
      '@labre/store',
      'katex',
      'lit',
      'mdast',
      'yjs',
      'zod',
    ]);
  });

  test('every package an src file imports is in its own manifest', () => {
    const missing: string[] = [];
    let scanned = 0;
    for (const dir of manifestDirs(join(ROOT, 'packages'))) {
      if (!existsSync(join(dir, 'src'))) continue;
      const manifest = JSON.parse(
        readFileSync(join(dir, 'package.json'), 'utf8')
      );
      const declared = new Set([
        ...Object.keys(manifest.dependencies ?? {}),
        ...Object.keys(manifest.peerDependencies ?? {}),
        manifest.name,
      ]);
      scanned++;
      for (const file of sourceFiles(join(dir, 'src'))) {
        for (const name of importedPackages(readFileSync(file, 'utf8'))) {
          if (declared.has(name) || declared.has(`@types/${name}`)) continue;
          missing.push(`${toRepoRelative(file)}: ${name}`);
        }
      }
    }

    expect(scanned).toBeGreaterThan(70);
    expect(
      missing,
      'An `src` file imports a package its manifest does not declare. Add it ' +
        'to `dependencies` (`workspace:*` for a `@labre/*` package, the range ' +
        'the other packages use for a third-party one), and a tsconfig ' +
        '`references` entry for a workspace package.'
    ).toEqual([]);
    // Same ceiling as `brand-hex.unit.spec.ts`: this walks the whole
    // workspace source, and under `yarn test:unit` workers share the disk.
  }, 90_000);
});

/**
 * No file a published bundle ships imports React or test tooling.
 *
 * React inside the library is forbidden (`CLAUDE.md`, Stack), and a test
 * runner is not something a host should install to open a document. A
 * manifest entry is not the whole story: `scripts/build-bundles.mjs` copies
 * every file under a vendored package's `src` except `__tests__`, whatever
 * the package's `exports` say, so a helper kept beside the shipped code ships
 * with it.
 *
 * **This spec would have caught** three defects of the 0.44 bundles:
 * `@labre/affine-components/icons` re-exporting `file-icons-rc.ts`, whose
 * `@blocksuite/icons/rc` loads `react/jsx-runtime` at run time with no `react`
 * declared anywhere a host installs; `@labre/affine-shared` keeping its
 * `vitest` helpers in `src/test-utils`, outside `__tests__`, so the core
 * bundle shipped them; and `@labre/data-view` listing `vitest` under
 * `dependencies` (the manifest half of the same leak).
 *
 * ## Scope
 *
 * The packages `build-bundles.mjs` vendors: the `@labre/affine` umbrella and
 * every `@labre/*` package it depends on. Files are walked the way the script
 * copies them (everything under `src` but `__tests__`), not through the i18n
 * walker, which also skips stray specs and `.d.ts` files that do ship.
 */
const FORBIDDEN_PACKAGES = new Set(['react', 'react-dom', 'vitest']);
const FORBIDDEN_SPECIFIERS = ['@blocksuite/icons/rc'];

function isForbidden(specifier: string): boolean {
  if (FORBIDDEN_PACKAGES.has(packageOf(specifier) ?? '')) return true;
  return FORBIDDEN_SPECIFIERS.some(
    forbidden =>
      specifier === forbidden || specifier.startsWith(`${forbidden}/`)
  );
}

/** Every `.ts` file `build-bundles.mjs` copies out of `dir`. */
function shippedFiles(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === '__tests__' || entry.name === 'node_modules') continue;
    const path = join(dir, entry.name);
    if (entry.isDirectory()) shippedFiles(path, out);
    else if (entry.name.endsWith('.ts')) out.push(path);
  }
  return out;
}

describe('published source guard', () => {
  test('the filter names React and test tooling and nothing else', () => {
    expect(
      [
        'react',
        'react/jsx-runtime',
        'react-dom/client',
        'vitest',
        '@blocksuite/icons/rc',
        '@blocksuite/icons/lit',
        'lit',
        'reactive-element',
        './vitest.js',
      ].filter(isForbidden)
    ).toEqual([
      'react',
      'react/jsx-runtime',
      'react-dom/client',
      'vitest',
      '@blocksuite/icons/rc',
    ]);
  });

  test('no shipped file or manifest pulls in react, react-dom, @blocksuite/icons/rc or vitest', () => {
    const umbrella = JSON.parse(
      readFileSync(join(ROOT, 'packages/affine/all/package.json'), 'utf8')
    );
    const vendored = new Set([
      umbrella.name,
      ...Object.keys(umbrella.dependencies ?? {}).filter(name =>
        name.startsWith('@labre/')
      ),
    ]);
    const offending: string[] = [];
    let scanned = 0;
    for (const dir of manifestDirs(join(ROOT, 'packages'))) {
      if (!existsSync(join(dir, 'src'))) continue;
      const manifest = JSON.parse(
        readFileSync(join(dir, 'package.json'), 'utf8')
      );
      if (!vendored.has(manifest.name)) continue;
      scanned++;
      // `thirdPartyDeps` copies these into the bundle a host installs.
      for (const name of Object.keys({
        ...manifest.dependencies,
        ...manifest.peerDependencies,
      })) {
        if (FORBIDDEN_PACKAGES.has(name)) {
          offending.push(`${toRepoRelative(dir)}/package.json: ${name}`);
        }
      }
      for (const file of shippedFiles(join(dir, 'src'))) {
        for (const specifier of importedSpecifiers(
          readFileSync(file, 'utf8')
        )) {
          if (isForbidden(specifier)) {
            offending.push(`${toRepoRelative(file)}: ${specifier}`);
          }
        }
      }
    }

    expect(scanned).toBe(vendored.size);
    expect(
      offending,
      'A published bundle would ship or install React or test tooling. Test ' +
        'helpers live under `src/__tests__`, which the bundle script skips, ' +
        'and their packages under `devDependencies`; icons come from ' +
        '`@blocksuite/icons/lit`.'
    ).toEqual([]);
  }, 90_000);
});
