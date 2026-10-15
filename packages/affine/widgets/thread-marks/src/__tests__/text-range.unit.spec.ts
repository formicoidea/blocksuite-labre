/**
 * The text grain of the "has a thread" seam (ADR 0038, amendment of
 * 2026-10-15): a discussion anchored to a run of a block's text, held by two
 * Yjs relative positions the library encodes and the host stores as opaque
 * strings.
 *
 * ## What it would have caught
 *
 * - An anchor that does not come back to the same characters, or that does
 *   not follow edits made before, inside or after it, here or on a peer.
 * - Typing right after a run growing it (the end must stick to the last
 *   selected character).
 * - A deleted run, a forged string or another block's anchor throwing, or
 *   resolving to something: it must resolve to nothing, so only the block's
 *   mark stays.
 * - A highlight drawn, or a click answered, with no seam registered.
 * - ANY write to the document while encoding, resolving, quoting, offering
 *   "Discuss" or drawing: the anchor lives in the host, never in the
 *   content (the inline comment AFFiNE ships writes `comment-<id>` into the
 *   text, which is why it is not used).
 *
 * The widget's layout is stubbed (happy-dom lays nothing out): the rects come
 * from a fake `textSelectionToRange`, the rule under test is which runs are
 * drawn and what a click hands the host.
 */
import {
  type ThreadMark,
  ThreadMarksProvider,
  type ThreadMarksService,
  type ToolbarContext,
} from '@labre/affine-shared/services';
import { TextSelection } from '@labre/std';
import { signal } from '@preact/signals-core';
import { nothing, render } from 'lit';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { threadExcerpt } from '../excerpt.js';
import { encodeThreadRange, resolveThreadRange } from '../text-range.js';
import { openThreadOn, threadTargetOf } from '../toolbar.js';
import { ThreadMarksWidget } from '../widget.js';

const SENTENCE = 'Pick a vendor before Q3';

let doc: Y.Doc;
let updates: number;
const countUpdate = () => {
  updates++;
};

/** A block's text, attached to a document like a mounted paragraph's. */
function blockText(id: string, text: string, into: Y.Doc = doc): Y.Text {
  const yText = into.getMap(id).get('text') as Y.Text | undefined;
  if (yText) return yText;
  const created = new Y.Text(text);
  into.getMap(id).set('text', created);
  return created;
}

beforeEach(() => {
  doc = new Y.Doc();
  updates = 0;
});

afterEach(() => {
  doc.off('update', countUpdate);
});

/** From here on, any write to `doc` is counted. */
function watchWrites() {
  doc.on('update', countUpdate);
}

describe('encodeThreadRange / resolveThreadRange', () => {
  it('comes back to the same run, as two short opaque strings', () => {
    const text = blockText('b1', SENTENCE);
    watchWrites();
    const range = encodeThreadRange(text, 5, 8)!;
    expect(range.start).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(range.end).toMatch(/^[A-Za-z0-9+/]+=*$/);
    expect(resolveThreadRange(text, range)).toEqual({ index: 5, length: 8 });
    expect(text.toString().slice(5, 13)).toBe('a vendor');
    expect(updates).toBe(0);
  });

  it('refuses an empty run or one outside the text', () => {
    const text = blockText('b1', SENTENCE);
    expect(encodeThreadRange(text, 3, 0)).toBeNull();
    expect(encodeThreadRange(text, 20, 10)).toBeNull();
    expect(encodeThreadRange(text, -1, 2)).toBeNull();
  });

  it('follows edits before, inside and right after the run', () => {
    const text = blockText('b1', SENTENCE);
    const range = encodeThreadRange(text, 5, 8)!; // "a vendor"

    text.insert(0, '>> ');
    expect(resolveThreadRange(text, range)).toEqual({ index: 8, length: 8 });

    text.insert(10, 'big ');
    const inside = resolveThreadRange(text, range)!;
    expect(
      text.toString().slice(inside.index, inside.index + inside.length)
    ).toBe('a big vendor');

    // Typing right after the last selected character does not grow the run.
    text.insert(inside.index + inside.length, 's');
    expect(resolveThreadRange(text, range)).toEqual(inside);
  });

  it('follows the edits of another peer', () => {
    const text = blockText('b1', SENTENCE);
    const range = encodeThreadRange(text, 5, 8)!;

    const peer = new Y.Doc();
    Y.applyUpdate(peer, Y.encodeStateAsUpdate(doc));
    const peerText = blockText('b1', '', peer);
    peerText.insert(0, 'Q2: ');
    Y.applyUpdate(doc, Y.encodeStateAsUpdate(peer));

    expect(resolveThreadRange(text, range)).toEqual({ index: 9, length: 8 });
    expect(resolveThreadRange(peerText, range)).toEqual({
      index: 9,
      length: 8,
    });
  });

  it('resolves to nothing once the run is deleted, without throwing', () => {
    const text = blockText('b1', SENTENCE);
    const range = encodeThreadRange(text, 5, 8)!;
    text.delete(5, 8);
    expect(resolveThreadRange(text, range)).toBeNull();
  });

  it('resolves to nothing for a forged string or another block', () => {
    const text = blockText('b1', SENTENCE);
    const other = blockText('b2', 'Another paragraph');
    const range = encodeThreadRange(other, 0, 7)!;
    expect(resolveThreadRange(text, range)).toBeNull();
    expect(
      resolveThreadRange(text, { start: 'not base64 !', end: '%%' })
    ).toBeNull();
    expect(resolveThreadRange(text, { start: 'AAAA', end: 'AAAA' })).toBeNull();
    expect(resolveThreadRange(new Y.Text('detached'), range)).toBeNull();
  });
});

/** A paragraph model as the store hands it: a `Text` with its `yText`. */
const paragraph = (id: string, yText: Y.Text) => ({
  id,
  flavour: 'affine:paragraph',
  text: { yText, toString: () => yText.toString() },
  children: [],
});

function fakeStd(service: ThreadMarksService | null, models: object[]) {
  const byId = new Map(models.map(m => [(m as { id: string }).id, m]));
  const textSelectionToRange = vi.fn((selection: TextSelection) => {
    const { index } = selection.from;
    return {
      getClientRects: () => [new DOMRect(100 + index, 40, 60, 20)],
    } as unknown as Range;
  });
  return {
    getOptional: (identifier: unknown) =>
      identifier === ThreadMarksProvider ? service : null,
    store: {
      id: 'doc-1',
      getModelById: (id: string) => byId.get(id) ?? null,
    },
    selection: {
      create: (_type: unknown, init: object) => init as TextSelection,
    },
    range: { textSelectionToRange },
  };
}

function textContext(
  std: ReturnType<typeof fakeStd>,
  from: { blockId: string; index: number; length: number },
  to: { blockId: string; index: number; length: number } | null = null
) {
  return {
    std,
    store: std.store,
    hasSelectedSurfaceModels: false,
    getSurfaceModels: () => [],
    selection: {
      find: (type: unknown) => (type === TextSelection ? { from, to } : null),
      filter: () => [],
    },
    getCurrentModelBy: () => null,
  } as unknown as ToolbarContext;
}

const service = (marks: ThreadMark[] = []): ThreadMarksService => ({
  marks$: signal(marks),
  openThread: vi.fn(),
});

describe('"Discuss" on a text selection', () => {
  it('anchors to the selected run and quotes it, writing nothing', () => {
    const text = blockText('b1', SENTENCE);
    const seam = service();
    const std = fakeStd(seam, [paragraph('b1', text)]);
    watchWrites();

    const target = threadTargetOf(
      textContext(std, { blockId: 'b1', index: 5, length: 8 })
    )!;
    expect(target).toMatchObject({ targetType: 'block', targetId: 'b1' });
    expect(resolveThreadRange(text, target.range!)).toEqual({
      index: 5,
      length: 8,
    });

    openThreadOn(std as never, target);
    expect(seam.openThread).toHaveBeenCalledWith({
      docId: 'doc-1',
      targetType: 'block',
      targetId: 'b1',
      excerpt: 'a vendor',
      range: target.range,
    });
    expect(updates).toBe(0);
  });

  it('takes the first block of a selection over several', () => {
    const first = blockText('b1', SENTENCE);
    const second = blockText('b2', 'and sign in Q4');
    const std = fakeStd(service(), [
      paragraph('b1', first),
      paragraph('b2', second),
    ]);
    const target = threadTargetOf(
      textContext(
        std,
        { blockId: 'b1', index: 14, length: 9 },
        { blockId: 'b2', index: 0, length: 3 }
      )
    )!;
    expect(target.targetId).toBe('b1');
    expect(threadExcerpt(std as never, target)).toBe('before Q3');
  });

  it('a collapsed caret speaks for the block, with no range', () => {
    const text = blockText('b1', SENTENCE);
    const seam = service();
    const std = fakeStd(seam, [paragraph('b1', text)]);
    const target = threadTargetOf(
      textContext(std, { blockId: 'b1', index: 3, length: 0 })
    )!;
    openThreadOn(std as never, target);
    const request = vi.mocked(seam.openThread).mock.calls[0]![0];
    expect('range' in request).toBe(false);
    expect(request.excerpt).toBe(SENTENCE);
  });

  it('a range that no longer resolves quotes the whole block', () => {
    const text = blockText('b1', SENTENCE);
    const std = fakeStd(service(), [paragraph('b1', text)]);
    const range = encodeThreadRange(text, 5, 8)!;
    text.delete(5, 8);
    expect(
      threadExcerpt(std as never, {
        targetType: 'block',
        targetId: 'b1',
        range,
      })
    ).toBe('Pick before Q3');
  });
});

describe('the highlighted runs', () => {
  /** The widget's own methods over a fake editor in the page view. */
  function widget(seam: ThreadMarksService | null, models: object[]) {
    const std = fakeStd(seam, models);
    const proto = ThreadMarksWidget.prototype as unknown as Record<
      string,
      unknown
    >;
    const self: Record<string, unknown> = {
      std,
      _edgeless: false,
      getBoundingClientRect: () => new DOMRect(),
      _locate: () => ({ x: 0, y: 0, anchor: 'side' }),
    };
    for (const name of ['_resolve', '_ranges', '_openRangeAt']) {
      self[name] = (proto[name] as (...a: unknown[]) => unknown).bind(self);
    }
    const draw = () => {
      const container = document.createElement('div');
      render(
        ThreadMarksWidget.prototype.render.call(
          self as unknown as ThreadMarksWidget
        ),
        container
      );
      return container;
    };
    return { std, self, draw };
  }

  const mark = (range: ThreadMark['range']): ThreadMark => ({
    targetType: 'block',
    targetId: 'b1',
    count: 1,
    unread: false,
    range,
  });

  it('draws a resolvable run beside the block mark, writing nothing', () => {
    const text = blockText('b1', SENTENCE);
    const range = encodeThreadRange(text, 5, 8)!;
    const { std, draw } = widget(service([mark(range)]), [
      paragraph('b1', text),
    ]);
    watchWrites();
    const container = draw();
    const runs = container.querySelectorAll('[data-testid="thread-range"]');
    expect(runs).toHaveLength(1);
    expect(runs[0]!.getAttribute('data-target-id')).toBe('b1');
    expect(
      container.querySelectorAll('[data-testid="thread-mark"]')
    ).toHaveLength(1);
    expect(std.range.textSelectionToRange).toHaveBeenCalledWith(
      expect.objectContaining({
        from: { blockId: 'b1', index: 5, length: 8 },
      })
    );
    expect(updates).toBe(0);
  });

  it('draws no run once its text is deleted, and keeps the block mark', () => {
    const text = blockText('b1', SENTENCE);
    const range = encodeThreadRange(text, 5, 8)!;
    text.delete(5, 8);
    const { std, draw } = widget(service([mark(range)]), [
      paragraph('b1', text),
    ]);
    const container = draw();
    expect(
      container.querySelectorAll('[data-testid="thread-range"]')
    ).toHaveLength(0);
    expect(
      container.querySelectorAll('[data-testid="thread-mark"]')
    ).toHaveLength(1);
    expect(std.range.textSelectionToRange).not.toHaveBeenCalled();
  });

  it('draws no run on the canvas', () => {
    const text = blockText('b1', SENTENCE);
    const { self, draw } = widget(
      service([mark(encodeThreadRange(text, 5, 8)!)]),
      [paragraph('b1', text)]
    );
    self._edgeless = true;
    expect(
      draw().querySelectorAll('[data-testid="thread-range"]')
    ).toHaveLength(0);
  });

  it('a click on a run opens its discussion with the quote', () => {
    const text = blockText('b1', SENTENCE);
    const range = encodeThreadRange(text, 5, 8)!;
    const seam = service([mark(range)]);
    const { self } = widget(seam, [paragraph('b1', text)]);
    const openAt = self._openRangeAt as (x: number, y: number) => void;

    openAt(10, 10);
    expect(seam.openThread).not.toHaveBeenCalled();

    // The fake rect of a run at index 5 spans x 105..165, y 40..60.
    openAt(120, 50);
    expect(seam.openThread).toHaveBeenCalledWith({
      docId: 'doc-1',
      targetType: 'block',
      targetId: 'b1',
      excerpt: 'a vendor',
      range,
    });
  });

  it('without the seam, draws nothing and a click opens nothing', () => {
    const text = blockText('b1', SENTENCE);
    const { std, self } = widget(null, [paragraph('b1', text)]);
    expect(
      ThreadMarksWidget.prototype.render.call(
        self as unknown as ThreadMarksWidget
      )
    ).toBe(nothing);
    (self._openRangeAt as (x: number, y: number) => void)(120, 50);
    expect(std.range.textSelectionToRange).not.toHaveBeenCalled();
  });
});
