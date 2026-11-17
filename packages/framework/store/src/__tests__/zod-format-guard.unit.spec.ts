/**
 * GUARD — the document-format face of zod, pinned across the zod 3 → zod 4
 * move (issue #667, ADR 0052).
 *
 * `@labre/store` validates with zod at three places a document crosses:
 * `defineBlockSchema` / `Schema.register` check every block schema
 * (`BlockSchema`), the transformer checks every block, slice and doc snapshot
 * (`BlockSnapshotSchema`, `SliceSnapshotSchema`, `DocSnapshotSchema`) and the
 * edgeless clipboard KEEPS the parsed snapshot (`safeParse(data).data`), and
 * the inline editor normalises every delta's attributes through
 * `baseTextAttributes` before they are written to a `Y.Text`.
 *
 * A zod major changes defaults, unknown-key stripping, `catch` and `record`
 * semantics. Any of those, silently, is a document written differently or a
 * paste that loses a prop. So every outcome below — success or failure, and
 * the parsed value with its absent-versus-`undefined` keys — was recorded
 * under zod 3.25 BEFORE the migration, in `__snapshots__/`, and must stay
 * byte-identical under zod 4. A diff here is a format change: it needs an
 * ADR, not a snapshot update.
 */
import { describe, expect, test } from 'vitest';

import { BlockSchema, defineBlockSchema } from '../model/block/zod.js';
import { baseTextAttributes } from '../reactive/text/attributes.js';
import {
  BlockSnapshotSchema,
  DocSnapshotSchema,
  SliceSnapshotSchema,
} from '../transformer/type.js';

/** Arbitrary payload values: only their survival matters. */
const SECOND = 2;
const THIRD = 3;
const NOT_A_URL = 42;

type Outcome = { success: boolean; data?: unknown; paths?: string[] };

/** What a caller sees: the verdict, the kept value, the failing paths. */
function outcome(result: {
  success: boolean;
  data?: unknown;
  error?: { issues: { path: PropertyKey[] }[] };
}): Outcome {
  if (result.success) return { success: true, data: result.data };
  return {
    success: false,
    paths: (result.error?.issues ?? []).map(issue =>
      issue.path.map(String).join('.')
    ),
  };
}

const leaf = (id: string, props: Record<string, unknown> = {}) => ({
  type: 'block',
  id,
  flavour: 'affine:paragraph',
  props,
  children: [],
});

const BLOCK_CASES: Record<string, unknown> = {
  minimal: leaf('a'),
  'with version': { ...leaf('a'), version: 1 },
  'unknown top-level key is stripped': { ...leaf('a'), extra: 'x' },
  'props keep every key and value': leaf('a', {
    text: { '$blocksuite:internal:text$': true, delta: [{ insert: 'x' }] },
    nested: { deep: [1, SECOND, { k: null }] },
    undef: undefined,
    'prop:unknown': 'kept',
  }),
  'nested children': {
    ...leaf('root'),
    children: [{ ...leaf('c1'), children: [leaf('c2', { n: 1 })] }],
  },
  'missing props': { type: 'block', id: 'a', flavour: 'f', children: [] },
  'wrong type literal': { ...leaf('a'), type: 'slice' },
  'non-string id': { ...leaf('a'), id: THIRD },
  'props is an array': { ...leaf('a'), props: [] },
  'bad child': { ...leaf('a'), children: [{ type: 'block' }] },
  'version is a string': { ...leaf('a'), version: '1' },
  null: null,
};

const SLICE_CASES: Record<string, unknown> = {
  minimal: {
    type: 'slice',
    content: [leaf('a')],
    workspaceId: 'w',
    pageId: 'p',
  },
  'unknown key stripped': {
    type: 'slice',
    content: [],
    workspaceId: 'w',
    pageId: 'p',
    extra: true,
  },
  'missing pageId': { type: 'slice', content: [], workspaceId: 'w' },
};

const DOC_CASES: Record<string, unknown> = {
  minimal: {
    type: 'page',
    meta: { id: 'p', title: 'T', createDate: 1, tags: [] },
    blocks: leaf('root'),
  },
  'meta keeps only the declared keys': {
    type: 'page',
    meta: {
      id: 'p',
      title: 'T',
      createDate: 1,
      tags: ['a'],
      updatedDate: SECOND,
      favorite: true,
    },
    blocks: leaf('root'),
  },
  'meta without tags': {
    type: 'page',
    meta: { id: 'p', title: 'T', createDate: 1 },
    blocks: leaf('root'),
  },
};

const ATTRIBUTE_CASES: Record<string, unknown> = {
  empty: {},
  'every base mark': {
    bold: true,
    italic: true,
    underline: true,
    strike: true,
    code: true,
    link: 'https://example.com',
  },
  'null clears a mark': { bold: null, link: null },
  'explicit undefined': { bold: undefined },
  'a wrong value is caught to undefined': { bold: false, italic: 'yes' },
  'a wrong link is caught': { link: NOT_A_URL },
  'unknown keys are stripped': { color: 'red', reference: { pageId: 'x' } },
};

describe('zod format guard — @labre/store', () => {
  test('BlockSnapshotSchema', () => {
    const results = Object.fromEntries(
      Object.entries(BLOCK_CASES).map(([name, input]) => [
        name,
        outcome(BlockSnapshotSchema.safeParse(input)),
      ])
    );
    expect(results).toMatchSnapshot();
  });

  test('SliceSnapshotSchema', () => {
    const results = Object.fromEntries(
      Object.entries(SLICE_CASES).map(([name, input]) => [
        name,
        outcome(SliceSnapshotSchema.safeParse(input)),
      ])
    );
    expect(results).toMatchSnapshot();
  });

  test('DocSnapshotSchema', () => {
    const results = Object.fromEntries(
      Object.entries(DOC_CASES).map(([name, input]) => [
        name,
        outcome(DocSnapshotSchema.safeParse(input)),
      ])
    );
    expect(results).toMatchSnapshot();
  });

  test('baseTextAttributes', () => {
    const results = Object.fromEntries(
      Object.entries(ATTRIBUTE_CASES).map(([name, input]) => [
        name,
        outcome(baseTextAttributes.safeParse(input)),
      ])
    );
    expect(results).toMatchSnapshot();
  });

  test('BlockSchema accepts a defined schema and refuses a malformed one', () => {
    const schema = defineBlockSchema({
      flavour: 'guard:block',
      props: internal => ({ title: internal.Text('t'), n: 1 }),
      metadata: { version: SECOND, role: 'content', parent: ['guard:root'] },
    });
    const verdicts = {
      defined: BlockSchema.safeParse(schema).success,
      'no props getter': BlockSchema.safeParse({
        version: 1,
        model: { role: 'content', flavour: 'f' },
      }).success,
      'props is not a function': BlockSchema.safeParse({
        version: 1,
        model: { role: 'content', flavour: 'f', props: {} },
      }).success,
      'transformer is not a function': BlockSchema.safeParse({
        version: 1,
        model: { role: 'content', flavour: 'f' },
        transformer: 'x',
      }).success,
      'missing version': BlockSchema.safeParse({
        model: { role: 'content', flavour: 'f' },
      }).success,
    };
    expect(verdicts).toMatchSnapshot();
    // `defineBlockSchema` returns its own object, not zod's parse output: the
    // props getter a store calls is the author's function, unwrapped.
    expect(schema.model.props).toBeTypeOf('function');
    expect(
      (schema.model.props as (i: unknown) => Record<string, unknown>)({
        Text: (s: string) => `text:${s}`,
        Boxed: (v: unknown) => v,
      })
    ).toEqual({ title: 'text:t', n: 1 });
  });
});
