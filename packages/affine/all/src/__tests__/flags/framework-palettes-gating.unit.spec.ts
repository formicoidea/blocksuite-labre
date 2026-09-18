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
 * The frameworks that ship a palette: every one that has HUES OF ITS OWN.
 *
 * Eight of the nine. UML is missing on purpose and is not an omission: its
 * pack is neutrals-only (`NOTATION_NEUTRALS`, `docs/adr/0026`), so the base
 * palette — page one of the carousel, never hidden — already serves it and a
 * UML page would repeat it word for word.
 *
 * A framework silently LOSING its page shows up here.
 */
const ALL_PALETTES = [
  'bpmn',
  'c4',
  'cynefin-estuarine',
  'ddd-context-map',
  'ddd-core-domain',
  'ddd-event-storming',
  'edgy',
  'wardley',
];

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

  test.each([
    ['bpmn', 'com.labre.framework.bpmn', 'Start green'],
    ['c4', 'com.labre.framework.c4', 'Person blue'],
    [
      'cynefin-estuarine',
      'com.labre.framework.cynefin-estuarine',
      'Iterate teal',
    ],
    [
      'ddd-context-map',
      'com.labre.framework.ddd-context-map',
      'Bounded context blue',
    ],
    [
      'ddd-core-domain',
      'com.labre.framework.ddd-core-domain',
      'Big-bet purple',
    ],
    [
      'ddd-event-storming',
      'com.labre.framework.ddd-event-storming',
      'Domain event orange',
    ],
  ])(
    '%s contributes its own swatches with the flag on, and nothing with it off',
    (framework, labelKey, swatch) => {
      const on = mountProvider('edgeless', ALL_ON);
      const palette = [...on.getAll(FrameworkPaletteIdentifier).values()].find(
        candidate => candidate.framework === framework
      );

      // Its own name, reused from the framework descriptor rather than minted.
      expect(palette?.labelWording[0]).toBe(labelKey);
      // Its own hues, led by the notation swatch its pack is known for, and
      // the shared neutrals behind them — so the page is never just the tail.
      expect(palette?.palettes.map(entry => entry.key)).toContain(swatch);
      expect(palette?.palettes.length).toBeGreaterThan(1);

      const off = mountProvider('edgeless', {
        [framework]: false,
      } as BlockFlags);
      expect(palettesOf(off)).not.toContain(framework);
    }
  );

  test('UML ships no page: its pack is neutrals-only', () => {
    // Not an omission — the base palette already says everything a UML diagram
    // is drawn in, and a second copy of it would be a page with no news.
    expect(palettesOf(mountProvider('edgeless', ALL_ON))).not.toContain('uml');
  });

  test('the page scope contributes no palette at all', () => {
    // Every registration sits behind `isEdgeless(context.scope)`: a colour
    // picker with a carousel is an edgeless affordance.
    expect(palettesOf(mountProvider('page', ALL_ON))).toEqual([]);
  });
});
