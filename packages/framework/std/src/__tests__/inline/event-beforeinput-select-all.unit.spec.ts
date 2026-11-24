/**
 * Reproduction for issue #741 (upstream toeverything/AFFiNE#15858, commit
 * a2dbbec): in Firefox, after Ctrl/Cmd+A in the equation editor, typing or
 * Backspace does not replace the selected formula. Firefox reports the
 * `beforeinput` target range from the inline ROOT (`div[data-v-root]` at the
 * offset of the first `v-line`), not from the text node, and
 * `EventService._onBeforeInput` (`inline/services/event.ts`) lets any
 * resolvable target range override the native selection, so the input lands
 * at the wrong place.
 *
 * Only chromium runs here, so the Firefox target range is synthesised (the
 * same shape upstream used). The first two tests are the reproduction; the
 * others are guards the fix must keep green: a COLLAPSED selection still
 * takes its target range (word and character deletion depend on it, since
 * `handleDelete` of a collapsed range deletes nothing), a non-collapsed
 * selection whose target range equals it is replaced as before, and
 * `insertReplacementText` (spellcheck / autocorrect) keeps its target range
 * even over a wider selection, because Firefox fires it before selecting the
 * misspelled word.
 */
import { expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { effects } from '../../effects.js';
import { InlineEditor } from '../../inline/index.js';

effects();

const FORMULA = 'a+b=c';
const SENTENCE = 'hello world';
const WORD = 'world';

type Ctx = Awaited<ReturnType<typeof setupInlineEditor>>;
type WithBeforeInput = { _onBeforeInput(event: InputEvent): Promise<void> };

async function setupInlineEditor(text: string) {
  const yDoc = new Y.Doc();
  const yText = yDoc.getText('text');
  yText.insert(0, text);

  const editor = new InlineEditor(yText);
  const root = document.createElement('div');
  document.body.append(root);
  editor.mount(root);
  await editor.waitForUpdate();

  return { editor, root };
}

function teardownInlineEditor(ctx: Ctx) {
  document.getSelection()?.removeAllRanges();
  ctx.editor.unmount();
  ctx.root.remove();
}

function select(ctx: Ctx, index: number, length: number) {
  const range = ctx.editor.toDomRange({ index, length });
  if (!range) throw new Error('range not resolvable');
  const selection = document.getSelection();
  if (!selection) throw new Error('Selection is not available');
  selection.removeAllRanges();
  selection.addRange(range);
  return range;
}

/** The target range Firefox reports for a select-all: from the inline root. */
function firefoxSelectAllTarget(ctx: Ctx, selected: Range) {
  const line = ctx.root.querySelector('v-line')!;
  const lineOffset = Array.from(ctx.root.childNodes).indexOf(line);
  return {
    startContainer: ctx.root,
    startOffset: lineOffset,
    endContainer: selected.endContainer,
    endOffset: selected.endOffset,
  } as unknown as StaticRange;
}

function beforeInput(
  inputType: string,
  data: string | null,
  target: StaticRange | Range
) {
  return {
    inputType,
    data,
    dataTransfer: null,
    preventDefault: vi.fn(),
    stopPropagation: vi.fn(),
    getTargetRanges: () => [target],
  } as unknown as InputEvent;
}

async function fire(ctx: Ctx, event: InputEvent) {
  await (ctx.editor.eventService as unknown as WithBeforeInput)._onBeforeInput(
    event
  );
}

test('typing over a select-all replaces it when the target range starts at the inline root (Firefox)', async () => {
  const ctx = await setupInlineEditor(FORMULA);
  try {
    const range = select(ctx, 0, FORMULA.length);

    await fire(
      ctx,
      beforeInput('insertText', 'x', firefoxSelectAllTarget(ctx, range))
    );

    expect(ctx.editor.yTextString).toBe('x');
  } finally {
    teardownInlineEditor(ctx);
  }
});

test('Backspace over a select-all clears it when the target range starts at the inline root (Firefox)', async () => {
  const ctx = await setupInlineEditor(FORMULA);
  try {
    const range = select(ctx, 0, FORMULA.length);

    await fire(
      ctx,
      beforeInput(
        'deleteContentBackward',
        null,
        firefoxSelectAllTarget(ctx, range)
      )
    );

    expect(ctx.editor.yTextString).toBe('');
  } finally {
    teardownInlineEditor(ctx);
  }
});

test('guard: a collapsed caret still deletes the word its target range covers', async () => {
  const ctx = await setupInlineEditor(SENTENCE);
  try {
    select(ctx, SENTENCE.length, 0);
    const word = ctx.editor.toDomRange({
      index: SENTENCE.indexOf(WORD),
      length: WORD.length,
    })!;

    await fire(ctx, beforeInput('deleteWordBackward', null, word));

    expect(ctx.editor.yTextString).toBe(SENTENCE.slice(0, -WORD.length));
  } finally {
    teardownInlineEditor(ctx);
  }
});

test('guard: a collapsed caret still deletes the character its target range covers', async () => {
  const ctx = await setupInlineEditor(SENTENCE);
  try {
    select(ctx, SENTENCE.length, 0);
    const lastChar = ctx.editor.toDomRange({
      index: SENTENCE.length - 1,
      length: 1,
    })!;

    await fire(ctx, beforeInput('deleteContentBackward', null, lastChar));

    expect(ctx.editor.yTextString).toBe(SENTENCE.slice(0, -1));
  } finally {
    teardownInlineEditor(ctx);
  }
});

test('guard: insertReplacementText with a collapsed caret still uses its target range', async () => {
  const typo = 'hello wrold';
  const ctx = await setupInlineEditor(typo);
  try {
    // Spellcheck / autocorrect: the caret sits after the word, the target
    // range covers the misspelled word.
    select(ctx, typo.length, 0);
    const word = ctx.editor.toDomRange({
      index: typo.indexOf(' ') + 1,
      length: WORD.length,
    })!;

    await fire(ctx, beforeInput('insertReplacementText', WORD, word));

    expect(ctx.editor.yTextString).toBe(SENTENCE);
  } finally {
    teardownInlineEditor(ctx);
  }
});

test('guard: insertReplacementText replaces only its target word while a wider selection exists (Firefox spellcheck)', async () => {
  const typo = 'hello wrold';
  const ctx = await setupInlineEditor(typo);
  try {
    // Firefox fires the spellcheck replacement with the misspelled word as
    // target range before it selects that word: the selection is still the
    // one the user made, here the whole text.
    select(ctx, 0, typo.length);
    const word = ctx.editor.toDomRange({
      index: typo.indexOf(' ') + 1,
      length: WORD.length,
    })!;

    await fire(ctx, beforeInput('insertReplacementText', WORD, word));

    expect(ctx.editor.yTextString).toBe(SENTENCE);
  } finally {
    teardownInlineEditor(ctx);
  }
});

test('guard: a non-collapsed selection whose target range equals it is replaced (Chromium)', async () => {
  const ctx = await setupInlineEditor(SENTENCE);
  try {
    const range = select(ctx, 0, SENTENCE.indexOf(' '));

    await fire(ctx, beforeInput('insertText', 'x', range.cloneRange()));

    expect(ctx.editor.yTextString).toBe('x world');
  } finally {
    teardownInlineEditor(ctx);
  }
});
