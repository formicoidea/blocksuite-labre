import { Container } from '@labre/global/di';
import { BlockFlavourIdentifier } from '@labre/std';
import { describe, expect, it } from 'vitest';

import type { ToolbarModuleConfig } from '../../services/toolbar-service/config';
import type { ToolbarModule } from '../../services/toolbar-service/module';
import {
  ToolbarModuleExtension,
  ToolbarRegistryExtension,
  toolbarModuleFlavour,
  toolbarModuleKey,
} from '../../services/toolbar-service/registry';

/**
 * Several modules on ONE flavour.
 *
 * A toolbar module used to be keyed by its flavour alone, which quietly capped
 * an element's row at two contributors — its own key and its `custom:` twin —
 * and made a third one a `DuplicateServiceDefinitionError` at setup rather than
 * a menu entry. That is not hypothetical: a canvas `group` is the native group
 * (rename, ungroup), a Wardley component AND a C4 component.
 *
 * The lift is an owner suffix on the DI variant. What this file pins is the
 * three things the rest of the library then relies on: that a shared flavour
 * hands back EVERY module, in an order that does not depend on registration
 * luck; that the bare-key questions still answer about the bare key; and that a
 * flavour nobody claimed answers with nothing rather than throwing.
 *
 * Built on a real `Container`, because the ordering under test IS the
 * container's iteration order and a hand-made `Map` would be a test of the test.
 */

/** A module, registered exactly as a view extension registers one. */
const moduleOn = (
  variant: string,
  config: ToolbarModuleConfig
): ToolbarModule => ({
  id: BlockFlavourIdentifier(variant),
  config,
});

const FLAVOUR = 'custom:affine:surface:group';

/** A registry over the given modules, in the order they are handed over. */
function registry(...modules: ToolbarModule[]) {
  const container = new Container();
  for (const module of modules) ToolbarModuleExtension(module).setup(container);
  const provider = container.provider();
  return new ToolbarRegistryExtension({ provider } as never);
}

const named = (name: string): ToolbarModuleConfig => ({
  actions: [{ id: name }],
});

const idsOf = (config: ToolbarModuleConfig | null) =>
  config?.actions.map(action => action.id) ?? null;

describe('toolbarModuleKey / toolbarModuleFlavour', () => {
  it('round-trips a flavour through an owner suffix', () => {
    const key = toolbarModuleKey(FLAVOUR, 'c4-morph');
    expect(key).toBe(`${FLAVOUR}#c4-morph`);
    expect(toolbarModuleFlavour(key)).toBe(FLAVOUR);
  });

  it('leaves a bare flavour alone, colons and wildcards included', () => {
    // The keys the widget actually asks for. A flavour is full of `:` and may
    // end in `*`; only `#` separates it from an owner.
    expect(toolbarModuleFlavour(FLAVOUR)).toBe(FLAVOUR);
    expect(toolbarModuleFlavour('affine:surface:*')).toBe('affine:surface:*');
    expect(toolbarModuleFlavour('affine:note')).toBe('affine:note');
  });

  it('refuses an owner that would collide with the bare key', () => {
    // Both failures would be SILENT: `flavour#` is a different variant from
    // `flavour`, so it registers a module the bare-key lookups never see, and
    // an owner containing `#` makes the flavour cut in the wrong place.
    expect(() => toolbarModuleKey(FLAVOUR, '')).toThrow(/non-empty/);
    expect(() => toolbarModuleKey(FLAVOUR, 'c4#morph')).toThrow(/non-empty/);
  });
});

describe('modulesFor — every contributor to one row', () => {
  /**
   * The bare module registered LAST on purpose. If the grouping simply
   * appended, this is the case that would put a contributor at the head and
   * make `getModuleBy` answer with whichever framework loaded first.
   */
  const three = () =>
    registry(
      moduleOn(toolbarModuleKey(FLAVOUR, 'c4-morph'), named('e.morph.c4')),
      moduleOn(toolbarModuleKey(FLAVOUR, 'zzz-late'), named('z.late')),
      moduleOn(FLAVOUR, named('y.element-tags'))
    );

  it('returns all three, bare first and the rest in registration order', () => {
    expect(
      three()
        .modulesFor(FLAVOUR)
        .map(m => idsOf(m.config))
    ).toEqual([['y.element-tags'], ['e.morph.c4'], ['z.late']]);
  });

  it('drops nothing: a bare module is a contributor like any other', () => {
    // The mutation this exists for: a grouping that only collected suffixed
    // variants would leave the row missing the module that defines it.
    const ids = three()
      .modulesFor(FLAVOUR)
      .flatMap(m => idsOf(m.config) ?? []);
    expect(ids).toContain('y.element-tags');
    expect(ids).toHaveLength(3);
  });

  it('answers an unclaimed flavour with an empty list, not undefined', () => {
    const registered = three();
    expect(registered.modulesFor('affine:surface:nobody')).toEqual([]);
    // The same object every time, so a miss on a hot path allocates nothing.
    expect(registered.modulesFor('affine:surface:nobody')).toBe(
      registered.modulesFor('affine:surface:else')
    );
  });

  it('hands out a frozen list, so a caller cannot rewrite the registry', () => {
    // It is returned on every render; a caller that sorted it in place would
    // silently reorder the row for every render afterwards.
    const modules = three().modulesFor(FLAVOUR);
    expect(Object.isFrozen(modules)).toBe(true);
  });

  it('keeps flavours apart', () => {
    const registered = registry(
      moduleOn('affine:surface:group', named('a.rename')),
      moduleOn(toolbarModuleKey(FLAVOUR, 'c4-morph'), named('e.morph.c4'))
    );
    expect(
      registered.modulesFor('affine:surface:group').map(m => idsOf(m.config))
    ).toEqual([['a.rename']]);
    expect(registered.modulesFor(FLAVOUR).map(m => idsOf(m.config))).toEqual([
      ['e.morph.c4'],
    ]);
  });
});

describe('getModuleBy / getModulePlacement — the bare-key questions', () => {
  it('answers with the module registered under the flavour itself', () => {
    const registered = registry(
      moduleOn(toolbarModuleKey(FLAVOUR, 'c4-morph'), named('e.morph.c4')),
      moduleOn(FLAVOUR, named('y.element-tags'))
    );
    expect(idsOf(registered.getModuleBy(FLAVOUR))).toEqual(['y.element-tags']);
  });

  it('answers null when only contributors claim the flavour', () => {
    // The real configuration this guards: `{wardley: false, c4: true}` leaves
    // `custom:affine:surface:group` with no bare module at all. A contributor
    // is an addition to a row, never the registration that defines it, so a
    // `has`-style probe or a placement must not be decided by a menu that only
    // some builds ship.
    const registered = registry(
      moduleOn(toolbarModuleKey(FLAVOUR, 'c4-morph'), named('e.morph.c4'))
    );
    expect(registered.getModuleBy(FLAVOUR)).toBeNull();
    // …while the row itself is still there, which is the whole point.
    expect(registered.modulesFor(FLAVOUR)).toHaveLength(1);
  });

  it('takes the placement from the first module that declares one', () => {
    // A row is one row however many modules feed it, so the placement belongs
    // to the flavour. A contributor that says nothing must not be read as
    // saying "top".
    const registered = registry(
      moduleOn(toolbarModuleKey('affine:surface:x', 'quiet'), named('a')),
      moduleOn(toolbarModuleKey('affine:surface:x', 'loud'), {
        actions: [],
        placement: 'inner',
      })
    );
    expect(registered.getModulePlacement('affine:surface:x')).toBe('inner');
  });

  it('falls back when nothing on the row states a placement', () => {
    const registered = registry(moduleOn('affine:surface:x', named('a')));
    expect(registered.getModulePlacement('affine:surface:x')).toBe('top');
    expect(registered.getModulePlacement('affine:surface:x', 'inner')).toBe(
      'inner'
    );
  });

  it('prefers the custom flavour placement, as it always has', () => {
    const registered = registry(
      moduleOn('affine:surface:x', { actions: [], placement: 'top' }),
      moduleOn(toolbarModuleKey('custom:affine:surface:x', 'c4'), {
        actions: [],
        placement: 'inner',
      })
    );
    expect(registered.getModulePlacement('affine:surface:x')).toBe('inner');
  });
});
