import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import type { YBlock } from '../model/block/types.js';
import { DocCRUD } from '../model/store/crud.js';
import { Schema } from '../schema/schema.js';
import {
  NoteBlockSchema,
  ParagraphBlockSchema,
  RootBlockSchema,
} from './test-schema.js';

function createCRUD() {
  const yDoc = new Y.Doc();
  const yBlocks = yDoc.getMap('blocks') as Y.Map<YBlock>;
  const schema = new Schema();
  schema.register([RootBlockSchema, NoteBlockSchema, ParagraphBlockSchema]);
  return new DocCRUD(yBlocks, schema);
}

// Builds page > note > the requested number of paragraphs, and answers their ids.
function createParagraphs(crud: DocCRUD, count: number) {
  crud.addBlock('root', 'affine:page');
  crud.addBlock('note', 'affine:note', {}, 'root');
  return Array.from({ length: count }, (_, index) => {
    const id = `p${index}`;
    crud.addBlock(id, 'affine:paragraph', {}, 'note');
    return id;
  });
}

describe('DocCRUD siblings', () => {
  test('the first child has no previous sibling', () => {
    const crud = createCRUD();
    const [first] = createParagraphs(crud, 3);

    expect(crud.getPrev(first)).toBeNull();
  });

  test('an only child has no previous and no next sibling', () => {
    const crud = createCRUD();
    const [only] = createParagraphs(crud, 1);

    expect(crud.getPrev(only)).toBeNull();
    expect(crud.getNext(only)).toBeNull();
  });

  test('a child in the middle answers the child before it', () => {
    const crud = createCRUD();
    const [first, middle, last] = createParagraphs(crud, 3);

    expect(crud.getPrev(middle)).toBe(first);
    expect(crud.getPrev(last)).toBe(middle);
    expect(crud.getNext(first)).toBe(middle);
    expect(crud.getNext(last)).toBeNull();
  });
});
