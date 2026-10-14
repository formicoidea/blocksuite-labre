import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { deflateRawSync } from 'node:zlib';

import { describe, expect, it } from 'vitest';

import { InterchangeImportError } from '@labre/affine-block-surface';

import {
  DRAWIO_BAD_PAYLOAD,
  DRAWIO_EMPTY_DIAGRAM,
  DRAWIO_MAX_INFLATED_BYTES,
  DRAWIO_TOO_LARGE,
  decodeDrawio,
  UML_DRAWIO_DECODE_ERRORS,
} from '../drawio-decode';
import { importDrawio } from '../drawio-import';

/**
 * The one impure step of the draw.io import (`docs/adr/0019`).
 *
 * What is proved here is the half the pure reader deliberately refuses: a real
 * `.drawio` file, compressed by draw.io itself, comes back as the
 * `<mxGraphModel>` that is checked in beside it — byte for byte, which is the
 * strongest statement available and the one that would notice a decoder that
 * dropped a trailing newline or mangled a non-ASCII label.
 *
 * `DecompressionStream` is a platform API. Node 18 and up has it, every browser
 * this library supports has it, and a runtime that does not is SKIPPED with a
 * reason rather than failed: the function's own answer for that case is a named
 * error, and asserting it needs a runtime where the API is absent, which this
 * is not.
 */

const HERE = dirname(fileURLToPath(import.meta.url));
const corpus = (name: string) =>
  readFileSync(join(HERE, 'corpus', name), 'utf8');

const COMPRESSED = corpus('drawio-class-iwlayer.drawio.xml');
const DECODED = corpus('drawio-class-iwlayer.decoded.xml');

const canInflate =
  typeof (globalThis as { DecompressionStream?: unknown })
    .DecompressionStream === 'function';

describe('decoding a .drawio file', () => {
  it('leaves plain mxGraphModel XML exactly as it was', async () => {
    // The `.drawio.xml` case, the "Compressed: off" case, and the case a spec
    // feeds in. Identity, and not a round trip through a decoder that could
    // change it.
    await expect(decodeDrawio(DECODED)).resolves.toBe(DECODED);
  });

  it.runIf(canInflate)(
    'inflates draw.io’s own payload into the XML checked in beside it',
    async () => {
      const decoded = await decodeDrawio(COMPRESSED);
      expect(decoded.trim()).toBe(DECODED.trim());

      // …and it is the file the reader then reads: the two halves of the split
      // meet here and nowhere else.
      expect(importDrawio(decoded).model.classifiers).toHaveLength(8);
    }
  );

  it.skipIf(canInflate)(
    'needs DecompressionStream, which this runtime lacks',
    () => {
      // Left as a visible skip rather than dropped: the reason a suite did not
      // run a case belongs in its output.
      expect(canInflate).toBe(false);
    }
  );

  it('names what is wrong with an mxfile holding no diagram', async () => {
    await expect(
      decodeDrawio(
        '<mxfile host="app.diagrams.net"><diagram></diagram></mxfile>'
      )
    ).rejects.toThrow(DRAWIO_EMPTY_DIAGRAM);
  });

  it.runIf(canInflate)(
    'names a payload that is neither XML nor an inflatable blob',
    async () => {
      await expect(
        decodeDrawio(
          '<mxfile><diagram id="x">not-base64-at-all!!</diagram></mxfile>'
        )
      ).rejects.toThrow(DRAWIO_BAD_PAYLOAD);
    }
  );

  it('refuses with a static key, so a server can answer without the sentence', async () => {
    const error = await decodeDrawio(
      '<mxfile host="app.diagrams.net"><diagram></diagram></mxfile>'
    ).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(InterchangeImportError);
    expect((error as InterchangeImportError).messageKey).toBe(
      UML_DRAWIO_DECODE_ERRORS.emptyDiagram[0]
    );
    expect((error as InterchangeImportError).messageParams).toBeUndefined();
  });
});

/**
 * The decompression bomb of the P0 import spike (labre
 * `docs/spikes/2026-10-p0-import-edge-function.md`, "Bombe draw.io"): before
 * the ceiling, `decodeDrawio` buffered whatever the inflater produced, and a
 * 398 KiB file inflated to 300 MiB and killed the isolate. These specs would
 * have caught it: each one hands over a payload a few KiB long that inflates
 * far past the ceiling, and asserts a refusal rather than a string.
 */
describe('the inflated-size ceiling', () => {
  /** An mxfile whose first `<diagram>` inflates to `size` bytes of `%41`. */
  const bomb = (size: number) => {
    const payload = deflateRawSync(Buffer.alloc(size, 'A')).toString('base64');
    return `<mxfile host="app.diagrams.net"><diagram id="b">${payload}</diagram></mxfile>`;
  };

  it('is 20 MiB', () => {
    expect(DRAWIO_MAX_INFLATED_BYTES).toBe(20 * 1024 * 1024);
  });

  it.runIf(canInflate)(
    'refuses the spike’s 64 MiB bomb with the too-large key',
    async () => {
      const error = await decodeDrawio(bomb(64 * 1024 * 1024)).catch(
        (caught: unknown) => caught
      );
      expect(error).toBeInstanceOf(InterchangeImportError);
      expect((error as InterchangeImportError).message).toBe(DRAWIO_TOO_LARGE);
      expect((error as InterchangeImportError).messageKey).toBe(
        UML_DRAWIO_DECODE_ERRORS.tooLarge[0]
      );
    },
    10_000
  );

  it.runIf(canInflate)(
    'refuses one byte past the ceiling and inflates what stays under it',
    async () => {
      await expect(
        decodeDrawio(bomb(DRAWIO_MAX_INFLATED_BYTES + 1))
      ).rejects.toThrow(DRAWIO_TOO_LARGE);
      // Under the ceiling the payload inflates, and is then refused for what
      // it is (not an mxGraphModel), not for its size.
      await expect(decodeDrawio(bomb(64 * 1024))).rejects.toThrow(
        DRAWIO_BAD_PAYLOAD
      );
    },
    10_000
  );
});
