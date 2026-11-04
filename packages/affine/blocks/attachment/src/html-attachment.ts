import type { AttachmentBlockModel } from '@labre/affine-model';

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
