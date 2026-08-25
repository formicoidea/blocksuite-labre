import * as fflate from 'fflate';
import { describe, expect, test } from 'vitest';

import { Unzip } from '../transformers/utils.js';

/**
 * Build a zip whose entry name carries the given raw bytes while the UTF-8 flag
 * (general purpose bit 11) stays off — what the macOS `zip` tool produces.
 *
 * fflate always sets that flag for a non-ASCII name, so the archive is built
 * with an ASCII placeholder of the exact same byte length and the placeholder
 * bytes are then swapped for the real ones. Both copies of the name (local file
 * header and central directory) are rewritten in one pass.
 */
function zipWithRawName(nameBytes: Uint8Array, content: string): Blob {
  const placeholder = 'z'.repeat(nameBytes.length);
  const archive = fflate.zipSync(
    { [placeholder]: fflate.strToU8(content) },
    { level: 0 }
  );

  for (let i = 0; i + nameBytes.length <= archive.length; i++) {
    let matches = true;
    for (let j = 0; j < nameBytes.length; j++) {
      // 0x7a is 'z', the placeholder character.
      if (archive[i + j] !== 0x7a) {
        matches = false;
        break;
      }
    }
    if (matches) {
      archive.set(nameBytes, i);
      i += nameBytes.length - 1;
    }
  }

  return new Blob([archive], { type: 'application/zip' });
}

const utf8Name = (name: string, content: string) =>
  zipWithRawName(new TextEncoder().encode(name), content);

describe('Unzip', () => {
  test('recovers a CJK file name stored without the UTF-8 flag', async () => {
    const unzip = new Unzip();
    await unzip.load(utf8Name('中文文档.md', '# hello'));

    const entries = [...unzip];
    expect(entries).toHaveLength(1);
    expect(entries[0].path).toBe('中文文档.md');
    expect((entries[0].content as File).name).toBe('中文文档.md');
    expect(await entries[0].content.text()).toBe('# hello');
  });

  test('recovers a CJK folder name inside the path', async () => {
    const unzip = new Unzip();
    await unzip.load(utf8Name('文件夹/笔记.md', '# hello'));

    const entries = [...unzip];
    expect(entries[0].path).toBe('文件夹/笔记.md');
    expect((entries[0].content as File).name).toBe('笔记.md');
  });

  test('leaves an ASCII file name alone', async () => {
    const unzip = new Unzip();
    await unzip.load(utf8Name('plain-note.md', '# hello'));

    const entries = [...unzip];
    expect(entries[0].path).toBe('plain-note.md');
  });

  test('leaves a name fflate already decoded from its UTF-8 flag alone', async () => {
    const unzip = new Unzip();
    // fflate sets the UTF-8 flag itself for a non-ASCII name.
    const archive = fflate.zipSync({ '中文文档.md': fflate.strToU8('# hello') });
    await unzip.load(new Blob([archive], { type: 'application/zip' }));

    const entries = [...unzip];
    expect(entries[0].path).toBe('中文文档.md');
  });

  test('leaves a name that is not valid UTF-8 alone', async () => {
    const unzip = new Unzip();
    // 0xe9 alone is Latin-1 "é" but an incomplete UTF-8 sequence.
    const nameBytes = new TextEncoder().encode('caf_.md');
    nameBytes[3] = 0xe9;
    await unzip.load(zipWithRawName(nameBytes, '# hello'));

    const entries = [...unzip];
    expect(entries[0].path).toBe('café.md');
  });
});
