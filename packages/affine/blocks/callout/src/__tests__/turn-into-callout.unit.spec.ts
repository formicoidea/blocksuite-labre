/**
 * "Turn into → Callout" (issue #418, upstream AFFiNE #15508).
 *
 * A callout is a HUB: it has no text of its own and renders only its children,
 * so converting a paragraph into one cannot go through `transformModel` (which
 * hands the source's text to the new block). The conversion WRAPS instead: a
 * callout takes the block's place and a paragraph inside it takes the text,
 * while the source's own children move under that paragraph.
 *
 * What has to hold is the shape of the tree afterwards — and, when a step
 * fails, that nothing was lost — so the command runs against a REAL store.
 *
 * The two entries that offer a callout — "Turn into" and the slash menu — are
 * pinned here too: they answer to the `callout` block flag alone, never to the
 * deprecated `enable_callout` feature flag.
 */
import {
  CalloutBlockSchemaExtension,
  CodeBlockSchemaExtension,
  ListBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { TextSelection } from '@labre/std';
import { type BlockModel, Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import type { SlashMenuItem } from '@labre/affine-widget-slash-menu';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { turnIntoCalloutCommand } from '../commands/turn-into-callout.js';
import { calloutSlashMenuConfig } from '../configs/slash-menu.js';
import { calloutTurnIntoEntry } from '../configs/turn-into.js';

let seq = 0;

/**
 * A note holding, in order: a paragraph with one nested paragraph, a bulleted
 * list item, a code block, and a callout with a paragraph inside it.
 */
function authorNote() {
  const workspace = new TestWorkspace({ id: `turn-into-callout-${seq++}` });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    CalloutBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
    ListBlockSchemaExtension,
    CodeBlockSchemaExtension,
  ];
  workspace.meta.initialize();

  const store = workspace.createDoc().getStore();
  const ids = {
    note: '',
    paragraph: '',
    nested: '',
    list: '',
    code: '',
    callout: '',
    insideCallout: '',
  };
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('') });
    ids.note = store.addBlock('affine:note', {}, rootId);
    ids.paragraph = store.addBlock(
      'affine:paragraph',
      { text: new Text('plain') },
      ids.note
    );
    ids.nested = store.addBlock(
      'affine:paragraph',
      { text: new Text('nested') },
      ids.paragraph
    );
    ids.list = store.addBlock(
      'affine:list',
      { type: 'bulleted', text: new Text('item') },
      ids.note
    );
    ids.code = store.addBlock(
      'affine:code',
      { text: new Text('const a = 1;') },
      ids.note
    );
    ids.callout = store.addBlock('affine:callout', {}, ids.note);
    ids.insideCallout = store.addBlock(
      'affine:paragraph',
      { text: new Text('already in') },
      ids.callout
    );
  });

  const carets: { blockId: string; index: number }[] = [];
  const std = {
    store,
    event: { active: false },
    get: () => ({ getFlag: () => true }),
    selection: {
      create: (ctor: unknown, props: Record<string, unknown>) =>
        ctor === TextSelection ? props.from : null,
      setGroup: (_group: string, next: { blockId: string; index: number }[]) =>
        carets.push(...next),
    },
  } as unknown as BlockStdScope;

  const model = (id: string) => store.getModelById(id)!;
  /** The note's children, flattened to `flavour:text` with nested children. */
  const describeTree = (block: BlockModel = model(ids.note)): unknown[] =>
    block.children.map(child =>
      child.children.length > 0
        ? {
            [`${child.flavour}:${child.text?.toString() ?? ''}`]:
              describeTree(child),
          }
        : `${child.flavour}:${child.text?.toString() ?? ''}`
    );

  const convert = (models: BlockModel[]) =>
    turnIntoCalloutCommand({ std, models } as never, () => {});

  return { store, std, ids, model, describeTree, convert, carets };
}

const ORIGINAL_TREE = [
  { 'affine:paragraph:plain': ['affine:paragraph:nested'] },
  'affine:list:item',
  'affine:code:const a = 1;',
  { 'affine:callout:': ['affine:paragraph:already in'] },
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('turning a block into a callout', () => {
  it('wraps a paragraph: the callout takes its place, the text moves inside', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.list)]);

    expect(describeTree()).toEqual([
      ORIGINAL_TREE[0],
      { 'affine:callout:': ['affine:paragraph:item'] },
      ORIGINAL_TREE[2],
      ORIGINAL_TREE[3],
    ]);
  });

  it('carries a code block’s text into the callout’s paragraph', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.code)]);

    expect(describeTree()[2]).toEqual({
      'affine:callout:': ['affine:paragraph:const a = 1;'],
    });
  });

  it('re-parents the converted block’s children to the inner paragraph', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.paragraph)]);

    expect(describeTree()[0]).toEqual({
      'affine:callout:': [
        { 'affine:paragraph:plain': ['affine:paragraph:nested'] },
      ],
    });
    // Moved, not recreated: the nested block keeps its identity.
    expect(model(ids.nested).text?.toString()).toBe('nested');
  });

  it('converts a selected child together with its parent only once', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.paragraph), model(ids.nested)]);

    expect(describeTree()[0]).toEqual({
      'affine:callout:': [
        { 'affine:paragraph:plain': ['affine:paragraph:nested'] },
      ],
    });
  });

  it('puts the caret in the inner paragraph, not on the callout hub', () => {
    const { ids, model, convert, carets } = authorNote();

    convert([model(ids.list)]);

    const callout = model(ids.note).children[1];
    expect(carets.at(-1)).toEqual({
      blockId: callout.children[0].id,
      index: 'item'.length,
      length: 0,
    });
  });

  it('is one undo step', () => {
    const { store, ids, model, describeTree, convert } = authorNote();
    const capture = vi.spyOn(store, 'captureSync');
    const add = vi.spyOn(store, 'addBlock');

    convert([model(ids.paragraph), model(ids.list)]);

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.invocationCallOrder[0]).toBeLessThan(
      add.mock.invocationCallOrder[0]
    );
    store.undo();
    expect(describeTree()).toEqual(ORIGINAL_TREE);
  });
});

describe('a conversion that cannot complete', () => {
  it('leaves every source intact and rolls back the callouts already made', () => {
    const { store, ids, model, describeTree, convert } = authorNote();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // The store's own failure mode: `addBlock` hands back an id for a block it
    // never created. Let the first callout and its paragraph through, then
    // reject the second callout.
    const realAdd = store.addBlock.bind(store);
    let calls = 0;
    vi.spyOn(store, 'addBlock').mockImplementation(((
      ...args: Parameters<typeof store.addBlock>
    ) => (++calls > 2 ? 'rejected' : realAdd(...args))) as never);

    convert([model(ids.paragraph), model(ids.list)]);

    expect(describeTree()).toEqual(ORIGINAL_TREE);
  });

  it('writes nothing in a readonly store', () => {
    const { store, ids, model, describeTree, convert } = authorNote();
    store.readonly = true;

    convert([model(ids.paragraph)]);

    expect(describeTree()).toEqual(ORIGINAL_TREE);
  });

  it('does not nest a callout inside a callout', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.insideCallout)]);

    expect(describeTree()).toEqual(ORIGINAL_TREE);
  });
});

describe('the "Turn into" entry', () => {
  it('is offered for a paragraph, a list item and a code block', () => {
    const { std, ids, model } = authorNote();
    for (const id of [ids.paragraph, ids.list, ids.code]) {
      expect(calloutTurnIntoEntry.when(std, [model(id)])).toBe(true);
    }
  });

  it('is hidden when the selection is already inside a callout', () => {
    const { std, ids, model } = authorNote();
    expect(calloutTurnIntoEntry.when(std, [model(ids.insideCallout)])).toBe(
      false
    );
  });

  /**
   * One switch, not two: the entry is gated by the `callout` key of
   * `OPTIONAL_BLOCKS` (it is registered by the flag-gated
   * `CalloutViewExtension`, see `callout-turn-into-gating.unit.spec.ts` in
   * `@labre/affine`) and by nothing else. `enable_callout`, whose default is
   * `false`, used to hide it as well, so with default flags Callout was never
   * offered at all.
   */
  it('ignores enable_callout, the deprecated feature flag', () => {
    const { std, ids, model } = authorNote();
    const flagOff = {
      ...std,
      get: () => ({ getFlag: () => false }),
    } as unknown as BlockStdScope;
    expect(calloutTurnIntoEntry.when(flagOff, [model(ids.paragraph)])).toBe(
      true
    );
  });
});

describe('the slash-menu item', () => {
  const item = calloutSlashMenuConfig.items as SlashMenuItem[];
  const when = (std: BlockStdScope, block: BlockModel) =>
    item[0].when?.({ std, model: block } as never);

  it('is offered with enable_callout false, the feature flag’s default', () => {
    const { std, ids, model } = authorNote();
    const flagOff = {
      ...std,
      get: () => ({ getFlag: () => false }),
    } as unknown as BlockStdScope;
    expect(when(flagOff, model(ids.paragraph))).toBe(true);
  });

  it('is hidden inside a callout, where the schema refuses one', () => {
    const { std, ids, model } = authorNote();
    expect(when(std, model(ids.insideCallout))).toBe(false);
  });
});
