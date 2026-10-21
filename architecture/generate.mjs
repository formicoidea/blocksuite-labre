// ponytail: throwaway spike. Regex import scanner instead of dependency-cruiser;
// upgrade path: feed dependency-cruiser's JSON into the same emit().
// Reads packages/** and writes architecture/generated.c4 (never edited by hand).
// `node architecture/generate.mjs --check` exits 1 when the committed file drifts.
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const OUT = path.join(import.meta.dirname, 'generated.c4');
const EXTERNALS = ['lit', 'yjs', '@preact/signals-core', 'zod'];
const RESERVED = new Set(
  'model views view specification element relationship tag style color shape icon extend include exclude title description technology link metadata deployment dynamic global this it where with navigateTo and or not kind is import from icons apps colors fonts'.split(
    ' '
  )
);

const id = s => {
  let x = s.replace(/^@labre\//, '').replace(/[^a-zA-Z0-9_]/g, '_');
  if (/^[0-9]/.test(x)) x = '_' + x;
  if (RESERVED.has(x)) x += '_';
  return x;
};
const layerOf = rel => {
  if (rel.startsWith('packages/framework/')) return 'framework';
  if (rel === 'packages/affine/model') return 'model';
  if (rel === 'packages/affine/all') return 'assembly';
  if (rel.startsWith('packages/affine/')) return 'features';
  return 'tools';
};
const LAYERS = {
  framework: 'Framework (global, store, sync, std)',
  model: 'Model: the file format',
  features: 'Feature packages',
  assembly: 'Assembly (@labre/affine)',
  tools: 'Playground and integration tests',
};

// 1. workspaces
const pkgs = new Map(); // name -> {dir, id, layer, exports}
const walkPk = d => {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (!e.isDirectory() || e.name === 'node_modules' || e.name === 'dist')
      continue;
    const p = path.join(d, e.name);
    const pj = path.join(p, 'package.json');
    if (fs.existsSync(pj)) {
      const j = JSON.parse(fs.readFileSync(pj, 'utf8'));
      const rel = path.relative(ROOT, p).split(path.sep).join('/');
      pkgs.set(j.name, {
        name: j.name,
        dir: p,
        rel,
        id: id(j.name),
        layer: layerOf(rel),
        exports: j.exports ?? {},
      });
    }
    walkPk(p);
  }
};
walkPk(path.join(ROOT, 'packages'));

// 2. files -> (package, folder)
const isSrc = f => /\.(ts|tsx|mts)$/.test(f) && !f.endsWith('.d.ts');
const folderOf = (pkg, file) => {
  const rel = path.relative(pkg.dir, file).split(path.sep);
  // src/<folder>/... -> folder ; src/x.ts -> root ; anything else -> its first dir
  const parts = rel[0] === 'src' ? rel.slice(1) : rel;
  if (parts.includes('__tests__') || /\.spec\.[mc]?tsx?$/.test(file))
    return null;
  return parts.length > 1 ? parts[0] : '_root';
};
const files = new Map(); // abs -> {pkg, folder}
for (const pkg of pkgs.values()) {
  const walk = d => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) {
        if (e.name === 'node_modules' || e.name === 'dist') continue;
        if (fs.existsSync(path.join(p, 'package.json')) && p !== pkg.dir)
          continue; // nested workspace
        walk(p);
      } else if (isSrc(e.name)) {
        const folder = folderOf(pkg, p);
        if (folder) files.set(p, { pkg, folder });
      }
    }
  };
  walk(pkg.dir);
}

// 3. resolve imports
const resolveRel = (from, spec) => {
  const base = path.resolve(path.dirname(from), spec.replace(/\.js$/, ''));
  for (const c of [
    base + '.ts',
    base + '.tsx',
    base + '.mts',
    path.join(base, 'index.ts'),
  ])
    if (files.has(c)) return files.get(c);
  return null;
};
const resolveLabre = spec => {
  const m = spec.match(/^(@labre\/[^/]+)(?:\/(.*))?$/);
  if (!m) return null;
  const pkg = pkgs.get(m[1]);
  if (!pkg) return null;
  const sub = m[2] ? './' + m[2] : '.';
  const ex = pkg.exports[sub];
  const target = typeof ex === 'string' ? ex : (ex?.default ?? ex?.import);
  if (target) {
    const f = path.join(pkg.dir, target);
    if (files.has(f)) return files.get(f);
  }
  return { pkg, folder: '_root' };
};
const RE =
  /(?:import|export)\s[^'"]*?from\s*['"]([^'"]+)['"]|import\s*\(\s*['"]([^'"]+)['"]\s*\)|import\s*['"]([^'"]+)['"]/g;
const edges = new Map(); // "src->dst" -> count
const folders = new Map(); // "pkgid.folderid" -> {pkg, folder, files}
const addFolder = (pkg, folder) => {
  const k = `${pkg.id}.${id(folder)}`;
  if (!folders.has(k)) folders.set(k, { pkg, folder, files: 0 });
  return folders.get(k);
};
const ext = new Map();
for (const [file, { pkg, folder }] of files) {
  addFolder(pkg, folder).files++;
  const src = `${pkg.layer}.${pkg.id}.${id(folder)}`;
  const s = fs.readFileSync(file, 'utf8');
  let m;
  while ((m = RE.exec(s))) {
    const spec = m[1] || m[2] || m[3];
    let t = null;
    if (spec.startsWith('.')) t = resolveRel(file, spec);
    else if (spec.startsWith('@labre/')) t = resolveLabre(spec);
    else {
      const e = EXTERNALS.find(x => spec === x || spec.startsWith(x + '/'));
      if (e) {
        const k = `${src}->externals.${id(e)}`;
        ext.set(k, (ext.get(k) || 0) + 1);
      }
      continue;
    }
    if (!t) continue;
    addFolder(t.pkg, t.folder);
    const dst = `${t.pkg.layer}.${t.pkg.id}.${id(t.folder)}`;
    if (dst === src) continue;
    const k = `${src}->${dst}`;
    edges.set(k, (edges.get(k) || 0) + 1);
  }
}

// 4. emit
const q = s => `'${s.replace(/'/g, "\\'")}'`;
let out = `// GENERATED by architecture/generate.mjs from packages/** — do not edit.\nmodel {\n`;
for (const [layer, title] of Object.entries(LAYERS)) {
  out += `  ${layer} = layer ${q(title)} {\n`;
  for (const pkg of [...pkgs.values()]
    .filter(p => p.layer === layer)
    .sort((a, b) => a.name.localeCompare(b.name))) {
    out += `    ${pkg.id} = package ${q(pkg.name)} {\n      link ../${pkg.rel}\n`;
    for (const [k, f] of [...folders].filter(([, f]) => f.pkg === pkg).sort())
      out += `      ${k.split('.')[1]} = folder ${q(f.folder === '_root' ? 'src/' : f.folder + '/')} {\n        metadata { files ${q(String(f.files))} }\n      }\n`;
    out += `    }\n`;
  }
  out += `  }\n`;
}
out += `  externals = layer 'External libraries' {\n`;
for (const e of EXTERNALS) out += `    ${id(e)} = external ${q(e)}\n`;
out += `  }\n`;
for (const [k, n] of [...edges, ...ext].sort()) {
  const [s, d] = k.split('->');
  out += `  ${s} -> ${d} ${q(n + ' import' + (n > 1 ? 's' : ''))}\n`;
}
out += `}\n\nviews {\n`;
for (const layer of Object.keys(LAYERS))
  out += `  view ${layer} of ${layer} {\n    title ${q(LAYERS[layer])}\n    include *\n  }\n`;
for (const pkg of pkgs.values())
  out += `  view ${pkg.id} of ${pkg.layer}.${pkg.id} {\n    title ${q(pkg.name)}\n    include *, -> ${pkg.layer}.${pkg.id}.* ->\n  }\n`;
out += `}\n`;

if (process.argv.includes('--check')) {
  const cur = fs.existsSync(OUT) ? fs.readFileSync(OUT, 'utf8') : '';
  if (cur !== out) {
    console.error(
      'architecture/generated.c4 drifted from packages/**: run node architecture/generate.mjs'
    );
    process.exit(1);
  }
  console.log('architecture/generated.c4 is up to date');
} else {
  fs.writeFileSync(OUT, out);
  console.log(
    `wrote ${OUT}: ${pkgs.size} packages, ${folders.size} folders, ${edges.size} folder edges, ${files.size} files`
  );
}
