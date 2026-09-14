import { isCompressedDrawio } from './drawio-import.js';

/**
 * The one impure step of the draw.io import: inflating an `<mxfile>`'s payload
 * (`docs/adr/0019`, the compressed-payload split).
 *
 * ## Why this is a module of its own, and not part of the reader
 *
 * `docs/adr/0012` P3 makes every interchange reader a PURE function of text: no
 * `std`, no DOM, no clock, no platform. That is what lets labre-mcp call the
 * very function the editor command calls, and what lets a unit suite prove a
 * format with six string literals. Inflating a raw-deflate stream breaks all
 * three halves of it — it needs `DecompressionStream`, it is asynchronous, and
 * what it hands back is bytes — so it does not belong in `drawio-import.ts` and
 * it is not in the capability's `run` either.
 *
 * The split that came out of that:
 *
 *  - `importDrawio` (pure, synchronous) reads DECODED `<mxGraphModel>` XML;
 *  - `UML_DRAWIO_IMPORT.run` does the same, and answers a payload that is still
 *    compressed with one `warning` note rather than pretending it read nothing;
 *  - this function, called by the COMMAND before either of them, is where the
 *    platform API lives.
 *
 * A caller that has plain XML pays nothing: an `<mxGraphModel>` anywhere in the
 * text is returned unchanged, which is also what draw.io itself writes with
 * File › Properties › Compressed turned off.
 *
 * ## No dependency, and no vendored inflater
 *
 * `DecompressionStream('deflate-raw')` is the platform's own zlib, shipped in
 * every browser this library supports and in Node 18 and up. Adding `pako` or
 * `fflate` to read one file format would put forty kilobytes into every bundle
 * that imports this package for the sake of a function the runtime already has.
 * Where the API is genuinely absent the failure is NAMED — see below — rather
 * than left as a `TypeError` about an undefined constructor.
 */

/** `<diagram …>PAYLOAD</diagram>` — the first page of an `mxfile`. */
const DIAGRAM = /<diagram\b[^>]*>([\s\S]*?)<\/diagram>/i;

/**
 * The sentence a host sees when the runtime cannot inflate.
 *
 * Exported so the command's spec can assert the wording rather than a substring
 * of it, and so a host that wants to offer "open it in draw.io and save it
 * uncompressed" has something to match on.
 */
export const DRAWIO_NO_DECOMPRESSION =
  'This runtime cannot read a compressed .drawio file (DecompressionStream is unavailable). Re-save it from draw.io with File › Properties › Compressed turned off.';

export const DRAWIO_EMPTY_DIAGRAM =
  'This .drawio file holds no <diagram> to read.';

export const DRAWIO_BAD_PAYLOAD =
  'This .drawio file’s <diagram> is neither XML nor a payload this reader could inflate.';

/**
 * An `.drawio` file's text as the `<mxGraphModel>` XML inside it.
 *
 * Identity when the text already holds an `<mxGraphModel>` — that covers a
 * `.drawio.xml`, an uncompressed `.drawio`, and the decoded corpus a spec
 * feeds in. Otherwise: take the first `<diagram>`'s text, base64-decode it,
 * inflate it as a raw deflate stream, and undo the `encodeURIComponent`
 * draw.io applied before compressing.
 *
 * Only the FIRST page is read, and it is a limitation rather than an oversight:
 * a multi-page `.drawio` is several diagrams, this import draws one sheet, and
 * a reader that silently concatenated two pages would produce a drawing neither
 * page ever was. The remaining pages are what a second import of the same file
 * is for.
 *
 * Throws, with one of the three sentences above, when it cannot. That is the
 * contract the import pipeline already has for a file it cannot read
 * (`importInterchangeFile` shows the thrown sentence as the failure
 * notification), and it is the right one here: an empty board with a `warning`
 * would claim the file was read and found empty.
 */
export async function decodeDrawio(text: string): Promise<string> {
  if (!isCompressedDrawio(text)) return text;

  const payload = DIAGRAM.exec(text)?.[1]?.trim();
  if (!payload) throw new Error(DRAWIO_EMPTY_DIAGRAM);

  const Decompression = (
    globalThis as { DecompressionStream?: typeof DecompressionStream }
  ).DecompressionStream;
  if (!Decompression) throw new Error(DRAWIO_NO_DECOMPRESSION);

  let inflated: string;
  try {
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new Decompression('deflate-raw'));
    // draw.io deflates the URI-ENCODED xml, so this is percent-escaped text and
    // not the document yet.
    inflated = decodeURIComponent(await new Response(stream).text());
  } catch {
    throw new Error(DRAWIO_BAD_PAYLOAD);
  }

  if (!inflated.includes('<mxGraphModel')) throw new Error(DRAWIO_BAD_PAYLOAD);
  return inflated;
}
