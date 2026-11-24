/**
 * `surface.addElement` never saves a half-written element (#669, write side,
 * ADR 0056).
 *
 * What it would have caught: `addElement({ type: 'text', text: new Text('x') })`
 * with a store `Text` (`@labre/store`) instead of a `Y.Text`. Nothing
 * converted it, so attaching the element's map made Yjs throw
 * `Unexpected content type` half-way through the map's keys; `Store.transact`
 * swallowed the error and `addElement` returned an id. The stored map had no
 * `type`, `id` or `xywh` (the label key came first, from its field default),
 * and every reader skipped it as unreadable (ADR 0053). For a label with no
 * default (a shape's, a connector's) the keys written before it survived and
 * the label and every key after it were lost, silently.
 *
 * Who hits it: writers outside the editor — the host, its workspace connector,
 * labre-mcp, importers — which reach `addElement` with whatever they hold. The
 * editor itself writes `Y.Text`.
 *
 * The contract held here:
 * - a store `Text` is accepted and stored as a `Y.Text`, with the store's own
 *   rule (`native2Y`): a `Text` not yet in a document gives its `Y.Text`, one
 *   already in a document is COPIED, never moved;
 * - a value the document cannot store (a class instance, a Yjs type that is
 *   already in a document) makes `addElement` THROW, before anything is
 *   written: no stored map, no model, no event, no Yjs update;
 * - `type` and `id` are the first keys of the stored map, so a reader always
 *   finds them first.
 */
import { Bound } from '@labre/global/gfx';
import { BlockSchemaExtension, Text } from '@labre/store';
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { afterEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { effects } from '../../effects.js';
import { field, SURFACE_TEXT_UNIQ_IDENTIFIER } from '../../gfx/index.js';
import { TestShapeElement } from '../test-gfx-element.js';
import {
  RootBlockSchemaExtension,
  SurfaceBlockModel,
  SurfaceBlockSchema,
} from '../test-schema.js';

effects();

/**
 * A text-bearing element: `text` has a default, like `TextElementModel.text`
 * (written first by the field init), `label` has none, like a shape's text.
 */
class TestTextElement extends TestShapeElement {
  override get type() {
    return 'testText';
  }

  @field()
  accessor text: Y.Text = new Y.Text();

  @field()
  accessor label: Y.Text | undefined = undefined;
}

class TextSurfaceModel extends SurfaceBlockModel {
  override _init() {
    this._extendElement({ testText: TestTextElement });
    super._init();
  }
}

const TextSurfaceExtension = BlockSchemaExtension({
  ...SurfaceBlockSchema,
  model: {
    ...SurfaceBlockSchema.model,
    toModel: () => new TextSurfaceModel(),
  },
});

function setupSurface() {
  const workspace = new TestWorkspace({
    id: 'add-element-unstorable',
    idGenerator: createAutoIncrementIdGenerator(),
  });
  workspace.meta.initialize();
  const doc = workspace.createDoc('home');
  const store = doc.getStore({
    extensions: [RootBlockSchemaExtension, TextSurfaceExtension],
  });
  doc.load();
  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);
  const surface = store.getBlock(surfaceId)!.model as SurfaceBlockModel;
  const stored = (id: string) =>
    surface.elements.getValue()!.get(id) as Y.Map<unknown> | undefined;
  return { store, surface, stored };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('a store Text handed to addElement', () => {
  test('is stored as a Y.Text, with every other prop', () => {
    const { surface, stored } = setupSurface();
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    const id = surface.addElement({
      type: 'testText',
      xywh: '[1,2,3,4]',
      text: new Text('Label'),
      label: new Text('Caption'),
    });

    const map = stored(id)!;
    expect(map.get('type')).toBe('testText');
    expect(map.get('id')).toBe(id);
    expect(map.get('xywh')).toBe('[1,2,3,4]');
    expect(map.get('text')).toBeInstanceOf(Y.Text);
    expect(String(map.get('text'))).toBe('Label');
    expect(String(map.get('label'))).toBe('Caption');

    const model = surface.getElementById(id) as TestTextElement;
    expect(model.text.toString()).toBe('Label');
    expect(error).not.toHaveBeenCalled();
  });

  test('already in a document is copied, never moved out of it', () => {
    const { surface, stored } = setupSurface();
    const elsewhere = new Y.Doc();
    const bound = new Text('Bound elsewhere');
    elsewhere.getMap('host').set('text', bound.yText);

    const id = surface.addElement({ type: 'testText', label: bound });

    const label = stored(id)!.get('label') as Y.Text;
    expect(label.toString()).toBe('Bound elsewhere');
    expect(label).not.toBe(bound.yText);
    // The original stays where it was, intact.
    expect(bound.yText.doc).toBe(elsewhere);
    expect(elsewhere.getMap('host').get('text')).toBe(bound.yText);
    expect(bound.toString()).toBe('Bound elsewhere');
  });

  test('the same props object can be added twice', () => {
    // The conversion wrote the Yjs type it built back into the caller's
    // object; the first call attached it, and the second refused it as
    // already in a document. The caller's object now keeps what it passed.
    const { surface, stored } = setupSurface();
    const label = new Text('Twice');
    const props = {
      type: 'testText',
      label,
      text: {
        [SURFACE_TEXT_UNIQ_IDENTIFIER]: true,
        delta: [{ insert: 'Wrapped' }],
      },
    };

    const first = surface.addElement(props);
    const second = surface.addElement(props);

    expect(props.label).toBe(label);
    expect(props.text).not.toBeInstanceOf(Y.Text);
    [first, second].forEach(id => {
      expect(String(stored(id)!.get('label'))).toBe('Twice');
      expect(String(stored(id)!.get('text'))).toBe('Wrapped');
    });
    expect(stored(first)!.get('label')).not.toBe(stored(second)!.get('label'));
  });
});

describe('the stored map', () => {
  test('starts with type and id, before any field default', () => {
    const { surface, stored } = setupSurface();

    const id = surface.addElement({ type: 'testText', xywh: '[0,0,1,1]' });

    const first = ['type', 'id'];
    expect([...stored(id)!.keys()].slice(0, first.length)).toEqual(first);
  });
});

const SIZE = 10;

describe('a value the document cannot store', () => {
  const elsewhere = () => {
    const doc = new Y.Doc();
    const text = new Y.Text('in another document');
    doc.getMap('host').set('text', text);
    return text;
  };

  test.each([
    ['a class instance', 'xywh', () => new Bound(0, 0, SIZE, SIZE)],
    ['a null-prototype object', 'xywh', () => Object.create(null)],
    ['a Yjs type already in a document', 'label', elsewhere],
  ])('%s makes addElement throw, and nothing is written', (_, key, value) => {
    const { store, surface } = setupSurface();
    const before = surface.elements.getValue()!.size;
    const updates: Uint8Array[] = [];
    store.spaceDoc.on('update', update => updates.push(update));
    const added: string[] = [];
    surface.elementAdded.subscribe(({ id }) => added.push(id));
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(
      () =>
        surface.addElement({
          type: 'testText',
          xywh: '[0,0,1,1]',
          [key]: value(),
        })
      // The message names the type, then the key in quotes: matches
      // 'Cannot add testText: "xywh" holds…', rejects 'Cannot add testText'.
    ).toThrow(new RegExp(`testText.*"${key}"`));

    expect(surface.elements.getValue()!.size).toBe(before);
    expect(surface.elementModels).toHaveLength(0);
    expect(added).toEqual([]);
    expect(updates).toEqual([]);
    // Thrown to the caller, not swallowed and logged by `Store.transact`.
    expect(error).not.toHaveBeenCalled();
  });

  test('an integrated Y.Text is refused, not moved: its source keeps it', () => {
    const { surface } = setupSurface();
    const text = elsewhere();
    const source = text.doc;

    expect(() =>
      surface.addElement({ type: 'testText', label: text })
    ).toThrow();
    expect(text.doc).toBe(source);
    expect(text.toString()).toBe('in another document');
  });
});
