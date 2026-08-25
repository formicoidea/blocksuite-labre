import { expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { effects } from '../../effects.js';
import { InlineEditor } from '../../inline/index.js';

effects();

async function setupInlineEditor(text: string) {
  const yDoc = new Y.Doc();
  const yText = yDoc.getText('text');
  yText.insert(0, text);

  const editor = new InlineEditor(yText);
  const root = document.createElement('div');
  const outside = document.createElement('div');
  outside.textContent = 'outside';

  document.body.append(root, outside);
  editor.mount(root);
  await editor.waitForUpdate();

  return { editor, root, outside };
}

function setNativeSelection(range: Range) {
  const selection = document.getSelection();
  if (!selection) {
    throw new Error('Selection is not available');
  }
  selection.removeAllRanges();
  selection.addRange(range);
}

function teardownInlineEditor(
  ctx: Awaited<ReturnType<typeof setupInlineEditor>>
) {
  document.getSelection()?.removeAllRanges();
  ctx.editor.unmount();
  ctx.root.remove();
  ctx.outside.remove();
}

function createBeforeInputEvent(
  init: Pick<InputEvent, 'inputType' | 'data'> & {
    preventDefault: () => void;
    getTargetRanges: () => StaticRange[];
  }
) {
  return {
    dataTransfer: null,
    stopPropagation: vi.fn(),
    ...init,
  } as unknown as InputEvent;
}

test('beforeinput prevents native edits for a selection partially outside the inline root', async () => {
  const ctx = await setupInlineEditor('hello');
  try {
    const range = ctx.editor.toDomRange({ index: 1, length: 0 });
    expect(range).not.toBeNull();
    range!.setEnd(ctx.outside, 0);
    setNativeSelection(range!);

    const preventDefault = vi.fn();
    await (ctx.editor.eventService as any)._onBeforeInput(
      createBeforeInputEvent({
        inputType: 'deleteContentForward',
        data: null,
        preventDefault,
        getTargetRanges: () => [],
      })
    );

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(ctx.editor.yTextString).toBe('h');
  } finally {
    teardownInlineEditor(ctx);
  }
});

test('beforeinput does not intercept when the selection spans another inline root', async () => {
  const ctx1 = await setupInlineEditor('abc');
  const ctx2 = await setupInlineEditor('xyz');
  try {
    const startRange = ctx1.editor.toDomRange({ index: 1, length: 0 });
    const endRange = ctx2.editor.toDomRange({ index: 1, length: 0 });
    expect(startRange).not.toBeNull();
    expect(endRange).not.toBeNull();

    const selectionRange = document.createRange();
    selectionRange.setStart(
      startRange!.startContainer,
      startRange!.startOffset
    );
    selectionRange.setEnd(endRange!.endContainer, endRange!.endOffset);
    setNativeSelection(selectionRange);

    const preventDefault = vi.fn();
    await (ctx1.editor.eventService as any)._onBeforeInput(
      createBeforeInputEvent({
        inputType: 'deleteContentForward',
        data: null,
        preventDefault,
        getTargetRanges: () => [],
      })
    );

    expect(preventDefault).not.toHaveBeenCalled();
    expect(ctx1.editor.yTextString).toBe('abc');
  } finally {
    teardownInlineEditor(ctx1);
    teardownInlineEditor(ctx2);
  }
});

test('beforeinput ignores an un-resolvable target range and still applies the input', async () => {
  const ctx = await setupInlineEditor('hello world');
  try {
    const range = ctx.editor.toDomRange({ index: 0, length: 5 });
    expect(range).not.toBeNull();
    setNativeSelection(range!);

    const preventDefault = vi.fn();
    await (ctx.editor.eventService as any)._onBeforeInput(
      createBeforeInputEvent({
        inputType: 'insertText',
        data: 'x',
        preventDefault,
        getTargetRanges: () => [
          {
            startContainer: ctx.outside,
            startOffset: 0,
            endContainer: ctx.outside,
            endOffset: 0,
          } as unknown as StaticRange,
        ],
      })
    );

    expect(preventDefault).toHaveBeenCalledOnce();
    expect(ctx.editor.yTextString).toBe('x world');
  } finally {
    teardownInlineEditor(ctx);
  }
});
