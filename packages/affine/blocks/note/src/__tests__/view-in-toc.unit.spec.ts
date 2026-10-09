import { NoteDisplayMode } from '@labre/affine-model';
import { OutlinePanelProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { displayModeToast } from '../configs/toolbar.js';

/**
 * The note toast's "View in TOC" link, and the sentence that announces it,
 * are offered only when the host draws an outline (ADR 0034 §1).
 *
 * Its seam used to be the `open(tabId?)` one inherited from AFFiNE, read with
 * `getOptional(...)?.open('outline')` INSIDE the click handler: the link was
 * always shown, and a host with no such panel got a link that did nothing.
 * The first host on the replacement (the playground, #478) then found the
 * body still saying "Find it in the TOC for quick navigation." once the link
 * was gone. This spec pins all three: no provider (or `null`), no link and no
 * TOC sentence; a provider, both, and a link that opens it and nothing else.
 */

function fakeStd(outline: unknown): BlockStdScope {
  return {
    getOptional: (id: unknown) =>
      id === OutlinePanelProvider ? (outline ?? null) : null,
  } as unknown as BlockStdScope;
}

const MODES = [NoteDisplayMode.EdgelessOnly, NoteDisplayMode.DocAndEdgeless];

describe('the note display-mode toast', () => {
  it('offers no link and names no TOC when the host has no outline panel', () => {
    for (const outline of [undefined, null]) {
      for (const mode of MODES) {
        const toast = displayModeToast(fakeStd(outline), mode);
        expect(toast.actions, mode).toEqual([]);
        expect(toast.message, mode).not.toMatch(/TOC/);
      }
    }
    expect(
      displayModeToast(fakeStd(null), NoteDisplayMode.EdgelessOnly).message
    ).toBe('Content removed from your document.');
    expect(
      displayModeToast(fakeStd(null), NoteDisplayMode.DocAndEdgeless).message
    ).toBe('Content added to your document.');
  });

  it("names the TOC and links to the host's outline panel, and only that", () => {
    const outline = { open: vi.fn(), close: vi.fn() };

    for (const mode of MODES) {
      const toast = displayModeToast(fakeStd(outline), mode);
      expect(toast.message, mode).toMatch(
        /Find it in the TOC for quick navigation\.$/
      );
      expect(toast.actions.map(action => action.key)).toEqual(['view-in-toc']);
      expect(toast.actions[0].label).toBe('View in Toc');
    }

    displayModeToast(fakeStd(outline), MODES[0]).actions[0].onClick();
    expect(outline.open).toHaveBeenCalledTimes(1);
    expect(outline.close).not.toHaveBeenCalled();
  });
});
