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
import esbuild from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const PKGS_DIR = path.join(ROOT, 'packages');
const OUT_DIR = path.join(ROOT, 'dist-bundles');
const UMBRELLA_DIR = path.join(PKGS_DIR, 'affine', 'all');

/**
 * Business frameworks: each is a senior-button gfx module shipped as its OWN
 * bundle. `extensions` lists the view extension(s) the bundle exposes, each with
 * the flag that gates it; omit `flag` for an always-on extension (e.g. element
 * rendering that must paint even when the senior button is hidden).
 *
 * DERIVED, not hand-maintained (`docs/adr/0008` § Packaging): the single list
 * is `FRAMEWORK_DESCRIPTORS` in `packages/affine/all/src/frameworks.ts`, a
 * data-only module (object literals, type-only imports) that this script reads
 * through a type-strip transform. Adding a framework is one descriptor — no
 * edit here. The bundles that are NOT frameworks (templates-only packages with
 * no senior button and no commands) come from `AUXILIARY_BUNDLES` in the same
 * module.
 */
const FRAMEWORKS_TS = path.join(UMBRELLA_DIR, 'src', 'frameworks.ts');

/** Import a data-only `.ts` module without a bundler and without ts-node. */
async function importDataModule(fileAbs) {
  const source = fs.readFileSync(fileAbs, 'utf8');
  const { code } = await esbuild.transform(source, {
    loader: 'ts',
    format: 'esm',
  });
  if (/^\s*import\s+(?!type\b)/m.test(code)) {
    throw new Error(
      `${path.relative(ROOT, fileAbs)} must stay data-only (no runtime imports) ` +
        `so the bundle script can read it — see docs/adr/0008 § Packaging`
    );
  }
  return import(
    `data:text/javascript;base64,${Buffer.from(code).toString('base64')}`
  );
}

const { FRAMEWORK_DESCRIPTORS, AUXILIARY_BUNDLES } =
  await importDataModule(FRAMEWORKS_TS);

const FRAMEWORKS = [
  ...FRAMEWORK_DESCRIPTORS.map(d => ({
    out: d.bundle,
    pkg: d.pkg,
    dir: d.dir,
    /** Historical PostHog value; emitted as `telemetryKey` in descriptor.ts. */
    telemetryKey: d.telemetryKey,
    /** Code-side identity: the flag key AND the `CommandDescriptor.owner`. */
    id: d.id,
    info: d.info,
    extensions: d.extensions.map(e => ({ ext: e.viewExtension, flag: e.flag })),
    shortcuts: d.shortcuts ?? false,
  })),
  ...AUXILIARY_BUNDLES.map(b => ({
    out: b.bundle,
    pkg: b.pkg,
    dir: b.dir,
    telemetryKey: b.label,
    id: b.label,
    info: b.info,
    extensions: b.extensions.map(e => ({ ext: e.viewExtension, flag: e.flag })),
    shortcuts: false,
  })),
];

/**
 * Shared (non-framework) bundles: published packages with NO senior button that
 * one or more framework bundles depend on. Like frameworks they are vendored OUT
 * of core, but they are emitted as their own bundle depending only on core.
 */
const SHARED = [
  {
    out: 'ddd-shared',
    pkg: '@labre/affine-gfx-ddd-shared',
    dir: 'affine/gfx/ddd-shared',
  },
];

const FRAMEWORK_PKGS = new Set(FRAMEWORKS.map(f => f.pkg));
const SHARED_PKGS = new Set(SHARED.map(s => s.pkg));
/** Packages that must NOT be vendored into core (they ship as their own bundle). */
const EXCLUDED_FROM_CORE = new Set([...FRAMEWORK_PKGS, ...SHARED_PKGS]);

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

/** Published bundle name for a workspace pkg that ships as its own bundle. */
function bundleNameOf(pkg) {
  const b =
    FRAMEWORKS.find(f => f.pkg === pkg) ?? SHARED.find(s => s.pkg === pkg);
  return b ? `${SCOPE}/labre-${b.out}` : null;
}

/** Core packages = umbrella deps minus the frameworks AND the shared bundles. */
const corePkgNames = Object.keys(umbrella.deps).filter(
  d => d.startsWith('@labre/') && !EXCLUDED_FROM_CORE.has(d)
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
  if (EXCLUDED_FROM_CORE.has(pkgName)) {
    throw new Error(
      `@labre/core must not reference bundled package ${pkgName} (spec "${spec}")`
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

const escapeRe = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Remove whole statements matching `re` (multi-line safe); assert `expected`. */
function dropStatement(fileAbs, re, expected, label) {
  let removed = 0;
  const content = fs
    .readFileSync(fileAbs, 'utf8')
    .replace(new RegExp(re.source, 'g'), () => {
      removed++;
      return '';
    });
  if (removed !== expected) {
    throw new Error(
      `Expected to drop ${expected} ${label} statements from ${path.relative(ROOT, fileAbs)}, dropped ${removed} (anchor drift — re-review upstream)`
    );
  }
  fs.writeFileSync(fileAbs, content);
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
  // 3. trim every framework from the COPIED assembly files (source untouched),
  //    derived from FRAMEWORKS so a new senior-button package needs no edit here.
  const viewTs = path.join(CORE_SRC, 'extensions', 'view.ts');
  const flagsTs = path.join(CORE_SRC, 'flags.ts');
  for (const fw of FRAMEWORKS) {
    // the framework's `/view` import (single- or multi-line)
    dropStatement(
      viewTs,
      new RegExp(
        `import\\s*\\{[^}]*\\}\\s*from\\s*['"]${escapeRe(fw.pkg)}/view['"];?\\r?\\n`
      ),
      1,
      `${fw.out} import`
    );
    for (const e of fw.extensions) {
      if (e.flag) {
        dropLines(
          viewTs,
          new RegExp(
            `^\\s*\\.\\.\\.\\(on\\('${escapeRe(e.flag)}'\\)\\s*\\?\\s*\\[${e.ext}\\]`
          ),
          1,
          `${e.ext} registration`
        );
      } else {
        // always-on extension: a bare `    <Ext>,` registration line
        dropLines(
          viewTs,
          new RegExp(`^\\s*${e.ext},\\s*$`),
          1,
          `${e.ext} registration`
        );
      }
    }
    for (const e of fw.extensions) {
      if (!e.flag) continue;
      dropLines(
        flagsTs,
        new RegExp(`^\\s*'${escapeRe(e.flag)}',\\s*$`),
        1,
        `${e.flag} flag`
      );
    }
    // A framework's command and translation-key contributions ship with ITS
    // bundle, not with core: strip the import and the group entry from the
    // copied commands.ts and translations.ts (the host composes core's registry
    // and core's manifest with each enabled framework bundle's own exports).
    // The shortcut manifest derives from the registry, so stripping commands.ts
    // strips both.
    //
    // The two files have the SAME shape on purpose — a one-line
    // `{ owner: '<id>', … }` entry per framework — so one rule covers them and
    // a new framework needs no edit here.
    if (fw.shortcuts) {
      for (const [file, label] of [
        ['commands.ts', 'commands'],
        ['translations.ts', 'translation entries'],
      ]) {
        const fileAbs = path.join(CORE_SRC, file);
        dropStatement(
          fileAbs,
          new RegExp(
            `import\\s*\\{[^}]*\\}\\s*from\\s*['"]${escapeRe(fw.pkg)}['"];?\\r?\\n`
          ),
          1,
          `${fw.out} ${label} import`
        );
        dropLines(
          fileAbs,
          new RegExp(`^\\s*\\{\\s*owner:\\s*'${escapeRe(fw.id)}',`),
          1,
          `${fw.out} ${label} group`
        );
      }
    }
  }
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

/** Rewrite a bundle's `@labre/*` imports: own-pkg kept, else mapped via `reverseMap`. */
function rewriteBundleImports(src, ownPkg, reverseMap, label) {
  for (const abs of listFiles(src)) {
    if (!abs.endsWith('.ts')) continue;
    const before = fs.readFileSync(abs, 'utf8');
    const replace = (_m, pre, q, spec) => {
      const parts = spec.split('/');
      const pkgName = `${parts[0]}/${parts[1]}`;
      if (pkgName === ownPkg) return `${pre}${q}${spec}${q}`; // own package
      const mapped = reverseMap.get(spec);
      if (!mapped)
        throw new Error(
          `${label} imports "${spec}" which core / a sibling bundle does not expose`
        );
      return `${pre}${q}${mapped}${q}`;
    };
    const after = before
      .replace(IMPORT_RE, replace)
      .replace(MODULE_AUG_RE, replace);
    if (after !== before) fs.writeFileSync(abs, after);
  }
}

/** Sibling SHARED-bundle deps a package pulls in → { bundleName: VERSION }. */
function sharedBundleDeps(pkg) {
  const out = {};
  for (const d of Object.keys(byName.get(pkg)?.deps ?? {})) {
    if (SHARED_PKGS.has(d)) out[bundleNameOf(d)] = VERSION;
  }
  return out;
}

function buildFramework(fw, reverseMap) {
  const out = path.join(OUT_DIR, fw.out);
  const src = path.join(out, 'src');
  fs.rmSync(out, { recursive: true, force: true });
  copySrc(path.join(PKGS_DIR, fw.dir, 'src'), src);
  rewriteBundleImports(src, fw.pkg, reverseMap, fw.out);

  // descriptor.ts — host wiring. A single flag-gated extension keeps the
  // original { flag, …, viewExtension } shape; multi-extension frameworks (an
  // always-on renderer + a flag-gated button) use a list.
  //
  // `telemetry` is renamed `telemetryKey` and now carries the HISTORICAL
  // PostHog value in every case (docs/adr/0008 § Telemetry): it used to echo
  // the flag key, so the three DDD bundles were emitting a value the library
  // never sent. A host reading the old field must move to `telemetryKey`.
  //
  // `flag` is emitted in BOTH shapes — it still means exactly what it always
  // meant (the flag that gates this framework), so a host reading it for a
  // settings toggle keeps working. `viewExtension` is deliberately NOT
  // aliased on the multi shape: under the reversed flag contract
  // (docs/adr/0009) no single extension has the old
  // `flags[flag] ? register(viewExtension) : skip` semantics. Aliasing it to
  // the gated tooling extension would leave the renderer unregistered even
  // when the flag is ON, and aliasing it to a composite would drop rendering
  // when the flag is OFF — reintroducing the exact bug PF4 fixes. A host on
  // the old field must migrate to `extensions`; failing to compile is the
  // intended, safe outcome.
  const names = fw.extensions.map(e => e.ext).join(', ');
  const flagged = fw.extensions.filter(e => e.flag);
  const single = fw.extensions.length === 1 && fw.extensions[0].flag;
  const body = single
    ? `export const ${fw.info} = {\n` +
      `  flag: '${fw.extensions[0].flag}',\n` +
      `  telemetryKey: '${fw.telemetryKey}',\n` +
      `  viewExtension: ${fw.extensions[0].ext},\n` +
      `} as const;\n`
    : `export const ${fw.info} = {\n` +
      (flagged.length === 1 ? `  flag: '${flagged[0].flag}',\n` : '') +
      `  telemetryKey: '${fw.telemetryKey}',\n` +
      `  extensions: [\n` +
      fw.extensions
        .map(
          e =>
            `    { ${e.flag ? `flag: '${e.flag}', ` : ''}viewExtension: ${e.ext} },`
        )
        .join('\n') +
      `\n  ],\n} as const;\n`;
  fs.writeFileSync(
    path.join(src, 'descriptor.ts'),
    `import { ${names} } from './view.js';\n\n` +
      `/** Host wiring for the ${fw.id} framework. */\n` +
      body
  );

  fs.writeFileSync(
    path.join(out, 'package.json'),
    JSON.stringify(
      {
        name: bundleNameOf(fw.pkg),
        description: `Labre ${fw.id} framework for ${CORE}.`,
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
        dependencies: {
          [CORE]: VERSION,
          ...sharedBundleDeps(fw.pkg),
          ...thirdPartyDeps([fw.pkg]),
        },
      },
      null,
      2
    ) + '\n'
  );
}

/** A shared bundle: no senior button / descriptor; depends only on core. */
function buildShared(sh, reverseMap) {
  const out = path.join(OUT_DIR, sh.out);
  const src = path.join(out, 'src');
  fs.rmSync(out, { recursive: true, force: true });
  copySrc(path.join(PKGS_DIR, sh.dir, 'src'), src);
  rewriteBundleImports(src, sh.pkg, reverseMap, sh.out);
  fs.writeFileSync(
    path.join(out, 'package.json'),
    JSON.stringify(
      {
        name: bundleNameOf(sh.pkg),
        description: `Labre ${sh.out} — shared building blocks for ${CORE} frameworks.`,
        version: VERSION,
        type: 'module',
        sideEffects: false,
        author: 'lajola',
        contributors: ['toeverything'],
        license: 'MPL-2.0',
        exports: byName.get(sh.pkg).exports,
        files: ['src'],
        dependencies: { [CORE]: VERSION, ...thirdPartyDeps([sh.pkg]) },
      },
      null,
      2
    ) + '\n'
  );
}

// --- run ---
fs.mkdirSync(OUT_DIR, { recursive: true });
const core = buildCore();
const coreReverseMap = buildCoreReverseMap();
// shared bundles depend only on core
for (const sh of SHARED) buildShared(sh, coreReverseMap);
// frameworks may also import sibling shared bundles → map those to bundle names
const fwReverseMap = new Map(coreReverseMap);
for (const sh of SHARED) fwReverseMap.set(sh.pkg, bundleNameOf(sh.pkg));
for (const fw of FRAMEWORKS) buildFramework(fw, fwReverseMap);

console.log(
  `@labre/core: vendored ${core.vendored} packages, ${core.exportsCount} exports, version ${VERSION}`
);
console.log(`shared: ${SHARED.map(s => bundleNameOf(s.pkg)).join(', ')}`);
console.log(
  `frameworks: ${FRAMEWORKS.map(f => bundleNameOf(f.pkg)).join(', ')}`
);
console.log(`output: ${path.relative(ROOT, OUT_DIR)}/`);
