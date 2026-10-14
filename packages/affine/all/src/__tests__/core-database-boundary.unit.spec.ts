import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import * as databaseEditorView from '@labre/affine-database-editor/view';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../extensions/view.js';
import { OPTIONAL_BLOCKS } from '../flags.js';
import {
  AUXILIARY_BUNDLES,
  EDITOR_BUNDLES,
  FRAMEWORK_DESCRIPTORS,
} from '../frameworks.js';
import {
  allSourceFiles,
  ROOT,
  sourceFiles,
  toRepoRelative,
} from './translations/source-files.js';

/**
 * GUARD — the `core-database` bundle sits on core and nothing sits on it
 * (ADR 0035 §3, §4; issue B14).
 *
 * `@labre/affine-database-editor` ships as `@formicoidea/labre-core-database`,
 * pinned to the exact core version. `scripts/build-bundles.mjs` refuses, at
 * release time only, a core file that still names it once its import and
 * registration lines are stripped, and an editor bundle that imports what
 * core does not expose. Every rule below is one of those refusals moved into
 * the unit suite, the way `bundle-split.unit.spec.ts` moved the translations
 * one after 0.38.0 failed to publish.
 *
 * **What it would catch**: a core block (the database block, data-view, the
 * slash menu) importing the editor package to reach a seam identifier, which
 * ADR 0035 §3 places in core; the package importing a framework or
 * `ddd-shared`, an edge the bundle layout has no bundle for; the umbrella
 * stripping `database` from core's flags (core's own creation tooling reads
 * it) or registering the tooling half unconditionally; a descriptor naming
 * an extension the package does not export, which would emit a
 * `descriptor.ts` that does not compile.
 */

const EDITOR_PKG = '@labre/affine-database-editor';
const editor = EDITOR_BUNDLES.find(b => b.pkg === EDITOR_PKG);

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** `@labre/*` module specifiers in statement position. */
function labreSpecifiers(source: string): string[] {
  return [
    ...source.matchAll(
      /^[ \t]*(?:import|export)\b[^'"`;]*?\bfrom\s*['"](@labre\/[^'"]+)['"]/gm
    ),
    ...source.matchAll(/^[ \t]*import\s*['"](@labre\/[^'"]+)['"]/gm),
    ...source.matchAll(/\bimport\(\s*['"](@labre\/[^'"]+)['"]\s*\)/g),
  ].map(m => m[1]);
}

const packageOf = (spec: string) => spec.split('/').slice(0, 2).join('/');

/**
 * The `@labre/*` specifiers core re-exports through a one-line umbrella shim:
 * the only targets the bundle script can rewrite an editor bundle's import to
 * (`buildCoreReverseMap`).
 */
function coreShimTargets(): Set<string> {
  const umbrellaDir = join(ROOT, 'packages/affine/all');
  const umbrella = JSON.parse(
    readFileSync(join(umbrellaDir, 'package.json'), 'utf8')
  ) as { exports: Record<string, string> };
  const targets = new Set<string>();
  for (const file of Object.values(umbrella.exports)) {
    const m = readFileSync(join(umbrellaDir, file), 'utf8').match(
      /export \* from ['"](@labre\/[^'"]+)['"]/
    );
    if (m) targets.add(m[1]);
  }
  return targets;
}

describe('the core-database bundle boundary', () => {
  test('EDITOR_BUNDLES declares the database-editor package once', () => {
    expect(EDITOR_BUNDLES.map(b => b.pkg)).toEqual([EDITOR_PKG]);
    expect(editor?.bundle).toBe('core-database');
    expect(editor?.dir).toBe('affine/database-editor');
  });

  test('no library package imports it but the two assembly files the bundle script strips', () => {
    const allowed = new Set([
      'packages/affine/all/src/extensions/view.ts',
      'packages/affine/all/src/translations.ts',
    ]);
    const offending = allSourceFiles()
      .map(file => ({ file: toRepoRelative(file), source: file }))
      .filter(
        ({ file }) => !file.startsWith('packages/affine/database-editor/')
      )
      .filter(({ source }) =>
        labreSpecifiers(readFileSync(source, 'utf8')).some(
          spec => packageOf(spec) === EDITOR_PKG
        )
      )
      .map(({ file }) => file)
      .filter(file => !allowed.has(file));
    expect(
      offending,
      'Core, a framework or ddd-shared imports the editor package. A seam ' +
        'identifier lives in the lowest package that reads it (ADR 0035 §3): ' +
        'move it to core and let the editor package import it from there.'
    ).toEqual([]);
  });

  test('the umbrella imports it in the shapes the bundle script strips', () => {
    const viewTs = readFileSync(
      join(ROOT, 'packages/affine/all/src/extensions/view.ts'),
      'utf8'
    );
    const viewImports = labreSpecifiers(viewTs).filter(
      spec => packageOf(spec) === EDITOR_PKG
    );
    expect(viewImports).toEqual([`${EDITOR_PKG}/view`]);
    // The script drops the import statement first, then counts registration
    // lines: a multi-line import holds a bare `  <Ext>,` line too.
    const importRe = new RegExp(
      `import\\s*\\{[^}]*\\}\\s*from\\s*['"]${escapeRe(EDITOR_PKG)}/view['"];?\\r?\\n`,
      'g'
    );
    expect(viewTs.match(importRe)?.length).toBe(1);
    const registrations = viewTs.replace(importRe, '');
    for (const { viewExtension, flag } of editor?.extensions ?? []) {
      const line = flag
        ? new RegExp(
            `^\\s*\\.\\.\\.\\(on\\('${escapeRe(flag)}'\\)\\s*\\?\\s*\\[${viewExtension}\\]`,
            'gm'
          )
        : new RegExp(`^\\s*${viewExtension},\\s*$`, 'gm');
      expect(
        registrations.match(line)?.length,
        `${viewExtension} needs exactly one registration line`
      ).toBe(1);
    }

    const translationsTs = readFileSync(
      join(ROOT, 'packages/affine/all/src/translations.ts'),
      'utf8'
    );
    expect(
      labreSpecifiers(translationsTs).filter(
        spec => packageOf(spec) === EDITOR_PKG
      )
    ).toEqual([EDITOR_PKG]);
  });

  test('the package imports core alone: no framework, no auxiliary or shared bundle', () => {
    const dir = join(ROOT, 'packages', editor?.dir ?? '');
    const manifest = JSON.parse(
      readFileSync(join(dir, 'package.json'), 'utf8')
    ) as { dependencies?: Record<string, string> };
    const apart = new Set<string>([
      ...FRAMEWORK_DESCRIPTORS.map(d => d.pkg),
      ...AUXILIARY_BUNDLES.map(b => b.pkg),
      '@labre/affine-gfx-ddd-shared',
    ]);
    expect(
      Object.keys(manifest.dependencies ?? {}).filter(d => apart.has(d))
    ).toEqual([]);

    const shims = coreShimTargets();
    const unreachable = sourceFiles(join(dir, 'src')).flatMap(file =>
      labreSpecifiers(readFileSync(file, 'utf8'))
        .filter(spec => packageOf(spec) !== EDITOR_PKG && !shims.has(spec))
        .map(spec => `${toRepoRelative(file)}: ${spec}`)
    );
    expect(
      unreachable,
      'The bundle can import only what core re-exports through an umbrella ' +
        'shim; anything else fails `build-bundles.mjs`.'
    ).toEqual([]);
  });

  test('its gated extensions sit under a key core keeps', () => {
    for (const { flag } of editor?.extensions ?? []) {
      if (!flag) continue;
      expect(OPTIONAL_BLOCKS as readonly string[]).toContain(flag);
    }
    expect(editor?.extensions.filter(e => e.flag).map(e => e.flag)).toEqual([
      'database',
    ]);
  });

  test('every extension the descriptor names is exported by ./view', () => {
    const exported = databaseEditorView as Record<string, unknown>;
    for (const { viewExtension } of editor?.extensions ?? []) {
      expect(typeof exported[viewExtension], viewExtension).toBe('function');
    }
  });

  test('the umbrella registers the always-on half always and the tooling half under database', () => {
    const { DatabaseEditorViewExtension, DatabaseEditorToolingViewExtension } =
      databaseEditorView;
    const on = getInternalViewExtensions({});
    const off = getInternalViewExtensions({ database: false });
    expect(on).toContain(DatabaseEditorViewExtension);
    expect(on).toContain(DatabaseEditorToolingViewExtension);
    expect(off).toContain(DatabaseEditorViewExtension);
    expect(off).not.toContain(DatabaseEditorToolingViewExtension);
  });
});
