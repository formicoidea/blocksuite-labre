import { build } from 'esbuild';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, test } from 'vitest';

import { FRAMEWORK_DESCRIPTORS } from '../frameworks.js';
import { ROOT } from './translations/source-files.js';

/**
 * GUARD — the `./interchange` entries load no editor (ADR 0012, P3 as amended
 * 2026-10-14).
 *
 * A server reads foreign files with the library's own readers: the labre
 * import function (Deno, a 20 MB bundle ceiling, no DOM) and labre-mcp. The P0
 * import spike measured what importing one reader through a package index
 * costs: the whole editor, 3 858 modules and 18.35 MB, a graph that does not
 * even resolve under Deno without a local `node_modules`, because Lit and
 * `@atlaskit/pragmatic-drag-and-drop` come with it. The `./interchange`
 * entries are the answer, and this spec is what keeps them one: it BUNDLES
 * each entry from source and fails on any module outside a short allow-list.
 *
 * **What it would catch**: a reader that imports a value from a barrel
 * (`@labre/affine-model`, `@labre/affine-shared/services`, the surface index)
 * instead of the headless subpath; a constant read from a file that also
 * declares an element class (the reason `UML_FRAME_BAND_HEIGHT`,
 * `POOL_BAND_WIDTH` and their siblings moved to `consts.ts` files); a
 * framework adding `./interchange` to its manifest without being listed here,
 * or listed here without the subpath.
 *
 * The allow-list is the claim. Widening it is a decision about what a server
 * loads, and belongs in the ADR amendment, not only here.
 */

/** Workspace sources an `./interchange` graph may load. */
const ALLOWED_WORKSPACE = [
  'packages/framework/global/',
  'packages/affine/model/',
  'packages/affine/shared/',
  'packages/affine/blocks/surface/',
  // The DDD boards' shared tables and element builders, through its
  // `./headless` entry only (ADR 0045 amendment of 2026-10-27): the three
  // boards' toolboxes build their artefacts from them, and a board may import
  // `ddd-shared` but never another board. Its own entry is held below.
  'packages/affine/gfx/ddd-shared/',
];

/**
 * Third-party packages an `./interchange` graph may load. Not DOMPurify: the
 * SVG sanitizer is an allow-list on the read tree (`svg-sanitize.ts`), and a
 * DOM sanitizer would put the DOM back in a server's graph.
 */
const ALLOWED_THIRD_PARTY = new Set(['zod']);

/** DOM globals a reader must not touch: a server has none of them. */
const DOM_GLOBALS =
  /\b(?:DOMParser|XMLSerializer|DOMPurify|document\.createElement|window\.)/;

/** The frameworks that ship an `./interchange` entry. */
const WITH_INTERCHANGE = [
  'bpmn',
  'c4',
  'cynefin-estuarine',
  'ddd-context-map',
  'ddd-event-storming',
  'edgy',
  'uml',
  'wardley',
];

interface Entry {
  label: string;
  /** The package directory, relative to the repo root. */
  dir: string;
  /** The subpath the entry is published under. */
  subpath: string;
}

const manifestOf = (dir: string) =>
  JSON.parse(readFileSync(join(ROOT, dir, 'package.json'), 'utf8')) as {
    name: string;
    exports: Record<string, string>;
  };

const ENTRIES: Entry[] = [
  {
    label: 'surface ./interchange',
    dir: 'packages/affine/blocks/surface',
    subpath: './interchange',
  },
  {
    label: 'model ./headless',
    dir: 'packages/affine/model',
    subpath: './headless',
  },
  {
    label: 'shared ./headless',
    dir: 'packages/affine/shared',
    subpath: './headless',
  },
  {
    label: 'ddd-shared ./headless',
    dir: 'packages/affine/gfx/ddd-shared',
    subpath: './headless',
  },
  ...FRAMEWORK_DESCRIPTORS.filter(
    d => manifestOf(`packages/${d.dir}`).exports['./interchange'] !== undefined
  ).map(d => ({
    label: `${d.id} ./interchange`,
    dir: `packages/${d.dir}`,
    subpath: './interchange',
  })),
];

/** Every module the entry's graph loads, as repo-relative paths. */
async function graphOf(
  entry: Entry
): Promise<{ modules: string[]; code: string }> {
  const file = manifestOf(entry.dir).exports[entry.subpath];
  const result = await build({
    entryPoints: [join(ROOT, entry.dir, file)],
    absWorkingDir: ROOT,
    bundle: true,
    write: false,
    metafile: true,
    format: 'esm',
    // Neutral, not browser: a server has no `browser` field to pick.
    platform: 'neutral',
    mainFields: ['module', 'main'],
    logLevel: 'silent',
  });
  return {
    modules: Object.keys(result.metafile.inputs),
    code: result.outputFiles[0]?.text ?? '',
  };
}

const thirdPartyOf = (path: string) =>
  /node_modules\/((?:@[^/]+\/)?[^/]+)\//.exec(path)?.[1];

function forbidden(entry: Entry, modules: readonly string[]): string[] {
  const own = `${entry.dir}/`;
  return modules.filter(path => {
    const pkg = thirdPartyOf(path);
    if (pkg !== undefined) return !ALLOWED_THIRD_PARTY.has(pkg);
    return (
      !path.startsWith(own) &&
      !ALLOWED_WORKSPACE.some(prefix => path.startsWith(prefix))
    );
  });
}

describe('the headless interchange entries', () => {
  test('every framework with capabilities ships ./interchange', () => {
    expect(
      FRAMEWORK_DESCRIPTORS.filter(
        d =>
          manifestOf(`packages/${d.dir}`).exports['./interchange'] !== undefined
      )
        .map(d => d.id)
        .sort()
    ).toEqual(WITH_INTERCHANGE);
  });

  test('core re-exports the surface entry as ./interchange', () => {
    const umbrella = manifestOf('packages/affine/all');
    const shim = umbrella.exports['./interchange'];
    expect(shim).toBeDefined();
    expect(
      readFileSync(join(ROOT, 'packages/affine/all', shim!), 'utf8')
    ).toContain("export * from '@labre/affine-block-surface/interchange';");
    // The two headless subpaths a framework entry imports must be core
    // subpaths too, or the bundle script has nothing to rewrite them to.
    expect(umbrella.exports['./model/headless']).toBeDefined();
    expect(umbrella.exports['./shared/headless']).toBeDefined();
  });

  test.each(ENTRIES)(
    '$label loads no Lit, no drag-and-drop, no DOM and no editor',
    async entry => {
      const { modules, code } = await graphOf(entry);
      // A graph that resolved nothing proves nothing.
      expect(modules.length).toBeGreaterThan(1);
      expect(forbidden(entry, modules)).toEqual([]);
      // Belt and braces on the two the spike named: neither may appear by any
      // path, allow-list or not.
      expect(
        modules.filter(path =>
          /node_modules\/(?:lit|lit-html|lit-element|@lit|@lit-labs|@atlaskit)\//.test(
            path
          )
        )
      ).toEqual([]);
      expect(
        modules.filter(path =>
          /packages\/framework\/(?:std|store|sync)\//.test(path)
        )
      ).toEqual([]);
      // And no DOM by name, in any module that made it in: the readers are
      // pure in ADR 0012's amended sense, with no DOM and no editor.
      expect(DOM_GLOBALS.exec(code)?.[0]).toBeUndefined();
    },
    30_000
  );
});
