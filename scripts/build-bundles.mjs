// @ts-check
/**
 * Release-time bundle generator (Option B′).
 *
 * Consolidates the ~73 fine-grained `@labre/*` workspace packages into a small
 * set of PUBLISHED bundles, WITHOUT moving the source tree (so upstream AFFiNE
 * cherry-picks stay cheap). It only READS the workspace packages and WRITES
 * into `dist-bundles/` — it never edits anything under `packages/`.
 *
 * Output (all source-first, like the existing packages — `exports` → `./src`):
 *   - `@labre/core`             : the whole editor (every `@labre/affine`
 *                                 dependency except the 4 business frameworks),
 *                                 source-vendored into `src/_pkgs/<pkg>/…` with
 *                                 cross-package `@labre/*` imports rewritten to
 *                                 relative paths → zero `@labre/*` runtime deps.
 *   - `@labre/framework-<fw>`   : one per business framework (wardley/edgy/bpmn/
 *                                 cynefin), depending only on `@labre/core`.
 *
 * `@labre/core` IS the `@labre/affine` umbrella, retargeted: the umbrella's own
 * src (one-line re-export shims + the assembly files) becomes `core/src`, with
 * the 4 frameworks trimmed from `extensions/view.ts` + `flags.ts`.
 */
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

// Matches a `@labre/*` module specifier in `from '…'`, `import '…'` (side-effect)
// or `import('…')` position — NOT arbitrary `@labre/…` string literals in code.
const IMPORT_RE = /((?:from|import)\s*\(?\s*)(['"])(@labre\/[^'"]+)\2/g;
// Matches `declare module '@labre/…'` augmentation targets.
const MODULE_AUG_RE = /(declare\s+module\s+)(['"])(@labre\/[^'"]+)\2/g;

const toPosix = p => p.split(path.sep).join('/');
const readJson = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const vname = name => name.replace('@labre/', '');

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

// Published npm scope + names. The generated bundles ship under @formicoidea
// (override with NPM_SCOPE): @formicoidea/labre-core is the editor, the
// frameworks are @formicoidea/labre-framework-*. These are the exact names
// downstream apps consume via their npm aliases.
const SCOPE = process.env.NPM_SCOPE ?? '@formicoidea';
const CORE = `${SCOPE}/labre-core`;

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

/**
 * Resolve a bare `@labre/<pkg>[/<sub>]` specifier to its vendored file location
 * under `_pkgs/<vname>/<filerel>` (the file that the package's own `exports`
 * point at). Throws on anything unmapped or pointing at a framework.
 */
function resolveToVendored(spec) {
  const parts = spec.split('/');
  const pkgName = `${parts[0]}/${parts[1]}`;
  const sub = parts.slice(2).join('/');
  if (FRAMEWORK_PKGS.has(pkgName)) {
    throw new Error(
      `@labre/core must not reference framework ${pkgName} (spec "${spec}")`
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
  return { vname: vname(pkgName), filerel: val.slice('./src/'.length) };
}

const CORE_OUT = path.join(OUT_DIR, 'core');
const CORE_SRC = path.join(CORE_OUT, 'src');

/** Rewrite every `@labre/*` specifier in a core-bundle file to a relative path. */
function rewriteCoreImports(fileAbs, content) {
  const fileDir = path.dirname(fileAbs);
  const toRel = spec => {
    let targetAbs;
    if (spec === '@labre/affine' || spec.startsWith('@labre/affine/')) {
      // self-reference to an umbrella export → local file in core/src
      const sub =
        spec === '@labre/affine'
          ? '.'
          : `./${spec.slice('@labre/affine/'.length)}`;
      const val = umbrella.exports[sub];
      if (!val)
        throw new Error(`@labre/affine self-ref to missing export "${sub}"`);
      targetAbs = path.join(CORE_SRC, val.slice('./src/'.length));
    } else {
      const { vname: vn, filerel } = resolveToVendored(spec);
      targetAbs = path.join(CORE_SRC, '_pkgs', vn, filerel);
    }
    let rel = toPosix(path.relative(fileDir, targetAbs)).replace(
      /\.ts$/,
      '.js'
    );
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

/** Copy a package's src/ into a destination dir (skipping tests). */
function copySrc(srcDir, destDir) {
  for (const abs of listFiles(srcDir)) {
    if (abs.endsWith('.md')) continue; // docs aren't part of the published bundle
    const rel = path.relative(srcDir, abs);
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

function buildCore() {
  fs.rmSync(CORE_OUT, { recursive: true, force: true });
  // 1. umbrella's own src → core/src
  copySrc(path.join(UMBRELLA_DIR, 'src'), CORE_SRC);
  // 2. vendor every core package's src → core/src/_pkgs/<vname>/
  for (const n of corePkgNames) {
    copySrc(
      path.join(byName.get(n).dir, 'src'),
      path.join(CORE_SRC, '_pkgs', vname(n))
    );
  }
  // 3. trim the 4 frameworks from the COPIED assembly files (source untouched)
  const viewTs = path.join(CORE_SRC, 'extensions', 'view.ts');
  dropLines(
    viewTs,
    /@labre\/affine-gfx-(wardley|edgy|bpmn|cynefin-estuarine)\/view/,
    4,
    'framework import'
  );
  dropLines(
    viewTs,
    /on\('(wardley|edgy|cynefin-estuarine|bpmn)'\)/,
    4,
    'framework registration'
  );
  dropLines(
    path.join(CORE_SRC, 'flags.ts'),
    /^\s*'(wardley|edgy|cynefin-estuarine|bpmn)',\s*$/,
    4,
    'framework flag'
  );
  // 4. rewrite all @labre/* imports → relative vendored paths
  for (const abs of listFiles(CORE_SRC)) {
    if (!abs.endsWith('.ts')) continue;
    const before = fs.readFileSync(abs, 'utf8');
    const after = rewriteCoreImports(abs, before);
    if (after !== before) fs.writeFileSync(abs, after);
  }
  // 5. package.json (no @labre/* deps)
  const exportsMap = { ...umbrella.exports }; // frameworks are not umbrella subpaths
  fs.writeFileSync(
    path.join(CORE_OUT, 'package.json'),
    JSON.stringify(
      {
        name: CORE,
        description:
          'Labre editor — the full BlockSuite-derived editor as one package.',
        version: VERSION,
        type: 'module',
        sideEffects: false,
        author: 'lajola',
        contributors: ['toeverything'],
        license: 'MPL-2.0',
        exports: exportsMap,
        files: ['src'],
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

/** Build the `@labre/<pkg>/<sub>` → `@labre/core/<subpath>` rewrite table. */
function buildCoreReverseMap() {
  const map = new Map();
  for (const [key, val] of Object.entries(umbrella.exports)) {
    const fileAbs = path.join(UMBRELLA_DIR, val.replace(/^\.\//, ''));
    const content = fs.readFileSync(fileAbs, 'utf8');
    const m = content.match(/export \* from ['"](@labre\/[^'"]+)['"]/);
    if (!m) continue; // assembly file, not a pure shim
    const coreSpec = key === '.' ? CORE : `${CORE}${key.slice(1)}`;
    map.set(m[1], coreSpec);
  }
  return map;
}

function buildFramework(fw, reverseMap) {
  const out = path.join(OUT_DIR, fw.out);
  const src = path.join(out, 'src');
  fs.rmSync(out, { recursive: true, force: true });
  copySrc(path.join(PKGS_DIR, fw.dir, 'src'), src);
  // rewrite @labre/<core> imports → @labre/core/<sub>; self-refs untouched
  for (const abs of listFiles(src)) {
    if (!abs.endsWith('.ts')) continue;
    const before = fs.readFileSync(abs, 'utf8');
    const replace = (_m, pre, q, spec) => {
      const parts = spec.split('/');
      const pkgName = `${parts[0]}/${parts[1]}`;
      if (pkgName === fw.pkg) return `${pre}${q}${spec}${q}`; // own package (rare)
      const mapped = reverseMap.get(spec);
      if (!mapped)
        throw new Error(
          `${fw.out} imports "${spec}" which @labre/core does not expose`
        );
      return `${pre}${q}${mapped}${q}`;
    };
    const after = before
      .replace(IMPORT_RE, replace)
      .replace(MODULE_AUG_RE, replace);
    if (after !== before) fs.writeFileSync(abs, after);
  }
  // descriptor.ts — one-line host wiring
  fs.writeFileSync(
    path.join(src, 'descriptor.ts'),
    `import { ${fw.ext} } from './view.js';\n\n` +
      `/** Host wiring for the ${fw.flag} framework. */\n` +
      `export const ${fw.info} = {\n` +
      `  flag: '${fw.flag}',\n` +
      `  telemetry: '${fw.telemetry}',\n` +
      `  viewExtension: ${fw.ext},\n` +
      `} as const;\n`
  );
  fs.writeFileSync(
    path.join(out, 'package.json'),
    JSON.stringify(
      {
        name: `${SCOPE}/labre-${fw.out}`,
        description: `Labre ${fw.flag} framework for ${CORE}.`,
        version: VERSION,
        type: 'module',
        sideEffects: false,
        author: 'lajola',
        contributors: ['toeverything'],
        license: 'MPL-2.0',
        exports: {
          '.': './src/index.ts',
          './view': './src/view.ts',
          './descriptor': './src/descriptor.ts',
        },
        files: ['src'],
        dependencies: { [CORE]: VERSION, ...thirdPartyDeps([fw.pkg]) },
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
  `@labre/core: vendored ${core.vendored} packages, ${core.exportsCount} exports, version ${VERSION}`
);
console.log(`frameworks: ${FRAMEWORKS.map(f => '@labre/' + f.out).join(', ')}`);
console.log(`output: ${path.relative(ROOT, OUT_DIR)}/`);
