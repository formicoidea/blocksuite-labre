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
  return `${flavour}${MODULE_OWNER_SEPARATOR}${owner}`;
}

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
   * A module registered under the bare flavour leads its group, so
   * {@link getModuleBy} — and through it the placement lookup — answers with
   * the same module it answered with before flavours could be shared.
   */
  #grouped: Map<string, ToolbarModule[]> | null = null;

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
      this.#grouped = groups;
    }
    return this.#grouped;
  }

  /** Every module contributing to one flavour's row, in registration order. */
  modulesFor(flavour: string): readonly ToolbarModule[] {
    return this.#groups.get(flavour) ?? [];
  }

  getModuleBy(flavour: string) {
    return this.modulesFor(flavour)[0]?.config ?? null;
  }

  getModulePlacement(flavour: string, fallback: ToolbarPlacement = 'top') {
    return (
      this.getModuleBy(`custom:${flavour}`)?.placement ??
      this.getModuleBy(flavour)?.placement ??
      fallback
    );
  }

  static override setup(di: Container) {
    di.addImpl(ToolbarRegistryIdentifier, this, [StdIdentifier]);
  }
}
