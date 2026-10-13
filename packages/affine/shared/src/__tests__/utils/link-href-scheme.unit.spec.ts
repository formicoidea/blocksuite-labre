/**
 * Guard for `isSafeLinkUrl`, the one gate between a link stored in a document
 * and an `href` or a `window.open`.
 *
 * What it would have caught: before it existed, `normalizeUrl` filtered no
 * scheme, so a `javascript:` (or `data:`, `vbscript:`) link carried by an
 * imported Markdown file, a paste or a shared document was rendered as-is by
 * `affine-link` and opened as-is by the bookmark, embed and footnote blocks.
 * A click on it could run in the editor's origin.
 *
 * The obfuscated cases are the point: the scheme must be read the way the
 * browser reads it (case-insensitive, after dropping control characters,
 * spaces at the edges and tabs or newlines anywhere), never by a prefix test.
 */
import { describe, expect, test } from 'vitest';

import { isSafeLinkUrl } from '../../utils/url.js';

describe('isSafeLinkUrl', () => {
  test.each([
    'https://example.com',
    'http://example.com/a?b=c#d',
    'HTTPS://EXAMPLE.COM',
    '  https://example.com  ',
    'mailto:someone@example.com',
    'example.com',
    'www.example.com/path',
  ])('allows %j', url => {
    expect(isSafeLinkUrl(url)).toBe(true);
  });

  test.each([
    'javascript:void(0)',
    ' JaVaScRiPt:void(0)',
    'java\tscript:void(0)',
    'java\nscript:void(0)',
    'java\rscript:void(0)',
    '\u0000javascript:void(0)',
    '\u0001 \u001fjavascript:void(0)',
    'javascript://example.com/%0avoid(0)',
    'javascript:void(0).example.com',
    'data:text/html;base64,PGI+eDwvYj4=',
    'DATA:text/plain,x',
    'vbscript:msgbox(1)',
    'file:///etc/hosts',
    'blob:https://example.com/0000',
    'ftp://example.com',
    'tel:+33100000000',
    '/relative/path',
    '#anchor',
    'not a url',
  ])('refuses %j', url => {
    expect(isSafeLinkUrl(url)).toBe(false);
  });

  test('refuses an empty or missing value', () => {
    expect(isSafeLinkUrl('')).toBe(false);
    expect(isSafeLinkUrl('   ')).toBe(false);
    expect(isSafeLinkUrl('\u0000\t')).toBe(false);
    expect(isSafeLinkUrl(undefined)).toBe(false);
    expect(isSafeLinkUrl(null)).toBe(false);
  });
});
