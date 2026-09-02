import { ViewExtensionManager } from '@labre/affine-ext-loader';
import {
  ToolbarModuleExtension,
  ToolbarModuleIdentifier,
  ToolbarRegistryExtension,
  toolbarModuleFlavour,
  toolbarModuleKey,
} from '@labre/affine-shared/services';
import { Container } from '@labre/global/di';
import { BlockFlavourIdentifier } from '@labre/std';
import { describe, expect, test } from 'vitest';

import { getInternalViewExtensions } from '../../extensions/view.js';
import { type BlockFlags, OPTIONAL_BLOCKS } from '../../flags.js';

/**
 * Every view extension the library ships, MOUNTED — the assembly point checked
 * by building the container it builds at runtime rather than by reading the
 * list it is built from.
 *
 * `flags.unit.spec.ts` next door answers "which extensions are in the list";
 * this one answers the question that list cannot: whether two of them claim the
 * same DI slot. A container refuses a duplicate identifier + variant with
 * `DuplicateServiceDefinitionError`, and it refuses it at SETUP — so a
 * collision between two frameworks is not a broken menu, it is an editor that
 * does not open at all, on every document, for every user.
 *
 * It is a live hazard rather than a theoretical one. A toolbar module is keyed
 * by the flavour it hangs off, and one element can be claimed by several
 * frameworks: `custom:affine:surface:group` carries Wardley's qualification
 * dropdown, because a Wardley component is a group of a circle and its label —
 * and a C4 component is a group too. That is what `toolbarModuleKey` is for,
 * and this suite is what proves it was needed and what proves it works.
 */

const ALL_OFF = Object.fromEntries(
  OPTIONAL_BLOCKS.map(block => [block, false])
) as BlockFlags;

/** Everything one scope registers, in one container, exactly as std does it. */
function mount(scope: 'page' | 'edgeless', flags?: BlockFlags) {
  const manager = new ViewExtensionManager(getInternalViewExtensions(flags));
  const container = new Container();
  for (const extension of manager.get(scope)) extension.setup(container);
  return container;
}

const toolbarModules = (container: Container) =>
  container.provider().getAll(ToolbarModuleIdentifier);

describe('the whole view layer mounts in one container', () => {
  test.each(['page', 'edgeless'] as const)(
    'every extension registers without a DI collision (%s)',
    scope => {
      expect(() => mount(scope)).not.toThrow();
      // …and with the tooling switched off, which registers a different list.
      expect(() => mount(scope, ALL_OFF)).not.toThrow();
    }
  );

  test('a duplicate toolbar module really does throw', () => {
    // The mutation guard for the case above: without this, a `mount` that
    // silently swallowed collisions would pass it. `custom:affine:surface:group`
    // is Wardley's, and claiming it a second time is exactly what C4 would have
    // done without an owner-suffixed key.
    const container = mount('edgeless');
    const collide = ToolbarModuleExtension({
      id: BlockFlavourIdentifier('custom:affine:surface:group'),
      config: { actions: [] },
    });
    expect(() => collide.setup(container)).toThrowError(/already exists/);
  });

  test('the group row carries six modules, from five owners', () => {
    const modules = toolbarModules(mount('edgeless'));
    const forGroup = [...modules.keys()].filter(
      variant => toolbarModuleFlavour(variant) === 'custom:affine:surface:group'
    );

    // Wardley's qualification dropdown, under the bare flavour…
    expect(forGroup).toContain('custom:affine:surface:group');
    // …and the four morphs, each under an owner-suffixed variant that cannot
    // collide with it — nor with each other — while all five are merged into
    // the same row. Every one of those frameworks builds its artefact as a
    // native group, so five contributors on one flavour is the shipped
    // configuration and not a hypothetical one.
    //
    // Note that MODULES and OWNERS have stopped matching: Wardley holds two of
    // these — the bare qualification dropdown and its own morph — because one
    // framework may contribute more than once to the row of an element it
    // draws. That is what makes `toHaveLength` worth pinning separately from
    // the list of frameworks below.
    expect(forGroup).toContain(
      toolbarModuleKey('custom:affine:surface:group', 'wardley-morph')
    );
    expect(forGroup).toContain(
      toolbarModuleKey('custom:affine:surface:group', 'c4-morph')
    );
    expect(forGroup).toContain(
      toolbarModuleKey(
        'custom:affine:surface:group',
        'ddd-event-storming-morph'
      )
    );
    expect(forGroup).toContain(
      toolbarModuleKey('custom:affine:surface:group', 'ddd-core-domain-morph')
    );
    expect(forGroup).toHaveLength(5);
    // The native group operations sit on the other group key, untouched — the
    // fifth owner, and the one a stored group needs whatever the flags say.
    expect([...modules.keys()]).toContain('affine:surface:group');
  });

  test('a flavour claimed only by contributors still has a row', () => {
    // `{wardley: false}` is a real configuration, and it leaves
    // `custom:affine:surface:group` with NO bare module: only the three morphs
    // of the OTHER frameworks. Wardley's own two go together — the flag owns
    // the qualification dropdown and the morph alike — which is why turning one
    // framework off is what empties the bare key rather than thinning the row.
    // The row still exists — `modulesFor` finds them — while `getModuleBy`,
    // which answers about the flavour's own registration, correctly says there
    // is none. Reading a contributor there would let a placement, or a "does
    // this flavour have a toolbar" probe, be decided by a menu only some builds
    // ship.
    const container = mount('edgeless', { wardley: false });
    const registry = new ToolbarRegistryExtension({
      provider: container.provider(),
    } as never);
    const flavour = 'custom:affine:surface:group';

    // In `extensions/view.ts` registration order — event storming, then C4,
    // then core domain — because that is what `modulesFor` returns and pinning
    // it costs nothing. It is not an order a user can observe: `renderToolbar`
    // merges these modules' actions BY ID and sorts on that, so the row reads
    // the same whichever framework registered first.
    expect(
      registry.modulesFor(flavour).map(module => module.id.variant)
    ).toEqual([
      toolbarModuleKey(flavour, 'ddd-event-storming-morph'),
      toolbarModuleKey(flavour, 'c4-morph'),
      toolbarModuleKey(flavour, 'ddd-core-domain-morph'),
    ]);
    expect(registry.getModuleBy(flavour)).toBeNull();
    // …and the native group operations, on the other group key, are untouched.
    expect(registry.getModuleBy('affine:surface:group')).toBeTruthy();
  });

  test('each morph goes away with its own flag, and nothing else does', () => {
    const esMorph = toolbarModuleKey(
      'custom:affine:surface:group',
      'ddd-event-storming-morph'
    );
    const c4Morph = toolbarModuleKey('custom:affine:surface:group', 'c4-morph');
    const cdMorph = toolbarModuleKey(
      'custom:affine:surface:group',
      'ddd-core-domain-morph'
    );
    const wardleyMorph = toolbarModuleKey(
      'custom:affine:surface:group',
      'wardley-morph'
    );

    const noC4 = toolbarModules(mount('edgeless', { c4: false }));
    expect([...noC4.keys()]).not.toContain(c4Morph);
    // A morph is TOOLING: the flag takes the menu away and leaves the row a
    // stored component still needs — Wardley's two slots on the same flavour,
    // the native group operations, and the OTHER frameworks' morphs — exactly
    // where they were (`docs/adr/0009`). The four share a flavour and nothing
    // else.
    expect([...noC4.keys()]).toContain(esMorph);
    expect([...noC4.keys()]).toContain(cdMorph);
    expect([...noC4.keys()]).toContain(wardleyMorph);
    expect([...noC4.keys()]).toContain('custom:affine:surface:group');
    expect([...noC4.keys()]).toContain('affine:surface:group');

    const noStorming = toolbarModules(
      mount('edgeless', { 'ddd-event-storming': false })
    );
    expect([...noStorming.keys()]).not.toContain(esMorph);
    expect([...noStorming.keys()]).toContain(c4Morph);
    expect([...noStorming.keys()]).toContain(cdMorph);
    expect([...noStorming.keys()]).toContain(wardleyMorph);
    expect([...noStorming.keys()]).toContain('custom:affine:surface:group');

    const noCoreDomain = toolbarModules(
      mount('edgeless', { 'ddd-core-domain': false })
    );
    expect([...noCoreDomain.keys()]).not.toContain(cdMorph);
    expect([...noCoreDomain.keys()]).toContain(c4Morph);
    expect([...noCoreDomain.keys()]).toContain(esMorph);
    expect([...noCoreDomain.keys()]).toContain(wardleyMorph);
    expect([...noCoreDomain.keys()]).toContain('custom:affine:surface:group');

    // Wardley is the one framework that takes TWO modules away with its flag,
    // and the only one whose flag empties the bare key: the qualification
    // dropdown and the morph are both its tooling. Everything else on the row
    // is untouched, which is the whole claim of `docs/adr/0009` — a map drawn
    // while the flag was on still opens, still paints and still groups.
    const noWardley = toolbarModules(mount('edgeless', { wardley: false }));
    expect([...noWardley.keys()]).not.toContain(wardleyMorph);
    expect([...noWardley.keys()]).not.toContain('custom:affine:surface:group');
    expect([...noWardley.keys()]).toContain(c4Morph);
    expect([...noWardley.keys()]).toContain(esMorph);
    expect([...noWardley.keys()]).toContain(cdMorph);
    expect([...noWardley.keys()]).toContain('affine:surface:group');
  });
});
