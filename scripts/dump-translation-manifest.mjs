// @ts-check
/**
 * Dump the translation-key manifest as CSV, so a host's catalogue delta is a
 * `diff` rather than a session's work (#390).
 *
 * `getTranslationKeyManifest()` (`packages/affine/all/src/translations.ts`) is
 * the single source the translation-service README points a host at; until
 * this script existed the only way to read it was a throwaway vitest spec,
 * which is how the 0.42.0 delta of 423 keys was produced by hand.
 *
 * Usage, from the repo root:
 *
 *   yarn i18n:manifest                     # CSV on stdout
 *   yarn i18n:manifest 0.43.0.csv          # …or into a file
 *   diff 0.42.0.csv 0.43.0.csv             # the host's delta, key by key
 *
 * Columns: `key,fallback,domain`, sorted by key, RFC 4180 quoting. `domain` is
 * the manifest's own `source` (chrome, seed, role, rule, command…). An entry
 * with NO fallback keeps an EMPTY `fallback` cell — the README is explicit
 * that those keys must not be seeded into an `en` catalogue, and an empty cell
 * says so without inventing an English sentence for them.
 *
 * ## Why it bundles instead of importing
 *
 * Node cannot read a `.ts` file, and the manifest module reaches every package
 * in the library — including Lit views, `.css.ts` stylesheets and deps that
 * ship JSX. Running it under a bare loader stops at the first of those. So the
 * script asks esbuild to bundle exactly one export into one ESM file and runs
 * that: the same "read the TypeScript through esbuild" move
 * `scripts/build-bundles.mjs` makes to read `frameworks.ts`, one step larger.
 */
import esbuild from 'esbuild';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_TS = './packages/affine/all/src/translations.ts';
/** Inside `node_modules` so it is ignored by git, prettier and every scan. */
const BUNDLE = path.join(ROOT, 'node_modules', '.translation-manifest.mjs');

/** RFC 4180: wrap a cell in quotes and double any quote inside it. */
const cell = (value = '') => `"${String(value).replaceAll('"', '""')}"`;

async function readManifest() {
  await esbuild.build({
    stdin: {
      contents:
        `import { getTranslationKeyManifest } from ${JSON.stringify(MANIFEST_TS)};\n` +
        'process.stdout.write(JSON.stringify(getTranslationKeyManifest()));\n',
      resolveDir: ROOT,
      loader: 'ts',
    },
    bundle: true,
    platform: 'node',
    format: 'esm',
    outfile: BUNDLE,
    logLevel: 'error',
    // A `.css` import is a side effect for the browser and nothing at all
    // here; reading it as text keeps the bundle buildable without a plugin.
    loader: { '.css': 'text' },
  });

  try {
    const run = spawnSync(process.execPath, [BUNDLE], {
      cwd: ROOT,
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
    });
    if (run.status !== 0) {
      process.stderr.write(run.stderr ?? '');
      throw new Error(
        `could not read the manifest (node exited ${run.status})`
      );
    }
    return JSON.parse(run.stdout);
  } finally {
    fs.rmSync(BUNDLE, { force: true });
  }
}

const manifest = await readManifest();
const rows = [...manifest].sort((a, b) => (a.key < b.key ? -1 : 1));

const csv =
  ['key,fallback,domain']
    .concat(
      rows.map(entry =>
        [cell(entry.key), cell(entry.fallback), cell(entry.source)].join(',')
      )
    )
    .join('\n') + '\n';

const out = process.argv[2];
if (out) {
  fs.writeFileSync(out, csv, 'utf8');
  process.stderr.write(`${rows.length} keys → ${out}\n`);
} else {
  process.stdout.write(csv);
}
