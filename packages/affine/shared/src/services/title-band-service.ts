import { createIdentifier } from '@labre/global/di';
import type { ExtensionType } from '@labre/store';
import type { ReadonlySignal } from '@preact/signals-core';

/**
 * `TitleBandProvider` — the one seam that feeds the band of property chips
 * under the page title and at the head of the page's note on the canvas
 * (ADR 0035 §9d and §11, REQ-PR-1 and PR-7).
 *
 * **No value lives in the document.** A page's property values are the
 * host's (the Labre app keeps them in SQL, labre ADR-0047); the library reads
 * them here, draws them, and hands every edit back through `set`. It never
 * learns where they live, never caches them and never applies a value itself:
 * the host's store does, and owns the rollback.
 *
 * Not `PivotPropertiesProvider` (ADR 0006): that seam is keyed by an element's
 * `pivotDocId`, read-only, with its own value union; this one is keyed by a
 * document, written, and speaks the data-view property types, so a chip and a
 * database cell read the same `type`, `data` and value.
 *
 * Absent, there is no band at all: no chips, no "+", no panel button, no "Not
 * shown in this document" row, and nothing else changes.
 */

/**
 * One visible property of a page's sheet, in the order the band draws it.
 *
 * `type` and `data` are a data-view property type and its config (`select`
 * with `{ options }`, `number` with `{ format }`, …); `value` is the JSON a
 * data-view cell of that type holds (`select`: an option id, `multi-select`:
 * option ids, `date`: epoch milliseconds, `checkbox`: a boolean, text types: a
 * string). `null` or `undefined` is an empty value, drawn as an empty chip
 * that can still be clicked (REQ-PR-1).
 *
 * Visibility is resolved by the host: what is in the list is visible, in that
 * order, including a visible property with no value.
 */
export interface TitleBandProperty {
  /** Stable, host-defined id; what `set` receives back. */
  id: string;
  /** Whose definition this is: the workspace's, or the database's of a row. */
  namespace: 'workspace' | 'database';
  /** Display name, already localized by the host. */
  name: string;
  /** A data-view property type (`text`, `number`, `select`, …). */
  type: string;
  /** That type's config, as a data-view property holds it. */
  data: Record<string, unknown>;
  /** The JSON a data-view cell of that type holds; nullish is empty. */
  value: unknown;
  /** A read-only property draws its chip and opens no editor. */
  readonly: boolean;
}

/**
 * The state of one page's sheet. Same four states as ADR 0006: the signal may
 * start at `loading` and settle later, and the library never awaits it.
 */
export type TitleBandSheetState =
  | { status: 'loading' }
  | { status: 'ready'; properties: readonly TitleBandProperty[] }
  /** The page has no sheet this viewer may read. The band draws nothing. */
  | { status: 'missing' }
  | { status: 'error'; reason?: string };

/**
 * A child page this document holds but does not display (labre ADR-0045):
 * the host decides what belongs here, the library never computes a parent or
 * a child.
 */
export interface TitleBandNotShownPage {
  docId: string;
  /** The page's title; an empty one is drawn as "Untitled". */
  title: string;
}

export interface TitleBandService {
  /**
   * The sheet of document `docId`. MUST return synchronously and MUST NOT
   * throw; the same signal for the same document is the host's business (the
   * band asks once per mounted document).
   */
  sheet$(docId: string): ReadonlySignal<TitleBandSheetState>;

  /**
   * Write one value. The band shows the chip as pending until the promise
   * settles and never applies the value itself: the new value arrives through
   * `sheet$`. A rejection is the host's to report and roll back; the band only
   * clears its pending state. `value` is `null` to clear.
   */
  set(docId: string, propertyId: string, value: unknown): Promise<void>;

  /**
   * The band's "+" (REQ-PR-4): what it does is the host's (open the
   * workspace's property settings, or create a database property directly
   * on a row). Absent, there is no "+".
   */
  add?(docId: string): void;

  /**
   * Whether the band is collapsed for this document. The host decides where
   * that is remembered (the Labre app: per device, REQ-PR-6). Absent, the
   * band opens expanded every time and a collapse lasts while it is mounted.
   */
  collapsed$?(docId: string): ReadonlySignal<boolean>;
  setCollapsed?(docId: string, collapsed: boolean): void;

  /**
   * The child pages this document holds but does not display, drawn in both
   * views (under the title, and in the note header on the canvas) as a "Not
   * shown in this document" row: each page is a link that opens through the
   * linked-document path (`RefNodeSlotsProvider.docLinkClicked`; without it,
   * no row), with a "Show here" button on a writable document that inserts
   * an `affine:embed-linked-doc` card of it (end of the last note in the
   * page view, centre of the visible canvas on the canvas). The library
   * writes only that card: dropping the page from this list once it shows is
   * the host's reading of the document. Absent or empty, no row.
   */
  notShown$?(docId: string): ReadonlySignal<readonly TitleBandNotShownPage[]>;
}

export const TitleBandProvider =
  createIdentifier<TitleBandService>('LabreTitleBand');

/**
 * Host seam: the service that feeds the title band. **No default is
 * registered**: absence is a meaningful state (the playground without a mock,
 * a host with no properties), and the band then draws nothing.
 *
 * `di.override`, so a later registration always wins and registering twice
 * never throws at boot.
 */
export function TitleBandExtension(service: TitleBandService): ExtensionType {
  return {
    setup: di => {
      di.override(TitleBandProvider, () => service);
    },
  };
}
