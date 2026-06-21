// @ts-check
/**
 * Compile the source-first bundles produced by build-bundles.mjs into PUBLISHED,
 * compiled bundles (`dist/*.js` + `*.d.ts`, `exports` → `./dist`).
 *
 * build-bundles.mjs ships `src` (Option B′). But downstream apps consume these
 * bundles through a strict `tsc`/Vite build, which re-typechecks any shipped
 * `.ts` and chokes on the vendored editor source (ADR-0002). So between
 * `build-bundles` and `publish-bundles` we tsc each bundle to `dist`:
 *   - target ES2022 → lowers ES2023 auto-accessors (the reason apps break);
 *   - `noEmitOnError:false` → emit JS + d.ts despite the source's strict-mode
 *     type errors (it already compiles inside the workspace; we just need the
 *     emit, and `skipLibCheck` keeps d.ts consumption cheap downstream);
 *   - core first, then frameworks (their tsconfig `paths` resolve the freshly
 *     compiled core's d.ts).
 *
 * Usage: `node scripts/compile-bundles.mjs` (after build-bundles, before publish).
 */
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = path.join(ROOT, 'dist-bundles');
const TSC = path.join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

if (!fs.existsSync(OUT_DIR)) {
  throw new Error('dist-bundles/ not found — run build-bundles.mjs first');
}
const toPosix = p => p.split(path.sep).join('/');

const bundles = fs
  .readdirSync(OUT_DIR)
  .map(name => path.join(OUT_DIR, name))
  .filter(
    dir =>
      fs.statSync(dir).isDirectory() &&
      fs.existsSync(path.join(dir, 'package.json'))
  )
  .map(dir => ({
    dir,
    pkg: JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')),
  }));

const byBundleName = new Map(bundles.map(b => [b.pkg.name, b]));
/** Sibling-bundle deps (core + shared) of a bundle, from its package.json. */
const bundleDeps = b =>
  Object.keys(b.pkg.dependencies || {}).filter(d => byBundleName.has(d));

// Topological order: compile a bundle only after every bundle it depends on
// (core → shared → frameworks) so each resolves its deps' freshly emitted d.ts.
const ordered = [];
const done = new Set();
const onStack = new Set();
const visit = b => {
  if (done.has(b.pkg.name)) return;
  if (onStack.has(b.pkg.name))
    throw new Error(`bundle dependency cycle at ${b.pkg.name}`);
  onStack.add(b.pkg.name);
  for (const d of bundleDeps(b)) visit(byBundleName.get(d));
  onStack.delete(b.pkg.name);
  done.add(b.pkg.name);
  ordered.push(b);
};
for (const b of bundles) visit(b);

/** `./src/<p>.ts` → { types: ./dist/<p>.d.ts, import: ./dist/<p>.js }. */
function remapExports(exportsMap) {
  /** @type {Record<string, unknown>} */
  const out = {};
  for (const [key, val] of Object.entries(exportsMap)) {
    if (
      typeof val === 'string' &&
      val.startsWith('./src/') &&
      val.endsWith('.ts')
    ) {
      const base = val.slice('./src/'.length, -'.ts'.length);
      out[key] = { types: `./dist/${base}.d.ts`, import: `./dist/${base}.js` };
    } else {
      out[key] = val;
    }
  }
  return out;
}

/** Emit a bundle's `dist/` and flip its package.json to consume it. */
function compile({ dir, pkg }, paths) {
  const tsconfig = {
    extends: toPosix(path.relative(dir, path.join(ROOT, 'tsconfig.json'))),
    compilerOptions: {
      composite: false,
      noEmit: false,
      noEmitOnError: false, // emit despite the vendored source's strict errors
      declaration: true,
      declarationMap: false,
      sourceMap: false,
      target: 'ES2022', // lower ES2023 auto-accessors (ADR-0002)
      lib: ['ES2022', 'DOM', 'DOM.Iterable'],
      module: 'ESNext',
      moduleResolution: 'bundler',
      outDir: './dist',
      rootDir: './src',
      noUnusedLocals: false,
      noUnusedParameters: false,
      ...(paths ? { baseUrl: '.', paths } : {}),
    },
    include: ['src/**/*.ts'],
    exclude: ['node_modules', 'dist'],
  };
  fs.writeFileSync(
    path.join(dir, 'tsconfig.json'),
    JSON.stringify(tsconfig, null, 2) + '\n'
  );

  console.log(`compile ${pkg.name} …`);
  try {
    // tsc exits non-zero on type errors but, with noEmitOnError:false, still
    // emits — so a non-zero exit here is expected; we verify the emit below.
    execFileSync('node', [TSC, '-p', path.join(dir, 'tsconfig.json')], {
      stdio: ['ignore', 'ignore', 'ignore'],
    });
  } catch {
    // expected: strict-mode type errors in the vendored source
  }
  if (!fs.existsSync(path.join(dir, 'dist', 'index.js'))) {
    throw new Error(`${pkg.name}: tsc did not emit dist/index.js`);
  }

  pkg.exports = remapExports(pkg.exports);
  pkg.files = ['dist'];
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(pkg, null, 2) + '\n'
  );
  console.log(`  ✓ ${pkg.name} → dist`);
}

for (const b of ordered) {
  const paths = {};
  for (const d of bundleDeps(b)) {
    const dep = byBundleName.get(d);
    const rel = toPosix(path.relative(b.dir, path.join(dep.dir, 'dist')));
    paths[dep.pkg.name] = [`${rel}/index.d.ts`];
    paths[`${dep.pkg.name}/*`] = [`${rel}/*`];
  }
  compile(b, Object.keys(paths).length ? paths : undefined);
}

console.log(`compiled ${bundles.length} bundles → dist`);
