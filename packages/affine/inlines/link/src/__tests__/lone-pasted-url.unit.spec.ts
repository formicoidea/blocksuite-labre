/**
 * What counts as "a lone URL" for the paste proposal (labre REQ-IM-1): the
 * plain text of the clipboard is ONE http(s) URL and nothing else.
 *
 * Would have caught: a proposal opening on a sentence that merely holds a URL,
 * on `mailto:` (which `isSafeLinkUrl` accepts as a link but nothing can
 * embed), or on a scheme the link renderer refuses.
 */
import { describe, expect, it } from 'vitest';

import { lonePastedUrl } from '../link-node/propose-views.js';

describe('lonePastedUrl', () => {
  it.each([
    ['https://example.com', 'https://example.com'],
    ['http://example.com/a?b=c#d', 'http://example.com/a?b=c#d'],
    ['  https://example.com/path \n', 'https://example.com/path'],
    ['HTTPS://Example.com', 'HTTPS://Example.com'],
  ])('accepts %j', (text, url) => {
    expect(lonePastedUrl(text)).toBe(url);
  });

  it.each([
    [null],
    [undefined],
    [''],
    ['   '],
    ['example.com'],
    ['see https://example.com'],
    ['https://example.com https://example.org'],
    ['https://example.com\nhttps://example.org'],
    ['mailto:someone@example.com'],
    ['javascript:alert(1)'],
    [' JaVaScRiPt:alert(1)'],
    ['data:text/html,<script>alert(1)</script>'],
    ['ftp://example.com/file'],
    ['file:///etc/passwd'],
  ])('refuses %j', text => {
    expect(lonePastedUrl(text)).toBeNull();
  });
});
