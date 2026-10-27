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
 * shown on this page" row, and nothing else changes.
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
  /**
   * Whether the host takes a write of this property's definition (`data`)
   * through {@link TitleBandService.setData}; absent means `false`. A select
   * or multi-select whose options can be created and renamed from its chip
   * says `true`; one whose option ids are its labels (the Labre app's
   * `tags`) never does.
   */
  dataWritable?: boolean;
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
   * Write one property's definition, its `data` (a select's `options`): the
   * band's one definition write, distinct from `set` (product owner,
   * 2026-10-14). Called only for a property whose `dataWritable` is `true`
   * on a chip that is not read-only, and only to create an option or rename
   * one: the chip's tag menu offers no delete, no colour and no reordering.
   * `data` is the whole new config, the option list in data-view's shape
   * (`{ id, value, color }`, a created option first, its id minted by the
   * library). The library never applies it: the option shows once it arrives
   * through `sheet$`, so a host applies it to its sheet at once and owns the
   * rollback. Creating an option is followed at once by a `set` that selects
   * it: the host applies the two in the order it receives them. A rejection is
   * the host's to report; the band logs it. Absent, every chip's options are
   * fixed: no "Create", no option menu (the 0.48 band).
   */
  setData?(
    docId: string,
    propertyId: string,
    data: Record<string, unknown>
  ): Promise<void>;

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
   * shown on this page" row: each page is a link that opens through the
   * linked-document path (`RefNodeSlotsProvider.docLinkClicked`; without it,
   * no row), with a "Show here" button on a writable document that inserts
   * an `affine:embed-linked-doc` card of it (end of the last note in the
   * page view, centre of the visible canvas on the canvas). The library
   * writes only that card: dropping the page from this list once it shows is
   * the host's reading of the document. Absent or empty, no row.
   */
  notShown$?(docId: string): ReadonlySignal<readonly TitleBandNotShownPage[]>;

  /**
   * The ids of the child pages of document `docId` in the host's page tree
   * (labre ADR-0045, amended 2026-10-27). A linked-doc card or a synced-doc
   * embed of one of them, in that document, is the child's own card: it is
   * drawn with the plain page (or canvas) icon, without the link arrow an
   * inline `@` reference keeps. Read inside the card's icon computation, so
   * a move redraws it. The library never computes a parent or a child.
   * Absent, every card keeps the arrow (0.59).
   */
  children$?(docId: string): ReadonlySignal<readonly string[]>;
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
