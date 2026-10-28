import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType } from '@labre/store';

/** What "Table View" / "Kanban View" hand the menu once the block is drawn. */
export interface DatabaseCreationRequest {
  std: BlockStdScope;
  /** The native database the entry just inserted, still with no row. */
  blockId: string;
  /** The block's element, to hang the menu from. */
  anchor: HTMLElement;
}

/**
 * What a database creation entry opens over the block it just inserted
 * (ADR 0035 §5, amendment of 2026-10-28): the `core-database` bundle
 * registers one from its tooling extension to offer the host's sources in a
 * popover. Like `AddViewMenuIdentifier` (data-view), it is a registry between
 * library packages, never filled by a host, so it has no row in the seams
 * table. Read only when the host fills the data-source picker; absent, the
 * entries ask the host's `createDatabase` first, as in 0.61.
 */
export interface DatabaseCreationMenu {
  open(request: DatabaseCreationRequest): void;
}

export const DatabaseCreationMenuIdentifier =
  createIdentifier<DatabaseCreationMenu>('AffineDatabaseCreationMenu');

export function DatabaseCreationMenuExtension(
  menu: DatabaseCreationMenu
): ExtensionType {
  return {
    setup: di => {
      di.override(DatabaseCreationMenuIdentifier, () => menu);
    },
  };
}
