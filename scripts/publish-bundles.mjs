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
import { spawnSync } from 'node:child_process';
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

// MPL-2.0 is file-level copyleft: a tarball without the licence text must never
// reach the registry. Checked for EVERY bundle before the first publish, so a
// missing one cannot be found halfway through a release.
for (const { dir, pkg: pj } of ordered) {
  const license = path.join(dir, 'LICENSE');
  if (!fs.existsSync(license) || fs.statSync(license).size === 0) {
    throw new Error(
      `${pj.name}: no (or empty) LICENSE in ${path.relative(process.cwd(), dir)} — ` +
        'the published tarball would ship without the MPL-2.0 text; ' +
        're-run `node scripts/build-bundles.mjs`'
    );
  }
}

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

// npm can answer a 5xx to a PUT it has already accepted (npm/cli#6103), and a
// large tarball (core, ~15 MB) shows on the registry minutes after its PUT: the
// 0.56.0 release stopped on a 503 with core accepted but not yet visible. So a
// 5xx is retried, and "cannot publish over" means the registry already holds
// the version: skip it instead of aborting a half-published release.
const publish = async dir => {
  for (let attempt = 1; ; attempt++) {
    const { status, stderr } = spawnSync(
      `npm publish --access public --tag ${tag}`,
      {
        cwd: dir,
        shell: true,
        stdio: ['inherit', 'inherit', 'pipe'],
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
      }
    );
    process.stderr.write(stderr ?? '');
    if (status === 0) return 'published';
    if (/EPUBLISHCONFLICT|cannot publish over/i.test(stderr ?? '')) {
      return 'already there';
    }
    if (attempt >= 4 || !/\bE5\d\d\b/.test(stderr ?? '')) {
      throw new Error(`npm publish failed in ${dir} (exit ${status})`);
    }
    console.log(
      `registry ${/\bE5\d\d\b/.exec(stderr)?.[0]}, retry ${attempt}/3`
    );
    await sleep(attempt * 30_000);
  }
};

for (const { dir, pkg: pj } of ordered) {
  const url = `https://registry.npmjs.org/${pj.name.replace('/', '%2F')}/${pj.version}`;
  const res = await fetch(url);
  if (res.status === 200) {
    console.log(`skip ${pj.name}@${pj.version} (already published)`);
    continue;
  }

  console.log(`publish ${pj.name}@${pj.version} (tag ${tag})`);
  if ((await publish(dir)) === 'already there') {
    console.log(
      `skip ${pj.name}@${pj.version} (accepted by an earlier attempt)`
    );
  }
}
