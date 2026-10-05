/**
 * The canvas text decoration field — the RED ZONE half of ADR 0030.
 *
 * `packages/affine/model` is the file format, so the assertion that matters
 * most is the negative one: a `text` or a `shape` that is never decorated must
 * persist exactly the keys it persisted before `textDecoration` existed. That
 * is what makes the field migration-free, and it rests on the `@field()`
 * `undefined` contract rather than on anything a reader can see — hence the
 * pinned key lists below. The positive half pins that a decoration, once set,
 * is a stored key that `serialize()` (the snapshot and clipboard source)
 * carries, and that the value is written as given, unknown tokens included.
 *
 * Same real-`Y.Doc` harness as `connector-end-labels.unit.spec.ts`.
 */
import { describe, expect, test } from 'vitest';
import * as Y from 'yjs';

import {
  ConnectorElementModel,
  ShapeElementModel,
  TextDecoration,
  TextElementModel,
} from '../index.js';

type ModelClass =
  | typeof TextElementModel
  | typeof ShapeElementModel
  | typeof ConnectorElementModel;

function build<C extends ModelClass>(Model: C, id = 'element-1') {
  const doc = new Y.Doc();
  const elements = doc.getMap<Y.Map<unknown>>('elements');
  const yMap = new Y.Map<unknown>();
  elements.set(id, yMap);

  const surface = {
    _decoratorState: { creating: false, deriving: false, skipField: false },
    getElementById: () => null,
    store: {
      readonly: false,
      transact: (fn: () => void) => doc.transact(fn),
      getBlock: () => undefined,
    },
  };

  const model = new Model({
    id,
    yMap,
    model: surface as never,
    stashedStore: new Map(),
    onChange: () => {},
  }) as InstanceType<C>;

  return { model, yMap };
}

const storedKeys = (yMap: Y.Map<unknown>) =>
  Array.from(yMap.keys()).sort((a, b) => a.localeCompare(b));

describe('a text or a shape that is never decorated', () => {
  test('a text reads undefined and stores no decoration key', () => {
    const { model, yMap } = build(TextElementModel);

    expect(model.textDecoration).toBeUndefined();
    // The byte-identity pin: the keys a text wrote before ADR 0030.
    expect(storedKeys(yMap)).toEqual([
      'color',
      'fontFamily',
      'fontSize',
      'fontStyle',
      'fontWeight',
      'hasMaxWidth',
      'index',
      'rotate',
      'seed',
      'text',
      'textAlign',
      'xywh',
    ]);
  });

  test('a shape reads undefined and stores no decoration key', () => {
    const { model, yMap } = build(ShapeElementModel);

    expect(model.textDecoration).toBeUndefined();
    expect(storedKeys(yMap)).not.toContain('textDecoration');
  });

  test('a connector label style carries no decoration by default', () => {
    const { model } = build(ConnectorElementModel);

    expect('textDecoration' in model.labelStyle).toBe(false);
  });
});

describe('a decoration, once set', () => {
  test('is one stored key on a text, carried by serialize()', () => {
    const { model, yMap } = build(TextElementModel);

    model.textDecoration = TextDecoration.Underline;

    expect(yMap.get('textDecoration')).toBe('underline');
    expect(model.serialize().textDecoration).toBe('underline');
  });

  test('is one stored key on a shape, carried by serialize()', () => {
    const { model, yMap } = build(ShapeElementModel);

    model.textDecoration = TextDecoration.UnderlineOverline;

    expect(yMap.get('textDecoration')).toBe('underline overline');
    expect(model.serialize().textDecoration).toBe('underline overline');
  });

  test('turning it off writes none, it does not clear the key', () => {
    // `none` and absent paint the same; they differ for the UML legacy rule,
    // which is drawn only for a name that never carried the field.
    const { model, yMap } = build(TextElementModel);

    model.textDecoration = TextDecoration.Underline;
    model.textDecoration = TextDecoration.None;

    expect(yMap.has('textDecoration')).toBe(true);
    expect(model.textDecoration).toBe('none');
  });

  test('a token this build does not know is stored as written', () => {
    // A newer client may append a token; this build must not rewrite it away.
    const { model, yMap } = build(TextElementModel);

    model.textDecoration = 'underline line-through' as TextDecoration;

    expect(yMap.get('textDecoration')).toBe('underline line-through');
  });

  test('rides inside a connector labelStyle with the other five keys', () => {
    const { model, yMap } = build(ConnectorElementModel);

    model.labelStyle = {
      ...model.labelStyle,
      textDecoration: TextDecoration.Overline,
    };

    expect(
      (yMap.get('labelStyle') as Record<string, unknown>).textDecoration
    ).toBe('overline');
    expect(model.serialize().labelStyle).toMatchObject({
      textDecoration: 'overline',
    });
  });
});

describe('the stored vocabulary', () => {
  test('is append-only: the four values are pinned', () => {
    expect(Object.values(TextDecoration)).toEqual([
      'none',
      'underline',
      'overline',
      'underline overline',
    ]);
  });
});
