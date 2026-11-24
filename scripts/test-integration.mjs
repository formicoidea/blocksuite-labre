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
 * Every session runs, so one run reports every failure; the exit code is 1
 * when any failed. Sequential, one file at a time
 * (`--no-file-parallelism`): the suite is load-sensitive.
 *
 * Arguments reach every session. A filter (`yarn test:integration some-file`)
 * runs ONE session, unsharded:
 * since 3.2, Vitest refuses `--shard=i/N` when fewer than N files match
 * ("--shard <count> must be a smaller than count of test files"), and a
 * filtered subset does not need a second browser. A filter that matches no
 * file at all still fails. A filter is an argument that neither starts with
 * `-` nor follows a flag written without `=`: `--reporter verbose` and
 * `-t "name"` keep the two sessions, so the whole suite never runs in one
 * page. Put the filter first, or write a flag as `--flag=value`: a filter
 * right after a bare flag (`--coverage some-file`) reads as that flag's value.
 * With two sessions, an argument that writes one
 * output (`--coverage`, `--outputFile`) is overwritten by the second.
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
const followsBareFlag = index =>
  index > 0 &&
  args[index - 1].startsWith('-') &&
  !args[index - 1].includes('=');
const filtered = args.some(
  (arg, index) => !arg.startsWith('-') && !followsBareFlag(index)
);
const sessions = filtered ? 1 : SESSIONS;

let failed = false;
for (let session = 1; session <= sessions; session++) {
  const { status, signal, error } = spawnSync(
    process.execPath,
    [
      vitest,
      '--browser.headless',
      '--run',
      '--no-file-parallelism',
      ...(sessions > 1 ? [`--shard=${session}/${sessions}`] : []),
      ...args,
    ],
    { cwd, stdio: 'inherit' }
  );
  if (error) console.error(`session ${session}/${sessions}: ${error.message}`);
  if (signal)
    console.error(`session ${session}/${sessions}: killed by ${signal}`);
  if (status !== 0) failed = true;
}
process.exit(failed ? 1 : 0);
