// https://www.iana.org/assignments/uri-schemes/uri-schemes.xhtml
const ALLOWED_SCHEMES = new Set([
  'http',
  'https',
  'ftp',
  'sftp',
  'mailto',
  'tel',
]);

// https://publicsuffix.org/
const TLD_REGEXP = /(?:\.[a-zA-Z]+)?(\.[a-zA-Z]{2,})$/;

const IPV4_ADDR_REGEXP =
  /^(25[0-5]|2[0-4]\d|[01]?\d\d?)(\.(25[0-5]|2[0-4]\d|[01]?\d\d?)){3}$/;

const toURL = (str: string) => {
  try {
    if (!URL.canParse(str)) return null;

    return new URL(str);
  } catch {
    return null;
  }
};

function resolveURL(str: string, baseUrl: string, padded = false) {
  const url = toURL(str);
  if (!url) return null;

  const protocol = url.protocol.substring(0, url.protocol.length - 1);
  const hostname = url.hostname;
  const origin = url.origin;

  let allowed = ALLOWED_SCHEMES.has(protocol);
  if (allowed && hostname.includes('.')) {
    allowed =
      origin === baseUrl ||
      TLD_REGEXP.test(hostname) ||
      (padded ? false : IPV4_ADDR_REGEXP.test(hostname));
  }

  return { url, allowed };
}

export function normalizeUrl(str: string) {
  str = str.trim();

  let url = toURL(str);

  if (!url) {
    const hasScheme = str.match(/^https?:\/\//);

    if (!hasScheme) {
      const dotIdx = str.indexOf('.');
      if (dotIdx > 0 && dotIdx < str.length - 1) {
        url = toURL(`https://${str}`);
      }
    }
  }

  // Formatted
  if (url) {
    if (!str.endsWith('/') && url.href.endsWith('/')) {
      return url.href.substring(0, url.href.length - 1);
    }
    return url.href;
  }

  return str;
}

const LINK_SCHEMES = new Set(['http:', 'https:', 'mailto:']);

// What the WHATWG URL parser drops before reading a scheme: leading and
// trailing C0 controls and spaces, and every tab or newline anywhere.
const URL_EDGE_JUNK = /^[\u0000-\u0020]+|[\u0000-\u0020]+$/g;
const URL_TAB_OR_NEWLINE = /[\t\n\r]/g;

/**
 * Whether a link stored in a document may become an `href` or be opened.
 *
 * Only `http:`, `https:` and `mailto:` pass, plus scheme-less values that
 * {@link normalizeUrl} turns into https (`example.com`). Everything else is
 * refused — `javascript:`, `data:`, `vbscript:`, `file:`, relative paths —
 * because the value comes from an imported, pasted or shared document and a
 * click on it must never run in the editor's origin. The scheme is read by
 * `new URL` after the same cleanup the browser does, never by a prefix test,
 * so ` JaVaScRiPt:` and `java\tscript:` are recognised for what they are.
 *
 * Render and open sites call this on the stored value; nothing is rewritten
 * on load, so a refused link keeps its text and simply is not clickable.
 */
export function isSafeLinkUrl(str: string | null | undefined): str is string {
  if (!str) return false;
  const cleaned = str
    .replace(URL_TAB_OR_NEWLINE, '')
    .replace(URL_EDGE_JUNK, '');
  if (!cleaned) return false;
  const url = toURL(normalizeUrl(cleaned));
  return url !== null && LINK_SCHEMES.has(url.protocol);
}

/**
 * Assume user will input a url, we just need to check if it is valid.
 *
 * For more detail see https://www.ietf.org/rfc/rfc1738.txt
 */
export function isValidUrl(str: string, baseUrl = location.origin) {
  str = str.trim();

  let result = resolveURL(str, baseUrl);

  if (result && !result.allowed) return false;

  if (!result) {
    const hasScheme = str.match(/^https?:\/\//);
    if (!hasScheme) {
      const dotIdx = str.indexOf('.');
      if (dotIdx > 0 && dotIdx < str.length - 1) {
        result = resolveURL(`https://${str}`, baseUrl, true);
      }
    }
  }

  return result?.allowed ?? false;
}

// https://en.wikipedia.org/wiki/Top-level_domain
const COMMON_TLDS = new Set([
  'com',
  'org',
  'net',
  'edu',
  'gov',
  'co',
  'io',
  'me',
  'moe',
  'mil',
  'top',
  'dev',
  'xyz',
  'info',
  'cat',
  'ru',
  'de',
  'jp',
  'uk',
  'pro',
]);

function isCommonTLD(url: URL) {
  const tld = url.hostname.split('.').pop() ?? '';
  return COMMON_TLDS.has(tld);
}

/**
 * Assuming the user will input anything, we need to check rigorously.
 */
export function isStrictUrl(str: string) {
  try {
    if (!isValidUrl(str)) {
      return false;
    }

    const url = new URL(normalizeUrl(str));

    return isCommonTLD(url);
  } catch {
    return false;
  }
}

export function isUrlInClipboard(clipboardData: DataTransfer) {
  const url = clipboardData.getData('text/plain');
  return isValidUrl(url);
}

export function getHostName(link: string) {
  try {
    const url = new URL(link);
    return url.hostname || url.pathname;
  } catch {
    return link;
  }
}
