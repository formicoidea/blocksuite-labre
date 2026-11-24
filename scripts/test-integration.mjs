/**
 * `yarn test:integration [vitest arguments]`: the integration suite in two
 * browser sessions, run one after the other.
 *
 * One session shares one page across its files (`isolate: false`), and that
 * page kept about 6 MB per test it mounted: over the whole suite it reached
 * 8.2 GB, measured on Windows; that this, with Vite and Vitest, exhausted
 * the 16 GB hosted runner near the end of the run is inferred
 * (docs/lessons.md 39). `--shard` gives each half of the files its own
 * browser, so whatever the page accumulates is thrown away half-way. The
 * teardown leak behind it is fixed (`editor-teardown.spec.ts`); the second
 * session stays as a guard until a full run is sampled flat.
 *
 * Both sessions always run, so one run reports every failure; the exit code
 * is 1 when either failed. Sequential, one file at a time
 * (`--no-file-parallelism`): the suite is load-sensitive.
 *
 * Arguments reach both sessions. A filter (`yarn test:integration some-file`)
 * shards the matching files, so it can leave one session with nothing: that
 * session prints "No test files found, exiting with code 1" and exits 0
 * (Vitest 3.1.3 applies the shard after finding the files). A filter that
 * matches no file at all still fails. An argument that writes one output
 * (`--coverage`, `--outputFile`) is overwritten by the second session.
 *
 * Vitest is started with this Node, not through the package's `test:unit`
 * (whose flags it repeats): spawning `yarn` on Windows needs a shell, and
 * Yarn's portable shell cannot keep the first session's status.
 */
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// ponytail: a guard since the teardown leak was fixed; drop to one session
// once a sampled full run stays flat, and find the holder in a heap snapshot
// before raising the count (docs/contribute/04-testing.md, Flaky).
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
  const { status, signal, error } = spawnSync(
    process.execPath,
    [
      vitest,
      '--browser.headless',
      '--run',
      '--no-file-parallelism',
      `--shard=${session}/${SESSIONS}`,
      ...args,
    ],
    { cwd, stdio: 'inherit' }
  );
  if (error) console.error(`session ${session}/${SESSIONS}: ${error.message}`);
  if (signal)
    console.error(`session ${session}/${SESSIONS}: killed by ${signal}`);
  if (status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
