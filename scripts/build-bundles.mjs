// @ts-check
/**
 * Release-time bundle generator (Option B′).
 *
 * Consolidates the ~73 fine-grained `@labre/*` workspace packages into a small
 * set of PUBLISHED bundles, WITHOUT moving the source tree (so upstream AFFiNE
 * cherry-picks stay cheap). It READS the per-package COMPILED `dist/` (run
 * `yarn build:packages` first) and WRITES into `dist-bundles/` — it never edits
 * anything under `packages/`.
 *
 * Output (COMPILED, like the old vendored tarballs — `exports` → `./dist`):
 *   - `@formicoidea/labre-core`           : the whole editor (every
 *                                           `@labre/affine` dependency except the
 *                                           4 business frameworks), dist-vendored
 *                                           into `dist/_pkgs/<pkg>/…` with
 *                                           cross-package `@labre/*` imports
 *                                           rewritten to relative paths → zero
 *                                           `@labre/*` runtime deps.
 *   - `@formicoidea/labre-framework-<fw>` : one per business framework (wardley/
 *                                           edgy/bpmn/cynefin), depending only on
 *                                           `@formicoidea/labre-core`.
 *
 * Two transforms make the bundles consumable by a downstream Vite/Rollup/tsc app
 * — the same two the old `pack-editor-lib.mjs` applied per package:
 *   1. `exports` point at compiled `./dist/*.js` + `*.d.ts`, NOT `./src/*.ts`, so
 *      the consuming app's tsc does not typecheck the library internals.
 *   2. ES2023 auto-accessors (`accessor x = …`, emitted verbatim under the lib's
 *      `target: esnext`) are lowered to ES2022 with esbuild — Rollup (Vite build)
 *      and the vanilla-extract child compiler cannot parse that syntax.
 */
import { transformSync } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PKGS_DIR = path.join(ROOT, 'packages');
const OUT_DIR = path.join(ROOT, 'dist-bundles');
const UMBRELLA_DIR = path.join(PKGS_DIR, 'affine', 'all');

/** Business frameworks: source dir (under packages/) + the wiring they expose. */
const FRAMEWORKS = [
  {
    out: 'framework-wardley',
    pkg: '@labre/affine-gfx-wardley',
    dir: 'affine/gfx/wardley',
    ext: 'WardleyViewExtension',
    flag: 'wardley',
    telemetry: 'wardley',
    info: 'wardleyFramework',
  },
  {
    out: 'framework-edgy',
    pkg: '@labre/affine-gfx-edgy',
    dir: 'affine/gfx/edgy',
    ext: 'EdgyViewExtension',
    flag: 'edgy',
    telemetry: 'edgy',
    info: 'edgyFramework',
  },
  {
    out: 'framework-bpmn',
    pkg: '@labre/affine-gfx-bpmn',
    dir: 'affine/gfx/bpmn',
    ext: 'BpmnViewExtension',
    flag: 'bpmn',
    telemetry: 'bpmn',
    info: 'bpmnFramework',
  },
  {
    out: 'framework-cynefin',
    pkg: '@labre/affine-gfx-cynefin-estuarine',
    dir: 'affine/gfx/cynefin-estuarine',
    ext: 'CynefinEstuarineViewExtension',
    flag: 'cynefin-estuarine',
    telemetry: 'cynefin',
    info: 'cynefinFramework',
  },
];
const FRAMEWORK_PKGS = new Set(FRAMEWORKS.map(f => f.pkg));

// Matches a `@labre/*` module specifier in `from '…'`, `import '…'` (side-effect
// or type), `import('…')` or `export … from '…'` position — NOT arbitrary
// `@labre/…` string literals in code.
const IMPORT_RE = /((?:from|import)\s*\(?\s*)(['"])(@labre\/[^'"]+)\2/g;
// Matches `declare module '@labre/…'` augmentation targets.
const MODULE_AUG_RE = /(declare\s+module\s+)(['"])(@labre\/[^'"]+)\2/g;

const toPosix = p => p.split(path.sep).join('/');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const vname = name => name.replace('@labre/', '');

// Published bundle names live under the @formicoidea scope. The source
// workspace packages stay @labre/* (private, never published) — only the
// generated bundles below are renamed, so upstream AFFiNE cherry-picks on the
// source tree stay cheap.
const CORE_PKG = '@formicoidea/labre-core';
const fwPkgName = out => `@formicoidea/labre-${out}`;

/** Recursively list files under `dir`, skipping `__tests__` and `node_modules`. */
function listFiles(dir, acc = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (e.name === '__tests__' || e.name === 'node_modules') continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) listFiles(p, acc);
    else acc.push(p);
  }
  return acc;
}

/** Discover every workspace package: name → { dir, exports, deps, version }. */
function discoverPackages() {
  const byName = new Map();
  const walk = dir => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      if (e.name === 'node_modules') continue;
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.name === 'package.json') {
        const j = readJson(p);
        if (j.name?.startsWith('@labre/')) {
          byName.set(j.name, {
            dir: path.dirname(p),
            exports: j.exports || {},
            deps: j.dependencies || {},
            version: j.version,
          });
        }
      }
    }
  };
  walk(PKGS_DIR);
  return byName;
}

const byName = discoverPackages();
const umbrella = byName.get('@labre/affine');
if (!umbrella)
  throw new Error('Could not find @labre/affine (packages/affine/all)');
const VERSION = umbrella.version;

/** Core packages = umbrella deps minus the 4 frameworks. */
const corePkgNames = Object.keys(umbrella.deps).filter(
  d => d.startsWith('@labre/') && !FRAMEWORK_PKGS.has(d)
);

/** Third-party (non-@labre) deps across a set of packages → a deps object. */
function thirdPartyDeps(pkgNames, extraDirs = []) {
  const out = {};
  const collect = deps => {
    for (const [k, v] of Object.entries(deps || {})) {
      if (!k.startsWith('@labre/')) out[k] = v;
    }
  };
  for (const n of pkgNames) collect(byName.get(n)?.deps);
  for (const d of extraDirs)
    collect(readJson(path.join(d, 'package.json')).dependencies);
  return Object.fromEntries(Object.entries(out).sort());
}

/** `./src/foo/bar.ts` → `{ types: ./dist/foo/bar.d.ts, import: ./dist/foo/bar.js }`. */
function srcExportToDist(value) {
  if (typeof value !== 'string') return value;
  const m = value.match(/^\.\/src\/(.+)\.ts$/);
  if (!m) return value;
  return { types: `./dist/${m[1]}.d.ts`, import: `./dist/${m[1]}.js` };
}

function distExports(srcExportsMap) {
  const out = {};
  for (const [k, v] of Object.entries(srcExportsMap))
    out[k] = srcExportToDist(v);
  return out;
}

/** Lower ES2023 auto-accessors to ES2022 in every `.js` under `dir`. */
function lowerAutoAccessors(dir) {
  if (!fs.existsSync(dir)) return;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      lowerAutoAccessors(full);
      continue;
    }
    // `.css.js` are vanilla-extract style files — never carry accessors, and the
    // downstream VE compiler must see them untouched.
    if (!e.name.endsWith('.js') || e.name.endsWith('.css.js')) continue;
    const code = fs.readFileSync(full, 'utf8');
    if (!code.includes('accessor ')) continue;
    fs.writeFileSync(
      full,
      transformSync(code, { loader: 'js', target: 'es2022' }).code
    );
  }
}

/**
 * Resolve a bare `@labre/<pkg>[/<sub>]` specifier to its vendored COMPILED file
 * under `_pkgs/<vname>/<filerel.js>` (the dist file the package's own `exports`
 * point at, retargeted src→dist). Throws on anything unmapped or framework.
 */
function resolveToVendored(spec) {
  const parts = spec.split('/');
  const pkgName = `${parts[0]}/${parts[1]}`;
  const sub = parts.slice(2).join('/');
  if (FRAMEWORK_PKGS.has(pkgName)) {
    throw new Error(
      `${CORE_PKG} must not reference framework ${pkgName} (spec "${spec}")`
    );
  }
  const info = byName.get(pkgName);
  if (!info)
    throw new Error(`Unknown @labre package "${pkgName}" (spec "${spec}")`);
  const key = sub ? `./${sub}` : '.';
  const val = info.exports[key];
  if (!val)
    throw new Error(
      `Package ${pkgName} has no export "${key}" (spec "${spec}")`
    );
  if (!val.startsWith('./src/'))
    throw new Error(`Unexpected export value "${val}" for ${pkgName} ${key}`);
  return {
    vname: vname(pkgName),
    filerel: val.slice('./src/'.length).replace(/\.ts$/, '.js'),
  };
}

const CORE_OUT = path.join(OUT_DIR, 'core');
const CORE_DIST = path.join(CORE_OUT, 'dist');

/** Rewrite every `@labre/*` specifier in a core-bundle file to a relative path. */
function rewriteCoreImports(fileAbs, content) {
  const fileDir = path.dirname(fileAbs);
  const toRel = spec => {
    let targetAbs;
    if (spec === '@labre/affine' || spec.startsWith('@labre/affine/')) {
      // self-reference to an umbrella export → local file in core/dist
      const sub =
        spec === '@labre/affine'
          ? '.'
          : `./${spec.slice('@labre/affine/'.length)}`;
      const val = umbrella.exports[sub];
      if (!val)
        throw new Error(`@labre/affine self-ref to missing export "${sub}"`);
      targetAbs = path.join(
        CORE_DIST,
        val.slice('./src/'.length).replace(/\.ts$/, '.js')
      );
    } else {
      const { vname: vn, filerel } = resolveToVendored(spec);
      targetAbs = path.join(CORE_DIST, '_pkgs', vn, filerel);
    }
    let rel = toPosix(path.relative(fileDir, targetAbs));
    if (!rel.startsWith('.')) rel = `./${rel}`;
    return rel;
  };
  return content
    .replace(IMPORT_RE, (_m, pre, q, spec) => `${pre}${q}${toRel(spec)}${q}`)
    .replace(
      MODULE_AUG_RE,
      (_m, pre, q, spec) => `${pre}${q}${toRel(spec)}${q}`
    );
}

/** Copy a package's `dist/` into a destination dir (skip maps/tsbuildinfo/docs). */
function copyDist(distDir, destDir) {
  if (!fs.existsSync(distDir)) {
    throw new Error(
      `Missing compiled dist: ${path.relative(ROOT, distDir)} — run \`yarn build:packages\` first`
    );
  }
  for (const abs of listFiles(distDir)) {
    const base = path.basename(abs);
    if (
      base.endsWith('.map') ||
      base.endsWith('.md') ||
      base === 'tsconfig.tsbuildinfo'
    ) {
      continue;
    }
    const rel = path.relative(distDir, abs);
    const dest = path.join(destDir, rel);
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(abs, dest);
  }
}

/** Delete lines matching `re` from a file; assert exactly `expected` removed. */
function dropLines(fileAbs, re, expected, label) {
  const lines = fs.readFileSync(fileAbs, 'utf8').split('\n');
  const kept = lines.filter(l => !re.test(l));
  const removed = lines.length - kept.length;
  if (removed !== expected) {
    throw new Error(
      `Expected to drop ${expected} ${label} lines from ${path.relative(ROOT, fileAbs)}, dropped ${removed} (anchor drift — re-review upstream)`
    );
  }
  fs.writeFileSync(fileAbs, kept.join('\n'));
}

/** Strip the 4 framework names from the inline tuple in a compiled `flags.d.ts`. */
function trimFrameworkTypes(dtsAbs) {
  const before = fs.readFileSync(dtsAbs, 'utf8');
  const after = before.replace(
    /,\s*"wardley",\s*"edgy",\s*"cynefin-estuarine",\s*"bpmn"/g,
    ''
  );
  if (after === before) {
    throw new Error(
      `flags.d.ts framework tuple anchor not found in ${path.relative(ROOT, dtsAbs)} (drift)`
    );
  }
  fs.writeFileSync(dtsAbs, after);
}

function buildCore() {
  fs.rmSync(CORE_OUT, { recursive: true, force: true });
  // 1. umbrella's own dist → core/dist
  copyDist(path.join(UMBRELLA_DIR, 'dist'), CORE_DIST);
  // 2. vendor every core package's dist → core/dist/_pkgs/<vname>/
  for (const n of corePkgNames) {
    copyDist(
      path.join(byName.get(n).dir, 'dist'),
      path.join(CORE_DIST, '_pkgs', vname(n))
    );
  }
  // 3. trim the 4 frameworks from the COMPILED assembly files (source untouched)
  const viewJs = path.join(CORE_DIST, 'extensions', 'view.js');
  dropLines(
    viewJs,
    /@labre\/affine-gfx-(wardley|edgy|bpmn|cynefin-estuarine)\/view/,
    4,
    'framework import'
  );
  dropLines(
    viewJs,
    /on\('(wardley|edgy|cynefin-estuarine|bpmn)'\)/,
    4,
    'framework registration'
  );
  dropLines(
    path.join(CORE_DIST, 'flags.js'),
    /^\s*'(wardley|edgy|cynefin-estuarine|bpmn)',\s*$/,
    4,
    'framework flag'
  );
  // flags.d.ts holds the 4 names inline in the OPTIONAL_BLOCKS tuple type
  // (OptionalBlock derives from it) — strip them so the public BlockFlags type
  // drops the framework keys.
  trimFrameworkTypes(path.join(CORE_DIST, 'flags.d.ts'));
  // 4. rewrite all @labre/* imports → relative vendored paths (.js and .d.ts)
  for (const abs of listFiles(CORE_DIST)) {
    if (!abs.endsWith('.js') && !abs.endsWith('.d.ts')) continue;
    const before = fs.readFileSync(abs, 'utf8');
    const after = rewriteCoreImports(abs, before);
    if (after !== before) fs.writeFileSync(abs, after);
  }
  // 5. lower ES2023 auto-accessors → ES2022 (Rollup + VE child compiler safe)
  lowerAutoAccessors(CORE_DIST);
  // 6. package.json (exports → dist, no @labre/* deps)
  const exportsMap = distExports(umbrella.exports); // frameworks aren't subpaths
  fs.writeFileSync(
    path.join(CORE_OUT, 'package.json'),
    JSON.stringify(
      {
        name: CORE_PKG,
        description:
          'Labre editor — the full BlockSuite-derived editor as one package.',
        version: VERSION,
        type: 'module',
        sideEffects: false,
        author: 'lajola',
        contributors: ['toeverything'],
        license: 'MPL-2.0',
        exports: exportsMap,
        files: ['dist'],
        dependencies: thirdPartyDeps(corePkgNames, [UMBRELLA_DIR]),
      },
      null,
      2
    ) + '\n'
  );
  return {
    exportsCount: Object.keys(exportsMap).length,
    vendored: corePkgNames.length,
  };
}

/** Build the `@labre/<pkg>/<sub>` → `@formicoidea/labre-core/<subpath>` table. */
function buildCoreReverseMap() {
  const map = new Map();
  for (const [key, val] of Object.entries(umbrella.exports)) {
    const fileAbs = path.join(UMBRELLA_DIR, val.replace(/^\.\//, ''));
    const content = fs.readFileSync(fileAbs, 'utf8');
    const m = content.match(/export \* from ['"](@labre\/[^'"]+)['"]/);
    if (!m) continue; // assembly file, not a pure shim
    const coreSpec = key === '.' ? CORE_PKG : `${CORE_PKG}${key.slice(1)}`;
    map.set(m[1], coreSpec);
  }
  return map;
}

function buildFramework(fw, reverseMap) {
  const out = path.join(OUT_DIR, fw.out);
  const dist = path.join(out, 'dist');
  fs.rmSync(out, { recursive: true, force: true });
  copyDist(path.join(PKGS_DIR, fw.dir, 'dist'), dist);
  // rewrite @labre/<core> imports → @formicoidea/labre-core/<sub>; self untouched
  for (const abs of listFiles(dist)) {
    if (!abs.endsWith('.js') && !abs.endsWith('.d.ts')) continue;
    const before = fs.readFileSync(abs, 'utf8');
    const replace = (_m, pre, q, spec) => {
      const parts = spec.split('/');
      const pkgName = `${parts[0]}/${parts[1]}`;
      if (pkgName === fw.pkg) return `${pre}${q}${spec}${q}`; // own package (rare)
      const mapped = reverseMap.get(spec);
      if (!mapped)
        throw new Error(
          `${fw.out} imports "${spec}" which ${CORE_PKG} does not expose`
        );
      return `${pre}${q}${mapped}${q}`;
    };
    const after = before
      .replace(IMPORT_RE, replace)
      .replace(MODULE_AUG_RE, replace);
    if (after !== before) fs.writeFileSync(abs, after);
  }
  // descriptor.{js,d.ts} — one-line host wiring (generated, not in package src)
  fs.writeFileSync(
    path.join(dist, 'descriptor.js'),
    `import { ${fw.ext} } from './view.js';\n\n` +
      `/** Host wiring for the ${fw.flag} framework. */\n` +
      `export const ${fw.info} = {\n` +
      `  flag: '${fw.flag}',\n` +
      `  telemetry: '${fw.telemetry}',\n` +
      `  viewExtension: ${fw.ext},\n` +
      `};\n`
  );
  fs.writeFileSync(
    path.join(dist, 'descriptor.d.ts'),
    `import { ${fw.ext} } from './view.js';\n\n` +
      `export declare const ${fw.info}: {\n` +
      `  readonly flag: '${fw.flag}';\n` +
      `  readonly telemetry: '${fw.telemetry}';\n` +
      `  readonly viewExtension: typeof ${fw.ext};\n` +
      `};\n`
  );
  // lower auto-accessors in the framework's own compiled view/element files
  lowerAutoAccessors(dist);
  fs.writeFileSync(
    path.join(out, 'package.json'),
    JSON.stringify(
      {
        name: fwPkgName(fw.out),
        description: `Labre ${fw.flag} framework for ${CORE_PKG}.`,
        version: VERSION,
        type: 'module',
        sideEffects: false,
        author: 'lajola',
        contributors: ['toeverything'],
        license: 'MPL-2.0',
        exports: {
          '.': { types: './dist/index.d.ts', import: './dist/index.js' },
          './view': { types: './dist/view.d.ts', import: './dist/view.js' },
          './descriptor': {
            types: './dist/descriptor.d.ts',
            import: './dist/descriptor.js',
          },
        },
        files: ['dist'],
        dependencies: { [CORE_PKG]: VERSION, ...thirdPartyDeps([fw.pkg]) },
      },
      null,
      2
    ) + '\n'
  );
}

// --- run ---
fs.mkdirSync(OUT_DIR, { recursive: true });
const core = buildCore();
const reverseMap = buildCoreReverseMap();
for (const fw of FRAMEWORKS) buildFramework(fw, reverseMap);

console.log(
  `${CORE_PKG}: vendored ${core.vendored} packages, ${core.exportsCount} exports, version ${VERSION}`
);
console.log(`frameworks: ${FRAMEWORKS.map(f => fwPkgName(f.out)).join(', ')}`);
console.log(`output: ${path.relative(ROOT, OUT_DIR)}/`);
