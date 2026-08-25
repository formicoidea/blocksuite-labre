import { extMimeMap, getAssetName } from '@labre/store';
import * as fflate from 'fflate';

export class Zip {
  private compressed = new Uint8Array();

  private finalize?: () => void;

  private finalized = false;

  private readonly zip = new fflate.Zip((err, chunk, final) => {
    if (!err) {
      const temp = new Uint8Array(this.compressed.length + chunk.length);
      temp.set(this.compressed);
      temp.set(chunk, this.compressed.length);
      this.compressed = temp;
    }
    if (final) {
      this.finalized = true;
      this.finalize?.();
    }
  });

  async file(path: string, content: Blob | File | string) {
    const deflate = new fflate.ZipDeflate(path);
    this.zip.add(deflate);
    if (typeof content === 'string') {
      deflate.push(fflate.strToU8(content), true);
    } else {
      deflate.push(new Uint8Array(await content.arrayBuffer()), true);
    }
  }

  folder(folderPath: string) {
    return {
      folder: (folderPath2: string) => {
        return this.folder(`${folderPath}/${folderPath2}`);
      },
      file: async (name: string, blob: Blob) => {
        await this.file(`${folderPath}/${name}`, blob);
      },
      generate: async () => {
        return this.generate();
      },
    };
  }

  async generate() {
    this.zip.end();
    return new Promise<Blob>(resolve => {
      if (this.finalized) {
        resolve(new Blob([this.compressed], { type: 'application/zip' }));
      } else {
        this.finalize = () =>
          resolve(new Blob([this.compressed], { type: 'application/zip' }));
      }
    });
  }
}

const strictUtf8Decoder = new TextDecoder('utf-8', { fatal: true });

/**
 * Repair an entry name that was decoded as Latin-1.
 *
 * fflate follows the zip spec: unless an entry sets the UTF-8 flag (general
 * purpose bit 11) its name is decoded as Latin-1. Common archivers — the macOS
 * `zip` tool among them — write UTF-8 bytes without ever setting that flag, so
 * a CJK name comes back as mojibake, one character per raw byte.
 *
 * Such a name only ever holds code points in the 0x00-0xff range, so it can be
 * turned back into the original bytes and decoded again, strictly, as UTF-8.
 * Anything that is not valid UTF-8 — a name that really was Latin-1, or one
 * fflate already decoded correctly — is left untouched.
 */
function fixFileNameEncoding(fileName: string): string {
  const bytes = new Uint8Array(fileName.length);
  let hasNonAscii = false;
  for (let i = 0; i < fileName.length; i++) {
    const code = fileName.charCodeAt(i);
    // A code point above 0xff cannot come out of a Latin-1 decode: the name was
    // already decoded from its declared UTF-8 bytes, nothing to repair.
    if (code > 0xff) return fileName;
    if (code > 0x7f) hasNonAscii = true;
    bytes[i] = code;
  }
  if (!hasNonAscii) return fileName;
  try {
    return strictUtf8Decoder.decode(bytes);
  } catch {
    return fileName;
  }
}

export class Unzip {
  private unzipped?: ReturnType<typeof fflate.unzipSync>;

  async load(blob: Blob) {
    this.unzipped = fflate.unzipSync(new Uint8Array(await blob.arrayBuffer()));
  }

  *[Symbol.iterator]() {
    const keys = Object.keys(this.unzipped ?? {});
    let index = 0;
    while (keys.length) {
      const rawPath = keys.shift()!;
      if (rawPath.includes('__MACOSX') || rawPath.includes('DS_Store')) {
        continue;
      }
      const data = this.unzipped![rawPath];
      const path = fixFileNameEncoding(rawPath);
      const lastSplitIndex = path.lastIndexOf('/');
      const fileName = path.substring(lastSplitIndex + 1);
      const fileExt =
        fileName.lastIndexOf('.') === -1 ? '' : fileName.split('.').at(-1);
      const mime = extMimeMap.get(fileExt ?? '');
      const content = new File([data], fileName, {
        type: mime ?? '',
      }) as Blob;
      yield { path, content, index };
      index++;
    }
  }
}

export async function createAssetsArchive(
  assetsMap: Map<string, Blob>,
  assetsIds: string[]
) {
  const zip = new Zip();

  for (const [id, blob] of assetsMap) {
    if (!assetsIds.includes(id)) continue;
    const name = getAssetName(assetsMap, id);
    await zip.folder('assets').file(name, blob);
  }

  return zip;
}

export function download(blob: Blob, name: string) {
  const element = document.createElement('a');
  element.setAttribute('download', name);
  const fileURL = URL.createObjectURL(blob);
  element.setAttribute('href', fileURL);
  element.style.display = 'none';
  document.body.append(element);
  element.click();
  element.remove();
  URL.revokeObjectURL(fileURL);
}
