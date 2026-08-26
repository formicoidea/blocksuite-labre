/**
 * Editing inside a callout — upstream #13597.
 *
 * Three things were broken at once, and all three came from the callout being
 * a hub whose children the surrounding keymaps deliberately refuse to touch:
 *
 * - Backspace at the start of a paragraph never merged it into the line above,
 *   it only selected the whole callout.
 * - Enter did nothing at all: the paragraph keymap steps aside for a callout
 *   child, and nothing took over.
 * - The slash menu refused to OPEN anywhere inside a callout, because the
 *   widget ORs every config's `disableWhen` together before deciding.
 *
 * The commands are exercised against a REAL store: what has to be true is the
 * shape of the tree afterwards — which block still exists, which text it holds,
 * and where the caret was asked to go.
 */
import {
  CalloutBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
  type CalloutBlockModel,
  type ParagraphBlockModel,
} from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { TextSelection } from '@labre/std';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it } from 'vitest';

import { calloutToParagraphCommand } from '../commands/callout-to-paragraph.js';
import { splitCalloutCommand } from '../commands/split-callout.js';
import { calloutSlashMenuConfig } from '../configs/slash-menu.js';

let seq = 0;

/** What the last `setGroup` asked for, flattened to something assertable. */
type CapturedSelection =
  | { kind: 'text'; blockId: string; index: number }
  | { kind: 'block'; blockId: string };

/** A note holding one callout, itself holding `lines` paragraphs. */
function authorCallout(lines: string[]) {
  const collection = new TestWorkspace({ id: `callout-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    CalloutBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
  ];
  collection.meta.initialize();

  const store = collection.createDoc().getStore();
  let calloutId = '';
  let outsideId = '';
  const paragraphIds: string[] = [];
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('') });
    const noteId = store.addBlock('affine:note', {}, rootId);
    calloutId = store.addBlock('affine:callout', {}, noteId);
    for (const line of lines) {
      paragraphIds.push(
        store.addBlock('affine:paragraph', { text: new Text(line) }, calloutId)
      );
    }
    // A plain paragraph of the note, next to the callout rather than in it.
    outsideId = store.addBlock('affine:paragraph', {}, noteId);
  });

  const selections: CapturedSelection[] = [];
  const std = {
    store,
    event: { active: false },
    selection: {
      create: (ctor: unknown, props: Record<string, unknown>) =>
        ctor === TextSelection
          ? {
              kind: 'text',
              blockId: (props.from as { blockId: string }).blockId,
              index: (props.from as { index: number }).index,
            }
          : { kind: 'block', blockId: props.blockId as string },
      setGroup: (_group: string, next: CapturedSelection[]) => {
        selections.length = 0;
        selections.push(...next);
      },
    },
  } as unknown as BlockStdScope;

  const callout = () => store.getBlock(calloutId)!.model as CalloutBlockModel;
  const paragraphOf = (id: string) =>
    store.getBlock(id)?.model as ParagraphBlockModel | undefined;
  const linesNow = () =>
    callout().children.map(child => (child as ParagraphBlockModel).props.text.toString());

  return {
    store,
    std,
    calloutId,
    outsideId,
    paragraphIds,
    callout,
    paragraphOf,
    linesNow,
    lastSelection: () => selections.at(-1),
  };
}

describe('Backspace at the start of a callout paragraph', () => {
  it('merges the line into the previous one and puts the caret at the seam', () => {
    const { std, paragraphIds, paragraphOf, linesNow, lastSelection } =
      authorCallout(['first', 'second']);
    const [first, second] = paragraphIds;

    calloutToParagraphCommand({ std, id: second } as never, () => {});

    expect(linesNow()).toEqual(['firstsecond']);
    expect(paragraphOf(second)).toBeUndefined();
    // The caret lands where the two lines meet, not at the start.
    expect(lastSelection()).toEqual({
      kind: 'text',
      blockId: first,
      index: 'first'.length,
    });
  });

  it('selects the callout on the first line, without deleting anything', () => {
    const { std, calloutId, paragraphIds, linesNow, lastSelection } =
      authorCallout(['only line']);

    calloutToParagraphCommand({ std, id: paragraphIds[0] } as never, () => {});

    // Nothing to merge into: the text must survive so the next Backspace can
    // delete the selected callout as one deliberate step.
    expect(linesNow()).toEqual(['only line']);
    expect(lastSelection()).toEqual({ kind: 'block', blockId: calloutId });
  });
});

describe('Enter inside a callout', () => {
  it('breaks the line in two without leaving the callout', () => {
    const { std, calloutId, paragraphIds, callout, linesNow, lastSelection } =
      authorCallout(['abcdef']);

    splitCalloutCommand(
      {
        std,
        calloutId,
        currentBlockId: paragraphIds[0],
        inlineIndex: 3,
      } as never,
      () => {}
    );

    expect(linesNow()).toEqual(['abc', 'def']);
    expect(callout().children).toHaveLength(2);
    expect(lastSelection()).toEqual({
      kind: 'text',
      blockId: callout().children[1].id,
      index: 0,
    });
  });

  it('opens an empty line when pressed at the end', () => {
    const { std, calloutId, paragraphIds, callout, linesNow } = authorCallout([
      'done',
    ]);

    splitCalloutCommand(
      {
        std,
        calloutId,
        currentBlockId: paragraphIds[0],
        inlineIndex: 4,
      } as never,
      () => {}
    );

    expect(linesNow()).toEqual(['done', '']);
    expect(
      (callout().children[1] as ParagraphBlockModel).props.type
    ).toBe('text');
  });

  it('gives an empty callout its first paragraph', () => {
    const { std, calloutId, callout } = authorCallout([]);

    splitCalloutCommand(
      { std, calloutId, currentBlockId: calloutId, inlineIndex: 0 } as never,
      () => {}
    );

    expect(callout().children).toHaveLength(1);
    expect(callout().children[0].flavour).toBe('affine:paragraph');
  });
});

describe('the callout slash menu config', () => {
  it('never disables the slash menu as a whole', () => {
    // `disableWhen` is ORed across every config, so any value here silences the
    // WHOLE menu — every block and every framework — inside a callout.
    expect(calloutSlashMenuConfig.disableWhen).toBeUndefined();
  });

  it('still hides its own item inside a callout, which the schema forbids', () => {
    const { store, outsideId, paragraphIds } = authorCallout(['inside']);
    const items = calloutSlashMenuConfig.items;
    const item = (Array.isArray(items) ? items : [])[0];
    const std = { get: () => ({ getFlag: () => true }) } as never;

    const inside = store.getBlock(paragraphIds[0])!.model;
    const outside = store.getBlock(outsideId)!.model;

    expect(item.when?.({ std, model: inside } as never)).toBe(false);
    expect(item.when?.({ std, model: outside } as never)).toBe(true);
  });
});
