import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';

/**
 * The selection pane (ADR 0031 §12): a list of the canvas elements by z-order,
 * top first, with groups, lock, a filter by frame, and
 * drag-to-reorder — PowerPoint's pane, on a Labre canvas.
 *
 * The seam is shaped exactly like `ArtefactCatalogueService`, and was
 * challenged against it first: the catalogue's `open(owner)` is scoped to a
 * framework, and stretching it to a second panel would have changed the
 * signature of a shipped seam. So one more seam, two verbs, nothing else.
 *
 * Everything a pane draws is enumerable from the library without this seam:
 * the rows from `selectionPaneTree(std)` (ids only, z-order, top first), the
 * wordings from the element and the translation seam, and every action from
 * the command registry (`canvas.element.reorder`, `canvas.element.lock`,
 * `canvas.element.unlock`, `canvas.group.rename`), run through `runCommand`
 * so the read-only check and the telemetry happen once whoever draws the
 * pixels.
 */
export interface SelectionPaneService {
  /** Show the pane. */
  open(): void;
  /** Put it away. Writes nothing. */
  close(): void;
}

export const SelectionPaneProvider = createIdentifier<SelectionPaneService>(
  'AffineSelectionPane'
);

/**
 * Host override seam: replace the library's pane with the host's own — or
 * switch it off entirely.
 *
 * **Replace** — a host with its own sidebar registers this extension; its
 * implementation answers {@link SelectionPaneProvider}, the edgeless toolbar's
 * button and the `canvas.selectionPane.toggle` command then call it, and the
 * library's panel is never asked to open.
 *
 * **Disable** — pass `null`. The provider answers nothing: the toolbar button
 * is not rendered and the toggle command is unavailable, because a control
 * that opens nothing is a lie. A cold-assembly switch, decided when the editor
 * is put together (ADR 0031 §13: no flag key for it).
 *
 * `di.override`, like `ArtefactCatalogueExtension`, so a host registering
 * after the library's own default always wins.
 */
export function SelectionPaneExtension(
  service: SelectionPaneService | null
): ExtensionType {
  return {
    setup: di => {
      // `null` rides through the factory on purpose: `getOptional` then
      // reports the pane as absent, which is the whole disable story.
      di.override(SelectionPaneProvider, () => service as SelectionPaneService);
    },
  };
}
