import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';

/**
 * The outline panel (ADR 0034 §1): the document's table of contents, drawn by
 * the host beside the editor.
 *
 * The library never mounts an outline itself, so there is no default: a host
 * that draws one registers this seam, a host that does not leaves it out. Its
 * only caller in the library is the "View in TOC" link of the toast the note
 * toolbar shows after a note's display mode changes
 * (`blocks/note/src/configs/toolbar.ts`). Absent or `null`, that toast offers
 * no link, because a link that opens nothing is a lie.
 *
 * It replaces the `open(tabId?)` seam inherited from AFFiNE (removed in 0.46,
 * ADR 0034 §2): one caller, which opened a tab named by a string nobody typed
 * anywhere else. Shaped exactly like `SelectionPaneService`, so every panel
 * the library asks a host to show answers the same two verbs.
 */
export interface OutlinePanelService {
  /** Show the outline. */
  open(): void;
  /** Put it away. Writes nothing. */
  close(): void;
}

export const OutlinePanelProvider =
  createIdentifier<OutlinePanelService>('AffineOutlinePanel');

/**
 * Host seam: the host's outline panel, or `null` to say there is none.
 *
 * `di.override`, like `SelectionPaneExtension`, so a later registration always
 * wins and registering twice never throws at boot.
 */
export function OutlinePanelExtension(
  service: OutlinePanelService | null
): ExtensionType {
  return {
    setup: di => {
      // `null` rides through the factory on purpose: `getOptional` then
      // reports the panel as absent, which is the whole "no link" story.
      di.override(OutlinePanelProvider, () => service as OutlinePanelService);
    },
  };
}
