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
 *   - then `explicitifySpecifiers()` rewrites the emit's module specifiers to
 *     ones Node's ESM resolver accepts (see below).
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

/**
 * tsc under `moduleResolution: bundler` emits every module specifier VERBATIM —
 * it neither requires nor adds extensions. So an extensionless import in the
 * vendored source (`from './shortcuts'`, `from '../../consts'`,
 * `from 'lodash-es/last'`) ships that way into `dist`. Node's ESM resolver does
 * no extension/directory-index probing, so any consumer that lets NODE resolve
 * the bundle (vitest's externalized deps, a bundler-less import) gets
 * ERR_MODULE_NOT_FOUND. Bundlers tolerate it, which is why this only bites some
 * downstreams. Rewriting the emit — rather than the ~1000 source sites — keeps
 * upstream AFFiNE cherry-picks cheap (ADR-0001).
 *
 * Rewrites, per emitted `.js`/`.d.ts`:
 *   - `./x`  → `./x.js`        (sibling file)
 *   - `./x`  → `./x/index.js`  (directory index)
 *   - `pkg/sub` → `pkg/sub.js` ONLY when `pkg` has no `exports` map — without
 *     one Node probes nothing (lodash-es); with one, the map is authoritative
 *     and appending `.js` would break a subpath that already resolves.
 *   - `pkg/sub` → the file behind a bundler-only PROXY DIRECTORY (@atlaskit):
 *     a folder holding just a package.json with `main`/`module`. Node refuses
 *     directory imports outright (ERR_UNSUPPORTED_DIR_IMPORT), so no extension
 *     can fix these — only naming the real file does.
 */
// `from '…'`, `import '…'`, `import('…')`. The lookbehind keeps out `Array.from('x')`,
// `foo.import`, and — the subtle one — a keyword sitting INSIDE a string literal
// (`type: 'import',` would otherwise treat the closing quote as an opening one and
// swallow the following lines). A specifier never spans a newline either.
const SPEC_RE = /(?<![.\w$'"`])((?:from|import)\s*\(?\s*)(['"])([^'"\n]+)\2/g;
// A match whose line begins with `*` or `//` is prose, not an import: tsc keeps
// JSDoc, and some of it shows example `import` lines pointing at files that
// don't exist. Cheaper than a real parse and only ever skips comment text — a
// genuine import can't sit on a line that starts with a comment marker.
const inComment = (src, offset) =>
  /^\s*(\*|\/\/)/.test(src.slice(src.lastIndexOf('\n', offset) + 1, offset));
// Extensions Node resolves as-is; anything else (incl. `.css` on the compiled
// vanilla-extract files, which land as `.css.js`) still needs the suffix.
const EXPLICIT_EXT = new Set([
  '.js',
  '.mjs',
  '.cjs',
  '.json',
  '.node',
  '.wasm',
]);

/** Root of an installed dependency, or null if it isn't there (sibling bundle). */
const pkgDirCache = new Map();
function depPkgDir(pkg) {
  if (!pkgDirCache.has(pkg)) {
    // bundles are generated inside the workspace, so deps are hoisted at ROOT
    const dir = path.join(ROOT, 'node_modules', ...pkg.split('/'));
    pkgDirCache.set(
      pkg,
      fs.existsSync(path.join(dir, 'package.json')) ? dir : null
    );
  }
  return pkgDirCache.get(pkg);
}

/**
 * The file a bundler would load for `abs` when `abs` is a directory: either a
 * plain `index.js`, or a bundler-style proxy package.json.
 *
 * `main` (CJS) is preferred over `module` (ESM) deliberately. @atlaskit's ESM
 * build has no `type: "module"` above it and its own imports are extensionless,
 * so Node would read it as CJS and throw on `export` — it is ESM for bundlers
 * only. `main` is the build Node can actually load (and what Node's own
 * ERR_UNSUPPORTED_DIR_IMPORT hint points at); bundlers still interop it fine.
 */
function dirEntryFile(abs) {
  if (!fs.existsSync(abs) || !fs.statSync(abs).isDirectory()) return null;
  const pj = path.join(abs, 'package.json');
  if (fs.existsSync(pj)) {
    const j = JSON.parse(fs.readFileSync(pj, 'utf8'));
    for (const field of [j.main, j.module]) {
      if (!field) continue;
      const target = path.resolve(abs, field);
      if (fs.existsSync(target)) return target;
    }
  }
  const idx = path.join(abs, 'index.js');
  return fs.existsSync(idx) ? idx : null;
}

/** Explicit form of `spec` as seen from `fileDir`, or null to leave it alone. */
function explicitSpecifier(spec, fileDir) {
  if (EXPLICIT_EXT.has(path.extname(spec))) return null;
  if (spec.startsWith('.')) {
    const abs = path.resolve(fileDir, spec);
    if (fs.existsSync(`${abs}.js`)) return `${spec}.js`;
    if (fs.existsSync(path.join(abs, 'index.js')))
      return `${spec.replace(/\/$/, '')}/index.js`;
    // No runtime file: a types-only module (`.d.ts`, elided from the JS emit).
    if (fs.existsSync(`${abs}.d.ts`)) return null;
    return undefined; // unresolvable — reported by the caller
  }
  if (!spec.startsWith('@') && !spec.includes('/')) return null; // bare package
  const parts = spec.split('/');
  const pkg = spec.startsWith('@') ? parts.slice(0, 2).join('/') : parts[0];
  const sub = spec.slice(pkg.length + 1);
  if (!sub) return null;
  const dir = depPkgDir(pkg);
  if (!dir) return null;
  if (
    JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')).exports
  )
    return null; // an exports map is authoritative
  const abs = path.join(dir, sub);
  if (fs.existsSync(`${abs}.js`)) return `${spec}.js`;
  const entry = dirEntryFile(abs);
  return entry ? `${pkg}/${toPosix(path.relative(dir, entry))}` : null;
}

/** Recursively list files under `dir`. */
function listFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

/**
 * Make every specifier in a bundle's `dist` explicit; throw on any relative one
 * that resolves to nothing (it would be a broken import either way, so this is
 * also the audit that keeps the whole emit honest).
 */
function explicitifySpecifiers(dir, name) {
  const dist = path.join(dir, 'dist');
  const broken = [];
  let rewritten = 0;
  for (const abs of listFiles(dist)) {
    if (!abs.endsWith('.js') && !abs.endsWith('.d.ts')) continue;
    const fileDir = path.dirname(abs);
    const before = fs.readFileSync(abs, 'utf8');
    const after = before.replace(SPEC_RE, (m, pre, q, spec, offset) => {
      if (inComment(before, offset)) return m;
      const fixed = explicitSpecifier(spec, fileDir);
      if (fixed === undefined) {
        broken.push(`${toPosix(path.relative(dist, abs))}: "${spec}"`);
        return m;
      }
      if (fixed === null) return m;
      rewritten++;
      return `${pre}${q}${fixed}${q}`;
    });
    if (after !== before) fs.writeFileSync(abs, after);
  }
  if (broken.length) {
    throw new Error(
      `${name}: ${broken.length} unresolvable relative import(s) in dist:\n  ` +
        broken.slice(0, 20).join('\n  ')
    );
  }
  return rewritten;
}

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
  const rewritten = explicitifySpecifiers(dir, pkg.name);

  pkg.exports = remapExports(pkg.exports);
  pkg.files = ['dist'];
  fs.writeFileSync(
    path.join(dir, 'package.json'),
    JSON.stringify(pkg, null, 2) + '\n'
  );
  console.log(`  ✓ ${pkg.name} → dist (${rewritten} specifiers made explicit)`);
}

/**
 * The `_pkgs/*` leak (issue #60) — a TYPE-resolution problem, not a runtime one.
 *
 * Core vendors the ~70 workspace packages under `dist/_pkgs/<pkg>/…` and
 * re-exports them through one-line shims (`./global/utils` → `_pkgs/global/utils`).
 * The shims are what a consumer imports, and `explicitifySpecifiers` above keeps
 * the JS honest. But when tsc EMITS a dependent bundle's `.d.ts` it has to name
 * the module a type came from, and it names it by reverse-mapping the tsconfig
 * `paths` entry below (`<core>/*` → `<core>/dist/*`). The declaration file for
 * `Constructor` physically lives at `dist/_pkgs/global/utils.d.ts`, so tsc
 * writes `@formicoidea/labre-core/_pkgs/global/utils` — a subpath the published
 * `exports` map does not carry. Consumers only miss it because `skipLibCheck`
 * hides it; turn that off and every such reference is an unresolved module.
 *
 * Two fixes were on the table: rewrite the specifiers to the public shim
 * subpath, or publish the subpaths tsc actually named. This takes the SECOND,
 * because the first is not total: a `_pkgs` reference is only rewritable when a
 * public shim happens to re-export that exact module, and nothing guarantees
 * one exists for every internal declaration tsc chooses to name — the day it
 * does not, the rewrite has no target and either throws at release time or
 * silently leaves the broken specifier it was meant to remove. Publishing the
 * subpath always has a target: the file is right there.
 *
 * The leak is bounded by DERIVING the list instead of guessing it: only the
 * `_pkgs` subpaths the emitted files genuinely reference are added, so the map
 * grows and shrinks with the emit and never exposes an internal nobody asked
 * for. And the pass ends by re-checking every reference against the map it just
 * wrote, so an unresolvable one fails the release rather than the consumer.
 */
function internalSubpathRefs(bundles, coreName) {
  const prefix = `${coreName}/_pkgs/`;
  /** subpath (`_pkgs/global/utils`) → the files that name it. */
  const refs = new Map();
  for (const b of bundles) {
    for (const abs of listFiles(path.join(b.dir, 'dist'))) {
      if (!abs.endsWith('.js') && !abs.endsWith('.d.ts')) continue;
      const src = fs.readFileSync(abs, 'utf8');
      for (const [, , , spec, offset] of [...src.matchAll(SPEC_RE)].map(m => [
        ...m,
        m.index,
      ])) {
        if (!spec.startsWith(prefix) || inComment(src, offset)) continue;
        // Verbatim: the exports key has to match the specifier as WRITTEN,
        // extension and all (Node compares subpaths literally).
        const sub = spec.slice(coreName.length + 1);
        if (!refs.has(sub)) refs.set(sub, []);
        refs
          .get(sub)
          .push(`${b.pkg.name}: ${toPosix(path.relative(b.dir, abs))}`);
      }
    }
  }
  return refs;
}

/**
 * The `dist/` file behind an internal subpath, per condition. A specifier tsc
 * synthesized is extensionless (`_pkgs/global/utils`) and may name either a
 * sibling file or a directory index; one that came through
 * {@link explicitifySpecifiers} already carries `.js`.
 */
function distTarget(coreDir, sub, ext) {
  const stem = sub.replace(/\.js$/, '');
  for (const candidate of [`${stem}${ext}`, `${stem}/index${ext}`]) {
    if (fs.existsSync(path.join(coreDir, 'dist', candidate))) {
      return `./dist/${candidate}`;
    }
  }
  return null;
}

function exposeInternalTypeSubpaths(core, others) {
  const refs = internalSubpathRefs([core, ...others], core.pkg.name);
  if (!refs.size) {
    console.log(`${core.pkg.name}: no internal _pkgs subpath referenced`);
    return;
  }
  const added = {};
  const unresolvable = [];
  for (const sub of [...refs.keys()].sort()) {
    const types = distTarget(core.dir, sub, '.d.ts');
    const js = distTarget(core.dir, sub, '.js');
    if (!types && !js) {
      unresolvable.push(`${sub} (named by ${refs.get(sub)[0]})`);
      continue;
    }
    added[`./${sub}`] = {
      ...(types ? { types } : {}),
      ...(js ? { import: js } : {}),
    };
  }
  if (unresolvable.length) {
    throw new Error(
      `${core.pkg.name}: ${unresolvable.length} internal subpath(s) referenced ` +
        `by the emit resolve to no file:\n  ${unresolvable.join('\n  ')}`
    );
  }
  core.pkg.exports = { ...core.pkg.exports, ...added };
  // The audit the whole pass exists for: after the map is written, EVERY
  // `_pkgs` specifier the emit names must resolve through it. A consumer with
  // `skipLibCheck: false` sees exactly what this check sees.
  const unexported = [...refs.keys()].filter(
    sub => !core.pkg.exports[`./${sub}`]
  );
  if (unexported.length) {
    throw new Error(
      `${core.pkg.name}: ${unexported.length} internal subpath(s) still absent ` +
        `from the exports map:\n  ${unexported.join('\n  ')}`
    );
  }
  fs.writeFileSync(
    path.join(core.dir, 'package.json'),
    JSON.stringify(core.pkg, null, 2) + '\n'
  );
  console.log(
    `  ✓ ${core.pkg.name} exposes ${Object.keys(added).length} internal ` +
      `subpath(s) the emitted .d.ts name`
  );
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

const core = bundles.find(b => b.pkg.name.endsWith('/labre-core'));
if (!core) throw new Error('no core bundle in dist-bundles/');
exposeInternalTypeSubpaths(
  core,
  bundles.filter(b => b !== core)
);

console.log(`compiled ${bundles.length} bundles → dist`);
