/**
 * `yarn test:integration [vitest arguments]`: the integration suite in two
 * browser sessions, run one after the other.
 *
 * One session shares one page across its files (`isolate: false`), and that
 * page keeps about 6 MB per test it mounted: over the whole suite it reached
 * 8.2 GB, which with Vite and Vitest exhausted the 16 GB hosted runner near
 * the end of the run (docs/lessons.md 39). `--shard` gives each half of the
 * files its own browser, so the page that accumulates is thrown away half-way.
 *
 * Both sessions always run, so one run reports every failure; the exit code
 * is 1 when either failed. Sequential, one file at a time
 * (`--no-file-parallelism`): the suite is load-sensitive.
 *
 * A filter (`yarn test:integration some-file`) shards the matching files, so
 * it can land wholly in one session and leave the other with nothing: an
 * argument therefore adds `--passWithNoTests`. The bare run (CI) keeps
 * failing when it finds no file.
 *
 * Vitest is started with this Node, not through the package's `test:unit`
 * (whose flags it repeats): spawning `yarn` on Windows needs a shell, and
 * Yarn's portable shell cannot keep the first session's status.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const SESSIONS = 2;

const cwd = join(
  dirname(fileURLToPath(import.meta.url)),
  '../packages/integration-test'
);
const vitest = join(
  dirname(
    createRequire(join(cwd, 'package.json')).resolve('vitest/package.json')
  ),
  'vitest.mjs'
);
const args = process.argv.slice(2);

let failed = false;
for (let session = 1; session <= SESSIONS; session++) {
  const { status } = spawnSync(
    process.execPath,
    [
      vitest,
      '--browser.headless',
      '--run',
      '--no-file-parallelism',
      `--shard=${session}/${SESSIONS}`,
      ...(args.length > 0 ? ['--passWithNoTests'] : []),
      ...args,
    ],
    { cwd, stdio: 'inherit' }
  );
  if (status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
