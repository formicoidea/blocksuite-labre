/**
 * Generates `architecture/code.c4`, the library's architecture map, from the
 * imports of `packages/**` (ADR 0040, decisions 1 to 4).
 *
 *   yarn architecture           writes architecture/code.c4
 *   yarn architecture --check   exits 1 when the committed file is not what
 *                               the code produces
 *
 * The hierarchy is the repository's and nothing else: layer, then package,
 * then the first folder under the package's `src/`. Packages under
 * `packages/affine/<kind>/` sit in a `family` element named after `<kind>`,
 * so the feature layer zooms in two steps instead of showing every feature
 * package at once. `packages/playground` and `packages/integration-test` form a fifth,
 * `tooling`, layer that sits above the four of CLAUDE.md: they import
 * everything and nothing may import them.
 *
 * Relations come at two grains, each with its own kind, because the likeC4
 * MCP tools do not aggregate folder edges into packages: `uses` (package to
 * package) and `imports` (folder to folder). The title counts imports, one
 * per (importing file, imported file) pair; the pairs whose every import is
 * `import type` or `import('…').T` are counted again as "type-only", since
 * they put no edge in the runtime graph but still couple the sources.
 *
 * Two kinds of file never make an edge:
 * - tests (`__tests__/`, `*.spec.*`, `*.test.*`, benches, stories) and
 *   everything outside the package's `src/` (the `*.config.ts` files; for
 *   the playground, which has no `src/`, the files at its root);
 * - inside a package, a file that only re-exports (a barrel). A barrel's
 *   re-export is plumbing, not use: counting it drew a fake edge from the
 *   barrel's folder to every folder it re-exports and fake folder cycles
 *   (ADR 0040). An import OF a barrel still counts, against
 *   the barrel's folder, and a barrel's re-export of ANOTHER package still
 *   counts: that is a real dependency (`@labre/affine` is mostly such shims).
 *
 * The output is deterministic: sorted elements and relations, no timestamp,
 * ids derived from directory names only.
 */
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { cruise } from 'dependency-cruiser';
import ts from 'typescript';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'architecture', 'code.c4');
const OUT_REL = 'architecture/code.c4';
const REPO_URL =
  'https://github.com/formicoidea/blocksuite-labre/tree/blocksuite-labre-main';

/**
 * Top-level elements, in dependency order: a layer may use the layers before
 * it, never the ones after. Hosts import these ids (`import { framework }
 * from 'blocksuite'`), so they are stable.
 */
const LAYERS = [
  [
    'framework',
    'framework/*',
    'DI, the document model over Yjs, sync sources, the editor runtime.',
  ],
  [
    'model_',
    'affine/model',
    'Every block schema and surface element model: the file format.',
  ],
  [
    'features',
    'affine/* features',
    'One package per feature, grouped by kind folder.',
  ],
  [
    'assembly',
    'affine/all',
    'The assembly: schemas, extensions, flags, frameworks.',
  ],
  [
    'tooling',
    'tooling',
    'The playground and the integration suite. Not published.',
  ],
];

/**
 * Keywords of the likeC4 1.60 grammar, plus the words the spike found
 * rejected as element ids. An id equal to one of them gets a `_` suffix.
 */
const RESERVED = new Set(
  `BottomTop LeftRight RightLeft TopBottom agent alt amber and apps auto
  autoLayout blue border bottom break browser bucket catch color colors
  component crow cylinder dashed deployment deploymentNode description diagram
  diamond document dot dotted dynamic dynamicPredicateGroup element else exclude
  extend extends finally fixed fonts from global gray green group head icon
  iconColor iconPosition iconSize icons if import include includeAncestors
  indigo instance instanceOf is it kind large left lg line link loop max md
  medium metadata min mobile model multiple muted navigateTo node none normal
  not notation notes odiamond odot of onormal opacity open opt or order ortho
  padding par parallel person predicate predicateGroup primary queue rank
  rectangle red relationship rgb rgba right routing same secondary sequence
  shape sink size sizing sky slate sm small solid source specification spline
  storage style styleGroup summary tag tail target technology textSize this
  title top try variant vee view views when where with xl xlarge xs xsmall`.split(
    /\s+/
  )
);

/** A valid likeC4 identifier, `[a-zA-Z_][a-zA-Z0-9_-]*`, never a keyword. */
function c4Id(name) {
  let id = name.replace(/[^a-zA-Z0-9_-]/g, '_');
  if (!/^[a-zA-Z_]/.test(id)) id = `_${id}`;
  if (id.endsWith('-') || RESERVED.has(id)) id = `${id}_`;
  return id;
}

const quote = s => `'${s.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;

function isTestOrConfig(rel) {
  return (
    /(^|\/)__tests__\//.test(rel) ||
    /\.(spec|test|bench|stories)\.[cm]?tsx?$/.test(rel) ||
    /\.d\.[cm]?ts$/.test(rel)
  );
}

/** Every workspace under `packages/`, placed in its layer (and family). */
function findPackages() {
  const packages = [];
  const visit = dir => {
    for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.name === 'node_modules') continue;
      const rel = `${dir}/${entry.name}`;
      let manifest;
      try {
        manifest = JSON.parse(
          readFileSync(join(ROOT, rel, 'package.json'), 'utf8')
        );
      } catch {
        visit(rel);
        continue;
      }
      const parts = rel.split('/');
      let layer;
      let family = null;
      if (parts[1] === 'framework') layer = 'framework';
      else if (rel === 'packages/affine/model') layer = 'model_';
      else if (rel === 'packages/affine/all') layer = 'assembly';
      else if (parts[1] === 'affine') {
        layer = 'features';
        if (parts.length === 4) family = parts[2];
      } else if (parts.length === 2) layer = 'tooling';
      else throw new Error(`${rel}: no layer for this workspace`);
      let srcRoot = rel;
      try {
        if (statSync(join(ROOT, rel, 'src')).isDirectory())
          srcRoot = `${rel}/src`;
      } catch {
        // no src/: the playground keeps its sources at the package root
      }
      packages.push({
        rel,
        name: manifest.name,
        id: c4Id(entry.name),
        layer,
        family,
        srcRoot,
        fqn: [layer, family && c4Id(family), c4Id(entry.name)]
          .filter(Boolean)
          .join('.'),
      });
    }
  };
  visit('packages');
  const seen = new Map();
  for (const pkg of packages) {
    if (seen.has(pkg.fqn))
      throw new Error(
        `${seen.get(pkg.fqn)} and ${pkg.rel} share the id ${pkg.fqn}`
      );
    seen.set(pkg.fqn, pkg.rel);
  }
  return packages;
}

/** True when every top-level statement is `export … from '…'`. */
function isBarrel(file) {
  const source = ts.createSourceFile(
    file,
    readFileSync(join(ROOT, file), 'utf8'),
    ts.ScriptTarget.Latest
  );
  return (
    source.statements.length > 0 &&
    source.statements.every(s => ts.isExportDeclaration(s) && s.moduleSpecifier)
  );
}

async function cruiseImports() {
  const { output } = await cruise(
    ['packages'],
    {
      baseDir: ROOT,
      // `@labre/` keeps an unresolvable workspace import in the result, so
      // `buildGraph` can refuse it instead of losing the edge
      includeOnly: { path: ['^packages/', '^@labre/'] },
      exclude: { path: ['/node_modules/', '/dist/'] },
      doNotFollow: { path: '/node_modules/' },
      tsPreCompilationDeps: true,
      moduleSystems: ['es6'],
    },
    {
      exportsFields: ['exports'],
      conditionNames: ['import', 'default'],
      extensions: ['.ts', '.tsx', '.js', '.mjs'],
    }
  );
  return output.modules;
}

function buildGraph(packages, modules) {
  const byDepth = [...packages].sort((a, b) => b.rel.length - a.rel.length);
  const packageOf = file =>
    byDepth.find(p => file.startsWith(`${p.rel}/`)) ?? null;

  /** file -> { pkg, folder } for every file that belongs on the map. */
  const files = new Map();
  for (const { source } of modules) {
    if (!/\.[cm]?tsx?$/.test(source) || isTestOrConfig(source)) continue;
    const pkg = packageOf(source);
    if (!pkg || !source.startsWith(`${pkg.srcRoot}/`)) continue;
    const inner = source.slice(pkg.srcRoot.length + 1).split('/');
    if (pkg.srcRoot === pkg.rel && inner.length === 1) continue; // root configs
    // '' is the files directly under src/
    files.set(source, { pkg, folder: inner.length > 1 ? inner[0] : '' });
  }

  const folders = new Map(); // `${pkg.fqn}.${id}` -> { pkg, name, id, files }
  const folderKey = ({ pkg, folder }) => {
    const id = folder ? c4Id(folder) : 'src';
    const key = `${pkg.fqn}.${id}`;
    const known = folders.get(key);
    if (known && known.name !== folder)
      throw new Error(
        `${pkg.rel}: folders ${known.name} and ${folder} share the id ${id}`
      );
    if (!known) folders.set(key, { pkg, name: folder, id, files: 0 });
    return key;
  };
  for (const file of files.values()) folders.get(folderKey(file)).files += 1;

  const uses = new Map();
  const imports = new Map();
  const count = (edges, from, to, typeOnly) => {
    const key = `${from} ${to}`;
    const edge = edges.get(key) ?? { from, to, all: 0, typeOnly: 0 };
    edge.all += 1;
    if (typeOnly) edge.typeOnly += 1;
    edges.set(key, edge);
  };

  for (const { source, dependencies } of modules) {
    const from = files.get(source);
    if (!from) continue;
    const barrel = isBarrel(source);
    /** resolved file -> true while every import of it is type-only */
    const targets = new Map();
    for (const dep of dependencies) {
      if (dep.couldNotResolve && dep.module.startsWith('@labre/'))
        throw new Error(
          `${source}: cannot resolve ${dep.module}; is it declared and installed? A map that drops it would hide an edge.`
        );
      if (!files.has(dep.resolved) || dep.resolved === source) continue;
      // `import('x').T` is a type position like `import type`
      const typeOnly = dep.dependencyTypes.some(
        t => t === 'type-only' || t === 'type-import'
      );
      targets.set(
        dep.resolved,
        (targets.get(dep.resolved) ?? true) && typeOnly
      );
    }
    for (const [target, typeOnly] of targets) {
      const to = files.get(target);
      const crossPackage = to.pkg !== from.pkg;
      if (crossPackage) count(uses, from.pkg.fqn, to.pkg.fqn, typeOnly);
      if (barrel && !crossPackage) continue;
      const fromFolder = folderKey(from);
      const toFolder = folderKey(to);
      if (fromFolder !== toFolder)
        count(imports, fromFolder, toFolder, typeOnly);
    }
  }
  return { files, folders, uses, imports };
}

function emit(packages, { folders, uses, imports }) {
  const byId = (a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
  const fileCount = new Map();
  for (const folder of folders.values())
    fileCount.set(folder.pkg, (fileCount.get(folder.pkg) ?? 0) + folder.files);

  const lines = [
    '// GENERATED by scripts/architecture.mjs from the imports of packages/**',
    '// (ADR 0040). Never edit by hand: run `yarn architecture` and commit the',
    '// result; `yarn architecture --check` fails when this file drifts.',
    'model {',
  ];
  const link = (indent, path) => `${indent}link ${REPO_URL}/${path}`;
  const emitPackage = (pkg, indent) => {
    lines.push(`${indent}${pkg.id} = package ${quote(pkg.name)} {`);
    lines.push(link(`${indent}  `, pkg.rel));
    lines.push(
      `${indent}  metadata {`,
      `${indent}    path ${quote(pkg.rel)}`,
      `${indent}    files ${quote(String(fileCount.get(pkg) ?? 0))}`,
      `${indent}  }`
    );
    const own = [...folders.values()].filter(f => f.pkg === pkg).sort(byId);
    for (const folder of own) {
      const path = folder.name ? `${pkg.srcRoot}/${folder.name}` : pkg.srcRoot;
      const title = folder.name ? `${folder.name}/` : 'src/';
      lines.push(
        `${indent}  ${folder.id} = folder ${quote(title)} {`,
        link(`${indent}    `, path),
        `${indent}    metadata {`,
        `${indent}      path ${quote(path)}`,
        `${indent}      files ${quote(String(folder.files))}`,
        `${indent}    }`,
        `${indent}  }`
      );
    }
    lines.push(`${indent}}`);
  };

  for (const [layer, title, description] of LAYERS) {
    lines.push(`  ${layer} = layer ${quote(title)} {`);
    lines.push(`    description ${quote(description)}`);
    const members = packages.filter(p => p.layer === layer);
    const families = [
      ...new Set(members.map(p => p.family).filter(Boolean)),
    ].sort();
    const entries = [
      ...families.map(name => ({ id: c4Id(name), family: name })),
      ...members.filter(p => !p.family).map(pkg => ({ id: pkg.id, pkg })),
    ].sort(byId);
    for (const entry of entries) {
      if (entry.pkg) {
        emitPackage(entry.pkg, '    ');
        continue;
      }
      const path = `packages/affine/${entry.family}`;
      lines.push(
        `    ${entry.id} = family ${quote(`affine/${entry.family}`)} {`
      );
      lines.push(link('      ', path));
      lines.push(`      metadata {`, `        path ${quote(path)}`, `      }`);
      for (const pkg of members
        .filter(p => p.family === entry.family)
        .sort(byId))
        emitPackage(pkg, '      ');
      lines.push('    }');
    }
    lines.push('  }');
  }

  const relations = (kind, edges, label) => {
    lines.push('', `  // ${label}`);
    const sorted = [...edges.values()].sort((a, b) =>
      a.from === b.from ? (a.to < b.to ? -1 : 1) : a.from < b.from ? -1 : 1
    );
    for (const { from, to, all, typeOnly } of sorted) {
      const title =
        `${all} import${all === 1 ? '' : 's'}` +
        (typeOnly ? `, ${typeOnly} type-only` : '');
      lines.push(`  ${from} -[${kind}]-> ${to} ${quote(title)}`);
    }
  };
  relations(
    'uses',
    uses,
    'Package to package: imports that cross a package boundary.'
  );
  relations(
    'imports',
    imports,
    'Folder to folder: imports that cross a src/* folder.'
  );
  lines.push('}', '');
  return lines.join('\n');
}

async function main() {
  const check = process.argv.includes('--check');
  const started = Date.now();
  const packages = findPackages();
  const graph = buildGraph(packages, await cruiseImports());
  const text = emit(packages, graph);
  const summary = `${packages.length} packages, ${graph.folders.size} folders, ${graph.uses.size} uses, ${graph.imports.size} imports, ${graph.files.size} files, ${Date.now() - started} ms`;

  if (!check) {
    writeFileSync(OUT, text);
    console.log(`wrote ${OUT_REL}: ${summary}`);
    return;
  }
  let committed = '';
  try {
    committed = readFileSync(OUT, 'utf8');
  } catch {
    // a missing file is a drift like any other
  }
  if (committed === text) {
    console.log(`${OUT_REL} is up to date: ${summary}`);
    return;
  }
  const a = committed.split('\n');
  const b = text.split('\n');
  let line = 0;
  while (line < a.length && a[line] === b[line]) line += 1;
  console.error(
    [
      `${OUT_REL} is not what the code produces (first difference at line ${line + 1}).`,
      `  committed: ${a[line] ?? '<end of file>'}`,
      `  generated: ${b[line] ?? '<end of file>'}`,
      'Run `yarn architecture` and commit architecture/code.c4. Never edit it by hand.',
    ].join('\n')
  );
  process.exitCode = 1;
}

await main();
