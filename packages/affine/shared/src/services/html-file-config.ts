import type { AttachmentBlockModel } from '@labre/affine-model';
import { type BlockStdScope, ConfigExtensionFactory } from '@labre/std';

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

const HTML_TYPES = new Set(['text/html', 'application/xhtml+xml']);
const UNDECLARED_TYPES = new Set(['', 'application/octet-stream']);
const HTML_EXTENSIONS = new Set(['html', 'htm', 'xhtml']);

/**
 * Whether this attachment is shown as html. The type is a declaration, and so is
 * the name: whatever they say and whatever the bytes are, the preview only ever
 * goes through the frame (ADR 0048). The name counts only where nothing is
 * declared, because a browser can leave a file's type empty.
 */
export function isHtmlAttachment({
  name,
  type,
}: Pick<AttachmentBlockModel['props'], 'name' | 'type'>) {
  const declared = type.split(';', 1)[0]?.trim().toLowerCase() ?? '';
  if (HTML_TYPES.has(declared)) return true;
  if (!UNDECLARED_TYPES.has(declared)) return false;
  return HTML_EXTENSIONS.has(name.split('.').pop()?.toLowerCase() ?? '');
}

/**
 * An html file opens on its embed view, in a page and on the canvas, once the host
 * has named its page; without one it stays a card (ADR 0048). Only at creation: a
 * stored block keeps the view it has, and a reader who picks the card keeps it.
 */
export function withHtmlDefaultView<
  T extends Pick<AttachmentBlockModel['props'], 'name' | 'type'>,
>(std: BlockStdScope, props: T): T | (T & { embed: true; style: 'html' }) {
  if (!isHtmlAttachment(props)) return props;
  if (!std.getOptional(HtmlFileConfigExtension.identifier)?.frameUrl) {
    return props;
  }
  return { ...props, embed: true, style: 'html' };
}
