/**
 * The editor's foreign-drag handler (`FileDropExtension`) asks the host's
 * `PageDropProvider` before it accepts a drag (labre P7): a page the host
 * refuses here draws no drop line and is not accepted, so the browser shows
 * its no-drop cursor and fires no drop.
 *
 * What it would have caught:
 * - a refused page (a cycle, a base in a base, a read-only page) still drawn
 *   with a drop line, or still droppable;
 * - an accepted page whose drag allows 'move' only, left on the browser's
 *   default effect, so the drop never fires;
 * - any change for a drag the host ignores, or with no host at all (the file
 *   drop and every foreign drag behave as before).
 */
import { PageDropProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { DropIndicator } from '../drop-indicator/drop-indicator';
import { FileDropExtension } from '../drop-indicator/file-drop-manager';

customElements.define('affine-drop-indicator', DropIndicator);

function extensionFor(
  verdict?: 'ignore' | 'refuse' | 'accept',
  readonly = false
) {
  const providers = new Map<unknown, unknown>();
  if (verdict) providers.set(PageDropProvider, { verdict: () => verdict });
  const std = {
    store: { id: 'open-page', readonly },
    getOptional: (id: unknown) => providers.get(id) ?? null,
  } as unknown as BlockStdScope;
  return new FileDropExtension(std);
}

function dragOver() {
  const dataTransfer = { types: ['application/x-host-page'], dropEffect: '' };
  const preventDefault = vi.fn();
  const event = {
    dataTransfer,
    preventDefault,
    clientX: 10,
    clientY: 20,
  } as unknown as DragEvent;
  return { event, dataTransfer, preventDefault };
}

describe('FileDropExtension and the page-drop verdict', () => {
  it('refuses a page the host refuses: no line, no drop', () => {
    const extension = extensionFor('refuse');
    const { event, dataTransfer, preventDefault } = dragOver();

    extension.onDragOver(event);

    expect(preventDefault).not.toHaveBeenCalled();
    expect(dataTransfer.dropEffect).toBe('none');
    expect(extension.point$.peek()).toBeNull();
  });

  it('refuses any page of the host on a read-only document', () => {
    const extension = extensionFor('accept', true);
    const { event, preventDefault } = dragOver();

    extension.onDragOver(event);

    expect(preventDefault).not.toHaveBeenCalled();
  });

  it('accepts a page the host accepts, as a move, with its drop line', () => {
    const extension = extensionFor('accept');
    const { event, dataTransfer, preventDefault } = dragOver();

    extension.onDragOver(event);

    expect(preventDefault).toHaveBeenCalled();
    expect(dataTransfer.dropEffect).toBe('move');
    expect(extension.point$.peek()?.x).toBe(10);
  });

  it('leaves a drag as before without a host, or when the host ignores it', () => {
    for (const extension of [extensionFor(), extensionFor('ignore')]) {
      const { event, dataTransfer, preventDefault } = dragOver();

      extension.onDragOver(event);

      expect(preventDefault).toHaveBeenCalled();
      expect(dataTransfer.dropEffect).toBe('');
      expect(extension.point$.peek()?.y).toBe(20);
    }
  });
});
