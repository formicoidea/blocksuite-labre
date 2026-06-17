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

// Publish core before frameworks (frameworks depend on @labre/core).
const dirs = fs.readdirSync(outDir).sort();

for (const name of dirs) {
  const dir = path.join(outDir, name);
  const pjPath = path.join(dir, 'package.json');
  if (!fs.statSync(dir).isDirectory() || !fs.existsSync(pjPath)) continue;
  const pj = JSON.parse(fs.readFileSync(pjPath, 'utf8'));

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
