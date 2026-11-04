import type { AttachmentBlockModel } from '@labre/affine-model';
import { HtmlFileConfigExtension } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';

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
