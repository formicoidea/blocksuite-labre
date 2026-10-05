/**
 * A conversion the schema rejects must leave the source block where it was
 * (issue #418, upstream AFFiNE #15508).
 *
 * `Store.addBlock` returns an id even when the schema check threw: the throw
 * happens inside `transact`, which catches and logs it. Both helpers below
 * trusted that id and deleted the source anyway, so "Turn into → Code block"
 * on a paragraph inside a callout (which only accepts paragraphs and lists)
 * wiped the text and created nothing — silent content loss. `getModelById` on
 * the returned id is the only real test that the new block exists.
 *
 * Driven against a REAL store, because what has to hold is the tree
 * afterwards: which blocks still exist and which text they carry.
 */
import {
  CalloutBlockSchemaExtension,
  CodeBlockSchemaExtension,
  ListBlockSchemaExtension,
  NoteBlockSchemaExtension,
  ParagraphBlockSchemaExtension,
  RootBlockSchemaExtension,
} from '@labre/affine-model';
import { Text } from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { mergeToCodeModel } from '../../utils/model/merge-to-code-model.js';
import { transformModel } from '../../utils/model/transform-model.js';

let seq = 0;

/** A note holding one callout, itself holding `lines` paragraphs. */
function calloutWith(lines: string[]) {
  const workspace = new TestWorkspace({ id: `conversion-${seq++}` });
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
  let calloutId = '';
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
  });

  const linesInCallout = () =>
    store
      .getModelById(calloutId)!
      .children.map(child => `${child.flavour}:${child.text?.toString()}`);

  return { store, calloutId, paragraphIds, linesInCallout };
}

describe('a conversion the parent rejects', () => {
  // The store logs the schema error it swallowed; that log is expected here.
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('transformModel keeps the source block and reports failure', () => {
    const { store, paragraphIds, linesInCallout } = calloutWith(['keep me']);
    const source = store.getModelById(paragraphIds[0])!;

    const id = transformModel(source, 'affine:code');

    expect(linesInCallout()).toEqual(['affine:paragraph:keep me']);
    expect(id).toBeNull();
  });

  it('mergeToCodeModel keeps every source paragraph and reports failure', () => {
    const { store, paragraphIds, linesInCallout } = calloutWith([
      'first',
      'second',
    ]);
    const sources = paragraphIds.map(id => store.getModelById(id)!);

    const id = mergeToCodeModel(sources);

    expect(linesInCallout()).toEqual([
      'affine:paragraph:first',
      'affine:paragraph:second',
    ]);
    expect(id).toBeNull();
  });
});

describe('a conversion the parent accepts', () => {
  it('transformModel replaces the source in place', () => {
    const { store, paragraphIds, linesInCallout } = calloutWith([
      'a',
      'b',
      'c',
    ]);

    const id = transformModel(
      store.getModelById(paragraphIds[1])!,
      'affine:list'
    );

    expect(id).not.toBeNull();
    expect(linesInCallout()).toEqual([
      'affine:paragraph:a',
      'affine:list:b',
      'affine:paragraph:c',
    ]);
  });
});
