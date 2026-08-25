import type {
  AffineInlineEditor,
  AffineTextAttributes,
} from '@labre/affine-shared/types';
import { isValidUrl, normalizeUrl } from '@labre/affine-shared/utils';
import type { InlineRange } from '@labre/std/inline';

type UrlPasteInlineEditor = Pick<
  AffineInlineEditor,
  'insertText' | 'setInlineRange'
>;

export type UrlTextSegment = {
  text: string;
  link?: string;
};

const URL_SCHEME_IN_TOKEN_REGEXP =
  /(?:https?:\/\/|ftp:\/\/|sftp:\/\/|mailto:|tel:|www\.)/i;

const URL_LEADING_DELIMITER_REGEXP = /^[-([{<'"~]+/;

const URL_TRAILING_DELIMITER_REGEXP = /[)\]}>.,;:!?'"]+$/;

function appendUrlTextSegment(
  segments: UrlTextSegment[],
  segment: UrlTextSegment
) {
  if (!segment.text) return;
  const last = segments[segments.length - 1];
  if (last && !last.link && !segment.link) {
    last.text += segment.text;
    return;
  }
  segments.push(segment);
}

function splitTokenByUrl(token: string, baseUrl: string): UrlTextSegment[] {
  const schemeMatch = token.match(URL_SCHEME_IN_TOKEN_REGEXP);
  const schemeIndex = schemeMatch?.index;
  if (typeof schemeIndex === 'number' && schemeIndex > 0) {
    return [
      { text: token.slice(0, schemeIndex) },
      ...splitTokenByUrl(token.slice(schemeIndex), baseUrl),
    ];
  }

  const leading = token.match(URL_LEADING_DELIMITER_REGEXP)?.[0] ?? '';
  const withoutLeading = token.slice(leading.length);
  const trailing =
    withoutLeading.match(URL_TRAILING_DELIMITER_REGEXP)?.[0] ?? '';
  const core = trailing
    ? withoutLeading.slice(0, withoutLeading.length - trailing.length)
    : withoutLeading;

  if (core && isValidUrl(core, baseUrl)) {
    const segments: UrlTextSegment[] = [];
    appendUrlTextSegment(segments, { text: leading });
    appendUrlTextSegment(segments, { text: core, link: normalizeUrl(core) });
    appendUrlTextSegment(segments, { text: trailing });
    return segments;
  }

  return [{ text: token }];
}

/**
 * Split pasted plain text into mixed segments, where only the URL segments
 * carry link metadata. Text like `see https://example.com, then stop` keeps its
 * prose as prose and linkifies only the address, punctuation excluded.
 */
export function splitTextByUrl(
  text: string,
  baseUrl = location.origin
): UrlTextSegment[] {
  const chunks = text.match(/\s+|\S+/g);
  if (!chunks) {
    return [];
  }

  const segments: UrlTextSegment[] = [];
  chunks.forEach(chunk => {
    if (/^\s+$/.test(chunk)) {
      appendUrlTextSegment(segments, { text: chunk });
      return;
    }
    splitTokenByUrl(chunk, baseUrl).forEach(segment => {
      appendUrlTextSegment(segments, segment);
    });
  });
  return segments;
}

/**
 * Describe a paste for the database cells: the segments to insert, plus the
 * single URL the whole paste amounts to (if any), which is the only case where
 * a doc link may be resolved instead.
 */
export function analyzeTextForUrlPaste(text: string) {
  const segments = splitTextByUrl(text);
  const firstSegment = segments[0];
  const singleUrl =
    segments.length === 1 && firstSegment?.link && firstSegment.text === text
      ? firstSegment.link
      : undefined;
  return {
    segments,
    singleUrl,
  };
}

export function insertUrlTextSegments(
  inlineEditor: UrlPasteInlineEditor,
  inlineRange: InlineRange,
  segments: UrlTextSegment[]
) {
  let index = inlineRange.index;
  let replacedSelection = false;
  segments.forEach(segment => {
    if (!segment.text) return;
    const attributes: AffineTextAttributes | undefined = segment.link
      ? { link: segment.link }
      : undefined;
    inlineEditor.insertText(
      {
        index,
        // Only the first insertion replaces what the user had selected.
        length: replacedSelection ? 0 : inlineRange.length,
      },
      segment.text,
      attributes
    );
    replacedSelection = true;
    index += segment.text.length;
  });
  inlineEditor.setInlineRange({
    index,
    length: 0,
  });
}
