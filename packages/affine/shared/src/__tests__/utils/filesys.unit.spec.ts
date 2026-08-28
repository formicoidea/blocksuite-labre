import { describe, expect, it } from 'vitest';

import {
  type FilePickerSpec,
  openFilesWith,
  openSingleFileWithSpec,
} from '../../utils/file/filesys.js';

/**
 * The FALLBACK file picker — the branch every browser without the File System
 * Access API takes, which is Firefox and Safari.
 *
 * `showOpenFilePicker` is absent from this environment, so calling
 * `openFilesWith` here lands on the `<input type="file">` path by itself, with
 * nothing stubbed. The promise it returns only settles on a user gesture, so
 * the input is inspected while it is still mounted and then cancelled.
 *
 * What is pinned is the `accept` filter, because a filter that names only MIME
 * types silently greys out every extension the OS has no type registered for —
 * `.bpmn`, `.mm`, `.opml` — and the file simply cannot be chosen. There is no
 * error to see: the dialog just refuses to let you click.
 */

/** The mounted picker's `accept`, and the cancel that lets the promise settle. */
function acceptOf(open: () => Promise<unknown>): string {
  const pending = open();
  const input = document.querySelector<HTMLInputElement>(
    '.affine-upload-input'
  );
  const accept = input?.accept ?? '';
  // `cancel` settles the promise; only the `change` path removes the element,
  // so the helper takes it away itself or the next call reads this one.
  input?.dispatchEvent(new Event('cancel'));
  input?.remove();
  void pending;
  return accept;
}

const acceptFor = (type: Parameters<typeof openFilesWith>[0]) =>
  acceptOf(() => openFilesWith(type, false));

const acceptForSpec = (spec: FilePickerSpec) =>
  acceptOf(() => openSingleFileWithSpec(spec));

describe('the fallback file picker filter', () => {
  it('offers both the MIME type and the extensions of a declared format', () => {
    // The filter an INTERCHANGE format builds, which is the only way a `.bpmn`
    // file is offered now: the table's `'Bpmn'` row is gone, because a format's
    // own `extensions` and `mime` are the one statement of what its files are
    // called (`docs/adr/0012`).
    //
    // Asserted on the MOUNTED input rather than on the argument, because the
    // failure this file exists to catch is a spec that reaches the picker and
    // is then dropped: a dialog with no filter at all looks fine in a
    // screenshot and greys out nothing, and every `.bpmn` on the disk stays
    // unpickable for the opposite reason. `expect(open).toHaveBeenCalledWith`
    // somewhere else cannot see that.
    const accept = acceptForSpec({
      description: 'BPMN',
      accept: { 'application/xml': ['.bpmn', '.xml'] },
    });
    expect(accept.split(',')).toEqual(['application/xml', '.bpmn', '.xml']);
  });

  it('names the extensions of every type that has some', () => {
    // The pre-existing hole this closes, and why it is not only BPMN's: a mind
    // map has no registered MIME type either, so `text/xml` alone made `.mm`
    // and `.opml` unpickable in exactly the same way.
    expect(acceptFor('MindMap').split(',')).toEqual([
      'text/xml',
      '.mm',
      '.opml',
      '.xml',
    ]);
    // …and the wildcard types still lead with the wildcard, which is what
    // actually does the work for an image or a video.
    expect(acceptFor('Images').startsWith('image/*,')).toBe(true);
  });

  it('filters nothing when the caller asked for anything', () => {
    expect(acceptFor('Any')).toBe('');
  });
});
