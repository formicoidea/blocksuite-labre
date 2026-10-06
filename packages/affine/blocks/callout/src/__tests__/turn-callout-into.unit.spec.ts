/**
 * "Turn into → <text kind>" on a callout (issue #468), the inverse of
 * "Turn into → Callout" (#418, `turn-into-callout.unit.spec.ts` beside it).
 *
 * Before #468 a block-selected callout had no toolbar at all, so a callout
 * could never become text again. A callout is a HUB — its own `text` is
 * unused, its words live in its children — so the conversion UNWRAPS: the
 * children take the callout's place, each converted to the target kind, and
 * their own children follow them. What has to hold is the tree afterwards
 * and, when the conversion cannot complete, that NOTHING was written (the
 * #423/#418 rule: add first, prove with `getModelById`, delete the source
 * only after) — so the command runs against a REAL store.
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
import {
  type BlockModel,
  BlockSchemaExtension,
  defineBlockSchema,
  Text,
} from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  calloutUnwrapTargets,
  turnCalloutIntoCommand,
} from '../commands/turn-callout-into.js';
import { turnIntoCalloutCommand } from '../commands/turn-into-callout.js';

let seq = 0;

/**
 * AFFiNE's AI transcription block, which a host may register: the callout
 * and paragraph schemas name it as a parent, the list and code schemas do not
 * — so a callout inside one cannot become a list item or a code block. The
 * one real parent that refuses a target the callout itself is allowed under.
 */
const TranscriptionSchemaExtension = BlockSchemaExtension(
  defineBlockSchema({
    flavour: 'affine:transcription',
    // Content, so a note takes it (a note's children are roles).
    metadata: { version: 1, role: 'content', parent: ['affine:note'] },
  })
);

/**
 * A note holding, in order: a paragraph, a callout with two paragraphs (the
 * second with a nested paragraph), an empty callout, a callout with a
 * paragraph and a list item, a transcription holding a callout, and a paragraph.
 */
function authorNote() {
  const workspace = new TestWorkspace({ id: `turn-callout-into-${seq++}` });
  workspace.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    CalloutBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
    ListBlockSchemaExtension,
    CodeBlockSchemaExtension,
    TranscriptionSchemaExtension,
  ];
  workspace.meta.initialize();

  const store = workspace.createDoc().getStore();
  const ids = {
    note: '',
    before: '',
    callout: '',
    nested: '',
    empty: '',
    flat: '',
    transcription: '',
    inTranscription: '',
  };
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('') });
    ids.note = store.addBlock('affine:note', {}, rootId);
    const paragraph = (text: string, parent: string) =>
      store.addBlock('affine:paragraph', { text: new Text(text) }, parent);
    ids.before = paragraph('before', ids.note);
    ids.callout = store.addBlock('affine:callout', {}, ids.note);
    paragraph('one', ids.callout);
    const two = paragraph('two', ids.callout);
    ids.nested = paragraph('nested', two);
    ids.empty = store.addBlock('affine:callout', {}, ids.note);
    ids.flat = store.addBlock('affine:callout', {}, ids.note);
    paragraph('flat one', ids.flat);
    store.addBlock(
      'affine:list',
      { type: 'bulleted', text: new Text('flat two') },
      ids.flat
    );
    ids.transcription = store.addBlock('affine:transcription', {}, ids.note);
    ids.inTranscription = store.addBlock(
      'affine:callout',
      {},
      ids.transcription
    );
    paragraph('heard', ids.inTranscription);
    paragraph('after', ids.note);
  });

  const selections: unknown[][] = [];
  const std = {
    store,
    event: { active: false },
    get: () => ({ getFlag: () => true }),
    selection: {
      create: (ctor: unknown, props: Record<string, unknown>) =>
        ctor === TextSelection ? props.from : props,
      setGroup: (_group: string, next: unknown[]) => selections.push(next),
    },
  } as unknown as BlockStdScope;

  const model = (id: string) => store.getModelById(id)!;
  /** `flavour[:type]:text`, nested children as an object. */
  const label = (block: BlockModel) => {
    const type = (block.props as { type?: string }).type;
    return [block.flavour, type, block.text?.toString() ?? '']
      .filter(part => part !== undefined)
      .join(':');
  };
  const describeTree = (block: BlockModel = model(ids.note)): unknown[] =>
    block.children.map(child =>
      child.children.length > 0
        ? { [label(child)]: describeTree(child) }
        : label(child)
    );

  const convert = (
    models: BlockModel[],
    flavour: string,
    props?: { type?: string }
  ) => {
    const next = vi.fn();
    turnCalloutIntoCommand({ std, models, flavour, props } as never, next);
    return next;
  };

  return { store, std, ids, model, describeTree, convert, selections };
}

const BEFORE = 'affine:paragraph:text:before';
const AFTER = 'affine:paragraph:text:after';
const EMPTY = 'affine:callout:';
const FLAT = {
  'affine:callout:': [
    'affine:paragraph:text:flat one',
    'affine:list:bulleted:flat two',
  ],
};
const TRANSCRIPTION = {
  'affine:transcription:': [
    { 'affine:callout:': ['affine:paragraph:text:heard'] },
  ],
};
const ORIGINAL_TREE = [
  BEFORE,
  {
    'affine:callout:': [
      'affine:paragraph:text:one',
      { 'affine:paragraph:text:two': ['affine:paragraph:text:nested'] },
    ],
  },
  EMPTY,
  FLAT,
  TRANSCRIPTION,
  AFTER,
];

const frame = () => new Promise(resolve => requestAnimationFrame(resolve));

afterEach(() => {
  vi.restoreAllMocks();
});

describe('turning a callout into text', () => {
  it('Text: the children take the callout’s place, in order', () => {
    const { ids, model, describeTree, convert } = authorNote();

    const next = convert([model(ids.callout)], 'affine:paragraph', {
      type: 'text',
    });

    expect(describeTree()).toEqual([
      BEFORE,
      'affine:paragraph:text:one',
      { 'affine:paragraph:text:two': ['affine:paragraph:text:nested'] },
      EMPTY,
      FLAT,
      TRANSCRIPTION,
      AFTER,
    ]);
    expect(model(ids.callout)).toBeNull();
    // Moved, not recreated: the nested block keeps its identity.
    expect(model(ids.nested).text?.toString()).toBe('nested');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('Heading 1: every child becomes a heading', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.callout)], 'affine:paragraph', { type: 'h1' });

    expect(describeTree().slice(1, 3)).toEqual([
      'affine:paragraph:h1:one',
      { 'affine:paragraph:h1:two': ['affine:paragraph:text:nested'] },
    ]);
  });

  it('Bulleted list: the children become list items, nested blocks follow', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.callout)], 'affine:list', { type: 'bulleted' });

    expect(describeTree().slice(1, 3)).toEqual([
      'affine:list:bulleted:one',
      { 'affine:list:bulleted:two': ['affine:paragraph:text:nested'] },
    ]);
  });

  it('Quote: a list child converts across flavours too', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.flat)], 'affine:paragraph', { type: 'quote' });

    expect(describeTree().slice(3, 5)).toEqual([
      'affine:paragraph:quote:flat one',
      'affine:paragraph:quote:flat two',
    ]);
  });

  it('Code: a callout’s children merge into one code block', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.flat)], 'affine:code');

    expect(describeTree()[3]).toBe('affine:code:flat one\nflat two');
    expect(describeTree()[4]).toEqual(TRANSCRIPTION);
  });

  it('an empty callout yields one empty block of the target kind', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.empty)], 'affine:paragraph', { type: 'h2' });

    expect(describeTree()[2]).toBe('affine:paragraph:h2:');
  });

  it('is one undo step', () => {
    const { store, ids, model, describeTree, convert } = authorNote();
    const capture = vi.spyOn(store, 'captureSync');
    const add = vi.spyOn(store, 'addBlock');

    convert([model(ids.callout), model(ids.flat)], 'affine:paragraph', {
      type: 'text',
    });

    expect(capture).toHaveBeenCalledTimes(1);
    expect(capture.mock.invocationCallOrder[0]).toBeLessThan(
      add.mock.invocationCallOrder[0]
    );
    store.undo();
    expect(describeTree()).toEqual(ORIGINAL_TREE);
  });

  it('ends on a block selection of the new blocks', async () => {
    const { ids, model, convert, selections } = authorNote();

    const next = convert([model(ids.flat)], 'affine:paragraph', {
      type: 'text',
    });
    await frame();

    const { updatedBlocks } = next.mock.calls[0][0] as {
      updatedBlocks: BlockModel[];
    };
    expect(selections.at(-1)).toEqual(
      updatedBlocks.map(block => ({ blockId: block.id }))
    );
    expect(updatedBlocks.map(block => block.text?.toString())).toEqual([
      'flat one',
      'flat two',
    ]);
  });

  it('round-trips with "Turn into → Callout"', () => {
    const { std, ids, model, describeTree, convert } = authorNote();
    turnIntoCalloutCommand(
      { std, models: [model(ids.before)] } as never,
      () => {}
    );
    const wrapped = model(ids.note).children[0];
    expect(describeTree()[0]).toEqual({
      'affine:callout:': ['affine:paragraph:text:before'],
    });

    convert([wrapped], 'affine:paragraph', { type: 'text' });

    expect(describeTree()).toEqual(ORIGINAL_TREE);
  });
});

describe('a conversion that cannot complete', () => {
  it('writes nothing when the parent refuses the target', () => {
    const { store, ids, model, describeTree, convert } = authorNote();
    const capture = vi.spyOn(store, 'captureSync');

    const next = convert([model(ids.inTranscription)], 'affine:list', {
      type: 'bulleted',
    });

    expect(describeTree()).toEqual(ORIGINAL_TREE);
    expect(capture).not.toHaveBeenCalled();
    expect(next).not.toHaveBeenCalled();
  });

  it('refuses code when a child has children the merge would drop', () => {
    const { store, ids, model } = authorNote();
    expect(
      calloutUnwrapTargets(store, [model(ids.callout)], 'affine:code')
    ).toEqual([]);
  });

  it('converts no callout when one of the selected cannot be', () => {
    const { ids, model, describeTree, convert } = authorNote();

    convert([model(ids.flat), model(ids.inTranscription)], 'affine:code');

    expect(describeTree()).toEqual(ORIGINAL_TREE);
  });

  it('rolls back the blocks already made when the store refuses one', () => {
    const { store, ids, model, describeTree, convert } = authorNote();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // The store's own failure mode: `addBlock` hands back an id for a block it
    // never created. Let the first block through, then reject the second.
    const realAdd = store.addBlock.bind(store);
    let calls = 0;
    vi.spyOn(store, 'addBlock').mockImplementation(((
      ...args: Parameters<typeof store.addBlock>
    ) => (++calls > 1 ? 'rejected' : realAdd(...args))) as never);

    const next = convert([model(ids.callout)], 'affine:paragraph', {
      type: 'text',
    });

    expect(describeTree()).toEqual(ORIGINAL_TREE);
    expect(next).not.toHaveBeenCalled();
  });

  it('writes nothing in a readonly store', () => {
    const { store, ids, model, describeTree, convert } = authorNote();
    store.readonly = true;

    convert([model(ids.callout)], 'affine:paragraph', { type: 'text' });

    expect(describeTree()).toEqual(ORIGINAL_TREE);
  });

  it('skips what is not a callout', () => {
    const { ids, model, describeTree, convert } = authorNote();

    const next = convert([model(ids.before)], 'affine:paragraph', {
      type: 'h1',
    });

    expect(describeTree()).toEqual(ORIGINAL_TREE);
    expect(next).not.toHaveBeenCalled();
  });
});
