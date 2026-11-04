import { ConfigExtensionFactory } from '@labre/std';

import type { AssetRef } from './asset-picker-service';

/** What the reader's gesture on a link card asks of the host (ADR 0048). */
export interface HtmlPageImportRequest {
  /** The card's url, as it would open. */
  url: string;
  /** The document the card sits in. */
  docId: string;
}

/**
 * What the host answers. The library reads, stores and checks nothing: the bytes
 * are already the host's when this resolves, and the card only turns into a view.
 *
 * - `imported`: `asset` replaces the card, at its place, in its embed view when
 *   `frameUrl` is set. `replaces` is the `sourceId` of a version the reader agreed
 *   to overwrite: every attachment of the document that holds it takes `asset`.
 * - `cancelled`: the reader declined something the host asked. Nothing changes and
 *   nothing is said.
 * - `refused`: the card stays and a toast says `message`, or a generic sentence
 *   without one. `message` is the host's and already translated.
 *
 * A rejection counts as `refused` with no message.
 */
export type HtmlPageImport =
  | { status: 'imported'; asset: AssetRef; replaces?: string }
  | { status: 'cancelled' }
  | { status: 'refused'; message?: string };

export interface HtmlFileConfig {
  /**
   * A page the host serves to run html, since a `srcdoc` inherits the
   * Content-Security-Policy of the page (ADR 0047). The page posts
   * `{ type: 'labre:embed-html-ready' }` to its parent and receives
   * `{ html, scripts, scroll }`. Run scripts only on an explicit `scripts: true`. It
   * runs under `HOST_PAGE_SANDBOX` and must hand the html to a frame it isolates
   * itself, never write it: that frame's response carries `sandbox allow-scripts`.
   *
   * Absent, an html attachment stays a card (ADR 0048).
   */
  frameUrl?: string;

  /**
   * Imports the page a link card points at. Absent, the card has no import button.
   * The library has no idea how it is done: no fetch, no right and no quota here.
   */
  importPage?: (request: HtmlPageImportRequest) => Promise<HtmlPageImport>;
}

export const HtmlFileConfigExtension =
  ConfigExtensionFactory<HtmlFileConfig>('affine:html-file');
