import { describe, expect, it } from 'vitest';

import { openFilesWith } from '../../utils/file/filesys.js';

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
function acceptFor(type: Parameters<typeof openFilesWith>[0]): string {
  const pending = openFilesWith(type, false);
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

describe('the fallback file picker filter', () => {
  it('offers both the MIME type and the extensions of a BPMN file', () => {
    const accept = acceptFor('Bpmn');
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
