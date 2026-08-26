/**
 * `tags` — the level-3 contextual qualification on a surface element
 * (ADR 0007 § 4), and the read/write helpers over it.
 *
 * Four families of assertion, and the last two are the ones the ADR was argued
 * on:
 *
 * 1. The field behaves like the optional base-class fields that preceded it
 *    (`role`, `pivotDocId`): absent by default, never stamped, clearable. That
 *    is what buys "no version bump, no migration" on a class that has no schema
 *    version at all.
 * 2. **A nested `Y.Map` really is feasible inside `@field()`** — it is written,
 *    read back and serialized as a real Yjs type, not as an opaque blob.
 * 3. **Paste / duplicate preserve it, by construction.** The copy gets its own
 *    map with the same values, and not a second reference to the original's.
 * 4. **Two tags merge, one tag is last-write-wins.** The whole reason the shape
 *    is a nested map rather than a plain object.
 */
import {
  createAutoIncrementIdGenerator,
  TestWorkspace,
} from '@labre/store/test';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import { effects } from '../../effects.js';
import {
  elementTagValues,
  type GfxPrimitiveElementModel,
  hasElementTagValue,
  readElementTags,
  setElementTag,
} from '../../gfx/index.js';
import {
  RootBlockSchemaExtension,
  type SurfaceBlockModel,
  SurfaceBlockSchemaExtension,
} from '../test-schema.js';

effects();

const extensions = [RootBlockSchemaExtension, SurfaceBlockSchemaExtension];

const NATURE = 'wardley:nature';
const DATA = 'wardley:nature/data';
const PRACTICE = 'wardley:nature/practice';
const CRITICALITY = 'wardley:criticality';

function setupSurface(id = 'tags') {
  const collection = new TestWorkspace({
    id,
    idGenerator: createAutoIncrementIdGenerator(),
  });
  collection.meta.initialize();
  const doc = collection.createDoc('home');
  const store = doc.getStore({ extensions });
  doc.load();

  const rootId = store.addBlock('test:page');
  const surfaceId = store.addBlock('test:surface', {}, rootId);
  return {
    store,
    surface: store.getBlock(surfaceId)!.model as SurfaceBlockModel,
  };
}

describe('the tags field', () => {
  let surface!: SurfaceBlockModel;

  beforeEach(() => {
    surface = setupSurface().surface;
  });

  test('an unqualified element is byte-identical to one authored before the field', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;

    expect(el.tags).toBeUndefined();
    // The no-migration argument rests entirely on this. A non-`undefined`
    // default on the base class would put an empty nested map on every brush
    // stroke of every document.
    expect(el.yMap.has('tags')).toBe(false);
    expect(el.serialize()).not.toHaveProperty('tags');
    expect(readElementTags(el)).toEqual({});
  });

  test('the first qualification creates a real nested Y.Map', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;

    expect(setElementTag(el, NATURE, [DATA])).toBe(true);

    // Feasibility, asserted rather than assumed: `@field()` supports a nested
    // Y.Map (the `MindmapElementModel.children` precedent), and this is one
    // level shallower than that one.
    expect(el.yMap.get('tags')).toBeInstanceOf(Y.Map);
    expect(el.tags).toBeInstanceOf(Y.Map);
    expect(readElementTags(el)).toEqual({ [NATURE]: [DATA] });
    expect(elementTagValues(el, NATURE)).toEqual([DATA]);
    expect(hasElementTagValue(el, NATURE, DATA)).toBe(true);
    expect(hasElementTagValue(el, NATURE, PRACTICE)).toBe(false);
  });

  test('a second tag is added in place, keeping the first', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    setElementTag(el, NATURE, [DATA]);
    const map = el.tags;

    setElementTag(el, CRITICALITY, ['wardley:criticality/high']);

    // In place, NOT a replacement: replacing the map is what would restore
    // whole-blob last-write-wins and silently drop a concurrent edit.
    expect(el.tags).toBe(map);
    expect(readElementTags(el)).toEqual({
      [NATURE]: [DATA],
      [CRITICALITY]: ['wardley:criticality/high'],
    });
  });

  test('re-setting the same tag replaces its value set', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    setElementTag(el, NATURE, [DATA]);

    setElementTag(el, NATURE, [PRACTICE]);

    // One tag's value set is ONE atomic choice, so last-write-wins there is
    // correct — it is only ACROSS tags that a merge is owed.
    expect(readElementTags(el)).toEqual({ [NATURE]: [PRACTICE] });
  });

  test('a no-op write reports false and costs nothing', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    setElementTag(el, NATURE, [DATA]);

    expect(setElementTag(el, NATURE, [DATA])).toBe(false);
    // Order is preserved, so a re-set in the same order is the same value.
    expect(setElementTag(el, NATURE, [DATA, DATA])).toBe(false);
    expect(setElementTag(el, NATURE, [])).toBe(true);
    expect(setElementTag(el, NATURE, [])).toBe(false);
  });

  test('removing the last tag removes the key, not just the value', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    setElementTag(el, NATURE, [DATA]);
    setElementTag(el, CRITICALITY, ['wardley:criticality/high']);

    setElementTag(el, CRITICALITY, []);
    expect(el.yMap.has('tags')).toBe(true);

    setElementTag(el, NATURE, []);

    // Back to costing nothing, exactly like an element that never was
    // qualified — and `clearField` must accept it silently, since it is a
    // declared, non-structural field.
    expect(warn).not.toHaveBeenCalled();
    expect(el.yMap.has('tags')).toBe(false);
    expect(el.tags).toBeUndefined();
    expect(el.serialize()).not.toHaveProperty('tags');
    warn.mockRestore();
  });

  test('malformed entries are skipped, never thrown on', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    setElementTag(el, NATURE, [DATA]);
    // What a client of another vintage — or a bad host script — could write.
    surface.store.transact(() => {
      el.tags!.set('wardley:junk', 'not-an-array' as unknown as string[]);
      el.tags!.set('wardley:mixed', [
        DATA,
        42,
        '',
        null,
      ] as unknown as string[]);
    });

    expect(readElementTags(el)).toEqual({
      [NATURE]: [DATA],
      'wardley:mixed': [DATA],
    });
    // A board that cannot be read is worse than a tag that is not.
    expect(elementTagValues(el, 'wardley:junk')).toEqual([]);
  });

  test('an unknown value id survives: defs are configuration, never document data', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;

    setElementTag(el, 'nowhere:seeded', ['nowhere:seeded/whatever']);

    // Nothing here validates against a registry. A document must keep opening
    // against a changed, removed or never-seeded pack.
    expect(readElementTags(el)).toEqual({
      'nowhere:seeded': ['nowhere:seeded/whatever'],
    });
  });
});

describe('tags survive element re-creation from props', () => {
  let surface!: SurfaceBlockModel;

  beforeEach(() => {
    surface = setupSurface().surface;
  });

  test('paste / duplicate keep the qualification, with a map of their own', () => {
    const sourceId = surface.addElement({ type: 'testShape' });
    const source = surface.getElementById(sourceId)!;
    setElementTag(source, NATURE, [DATA]);
    setElementTag(source, CRITICALITY, ['wardley:criticality/high']);

    // Exactly what paste, duplicate, alt-drag clone and template insertion do:
    // replay `serialize()` through `_createElementFromProps`. `serialize()` is
    // `yMap.toJSON()`, so the nested map arrives as PLAIN JSON with no wrapper
    // — which is why `_propsToY` has to rebuild it for the base-class field.
    const { id: _id, ...props } = source.serialize();
    const copy = surface.getElementById(surface.addElement(props))!;

    expect(copy.id).not.toBe(sourceId);
    expect(copy.tags).toBeInstanceOf(Y.Map);
    expect(readElementTags(copy)).toEqual({
      [NATURE]: [DATA],
      [CRITICALITY]: ['wardley:criticality/high'],
    });

    // A copy of the VALUES, never a second reference to one map: editing the
    // copy must not reach into the original.
    expect(copy.tags).not.toBe(source.tags);
    setElementTag(copy, NATURE, [PRACTICE]);
    expect(readElementTags(source)).toEqual({
      [NATURE]: [DATA],
      [CRITICALITY]: ['wardley:criticality/high'],
    });
  });

  test('an unqualified element stays unqualified through a round trip', () => {
    const sourceId = surface.addElement({ type: 'testShape' });
    const { id: _id, ...props } = surface.getElementById(sourceId)!.serialize();

    const copy = surface.getElementById(surface.addElement(props))!;

    expect(copy.tags).toBeUndefined();
    // No tombstone: an empty or absent value drops the key entirely.
    expect(copy.yMap.has('tags')).toBe(false);
  });

  test('an empty tag map arriving from props writes no key at all', () => {
    const id = surface.addElement({ type: 'testShape', tags: {} as never });

    expect(surface.getElementById(id)!.yMap.has('tags')).toBe(false);
  });
});

/**
 * The shape a client that predates the field leaves behind.
 *
 * Not a hypothesis: an undeclared key goes down `_assignElementProp`'s
 * unknown-key branch, whose encodability guard accepts the serialized nested map
 * because it IS flat JSON. So the qualification is preserved — as a plain
 * object. Writing it here directly into the Y.Map is exactly what that branch
 * does.
 */
function writeDegradedTags(
  element: GfxPrimitiveElementModel,
  tags: Record<string, string[]>
) {
  element.surface.store.transact(() => {
    element.yMap.set('tags', tags);
  });
}

describe('the degraded shape a pre-declaration client writes', () => {
  let surface!: SurfaceBlockModel;

  beforeEach(() => {
    surface = setupSurface('tags-degraded').surface;
  });

  test('is READ, not reported as an unqualified element', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    writeDegradedTags(el, { [NATURE]: [DATA] });

    // Before this was handled, the element looked pristine: no Nature section,
    // no patch to the host, no fact for the rules engine.
    expect(el.tags).not.toBeInstanceOf(Y.Map);
    expect(readElementTags(el)).toEqual({ [NATURE]: [DATA] });
    expect(elementTagValues(el, NATURE)).toEqual([DATA]);
    expect(hasElementTagValue(el, NATURE, DATA)).toBe(true);
  });

  test('is CONVERTED by the first write, and the colleague keeps their tag', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    writeDegradedTags(el, { [NATURE]: [DATA] });

    expect(setElementTag(el, CRITICALITY, ['wardley:criticality/high'])).toBe(
      true
    );

    // The bug this replaces: a fresh Y.Map holding ONLY the tag just posted
    // replaced the plain object, and the qualification written by the other
    // client left without a word.
    expect(el.tags).toBeInstanceOf(Y.Map);
    expect(readElementTags(el)).toEqual({
      [NATURE]: [DATA],
      [CRITICALITY]: ['wardley:criticality/high'],
    });
  });

  test('converts on a write that REPLACES one of its own values', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    writeDegradedTags(el, { [NATURE]: [DATA], [CRITICALITY]: ['x:y/z'] });

    setElementTag(el, NATURE, [PRACTICE]);

    expect(el.tags).toBeInstanceOf(Y.Map);
    expect(readElementTags(el)).toEqual({
      [NATURE]: [PRACTICE],
      [CRITICALITY]: ['x:y/z'],
    });
  });

  test('removing its last tag removes the key rather than converting', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    writeDegradedTags(el, { [NATURE]: [DATA] });

    expect(setElementTag(el, NATURE, [])).toBe(true);

    expect(el.yMap.has('tags')).toBe(false);
    expect(readElementTags(el)).toEqual({});
  });

  test('a no-op write on it stays a no-op — no gratuitous conversion', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    writeDegradedTags(el, { [NATURE]: [DATA] });

    // Conversion is a side effect of qualifying, not a migration pass. Nothing
    // walks documents rewriting them.
    expect(setElementTag(el, NATURE, [DATA])).toBe(false);
    expect(el.tags).not.toBeInstanceOf(Y.Map);
  });

  test('it does not warn once per element per mount', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;

    writeDegradedTags(el, { [NATURE]: [DATA] });

    // A plain object under this key is a document value of another vintage, not
    // the `@observe`-on-a-non-Y-type misconfiguration the warning exists for,
    // and there is nothing the user could do about it anyway.
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
  });

  test('but the silence stays as narrow as its reason', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;

    // An ARRAY is not a shape any client writes here. Excusing it too would
    // mean an `@observe` put by mistake on a non-Y field never says so again —
    // and the point of silencing the plain object was that it is a legitimate
    // document value, not that the check is noisy.
    surface.store.transact(() => {
      el.yMap.set('tags', [DATA] as unknown as Record<string, string[]>);
    });

    expect(warn).toHaveBeenCalled();
    expect(readElementTags(el)).toEqual({});
    warn.mockRestore();
  });
});

describe('a read-only document is never written to', () => {
  let surface!: SurfaceBlockModel;

  beforeEach(() => {
    surface = setupSurface('tags-readonly').surface;
  });

  /**
   * `setElementTag` is exported from `@labre/std/gfx`, so a host reaches it
   * without going through `tag.set`'s own guard. The three write paths below
   * used to behave three different ways under read-only: the in-place mutation
   * and `clearField` both went through `Store.transact`, which carries no guard
   * and so SUCCEEDED, while `updateElement` threw.
   */
  test('all three write paths refuse, identically, and none throws', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const created = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    const mutated = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    setElementTag(mutated, NATURE, [DATA]);
    setElementTag(mutated, CRITICALITY, ['x:y/z']);
    const removed = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    setElementTag(removed, NATURE, [DATA]);

    surface.store.readonly = true;

    // 1. create the map — used to THROW out of `updateElement`.
    expect(setElementTag(created, NATURE, [DATA])).toBe(false);
    // 2. mutate an existing map in place — used to WRITE.
    expect(setElementTag(mutated, NATURE, [PRACTICE])).toBe(false);
    // 3. remove the last tag, i.e. `clearField` — used to WRITE.
    expect(setElementTag(removed, NATURE, [])).toBe(false);

    expect(created.yMap.has('tags')).toBe(false);
    expect(readElementTags(mutated)).toEqual({
      [NATURE]: [DATA],
      [CRITICALITY]: ['x:y/z'],
    });
    expect(readElementTags(removed)).toEqual({ [NATURE]: [DATA] });
    // A refusal, not a silent one: three calls, three warnings.
    expect(warn).toHaveBeenCalledTimes(3);
    warn.mockRestore();
  });

  test('lifting read-only lets the same gesture through', () => {
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;
    surface.store.readonly = true;
    setElementTag(el, NATURE, [DATA]);
    surface.store.readonly = false;

    expect(setElementTag(el, NATURE, [DATA])).toBe(true);
    expect(readElementTags(el)).toEqual({ [NATURE]: [DATA] });
  });
});

describe('tags emit an element update, including from a nested write', () => {
  test('the surface reports every in-place tag write, with its own local flag', () => {
    const { surface } = setupSurface('tags-events');
    const el = surface.getElementById(
      surface.addElement({ type: 'testShape' })
    )!;

    const seen: { id: string; local: boolean }[] = [];
    surface.elementUpdated.subscribe(({ id, props, local }) => {
      if ('tags' in props) seen.push({ id, local });
    });

    // First write: goes through the accessor, so the top-level key changes.
    setElementTag(el, NATURE, [DATA]);
    // Second write: mutates the NESTED map only. `syncElementFromY` observes
    // the element's own Y.Map and would see nothing — the `@observe` bridge is
    // what puts a per-tag write on the same footing as every other field, for
    // the renderer, the rules engine and `PivotMaterialityPublisher` alike.
    setElementTag(el, CRITICALITY, ['wardley:criticality/high']);

    expect(seen.length).toBeGreaterThanOrEqual(2);
    expect(seen.every(entry => entry.id === el.id)).toBe(true);
    expect(seen.every(entry => entry.local)).toBe(true);
  });
});

describe('two clients qualifying one element', () => {
  test('different tags MERGE; the same tag is last-write-wins', () => {
    // The single argument the nested-map decision rests on, played out on two
    // real Yjs documents. With a plain object one of the two would silently
    // lose their qualification — and there is no migration runner to fix the
    // shape afterwards.
    const alice = new Y.Doc();
    const bob = new Y.Doc();

    const aliceTags = alice.getMap<Y.Map<string[]>>('element');
    alice.transact(() => {
      aliceTags.set('tags', new Y.Map<string[]>());
      aliceTags.get('tags')!.set(NATURE, [DATA]);
    });
    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));

    // Concurrently: Alice qualifies the criticality, Bob changes the nature.
    alice.transact(() => {
      aliceTags.get('tags')!.set(CRITICALITY, ['wardley:criticality/high']);
    });
    const bobTags = bob.getMap<Y.Map<string[]>>('element');
    bob.transact(() => {
      bobTags.get('tags')!.set(NATURE, [PRACTICE]);
    });

    Y.applyUpdate(alice, Y.encodeStateAsUpdate(bob));
    Y.applyUpdate(bob, Y.encodeStateAsUpdate(alice));

    for (const doc of [alice, bob]) {
      const merged = doc
        .getMap<Y.Map<string[]>>('element')
        .get('tags')!
        .toJSON();
      // Nobody lost anything: two tags, two authors, one element.
      expect(merged[CRITICALITY]).toEqual(['wardley:criticality/high']);
      expect(merged[NATURE]).toEqual([PRACTICE]);
    }
  });
});
