// @ts-check
/**
 * Publish the generated bundles in `dist-bundles/` to npm.
 *
 * Replaces `yarn workspaces foreach npm publish` (all workspace packages are now
 * private). Publishes `@labre/core` first, then the framework bundles. Idempotent:
 * a bundle whose exact version is already on the registry is skipped — so the
 * Release workflow's publish job can safely run on every push.
 *
 * Usage: `node scripts/publish-bundles.mjs <dist-tag>` (e.g. latest | canary).
 * Auth: relies on npm's userconfig `.npmrc` (set up by actions/setup-node) plus
 * the `NODE_AUTH_TOKEN` env var.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const tag = process.argv[2] || 'latest';
const outDir = path.join(process.cwd(), 'dist-bundles');

if (!fs.existsSync(outDir)) {
  throw new Error(
    'dist-bundles/ not found — run `node scripts/build-bundles.mjs` first'
  );
}

// Publish in dependency order (core → shared → frameworks) so a dependency is
// always on the registry before its dependents.
const bundles = fs
  .readdirSync(outDir)
  .map(name => path.join(outDir, name))
  .filter(
    dir =>
      fs.statSync(dir).isDirectory() &&
      fs.existsSync(path.join(dir, 'package.json'))
  )
  .map(dir => ({
    dir,
    pkg: JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8')),
  }));

const byName = new Map(bundles.map(b => [b.pkg.name, b]));
const bundleDeps = b =>
  Object.keys(b.pkg.dependencies || {}).filter(d => byName.has(d));
const ordered = [];
const done = new Set();
const visit = b => {
  if (done.has(b.pkg.name)) return;
  done.add(b.pkg.name);
  for (const d of bundleDeps(b)) visit(byName.get(d));
  ordered.push(b); // pushed after its deps → deps publish first
};
for (const b of bundles) visit(b);

for (const { dir, pkg: pj } of ordered) {
  const url = `https://registry.npmjs.org/${pj.name.replace('/', '%2F')}/${pj.version}`;
  const res = await fetch(url);
  if (res.status === 200) {
    console.log(`skip ${pj.name}@${pj.version} (already published)`);
    continue;
  }

  console.log(`publish ${pj.name}@${pj.version} (tag ${tag})`);
  execSync(`npm publish --access public --tag ${tag}`, {
    cwd: dir,
    stdio: 'inherit',
  });
}
