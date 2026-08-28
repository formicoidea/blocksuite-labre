import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';
import { FRAMEWORK_DESCRIPTORS } from '../../frameworks.js';

/**
 * The left-to-right order of the framework buttons on the edgeless senior row.
 *
 * ## The mechanism, and why this file is where it is pinned
 *
 * `EdgelessToolbar._seniorTools` reads `provider.getAll(SeniorToolIdentifier)`
 * — a DI map, so INSERTION-ordered — and then applies
 * `.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))`. `Array.prototype.sort` is
 * stable, so a group of tools that all leave `order` undefined comes out in
 * registration order, untouched. Every framework leaves it undefined (only the
 * Template button declares one, `order: 100`, to sit last whatever ships), so
 * the row IS the registration order of the flag-gated tooling extensions in
 * `getInternalViewExtensions` — the third test below is what keeps that
 * premise true.
 *
 * Registration order is the array order: the DI container preserves insertion
 * (`getFactoryAll` rebuilds a `Map`), and `ViewExtensionManager` collects into
 * an insertion-ordered `Set`.
 *
 * The order itself is a PO arbitration (recette, 28/08/2026). It is declared
 * once, in `FRAMEWORK_DESCRIPTORS`, and this file is what stops `view.ts`
 * drifting from that declaration — the two lists are edited in different files
 * for good reasons (one is data a build script reads, the other imports lit),
 * and nothing else makes them agree.
 */

const PO_ORDER = [
  'wardley',
  'edgy',
  'cynefin-estuarine',
  'bpmn',
  'ddd-event-storming',
  'c4',
  'ddd-core-domain',
  'ddd-context-map',
] as const;

const HERE = dirname(fileURLToPath(import.meta.url));
// …/packages/affine/all/src/__tests__/toolbar → repo root is 6 levels up.
const ROOT = join(HERE, '..', '..', '..', '..', '..', '..');

const gatedOf = (id: string) => {
  const descriptor = FRAMEWORK_DESCRIPTORS.find(d => d.id === id)!;
  return descriptor.extensions.find(e => e.flag === id)!.viewExtension;
};

const renderOf = (id: string) => {
  const descriptor = FRAMEWORK_DESCRIPTORS.find(d => d.id === id)!;
  return descriptor.extensions.find(e => !e.flag)?.viewExtension;
};

describe('the senior row reads in the order the PO asked for', () => {
  test('FRAMEWORK_DESCRIPTORS declares that order, and nothing else', () => {
    expect(FRAMEWORK_DESCRIPTORS.map(d => d.id)).toEqual([...PO_ORDER]);
  });

  test('the tooling extensions are registered in the same order', () => {
    const tooling = new Set(PO_ORDER.map(gatedOf));
    const registered = getInternalViewExtensions()
      .map(e => e.name)
      .filter(name => tooling.has(name));
    expect(registered).toEqual(PO_ORDER.map(gatedOf));
  });

  test('no framework declares a SeniorTool order, so the sort is a no-op', () => {
    // The premise of the test above. The day a framework wants to jump the
    // queue it will declare `order:` here, the stable sort will start mattering,
    // and this test is the one that says so out loud.
    for (const { id, dir } of FRAMEWORK_DESCRIPTORS) {
      const source = readFileSync(
        join(
          ROOT,
          'packages',
          ...dir.split('/'),
          'src',
          'toolbar',
          'senior-tool.ts'
        ),
        'utf8'
      );
      expect(source, `${id} declares a SeniorTool order`).not.toMatch(
        /^\s*order:/m
      );
    }
  });

  test('each render half is registered immediately before its tooling half', () => {
    // The pairing `docs/adr/0009` asks for, mechanically: moving a framework in
    // the row moves the always-on half with it, so the two halves cannot drift
    // apart the way the three DDD ones had.
    const names = getInternalViewExtensions().map(e => e.name);
    for (const id of PO_ORDER) {
      const render = renderOf(id);
      if (!render) continue;
      expect(names.indexOf(gatedOf(id)), id).toBe(names.indexOf(render) + 1);
    }
  });
});
