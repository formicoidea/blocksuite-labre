import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * What the host says about a native drag over an editor (dragover).
 *
 * - `'ignore'`: not one of the host's pages; the editor treats it as before.
 * - `'refuse'`: one of the host's pages that may not land in this document;
 *   the browser shows its no-drop cursor and no drop line is drawn.
 * - `'accept'`: the drop line is drawn and the drop calls `drop`.
 */
export type PageDropVerdict = 'ignore' | 'refuse' | 'accept';

/** The page a drop placed, and how to undo what the host did for it. */
export interface PageDrop {
  /** The page whose `affine:embed-linked-doc` card goes where it was dropped. */
  pageId: string;
  /**
   * Called when the undo step that holds the card is undone (Mod+Z, the
   * history), after the card is gone: put back what `drop` changed.
   */
  undo?: () => void;
  /** Called when that step is redone, after the card is back. */
  redo?: () => void;
}

/**
 * Pages dragged from the host's own chrome (a sidebar tree) into the editor
 * (labre P7, ADR-0045 §7 amended 2026-10-16): the host recognises its drag
 * and decides what the drop means; the editor draws the drop line and places
 * a card of the page where it was dropped (the drop line in a note, the drop
 * point on the canvas), in one undo step that also carries the host's
 * `undo` / `redo`.
 *
 * - `verdict` is called on every dragover. The browser exposes only
 *   `dataTransfer.types` then, never the data: the host knows which page it is
 *   dragging from its own state. A read-only document refuses whatever the
 *   host says.
 * - `drop` is called once, synchronously, for a drop the last `verdict`
 *   accepted. Return `null` to place nothing (the host changed its mind).
 *   The editor never copies or creates a page: the card references `pageId`.
 */
export interface PageDropService {
  verdict(drag: { types: readonly string[]; docId: string }): PageDropVerdict;
  drop(drag: { dataTransfer: DataTransfer; docId: string }): PageDrop | null;
}

export const PageDropProvider =
  createIdentifier<PageDropService>('AffinePageDrop');

/**
 * Host seam: accept pages dragged from the host into the editor. Absent, such
 * a drag is any other foreign drag: the page view draws its drop line and the
 * drop does nothing.
 *
 * `di.override`, like `FrameTemplateExtension`, so a later registration wins
 * and registering twice never throws at boot.
 */
export function PageDropExtension(service: PageDropService): ExtensionType {
  return {
    setup: di => {
      di.override(PageDropProvider, () => service);
    },
  };
}

/** The verdict for a native drag over `std`'s editor, read-only included. */
export function pageDropVerdict(
  std: Pick<BlockStdScope, 'getOptional' | 'store'>,
  dataTransfer: DataTransfer | null
): PageDropVerdict {
  const service = std.getOptional(PageDropProvider);
  if (!service || !dataTransfer) return 'ignore';
  const verdict = service.verdict({
    types: [...dataTransfer.types],
    docId: std.store.id,
  });
  if (verdict === 'ignore') return 'ignore';
  return std.store.readonly ? 'refuse' : verdict;
}
