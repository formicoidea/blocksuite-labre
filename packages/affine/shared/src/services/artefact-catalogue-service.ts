import { createIdentifier } from '@labre/global/di';
import type { CommandOwner } from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * Consumer 2 of `docs/adr/0008`: the "more artefacts" sidepanel, which shows an
 * owner's WHOLE `'catalogue'` surface by sub-category once its senior sub-menu
 * has stopped being able to.
 *
 * The seam had to exist before either end of it, because the senior menu is
 * what opens it — `selectSeniorMenuCommands` reports an overflow, the menu
 * grows a trailing button, and that button needs somewhere to send the click.
 * The library now ships the panel that answers by default
 * (`edgeless-artefact-catalogue-widget`, registered next to the toolbar
 * widget), and the menu still renders the button only when this provider
 * answers — so an assembly that overrode the provider away shows no control
 * that opens nothing.
 *
 * The contract is two verbs on purpose. Everything the panel needs to draw
 * itself is already enumerable from the command registry
 * (`getCommandsForSurface(std, owner, 'catalogue')`), so the seam carries the
 * OWNER and nothing else — no list of entries, no open state, no rendering.
 * That is what lets the two implementations be genuinely different things: the
 * library's own left sidepanel, and a host's existing right-hand sidebar.
 */
export interface ArtefactCatalogueService {
  /** Show the catalogue, scoped to one framework's artefacts. */
  open(owner: CommandOwner): void;
  /** Put it away. Never touches the active senior tool. */
  close(): void;
}

export const ArtefactCatalogueProvider =
  createIdentifier<ArtefactCatalogueService>('AffineArtefactCatalogue');

/**
 * Host override seam: replace the library's sidepanel with the host's own.
 *
 * This is where a host that already owns a sidebar — a right-hand inspector, a
 * docked panel, a mobile sheet — takes the catalogue over. It registers this
 * extension, its implementation answers {@link ArtefactCatalogueProvider}, and
 * the library's widget is then never asked to open: the sub-menu's "More
 * artefacts…" entry resolves ONE service, and `di.override` decides which.
 *
 * Mirrors `CommandUsageExtension` / `KeymapOverrideExtension`: `di.override`,
 * so a host registering after the library's own extensions always wins,
 * whatever the registration order turns out to be.
 */
export function ArtefactCatalogueExtension(
  service: ArtefactCatalogueService
): ExtensionType {
  return {
    setup: di => {
      di.override(ArtefactCatalogueProvider, () => service);
    },
  };
}
