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
 * Host override seam: replace the library's sidepanel with the host's own —
 * or switch the catalogue off entirely.
 *
 * **Replace** — a host that already owns a sidebar (a right-hand inspector, a
 * docked panel, a mobile sheet) registers this extension, its implementation
 * answers {@link ArtefactCatalogueProvider}, and the library's widget is then
 * never asked to open: the sub-menu's "More artefacts…" entry resolves ONE
 * service, and `di.override` decides which. The host's own UI draws itself
 * from the registry (`getCommandsForSurface(std, owner, 'catalogue')`,
 * `getCommandIcon`) and creates through the one bottleneck
 * (`runCommand(std, command, { surface: 'catalogue', … })`), so telemetry and
 * the usage measure keep flowing wherever the pixels live.
 *
 * **Disable** — pass `null`. The provider then answers nothing, and every
 * consumer reads that the honest way: the sub-menu's "More artefacts…" button
 * is not rendered (a control that opens nothing is a lie), and the library's
 * panel never opens. This is a cold-assembly switch, like the framework flags:
 * decided when the editor is put together, not toggled mid-session.
 *
 * Mirrors `CommandUsageExtension` / `KeymapOverrideExtension`: `di.override`,
 * so a host registering after the library's own extensions always wins,
 * whatever the registration order turns out to be.
 */
export function ArtefactCatalogueExtension(
  service: ArtefactCatalogueService | null
): ExtensionType {
  return {
    setup: di => {
      // `null` rides through the factory on purpose: `getOptional` then
      // reports the catalogue as absent, which is the whole disable story.
      di.override(
        ArtefactCatalogueProvider,
        () => service as ArtefactCatalogueService
      );
    },
  };
}
