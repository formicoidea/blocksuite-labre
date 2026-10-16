/**
 * The "has a thread" seam, view side (ADR 0038): the marks widget and the
 * "Discuss" toolbar action, against a fake host.
 *
 * ## What it would have caught
 *
 * - A mark or a "Discuss" button drawn with no seam registered: a button that
 *   opens nothing (the "mounts without provider" half of the seams table).
 * - A mark drawn for an id the editor cannot find (an orphan anchor, an
 *   element of the other view), or for a target at `count: 0`.
 * - An excerpt longer than the 280 characters the host stores, or one cut
 *   inside an emoji.
 * - A mark on a run of text that opened a draft instead of its discussion:
 *   the click handed the host the block without the run (0.53.0). A mark
 *   standing for several discussions of one block opens the block.
 * - A "Discuss" that speaks for several targets: a discussion anchors to one
 *   block or one element (a text selection over several blocks speaks for
 *   the first one).
 *
 * The widget's DOM geometry is not exercised here (happy-dom lays nothing
 * out): `placeThreadMarks` is the rule, `_locate` is stubbed.
 */
import {
  THREAD_EXCERPT_MAX,
  type ThreadMark,
  ThreadMarksProvider,
  type ThreadMarksService,
  type ToolbarContext,
} from '@labre/affine-shared/services';
import { BlockSelection, TextSelection } from '@labre/std';
import { signal } from '@preact/signals-core';
import { nothing, render } from 'lit';
import { describe, expect, it, vi } from 'vitest';

import { truncateThreadExcerpt } from '../excerpt.js';
import {
  THREAD_DISCUSS_ACTION_ID,
  threadDiscussToolbarConfig,
  threadTargetOf,
} from '../toolbar.js';
import { placeThreadMarks, ThreadMarksWidget } from '../widget.js';

const mark = (
  targetId: string,
  over: Partial<ThreadMark> = {}
): ThreadMark => ({
  targetType: 'block',
  targetId,
  count: 1,
  unread: false,
  ...over,
});

function fakeService(marks: ThreadMark[] = []): ThreadMarksService {
  return { marks$: signal(marks), openThread: vi.fn() };
}

/** A paragraph-like model: own text, no children. */
const paragraph = (id: string, text: string) => ({
  id,
  flavour: 'affine:paragraph',
  text: { toString: () => text },
  children: [],
});

function fakeStd(service: ThreadMarksService | null, models: object[] = []) {
  const byId = new Map(models.map(m => [(m as { id: string }).id, m]));
  return {
    getOptional: (identifier: unknown) =>
      identifier === ThreadMarksProvider ? service : null,
    store: {
      id: 'doc-1',
      getModelById: (id: string) => byId.get(id) ?? null,
      getBlocksByFlavour: () => [],
    },
  };
}

/** A toolbar context whose selection is one block, or what `over` says. */
function fakeContext(
  std: ReturnType<typeof fakeStd>,
  over: {
    surface?: { id: string }[];
    text?: { from: string; to?: string };
    blocks?: string[];
  } = {}
) {
  const blocks = over.blocks ?? [];
  return {
    std,
    store: std.store,
    hasSelectedSurfaceModels: Boolean(over.surface),
    getSurfaceModels: () => over.surface ?? [],
    selection: {
      find: (type: unknown) =>
        type === TextSelection && over.text
          ? {
              from: { blockId: over.text.from },
              to: over.text.to ? { blockId: over.text.to } : null,
            }
          : null,
      filter: (type: unknown) =>
        type === BlockSelection ? blocks.map(blockId => ({ blockId })) : [],
    },
    getCurrentModelBy: () =>
      blocks.length === 1 ? std.store.getModelById(blocks[0]!) : null,
  } as unknown as ToolbarContext;
}

const when = (ctx: ToolbarContext) =>
  typeof threadDiscussToolbarConfig.when === 'function' &&
  threadDiscussToolbarConfig.when(ctx);

describe('truncateThreadExcerpt', () => {
  it('collapses whitespace and keeps a short text whole', () => {
    expect(truncateThreadExcerpt('  Hello \n\t world  ')).toBe('Hello world');
  });

  it('cuts a long text to 280 code points, the ellipsis included', () => {
    const cut = truncateThreadExcerpt('a'.repeat(1000));
    expect(Array.from(cut)).toHaveLength(THREAD_EXCERPT_MAX);
    expect(cut.endsWith('…')).toBe(true);
  });

  it('never cuts an emoji in half', () => {
    const cut = truncateThreadExcerpt('\u{1F600}'.repeat(400));
    expect(Array.from(cut)).toHaveLength(THREAD_EXCERPT_MAX);
    expect(cut).not.toMatch(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/);
  });
});

describe('placeThreadMarks', () => {
  const locate = (m: ThreadMark) =>
    m.targetId === 'gone' ? null : { x: 1, y: 2, anchor: 'side' as const };

  it('ignores a target the editor cannot find, and a count of zero', () => {
    const placed = placeThreadMarks(
      [mark('b1'), mark('gone'), mark('b2', { count: 0 })],
      locate
    );
    expect(placed.map(p => p.mark.targetId)).toEqual(['b1']);
  });

  it('draws one mark per target: counts add up, unread wins', () => {
    const placed = placeThreadMarks(
      [mark('b1', { count: 2 }), mark('b1', { count: 1, unread: true })],
      locate
    );
    expect(placed).toHaveLength(1);
    expect(placed[0]!.mark).toMatchObject({ count: 3, unread: true });
  });

  it('keeps the run of text only when every merged mark names it', () => {
    const run = { start: 'cw==', end: 'dA==' };
    const other = { start: 'eA==', end: 'eQ==' };
    expect(
      placeThreadMarks([mark('b1', { range: run })], locate)[0]!.mark.range
    ).toEqual(run);
    expect(
      placeThreadMarks(
        [mark('b1', { range: run }), mark('b1', { range: run })],
        locate
      )[0]!.mark.range
    ).toEqual(run);
    expect(
      placeThreadMarks(
        [mark('b1', { range: run }), mark('b1', { range: other })],
        locate
      )[0]!.mark.range
    ).toBeUndefined();
    expect(
      placeThreadMarks([mark('b1', { range: run }), mark('b1')], locate)[0]!
        .mark.range
    ).toBeUndefined();
  });

  it('tells a block from an element of the same id', () => {
    const placed = placeThreadMarks(
      [mark('x'), mark('x', { targetType: 'element' })],
      locate
    );
    expect(placed).toHaveLength(2);
  });
});

describe('the marks widget', () => {
  function renderWidget(
    service: ThreadMarksService | null,
    models: object[] = []
  ) {
    const std = fakeStd(service, models);
    const self = {
      std,
      getBoundingClientRect: () => new DOMRect(),
      _locate: (m: ThreadMark) =>
        m.targetId === 'gone' ? null : { x: 10, y: 20, anchor: 'side' },
      _ranges: () => [],
    };
    const result = ThreadMarksWidget.prototype.render.call(
      self as unknown as ThreadMarksWidget
    );
    const container = document.createElement('div');
    render(result, container);
    return { result, container };
  }

  it('mounts without a provider and draws nothing', () => {
    expect(renderWidget(null).result).toBe(nothing);
  });

  it('draws one mark per target found, and none for the rest', () => {
    const service = fakeService([
      mark('b1', { count: 3, unread: true }),
      mark('gone'),
    ]);
    const { container } = renderWidget(service);
    const drawn = container.querySelectorAll('[data-testid="thread-mark"]');
    expect(drawn).toHaveLength(1);
    expect(drawn[0]!.getAttribute('data-target-id')).toBe('b1');
    expect(drawn[0]!.hasAttribute('data-unread')).toBe(true);
    expect(drawn[0]!.getAttribute('aria-label')).toBe('Discuss');
  });

  it('opens the discussion of a run of text on click, with its run', () => {
    const run = { start: 'cw==', end: 'dA==' };
    const service = fakeService([mark('b1', { range: run })]);
    const { container } = renderWidget(service, [
      paragraph('b1', 'Pick a vendor'),
    ]);
    container
      .querySelector<HTMLElement>('[data-testid="thread-mark"]')!
      .click();
    expect(service.openThread).toHaveBeenCalledWith(
      expect.objectContaining({ targetId: 'b1', range: run })
    );
  });

  it('opens the thread of a mark on click, with its excerpt', () => {
    const service = fakeService([mark('b1')]);
    const { container } = renderWidget(service, [
      paragraph('b1', 'Pick a vendor'),
    ]);
    container
      .querySelector<HTMLElement>('[data-testid="thread-mark"]')!
      .click();
    expect(service.openThread).toHaveBeenCalledWith({
      docId: 'doc-1',
      targetType: 'block',
      targetId: 'b1',
      excerpt: 'Pick a vendor',
    });
  });
});

describe('"Discuss" in the toolbar', () => {
  it('is not offered without a provider', () => {
    const std = fakeStd(null, [paragraph('b1', 'text')]);
    expect(when(fakeContext(std, { blocks: ['b1'] }))).toBe(false);
  });

  it('is offered for one block, and opens its thread with the excerpt', () => {
    const service = fakeService();
    const long = 'word '.repeat(200);
    const std = fakeStd(service, [paragraph('b1', long)]);
    const ctx = fakeContext(std, { blocks: ['b1'] });
    expect(when(ctx)).toBe(true);

    const action = threadDiscussToolbarConfig.actions.find(
      a => a.id === THREAD_DISCUSS_ACTION_ID
    )!;
    action.run(ctx);
    const request = vi.mocked(service.openThread).mock.calls[0]![0];
    expect(request).toMatchObject({
      docId: 'doc-1',
      targetType: 'block',
      targetId: 'b1',
    });
    expect(Array.from(request.excerpt)).toHaveLength(THREAD_EXCERPT_MAX);
  });

  it('speaks for one target only', () => {
    const std = fakeStd(fakeService(), [
      paragraph('b1', 'one'),
      paragraph('b2', 'two'),
    ]);
    expect(threadTargetOf(fakeContext(std, { blocks: ['b1', 'b2'] }))).toBe(
      null
    );
    // A text selection over several blocks anchors to the first one (ADR
    // 0038, amendment of 2026-10-15); these fakes carry no Y.Text, so no run.
    expect(
      threadTargetOf(fakeContext(std, { text: { from: 'b1', to: 'b2' } }))
    ).toEqual({ targetType: 'block', targetId: 'b1' });
    expect(threadTargetOf(fakeContext(std, { text: { from: 'b2' } }))).toEqual({
      targetType: 'block',
      targetId: 'b2',
    });
    expect(
      threadTargetOf(fakeContext(std, { surface: [{ id: 'a' }, { id: 'b' }] }))
    ).toBe(null);
  });

  it('never anchors to the page itself', () => {
    const std = fakeStd(fakeService(), [
      { id: 'root', flavour: 'affine:page', children: [] },
    ]);
    expect(threadTargetOf(fakeContext(std, { blocks: ['root'] }))).toBe(null);
  });
});
