import { type Container, createIdentifier } from '@labre/global/di';
import { type BlockStdScope, StdIdentifier } from '@labre/std';
import type { GfxModel } from '@labre/std/gfx';
import { Extension, type ExtensionType } from '@labre/store';
import { signal } from '@preact/signals-core';

import type { ToolbarPlacement } from './config';
import { Flags } from './flags';
import type { ToolbarModule } from './module';

export const ToolbarModuleIdentifier = createIdentifier<ToolbarModule>(
  'AffineToolbarModuleIdentifier'
);

export const ToolbarRegistryIdentifier =
  createIdentifier<ToolbarRegistryExtension>('AffineToolbarRegistryIdentifier');

export function ToolbarModuleExtension(module: ToolbarModule): ExtensionType {
  return {
    setup: di => {
      di.addImpl(ToolbarModuleIdentifier(module.id.variant), module);
    },
  };
}

/**
 * What separates a flavour from the OWNER of one of its modules.
 *
 * A module is registered under one DI variant, and until now that variant WAS
 * the flavour — so a flavour held at most two modules, its own key and its
 * `custom:` twin, and a third contributor got a `DuplicateServiceDefinitionError`
 * at setup rather than a menu entry. That ceiling was invisible until two
 * frameworks needed the same element: `affine:surface:group` carries the native
 * group operations, `custom:affine:surface:group` carries Wardley's
 * qualification dropdown, and a C4 component IS a group — so C4's morph had
 * nowhere at all to be registered.
 *
 * {@link toolbarModuleKey} gives it one. `custom:affine:surface:group#c4-morph`
 * is a DISTINCT DI variant and therefore never collides, while
 * {@link ToolbarRegistryExtension.modulesFor} still hands it to the row drawn
 * for `custom:affine:surface:group`. Nothing about the existing keys changes:
 * a module registered under a bare flavour is that flavour's first module, and
 * every registration in the library before this one stays exactly as it was.
 */
const MODULE_OWNER_SEPARATOR = '#';

/** The flavour a DI variant speaks for, owner suffix and all. */
export function toolbarModuleFlavour(variant: string): string {
  const at = variant.indexOf(MODULE_OWNER_SEPARATOR);
  return at < 0 ? variant : variant.slice(0, at);
}

/**
 * A second (or third) module on one flavour, named by who contributes it.
 *
 * The owner is never shown and never parsed back — it exists so two
 * contributors cannot claim one DI variant. Use a stable, framework-scoped
 * name (`c4-morph`), because it is the identity the container refuses
 * duplicates on.
 */
export function toolbarModuleKey(flavour: string, owner: string): string {
  // Dev-only, because the failure it prevents is silent: an empty owner
  // produces `flavour#`, which is a DIFFERENT variant from `flavour` and would
  // therefore register a second module the bare-key lookups below never see,
  // and an owner carrying the separator makes `toolbarModuleFlavour` cut in the
  // wrong place, filing the module under a flavour nobody draws.
  if (process.env.NODE_ENV !== 'production') {
    if (!owner || owner.includes(MODULE_OWNER_SEPARATOR)) {
      throw new Error(
        `toolbarModuleKey: owner must be non-empty and free of "${MODULE_OWNER_SEPARATOR}" (got ${JSON.stringify(owner)})`
      );
    }
  }
  return `${flavour}${MODULE_OWNER_SEPARATOR}${owner}`;
}

/** One shared empty answer, so a miss allocates nothing and can be frozen. */
const NO_MODULES: readonly ToolbarModule[] = Object.freeze([]);

export class ToolbarRegistryExtension extends Extension {
  flavour$ = signal<string>('affine:note');

  elementsMap$ = signal<Map<string, GfxModel[]>>(new Map());

  message$ = signal<{
    flavour: string;
    element: Element;
    setFloating: (element?: Element) => void;
  } | null>(null);

  placement$ = signal<ToolbarPlacement>('top');

  flags = new Flags();

  constructor(readonly std: BlockStdScope) {
    super();
  }

  /**
   * Every module of every flavour, keyed by the DI variant it was registered
   * under — which for a shared flavour carries an owner suffix. Read
   * {@link modulesFor} instead unless the variant itself is the question.
   */
  get modules() {
    return this.std.provider.getAll(ToolbarModuleIdentifier);
  }

  /**
   * The modules grouped by the FLAVOUR they speak for, computed once.
   *
   * Once, because the registrations are fixed for the life of a container —
   * they are DI impls, added at setup and never afterwards — while
   * {@link modulesFor} is asked six times per toolbar render, and a toolbar
   * re-renders on every selection change, every drag frame and every zoom
   * notch.
   *
   * A module registered under the BARE flavour leads its group, and the rest
   * follow in registration order. The order is what decides nothing much —
   * `renderToolbar` sorts the merged actions by `placement`, `id` and `score`
   * — and it is pinned all the same, because "which module answers a bare-key
   * question" must not depend on which framework happened to be registered
   * first.
   *
   * Each group is FROZEN: it is handed out by {@link modulesFor} on every
   * render, and a caller that sorted or spliced the answer in place would
   * silently rewrite the registry for every later render.
   */
  #grouped: Map<string, readonly ToolbarModule[]> | null = null;

  get #groups() {
    if (!this.#grouped) {
      const groups = new Map<string, ToolbarModule[]>();
      for (const [variant, module] of this.modules) {
        const flavour = toolbarModuleFlavour(variant);
        const group = groups.get(flavour);
        if (!group) groups.set(flavour, [module]);
        else if (variant === flavour) group.unshift(module);
        else group.push(module);
      }
      for (const group of groups.values()) Object.freeze(group);
      this.#grouped = groups as Map<string, readonly ToolbarModule[]>;
    }
    return this.#grouped;
  }

  /**
   * Every module contributing to one flavour's row — the bare-key module
   * first, then the owner-suffixed ones in registration order.
   */
  modulesFor(flavour: string): readonly ToolbarModule[] {
    return this.#groups.get(flavour) ?? NO_MODULES;
  }

  /**
   * The config registered under the flavour ITSELF, or `null`.
   *
   * Deliberately not "the first module of this flavour". The callers of this
   * method ask a question about one identified registration — does this block
   * flavour have a toolbar of its own, where does that toolbar sit — and an
   * owner-suffixed contributor is an ADDITION to a row, not a stand-in for the
   * module that defines it. Answering with a contributor would make the reply
   * depend on which frameworks a host happened to switch on: with `wardley`
   * off and `c4` on, `custom:affine:surface:group` has no bare module at all,
   * and returning C4's morph there would let a placement (or a `has`-style
   * probe) be decided by a menu that only some builds ship.
   */
  getModuleBy(flavour: string) {
    return (
      this.modulesFor(flavour).find(module => module.id.variant === flavour)
        ?.config ?? null
    );
  }

  /**
   * Where a flavour's row sits: the first module of it that actually SAYS.
   *
   * A row is one row however many modules contribute to it, so the placement
   * is a property of the flavour and not of a registration — and a contributor
   * that declares none must not be read as declaring the default. Scanning for
   * the first module with a `placement` keeps the answer the same whether the
   * framework that states it is registered first, last, or under an owner.
   */
  getModulePlacement(flavour: string, fallback: ToolbarPlacement = 'top') {
    return (
      this.#placementOf(`custom:${flavour}`) ??
      this.#placementOf(flavour) ??
      fallback
    );
  }

  #placementOf(flavour: string): ToolbarPlacement | undefined {
    for (const module of this.modulesFor(flavour)) {
      if (module.config.placement) return module.config.placement;
    }
    return undefined;
  }

  static override setup(di: Container) {
    di.addImpl(ToolbarRegistryIdentifier, this, [StdIdentifier]);
  }
}
