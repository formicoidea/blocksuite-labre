import { FrameworkPaletteIdentifier } from '@labre/affine-components/color-picker';
import { ViewExtensionManager } from '@labre/affine-ext-loader';
import { Container } from '@labre/global/di';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';
import { type BlockFlags, OPTIONAL_BLOCKS } from '../../flags.js';

/**
 * A framework's PALETTE is tooling (`docs/adr/0009`, `docs/adr/0027`): it is a
 * shelf of hues offered for new work, not something a stored drawing needs in
 * order to open. So a framework whose flag is off contributes no page to the
 * colour pickers' carousel — every colour it ever wrote stays exactly where it
 * is, painted by the always-on render extension.
 *
 * The sibling of `template-categories-gating.unit.spec.ts`, and for the same
 * reason: the list is read from the DI container the view extensions mounted
 * on, one per editor, so two mounts in one process must answer about
 * themselves (#244).
 */

/** Every optional block AND every framework switched off. */
const ALL_OFF = Object.fromEntries(
  OPTIONAL_BLOCKS.map(block => [block, false])
) as BlockFlags;

const ALL_ON: BlockFlags = {};

/**
 * The frameworks that ship a palette TODAY. Wardley and EDGY are the two that
 * have one; the other seven come in a follow-up, so this list is expected to
 * grow — and a framework silently LOSING its page shows up here.
 */
const ALL_PALETTES = ['edgy', 'wardley'];

/** Mount the view extensions of one scope for real, exactly as std does. */
function mountProvider(scope: 'page' | 'edgeless', flags: BlockFlags) {
  const manager = new ViewExtensionManager(getInternalViewExtensions(flags));
  const container = new Container();
  manager.get(scope).forEach(ext => ext.setup(container));
  return container.provider();
}

/** The carousel pages an editor built on that provider would offer. */
function palettesOf(provider: ReturnType<typeof mountProvider>) {
  return [...provider.getAll(FrameworkPaletteIdentifier).values()]
    .map(palette => palette.framework)
    .sort();
}

describe('the framework palettes are flag-gated tooling', () => {
  test('every framework that has one contributes its palette with the flags on', () => {
    expect(palettesOf(mountProvider('edgeless', ALL_ON))).toEqual(ALL_PALETTES);
  });

  test('a registered palette carries a label and its own swatches', () => {
    const provider = mountProvider('edgeless', ALL_ON);
    const wardley = [
      ...provider.getAll(FrameworkPaletteIdentifier).values(),
    ].find(palette => palette.framework === 'wardley');

    expect(wardley?.labelWording[0]).toBe('com.labre.framework.wardley');
    // The nine Wardley swatches plus the shared neutrals — the very list its
    // node toolbar is seeded with, not a second table.
    expect(wardley?.palettes.map(p => p.key)).toContain('Wonder');
    expect(wardley?.palettes.length).toBeGreaterThan(9);
  });

  test('with everything off, the carousel has no framework page at all', () => {
    expect(palettesOf(mountProvider('edgeless', ALL_OFF))).toEqual([]);
  });

  test('a second editor sees the flags it was mounted with, not the first one', () => {
    expect(palettesOf(mountProvider('edgeless', ALL_ON))).toEqual(ALL_PALETTES);

    const second = palettesOf(mountProvider('edgeless', { wardley: false }));
    expect(second).not.toContain('wardley');
    expect(second).toEqual(ALL_PALETTES.filter(id => id !== 'wardley'));
  });

  test('the page scope contributes no palette at all', () => {
    // Every registration sits behind `isEdgeless(context.scope)`: a colour
    // picker with a carousel is an edgeless affordance.
    expect(palettesOf(mountProvider('page', ALL_ON))).toEqual([]);
  });
});
