import { OutlinePanelProvider } from '@labre/affine-shared/services';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it, vi } from 'vitest';

import { viewInTocActions } from '../configs/toolbar.js';

/**
 * The note toast's "View in TOC" link is offered only when the host draws an
 * outline (ADR 0034 §1).
 *
 * Its seam used to be the `open(tabId?)` one inherited from AFFiNE, read with
 * `getOptional(...)?.open('outline')` INSIDE the click handler: the link was
 * always shown, and a host with no such panel got a link that did nothing.
 * This spec pins both halves of the replacement: no provider (or `null`), no
 * link; a provider, a link that opens it and nothing else.
 */

function fakeStd(outline: unknown): BlockStdScope {
  return {
    getOptional: (id: unknown) =>
      id === OutlinePanelProvider ? (outline ?? null) : null,
  } as unknown as BlockStdScope;
}

describe('the note toast "View in TOC" link', () => {
  it('is not offered when the host registered no outline panel', () => {
    expect(viewInTocActions(fakeStd(undefined))).toEqual([]);
    expect(viewInTocActions(fakeStd(null))).toEqual([]);
  });

  it("opens the host's outline panel, and only that", () => {
    const outline = { open: vi.fn(), close: vi.fn() };
    const actions = viewInTocActions(fakeStd(outline));

    expect(actions.map(action => action.key)).toEqual(['view-in-toc']);
    expect(actions[0].label).toBe('View in Toc');

    actions[0].onClick();
    expect(outline.open).toHaveBeenCalledTimes(1);
    expect(outline.close).not.toHaveBeenCalled();
  });
});
