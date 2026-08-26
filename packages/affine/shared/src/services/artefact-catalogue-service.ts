import { createIdentifier } from '@labre/global/di';
import type { CommandOwner } from '@labre/std';

/**
 * Consumer 2 of `docs/adr/0008`: the "more artefacts" sidepanel, which shows an
 * owner's WHOLE `'catalogue'` surface by sub-category once its senior sub-menu
 * has stopped being able to.
 *
 * Declared here, and only declared: the panel itself is a separate tranche. The
 * seam has to exist first because the senior menu is what opens it —
 * `selectSeniorMenuCommands` reports an overflow, the menu grows a trailing
 * button, and that button needs somewhere to send the click. Registering the
 * implementation is the host's (or the widget's) business; the menu renders the
 * button only when this provider answers, so a Labre assembly without the panel
 * shows no control that opens nothing.
 */
export interface ArtefactCatalogueService {
  /** Show the catalogue, scoped to one framework's artefacts. */
  open(owner: CommandOwner): void;
  close(): void;
}

export const ArtefactCatalogueProvider =
  createIdentifier<ArtefactCatalogueService>('AffineArtefactCatalogue');
