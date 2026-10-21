import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, expect, test } from 'vitest';

import { AUXILIARY_BUNDLES, FRAMEWORK_DESCRIPTORS } from '../frameworks.js';
import { ROOT } from './translations/source-files.js';

/**
 * GUARD — the package graph keeps the shape CLAUDE.md writes down
 * (ADR 0040, "a guard test can assert them on the generated graph").
 *
 * It reads `architecture/code.c4`, the map `scripts/architecture.mjs`
 * generates from the imports, rather than walking the imports itself: the
 * map is what reviewers and hosts read, a parse of it takes milliseconds
 * where dependency-cruiser takes seconds, and `yarn architecture --check`
 * already fails when the committed map is not what the code produces. The
 * parse only needs the generator's two stable shapes: one `id = kind '…' {`
 * line per element with a `path '…'` metadata line, and one
 * `from -[uses]-> to '…'` line per package edge.
 *
 * **What it would catch**:
 * - a package cycle (`a` uses `b` uses `a`), which `tsc -b` project
 *   references reject only when both sides declare the reference;
 * - an upward edge across "four layers, one direction": `model` importing a
 *   feature, a feature importing `@labre/affine`, an upstream cherry-pick
 *   bringing back an `import type` from above, anything importing tooling;
 * - a framework package importing another framework package, an edge the
 *   bundle layout has no bundle for (each framework bundle depends on core
 *   and the shared bundle only), which `scripts/build-bundles.mjs` refuses at
 *   release time only.
 */

const CODE_C4 = readFileSync(join(ROOT, 'architecture', 'code.c4'), 'utf8');

/** Top-level elements, lowest first: a layer may use itself and below. */
const LAYERS = ['framework', 'model_', 'features', 'assembly', 'tooling'];

/** Element FQN by repo path, read from the nesting of `code.c4`. */
function fqnByPath(text: string): Map<string, string> {
  const byPath = new Map<string, string>();
  const stack: (string | null)[] = [];
  for (const line of text.split('\n')) {
    const element = line.match(/^\s*([\w-]+) = \w+ '.*' \{$/);
    const path = line.match(/^\s*path '(.+)'$/);
    if (element) stack.push(element[1]);
    else if (/\{$/.test(line)) stack.push(null);
    else if (/^\s*\}$/.test(line)) stack.pop();
    else if (path) byPath.set(path[1], stack.filter(Boolean).join('.'));
  }
  return byPath;
}

const USES = [...CODE_C4.matchAll(/^ {2}(\S+) -\[uses\]-> (\S+) '/gm)].map(
  ([, from, to]) => ({ from, to })
);
const layerOf = (fqn: string) => fqn.split('.')[0];

describe('architecture map (architecture/code.c4)', () => {
  test('the top-level elements are the layers, in a known order', () => {
    const layers = [...CODE_C4.matchAll(/^ {2}([\w-]+) = layer /gm)].map(
      m => m[1]
    );
    expect(layers).toEqual(LAYERS);
    expect(USES.length).toBeGreaterThan(0);
  });

  test('no package cycle', () => {
    const next = new Map<string, string[]>();
    for (const { from, to } of USES)
      next.set(from, [...(next.get(from) ?? []), to]);
    const done = new Set<string>();
    const path: string[] = [];
    const cycles: string[] = [];
    const visit = (node: string) => {
      const start = path.indexOf(node);
      if (start >= 0) {
        cycles.push([...path.slice(start), node].join(' -> '));
        return;
      }
      if (done.has(node)) return;
      path.push(node);
      for (const to of next.get(node) ?? []) visit(to);
      path.pop();
      done.add(node);
    };
    for (const node of [...next.keys()].sort()) visit(node);
    expect(cycles).toEqual([]);
  });

  test('no edge goes up a layer', () => {
    const upward = USES.filter(
      ({ from, to }) =>
        LAYERS.indexOf(layerOf(to)) > LAYERS.indexOf(layerOf(from))
    ).map(({ from, to }) => `${from} -> ${to}`);
    expect(upward).toEqual([]);
  });

  test('no framework package imports another framework package', () => {
    const byPath = fqnByPath(CODE_C4);
    const frameworks = new Set(
      [...FRAMEWORK_DESCRIPTORS, ...AUXILIARY_BUNDLES].map(({ dir }) => {
        const fqn = byPath.get(`packages/${dir}`);
        expect(fqn, `packages/${dir} is on the map`).toBeDefined();
        return fqn;
      })
    );
    const crossings = USES.filter(
      ({ from, to }) => frameworks.has(from) && frameworks.has(to)
    ).map(({ from, to }) => `${from} -> ${to}`);
    expect(crossings).toEqual([]);
  });
});
