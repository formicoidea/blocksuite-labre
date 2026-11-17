/**
 * GUARD — every place zod decides what a document holds or a host reads,
 * pinned across the zod 3 → zod 4 move (issue #667, ADR 0052).
 *
 * zod 4 changes `.default()` (the default is returned as is, no longer parsed
 * through the inner schema, and it now wins inside `.optional()`), unifies
 * `nativeEnum` into `enum`, keeps `.refine()` on the refined schema instead of
 * wrapping it, drops `_def.typeName`, and requires `z.record` to name its key.
 * Each of those can change, without a type error, what lands in a document:
 *
 * - the default props of every block schema (`getAffineSchemas`) and every
 *   surface element type (the element's stored `Y.Map`);
 * - the style a new element is created with (`NodePropsSchema`,
 *   `makeDeepOptional`, `pickStylePropsForKey`, the host's `EditorSetting`);
 * - the attributes of every inline delta (`InlineManager.getSchema()` over the
 *   real `DefaultInlineManagerExtension` specs, as a paragraph uses it);
 * - the cell values, column data and JSON values a database reads back
 *   (`rawValue` / `propertyData` / `jsonValue` schemas of every column type);
 * - the agent manifest's parameter contract (`describeCommandParams`, which
 *   read zod 3's `_def.typeName` and would go silently empty under zod 4).
 *
 * The outcomes were recorded under zod 3.25 BEFORE the migration
 * (`__snapshots__/`) and must stay byte-identical under zod 4: absent and
 * `undefined` keys are told apart, failures are recorded with their verdict.
 * A diff here is a stored-format or contract change — an ADR, not a snapshot
 * update. The store's own schemas (snapshots, `BlockSchema`, base text
 * attributes) have their twin in `framework/store`.
 */
import { databaseBlockProperties } from '@labre/affine-database-block';
import {
  StoreExtensionManager,
  ViewExtensionManager,
} from '@labre/affine-ext-loader';
import { DefaultInlineManagerExtension } from '@labre/affine-inline-preset';
import {
  ColorSchema,
  EdgelessTextZodSchema,
  FootNoteSchema,
  FrameZodSchema,
  NoteZodSchema,
  ReferenceInfoSchema,
} from '@labre/affine-model';
import { GeneralSettingSchema } from '@labre/affine-shared/services';
import {
  makeDeepOptional,
  NodePropsSchema,
  pickStylePropsForKey,
} from '@labre/affine-shared/utils';
import { Container } from '@labre/global/di';
import { StdIdentifier } from '@labre/std';
import {
  BlockSchema,
  Boxed,
  internalPrimitives,
  Schema,
  Text,
} from '@labre/store';
import { TestWorkspace } from '@labre/store/test';
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import { getCommandManifest } from '../commands.js';
import { getInternalStoreExtensions } from '../extensions/store.js';
import { getInternalViewExtensions } from '../extensions/view.js';
import { getAffineSchemas } from '../schemas.js';

/** Keys whose value is random by construction: their presence is pinned. */
const RANDOM_KEYS = new Set(['id', 'seed', 'index']);

/**
 * A plain, comparable picture of a value: library wrappers and Yjs types are
 * unwrapped with a tag, `undefined` values are KEPT (an absent key and an
 * `undefined` one are different documents).
 */
function plain(value: unknown): unknown {
  if (value instanceof Text) return { $text: plain(value.yText) };
  // A default prop's Yjs type is not in a document yet, and Yjs refuses to
  // read one: give it a scratch document of its own first.
  if (value instanceof Y.AbstractType && !value.doc) {
    new Y.Doc().getMap('guard').set('value', value);
  }
  if (value instanceof Boxed) return { $boxed: plain(value.getValue()) };
  if (value instanceof Y.Text) return { $yText: plain(value.toDelta()) };
  if (value instanceof Y.Map) {
    return {
      $yMap: Object.fromEntries(
        [...value.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([k, v]) => [k, RANDOM_KEYS.has(k) ? '<random>' : plain(v)])
      ),
    };
  }
  if (value instanceof Y.Array) return { $yArray: value.toArray().map(plain) };
  if (Array.isArray(value)) return value.map(plain);
  if (typeof value === 'function') return '<function>';
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([k, v]) => [k, plain(v)])
    );
  }
  return value;
}

type Parser = {
  safeParse: (input: unknown) => {
    success: boolean;
    data?: unknown;
    error?: { issues: { path: PropertyKey[] }[] };
  };
};

function outcome(schema: Parser, input: unknown) {
  const result = schema.safeParse(input);
  if (result.success) return { success: true, data: plain(result.data) };
  return {
    success: false,
    paths: (result.error?.issues ?? []).map(issue =>
      issue.path.map(String).join('.')
    ),
  };
}

const outcomes = (schema: Parser, cases: Record<string, unknown>) =>
  Object.fromEntries(
    Object.entries(cases).map(([name, input]) => [name, outcome(schema, input)])
  );

/** Arbitrary payload values: only their survival matters. */
const SOME_NUMBER = 12;
const SOME_FRACTION = 0.5;
const NEGATIVE = -1;
const WIDE = 4;
const NARROW = 2;
const OFF_THE_LIST = 9;

describe('zod format guard — block schemas and surface elements', () => {
  test('every block schema validates and keeps its default props', () => {
    const byFlavour = Object.fromEntries(
      getAffineSchemas({}).map(schema => [
        schema.model.flavour,
        {
          valid: BlockSchema.safeParse(schema).success,
          props: plain(schema.model.props?.(internalPrimitives)),
        },
      ])
    );
    expect(byFlavour).toMatchSnapshot();
  });

  test('every surface element type stores the same defaults', () => {
    const collection = new TestWorkspace({ id: 'zod-guard' });
    collection.storeExtensions = new StoreExtensionManager(
      getInternalStoreExtensions({})
    ).get('store');
    collection.meta.initialize();
    const store = collection.createDoc('page').getStore({ id: 'page' });
    const stored: Record<string, unknown> = {};
    store.load(() => {
      const rootId = store.addBlock('affine:page', { title: new Text('Z') });
      const surfaceId = store.addBlock('affine:surface', {}, rootId);
      const surface = store.getBlock(surfaceId)!.model as unknown as {
        registeredElementTypes: string[];
        addElement: (props: Record<string, unknown>) => string;
        elements: { getValue: () => Y.Map<Y.Map<unknown>> | undefined };
      };
      [...surface.registeredElementTypes].sort().forEach(type => {
        try {
          const id = surface.addElement({ type, xywh: '[0,0,100,100]' });
          stored[type] = plain(surface.elements.getValue()?.get(id));
        } catch (error) {
          stored[type] = { $throws: (error as Error).message };
        }
      });
      // The mind map is the one element whose creation parses its input with
      // zod (`nodeSchema`): a tree, then a malformed one.
      try {
        const id = surface.addElement({
          type: 'mindmap',
          children: {
            text: 'root',
            children: [{ text: 'a' }, { text: 'b', children: [] }],
          },
        });
        const children = (
          surface.elements.getValue()?.get(id)?.get('children') as Y.Map<
            Record<string, unknown>
          >
        ).toJSON();
        stored['mindmap (tree)'] = Object.keys(children).length;
      } catch (error) {
        stored['mindmap (tree)'] = { $throws: (error as Error).message };
      }
      try {
        surface.addElement({ type: 'mindmap', children: { text: 1 } });
        stored['mindmap (malformed)'] = 'accepted';
      } catch {
        stored['mindmap (malformed)'] = 'refused';
      }
    });
    expect(stored).toMatchSnapshot();
  });

  test('a schema registry accepts every block schema', () => {
    expect(() => new Schema().register(getAffineSchemas({}))).not.toThrow();
  });
});

describe('zod format guard — model schemas', () => {
  test('the gfx block style defaults (note, frame, edgeless text)', () => {
    expect({
      note: outcome(NoteZodSchema, undefined),
      frame: outcome(FrameZodSchema, undefined),
      'edgeless-text': outcome(EdgelessTextZodSchema, undefined),
      'note, partial': outcome(NoteZodSchema, { background: '#fff' }),
      'frame, own value': outcome(FrameZodSchema, {
        background: { normal: '#000' },
      }),
    }).toMatchSnapshot();
  });

  test('colour, reference and footnote', () => {
    expect({
      color: outcomes(ColorSchema, {
        string: '#fff',
        normal: { normal: '#000', extra: 1 },
        'dark/light': { dark: '#000', light: '#fff' },
        number: 1,
        'partial dark/light': { dark: '#000' },
      }),
      reference: outcomes(ReferenceInfoSchema, {
        minimal: { pageId: 'p' },
        params: {
          pageId: 'p',
          params: { mode: 'edgeless', blockIds: ['b'], elementIds: [] },
          title: 'T',
          description: 'D',
          extra: true,
        },
        'bad mode': {
          pageId: 'p',
          params: { mode: 'board', blockIds: [], elementIds: [] },
        },
      }),
      footnote: outcomes(FootNoteSchema, {
        doc: { label: '1', reference: { type: 'doc', docId: 'd' } },
        url: {
          label: '2',
          reference: { type: 'url', url: 'https://x.y', title: 'X' },
        },
        'bad type': { label: '3', reference: { type: 'mail' } },
      }),
    }).toMatchSnapshot();
  });
});

describe('zod format guard — the style a new element is created with', () => {
  test('NodePropsSchema fills every default from nothing', () => {
    const fromNothing = Object.fromEntries(
      Object.entries(NodePropsSchema.shape).map(([key, schema]) => [
        key,
        outcome(schema as Parser, undefined),
      ])
    );
    expect(fromNothing).toMatchSnapshot();
    expect(
      outcome(
        NodePropsSchema,
        Object.fromEntries(
          Object.keys(NodePropsSchema.shape).map(key => [key, undefined])
        )
      )
    ).toMatchSnapshot();
  });

  test('makeDeepOptional keeps partial records partial', () => {
    const optional = makeDeepOptional(NodePropsSchema) as unknown as Parser;
    expect(
      outcomes(optional, {
        empty: {},
        undefined: undefined,
        'one prop': { connector: { stroke: '#fff' } },
        'nested prop': { connector: { labelStyle: { fontSize: SOME_NUMBER } } },
        'wrong value': { 'shape:rect': { radius: 'round' } },
        'unknown key': { 'shape:rect': { radius: 1, nope: 1 }, nope: {} },
        'a colour object': {
          brush: { color: { dark: '#000', light: '#fff' } },
        },
        'a highlighter width off the list': {
          highlighter: { lineWidth: SOME_NUMBER + SOME_FRACTION },
        },
      })
    ).toMatchSnapshot();
  });

  test('pickStylePropsForKey', () => {
    const bag = {
      fillColor: '#123456',
      strokeWidth: WIDE,
      mode: 1,
      fontSize: SOME_NUMBER,
      radius: 'x',
      color: { normal: '#000' },
      unknown: true,
      textAlign: 'center',
      textVerticalAlign: 'bottom',
      lineWidth: NARROW,
    };
    expect({
      'shape:rect': pickStylePropsForKey('shape:rect', bag),
      connector: pickStylePropsForKey('connector', bag),
      text: pickStylePropsForKey('text', bag),
      brush: pickStylePropsForKey('brush', bag),
      highlighter: pickStylePropsForKey('highlighter', bag),
      mindmap: pickStylePropsForKey('mindmap', {
        layoutType: 1,
        style: OFF_THE_LIST,
      }),
      'affine:note': pickStylePropsForKey('affine:note', {
        background: '#fff',
        displayMode: 'both',
      }),
      nothing: pickStylePropsForKey('shape:rect', { nope: 1 }),
    }).toMatchSnapshot();
  });

  test("the host's EditorSetting", () => {
    expect(
      outcomes(GeneralSettingSchema as unknown as Parser, {
        empty: {},
        'host values': {
          edgelessScrollZoom: true,
          edgelessShowGrid: false,
          docCanvasPreferView: 'affine:embed-linked-doc',
          'shape:rect': { radius: SOME_FRACTION },
        },
        'bad view': { docCanvasPreferView: 'affine:embed-html' },
      })
    ).toMatchSnapshot();
  });
});

describe('zod format guard — inline delta attributes', () => {
  test('the default inline manager schema, as a paragraph normalises', () => {
    const manager = new ViewExtensionManager(getInternalViewExtensions({}));
    const container = new Container();
    manager.get('page').forEach(ext => ext.setup(container));
    container.addImpl(StdIdentifier, () => ({}) as never);
    const inline = container
      .provider()
      .get(DefaultInlineManagerExtension.identifier);
    const schema = inline.getSchema() as unknown as Parser;
    expect(
      outcomes(schema, {
        empty: {},
        marks: {
          bold: true,
          italic: true,
          underline: true,
          overline: true,
          strike: true,
          code: true,
          background: 'var(--x)',
          color: 'red',
        },
        'nulls clear': { bold: null, color: null, link: null },
        'wrong values are caught': {
          bold: 'yes',
          color: 1,
          latex: false,
          link: {},
        },
        link: { link: 'https://example.com' },
        latex: { latex: 'x^2' },
        reference: {
          reference: {
            type: 'LinkedPage',
            pageId: 'p',
            params: { mode: 'page', blockIds: ['b'], elementIds: [] },
            title: 'T',
            extra: 'dropped',
          },
        },
        'reference, deprecated type': {
          reference: { type: 'Subpage', pageId: 'p' },
        },
        'reference, bad type': { reference: { type: 'Doc', pageId: 'p' } },
        footnote: {
          footnote: { label: '1', reference: { type: 'url', url: 'u' } },
        },
        mention: { mention: { member: 'm', notification: 'n' } },
        comment: { 'comment-abc': true, 'comment-def': null },
        'unknown keys': { size: SOME_NUMBER, 'x-labre': true },
        'not an object': 'bold',
      })
    ).toMatchSnapshot();
  });
});

describe('zod format guard — database values read back', () => {
  const values: Record<string, unknown> = {
    null: null,
    undefined: undefined,
    zero: 0,
    number: SOME_FRACTION,
    negative: NEGATIVE,
    string: 'text',
    empty: '',
    true: true,
    false: false,
    'empty array': [],
    'string array': ['a', 'b'],
    'number array': [1],
    object: { a: 1 },
    text: new Text('t'),
  };

  test('rawValue, jsonValue and propertyData of every column type', () => {
    const byColumn = Object.fromEntries(
      Object.entries(databaseBlockProperties).map(([name, meta]) => {
        const config = (
          meta as unknown as {
            config: {
              rawValue: { schema: Parser };
              jsonValue: { schema: Parser };
              propertyData: { schema: Parser; default: () => unknown };
            };
          }
        ).config;
        return [
          name,
          {
            rawValue: outcomes(config.rawValue.schema, values),
            jsonValue: outcomes(config.jsonValue.schema, values),
            propertyData: outcomes(config.propertyData.schema, {
              default: config.propertyData.default(),
              empty: {},
              options: {
                options: [{ id: 'o', value: 'v', color: 'c', extra: 1 }],
              },
              decimal: { decimal: NARROW, format: 'percent' },
            }),
          },
        ];
      })
    );
    expect(byColumn).toMatchSnapshot();
  });
});

describe('zod format guard — the agent manifest parameter contract', () => {
  test('every described command parameter', () => {
    const described = Object.fromEntries(
      getCommandManifest()
        .filter(entry => entry.params !== undefined)
        .map(entry => [entry.id, entry.params])
    );
    expect(described).toMatchSnapshot();
    // Not vacuous: the contract the issue named is described, key by key.
    expect(described['pivot.bind']).toBeDefined();
  });
});
