import { readdirSync } from 'node:fs';
import { dirname, join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The library source walker shared by the two translation guards:
 * `manifest.unit.spec.ts` (key exhaustiveness) and `literals.unit.spec.ts`
 * (the literal ratchet). Both need "every shipped `.ts` file under
 * `packages/affine` and `packages/framework`", so it lives here once rather
 * than being copy-pasted between the two specs.
 */

export const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__/translations → repo root is 6 levels up.
export const ROOT = join(HERE, '..', '..', '..', '..', '..', '..');

/** The library source: everything a host can import. */
export const SCAN_DIRS = ['packages/affine', 'packages/framework'];

const SKIP_DIRS = new Set(['node_modules', 'dist', '__tests__']);

/** File-name fragments that mean "not shipped source". */
const SKIP_NAME_PATTERNS = [/\.spec\./, /\.bench\./, /\.stories\./, /\.d\.ts$/];

function isScannableFile(name: string): boolean {
  return (
    name.endsWith('.ts') &&
    !SKIP_NAME_PATTERNS.some(pattern => pattern.test(name))
  );
}

/**
 * Every `.ts` source file under `dir`, recursively, minus tests/benches/
 * stories/declarations and `SKIP_DIRS`. `skipFiles` additionally excludes
 * specific files by path SUFFIX — used by the manifest spec to exclude
 * itself (the manifest must not be allowed to justify its own entries).
 */
export function sourceFiles(
  dir: string,
  skipFiles: ReadonlySet<string> = new Set(),
  out: string[] = []
): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) sourceFiles(path, skipFiles, out);
    } else if (isScannableFile(entry.name)) {
      if (![...skipFiles].some(skip => path.endsWith(skip))) out.push(path);
    }
  }
  return out;
}

/** Every library source file under every `SCAN_DIRS` entry, rooted at `ROOT`. */
export function allSourceFiles(
  skipFiles: ReadonlySet<string> = new Set()
): string[] {
  return SCAN_DIRS.flatMap(dir => sourceFiles(join(ROOT, dir), skipFiles));
}

/** `file` (an absolute path under `ROOT`) as a repo-relative POSIX path. */
export function toRepoRelative(file: string): string {
  return relative(ROOT, file).split(sep).join('/');
}
