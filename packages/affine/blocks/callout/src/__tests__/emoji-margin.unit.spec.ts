/**
 * Where the callout's emoji sits — upstream #13712.
 *
 * The emoji is a fixed 24px box beside a column whose first line can be an H1
 * or an ordinary paragraph, so one hard-coded margin cannot be right twice: it
 * floated well above a heading, or sank below a plain line. The drop is now
 * read from the first child.
 */
import {
  CalloutBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
  type CalloutBlockModel,
  type ParagraphBlockModel,
} from '@labre/affine-model';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, it } from 'vitest';

import { getCalloutEmojiMarginTop } from '../emoji-margin.js';

let seq = 0;

/** A callout whose first child is a paragraph of the given type, if any. */
function calloutStartingWith(first?: { flavour: string; type?: string }) {
  const collection = new TestWorkspace({ id: `emoji-margin-${seq++}` });
  collection.storeExtensions = [
    RootBlockSchemaExtension,
    NoteBlockSchemaExtension,
    CalloutBlockSchemaExtension,
    ParagraphBlockSchemaExtension,
  ];
  collection.meta.initialize();

  const store = collection.createDoc().getStore();
  let calloutId = '';
  store.load(() => {
    const rootId = store.addBlock('affine:page', { title: new Text('') });
    const noteId = store.addBlock('affine:note', {}, rootId);
    calloutId = store.addBlock('affine:callout', {}, noteId);
    if (first) {
      store.addBlock(
        first.flavour as 'affine:paragraph',
        { type: first.type, text: new Text('a line') },
        calloutId
      );
    }
  });

  return store.getBlock(calloutId)!.model as CalloutBlockModel;
}

describe('getCalloutEmojiMarginTop', () => {
  it.each([
    ['h1', '23px'],
    ['h2', '20px'],
    ['h3', '16px'],
    ['h4', '15px'],
    ['h5', '14px'],
    ['h6', '13px'],
  ])('drops the emoji onto the baseline of an %s', (type, expected) => {
    const callout = calloutStartingWith({
      flavour: 'affine:paragraph',
      type,
    });
    expect(getCalloutEmojiMarginTop(callout)).toBe(expected);
  });

  it('keeps the default drop for an ordinary paragraph', () => {
    const callout = calloutStartingWith({
      flavour: 'affine:paragraph',
      type: 'text',
    });
    expect(getCalloutEmojiMarginTop(callout)).toBe('10px');
  });

  it('keeps the default drop for an empty callout', () => {
    expect(getCalloutEmojiMarginTop(calloutStartingWith())).toBe('10px');
  });

  it('follows the first line when it becomes a heading', () => {
    const callout = calloutStartingWith({
      flavour: 'affine:paragraph',
      type: 'text',
    });
    const first = callout.children[0] as ParagraphBlockModel;

    first.props.type = 'h2';

    expect(getCalloutEmojiMarginTop(callout)).toBe('20px');
  });
});
