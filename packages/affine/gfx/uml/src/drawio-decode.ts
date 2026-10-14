import { InterchangeImportError } from '@labre/affine-block-surface/interchange';

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

/**
 * `PAYLOAD` in `<diagram …>PAYLOAD</diagram>`, the first page of an `mxfile`.
 *
 * Two linear searches rather than one lazy regex: `[\s\S]*?` re-scanned the
 * rest of the file from every `<diagram` that never closed, 13.7 s for 352 KiB
 * (security review, 2026-10-14). Only the first open tag can match: when it
 * has no `>` or no close after it, no later one has either.
 */
function diagramPayload(text: string): string | undefined {
  const open = /<diagram\b/i.exec(text);
  if (!open) return undefined;
  const start = text.indexOf('>', open.index);
  if (start < 0) return undefined;
  const close = /<\/diagram>/gi;
  close.lastIndex = start + 1;
  const end = close.exec(text);
  return end ? text.slice(start + 1, end.index) : undefined;
}

/**
 * The most a `<diagram>` payload may inflate to: 20 MiB.
 *
 * A raw deflate stream compresses a run of one byte about a thousand to one,
 * so the size of the FILE says nothing about the size of what it holds: the
 * P0 import spike (labre `docs/spikes/2026-10-p0-import-edge-function.md`)
 * inflated a 398 KiB `.drawio` to 300 MiB and lost the isolate to it, and an
 * 85 KiB one to 64 MiB in 624 ms. The real corpus is three orders of magnitude
 * below the ceiling (`drawio-class-iwlayer` inflates to 12 KiB), and a drawing
 * twenty megabytes of XML long is already more than the canvas draws usefully.
 *
 * Counted on the INFLATED BYTES as they stream out, never on the payload: the
 * compressed size is the attacker's number, the inflated one is ours. The
 * stream is cancelled the moment the count passes the ceiling, so the memory
 * the decode can take is bounded by the ceiling plus one chunk.
 */
export const DRAWIO_MAX_INFLATED_BYTES = 20 * 1024 * 1024;

/**
 * The decoder's four refusals, as `[key, English]` pairs (ADR 0023): every one
 * is thrown as an {@link InterchangeImportError} carrying the key, so a host
 * that must not echo a reader's sentence (an HTTP response, a log) has a
 * STATIC identifier to hand on instead, and the editor's catch site translates
 * it exactly as it translates a reader's own refusal. None takes a parameter:
 * nothing out of the file is ever put into one.
 */
export const UML_DRAWIO_DECODE_ERRORS = {
  noDecompression: [
    'com.labre.uml.import.drawio.error.no-decompression',
    'This runtime cannot read a compressed .drawio file (DecompressionStream is unavailable). Re-save it from draw.io with File › Properties › Compressed turned off.',
  ],
  emptyDiagram: [
    'com.labre.uml.import.drawio.error.empty-diagram',
    'This .drawio file holds no <diagram> to read.',
  ],
  badPayload: [
    'com.labre.uml.import.drawio.error.bad-payload',
    'This .drawio file’s <diagram> is neither XML nor a payload this reader could inflate.',
  ],
  tooLarge: [
    'com.labre.uml.import.drawio.error.too-large',
    'This .drawio file’s <diagram> inflates past the size this reader accepts.',
  ],
} as const satisfies Record<string, readonly [key: string, english: string]>;

/**
 * The sentence a host sees when the runtime cannot inflate.
 *
 * Exported so the command's spec can assert the wording rather than a substring
 * of it, and so a host that wants to offer "open it in draw.io and save it
 * uncompressed" has something to match on.
 */
export const DRAWIO_NO_DECOMPRESSION =
  UML_DRAWIO_DECODE_ERRORS.noDecompression[1];

export const DRAWIO_EMPTY_DIAGRAM = UML_DRAWIO_DECODE_ERRORS.emptyDiagram[1];

export const DRAWIO_BAD_PAYLOAD = UML_DRAWIO_DECODE_ERRORS.badPayload[1];

export const DRAWIO_TOO_LARGE = UML_DRAWIO_DECODE_ERRORS.tooLarge[1];

const refusal = (
  which: keyof typeof UML_DRAWIO_DECODE_ERRORS
): InterchangeImportError => {
  const [key, message] = UML_DRAWIO_DECODE_ERRORS[which];
  return new InterchangeImportError(message, { messageKey: key });
};

/** The ceiling was passed — a sentinel, so the `catch` below can tell it apart. */
class InflateCeiling extends Error {}

/**
 * Read a byte stream to its end, refusing past `limit` bytes.
 *
 * `new Response(stream).text()` buffers whatever the stream yields, which is
 * the unbounded read the ceiling exists to replace.
 */
async function readCapped(
  stream: ReadableStream<Uint8Array>,
  limit: number
): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > limit) {
      // Stops the inflater, rather than letting it run to the end of a stream
      // nobody will read.
      await reader.cancel().catch(() => undefined);
      throw new InflateCeiling();
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

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
 * Throws an {@link InterchangeImportError}, with one of the four refusals
 * above, when it cannot — the fourth being a payload that inflates past
 * {@link DRAWIO_MAX_INFLATED_BYTES}. That is the
 * contract the import pipeline already has for a file it cannot read
 * (`importInterchangeFile` shows the thrown sentence as the failure
 * notification), and it is the right one here: an empty board with a `warning`
 * would claim the file was read and found empty.
 */
export async function decodeDrawio(text: string): Promise<string> {
  if (!isCompressedDrawio(text)) return text;

  const payload = diagramPayload(text)?.trim();
  if (!payload) throw refusal('emptyDiagram');

  const Decompression = (
    globalThis as { DecompressionStream?: typeof DecompressionStream }
  ).DecompressionStream;
  if (!Decompression) throw refusal('noDecompression');

  let inflated: string;
  try {
    const binary = atob(payload);
    const bytes = Uint8Array.from(binary, character => character.charCodeAt(0));
    const stream = new Blob([bytes])
      .stream()
      .pipeThrough(new Decompression('deflate-raw'));
    // draw.io deflates the URI-ENCODED xml, so this is percent-escaped text and
    // not the document yet.
    inflated = decodeURIComponent(
      new TextDecoder().decode(
        await readCapped(stream, DRAWIO_MAX_INFLATED_BYTES)
      )
    );
  } catch (error) {
    if (error instanceof InflateCeiling) throw refusal('tooLarge');
    throw refusal('badPayload');
  }

  if (!inflated.includes('<mxGraphModel')) throw refusal('badPayload');
  return inflated;
}
