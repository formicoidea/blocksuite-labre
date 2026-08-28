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

  test('the group row carries three modules, from three owners', () => {
    const modules = toolbarModules(mount('edgeless'));
    const forGroup = [...modules.keys()].filter(
      variant => toolbarModuleFlavour(variant) === 'custom:affine:surface:group'
    );

    // Wardley's qualification dropdown, under the bare flavour…
    expect(forGroup).toContain('custom:affine:surface:group');
    // …and C4's morph, under an owner-suffixed variant that cannot collide
    // with it while still being merged into the same row.
    expect(forGroup).toContain(
      toolbarModuleKey('custom:affine:surface:group', 'c4-morph')
    );
    // The native group operations sit on the other group key, untouched.
    expect([...modules.keys()]).toContain('affine:surface:group');
  });

  test('a flavour claimed only by a contributor still has a row', () => {
    // `{wardley: false, c4: true}` is a real configuration, and it leaves
    // `custom:affine:surface:group` with NO bare module: only C4's morph. The
    // row still exists — `modulesFor` finds it — while `getModuleBy`, which
    // answers about the flavour's own registration, correctly says there is
    // none. Reading a contributor there would let a placement, or a "does this
    // flavour have a toolbar" probe, be decided by a menu only some builds
    // ship.
    const container = mount('edgeless', { wardley: false });
    const registry = new ToolbarRegistryExtension({
      provider: container.provider(),
    } as never);
    const flavour = 'custom:affine:surface:group';

    expect(
      registry.modulesFor(flavour).map(module => module.id.variant)
    ).toEqual([toolbarModuleKey(flavour, 'c4-morph')]);
    expect(registry.getModuleBy(flavour)).toBeNull();
    // …and the native group operations, on the other group key, are untouched.
    expect(registry.getModuleBy('affine:surface:group')).toBeTruthy();
  });

  test('the C4 morph goes away with the C4 flag, and nothing else does', () => {
    const off = toolbarModules(mount('edgeless', { c4: false }));
    expect([...off.keys()]).not.toContain(
      toolbarModuleKey('custom:affine:surface:group', 'c4-morph')
    );
    // A morph is TOOLING: the flag takes the menu away and leaves the row a
    // stored component still needs — Wardley's slot on the same flavour, and
    // the native group operations — exactly where they were (`docs/adr/0009`).
    expect([...off.keys()]).toContain('custom:affine:surface:group');
    expect([...off.keys()]).toContain('affine:surface:group');
  });
});
