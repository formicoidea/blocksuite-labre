/**
 * The Porter's-forces **competition** tag, and the watcher that keeps it saying
 * the same thing as the letter in the circle.
 *
 * Three claims live here:
 *
 * 1. The tag is declared on `wardley:porter` and on nothing else. A force is
 *    not a link in the value chain, so the nature must not reach it — and this
 *    must not reach a component.
 * 2. The letter and the value are related by one pure, total function each way.
 *    It is the part worth being wrong about, so it is tested without a
 *    document anywhere near it.
 * 3. The tag is DERIVED from the letter, at every instant history passes
 *    through. That is the claim the recette of #211 broke: reconciling only
 *    when the editor closed left an undo landing on an intermediate text — two
 *    letters at once — that carried the force of the text after it. The undo
 *    ladder is walked here, step by step, in both directions.
 */
import {
  buildUniverseRegistry,
  tagAppliesToRole,
} from '@labre/affine-shared/services';
import { WardleyNodeElementModel } from '@labre/affine-model';
import {
  elementTagValues,
  readElementTags,
  setElementTag,
} from '@labre/std/gfx';
import { describe, expect, test, vi } from 'vitest';
import * as Y from 'yjs';

import {
  WARDLEY_COMPETITION,
  WARDLEY_COMPETITION_TAG_ID,
  WARDLEY_NATURE_TAG_ID,
  WARDLEY_TAG_DEFS,
} from '../natures';
import {
  WardleyPorterWatcher,
  wardleyEditingIds,
} from '../node/porter-watcher';
import {
  competitionOfPorterLetter,
  porterLetterOfCompetition,
} from '../porter-competition';
import { WARDLEY_ROLE, WARDLEY_ROLES } from '../roles';

/* ── What the pack declares ───────────────────────────────────────────── */

describe('the competition tag', () => {
  const registry = buildUniverseRegistry([WARDLEY_TAG_DEFS]);

  test('rides on the pack the library already ships, with no issue', () => {
    // A second tag on the SAME pack, not a second pack: `wardley-core` is the
    // library's one seeded pack, and a pack per tag would make a client's
    // private extension have to guess which of them to merge with.
    expect(registry.issues()).toEqual([]);
    expect(registry.frameworks()).toEqual(['wardley']);
  });

  test('offers the three forces, single-valued, letter in the label', () => {
    const competition = registry.tag(WARDLEY_COMPETITION_TAG_ID)!;

    expect(competition).toBeTruthy();
    // There is exactly one letter in the circle, so a second value would be a
    // qualification the map could not show.
    expect(competition.cardinality).toBe('single');
    expect(
      (competition.values as { id: string; label: string }[]).map(v => [
        v.id,
        v.label,
      ])
    ).toEqual([
      [WARDLEY_COMPETITION.relative, 'Relative competition (R)'],
      [WARDLEY_COMPETITION.struggle, 'Struggle for survival (L)'],
      [WARDLEY_COMPETITION.establish, 'Struggle to establish (E)'],
    ]);
  });

  test('qualifies the porter, and nothing else on the map', () => {
    const competition = registry.tag(WARDLEY_COMPETITION_TAG_ID)!;

    expect(
      tagAppliesToRole(competition, WARDLEY_ROLE.porter, WARDLEY_ROLES)
    ).toBe(true);

    for (const role of [
      // The value chain and its specialisations. `wardley:porter` has no
      // parent precisely so these two families never meet.
      WARDLEY_ROLE.component,
      WARDLEY_ROLE.market,
      WARDLEY_ROLE.ecosystem,
      WARDLEY_ROLE.anchor,
      WARDLEY_ROLE.pipeline,
      WARDLEY_ROLE.method,
      WARDLEY_ROLE.map,
      WARDLEY_ROLE.changeArrow,
      WARDLEY_ROLE.inertia,
      WARDLEY_ROLE.label,
      WARDLEY_ROLE.dependency,
    ]) {
      expect(tagAppliesToRole(competition, role, WARDLEY_ROLES), role).toBe(
        false
      );
    }
  });

  test('and the nature never reaches the porter', () => {
    // The other half of the same claim, asserted from the other side: a force
    // is not something that has a nature.
    const nature = registry.tag(WARDLEY_NATURE_TAG_ID)!;
    expect(tagAppliesToRole(nature, WARDLEY_ROLE.porter, WARDLEY_ROLES)).toBe(
      false
    );
  });
});

/* ── The letter and the value, both ways ──────────────────────────────── */

describe('reading a letter as a force', () => {
  test('reads the three letters', () => {
    expect(competitionOfPorterLetter('R')).toBe(WARDLEY_COMPETITION.relative);
    expect(competitionOfPorterLetter('L')).toBe(WARDLEY_COMPETITION.struggle);
    expect(competitionOfPorterLetter('E')).toBe(WARDLEY_COMPETITION.establish);
  });

  test('forgives the shift key and the whitespace the editor leaves', () => {
    // `l` is the same force as `L`: making the qualification depend on a
    // modifier key would be a rule about typing, not about mapping.
    expect(competitionOfPorterLetter(' l ')).toBe(WARDLEY_COMPETITION.struggle);
    expect(competitionOfPorterLetter('\ne\t')).toBe(
      WARDLEY_COMPETITION.establish
    );
  });

  test('reads anything else as no force at all', () => {
    // Never the nearest value: a glyph nobody can read must not be reported as
    // a force somebody named.
    expect(competitionOfPorterLetter('X')).toBeNull();
    expect(competitionOfPorterLetter('RL')).toBeNull();
    expect(competitionOfPorterLetter('')).toBeNull();
    expect(competitionOfPorterLetter('   ')).toBeNull();
    expect(competitionOfPorterLetter(undefined)).toBeNull();
    expect(competitionOfPorterLetter(null)).toBeNull();
    // Not a lookup on a bare object: `toString` is not a force either.
    expect(competitionOfPorterLetter('toString')).toBeNull();
  });
});

describe('drawing a force as a letter', () => {
  test('draws the three values', () => {
    expect(porterLetterOfCompetition(WARDLEY_COMPETITION.relative)).toBe('R');
    expect(porterLetterOfCompetition(WARDLEY_COMPETITION.struggle)).toBe('L');
    expect(porterLetterOfCompetition(WARDLEY_COMPETITION.establish)).toBe('E');
  });

  test('draws nothing for a value it does not know', () => {
    // Defs are runtime configuration and are never persisted, so a board may
    // carry a value whose pack was removed or renamed.
    expect(porterLetterOfCompetition('wardley:competition/retired')).toBeNull();
    expect(porterLetterOfCompetition(WARDLEY_NATURE_TAG_ID)).toBeNull();
    expect(porterLetterOfCompetition(undefined)).toBeNull();
    expect(porterLetterOfCompetition('toString')).toBeNull();
  });

  test('round-trips: every value draws a letter that reads back as it', () => {
    for (const value of Object.values(WARDLEY_COMPETITION)) {
      expect(competitionOfPorterLetter(porterLetterOfCompetition(value))).toBe(
        value
      );
    }
  });
});

/* ── Whose caret is where ─────────────────────────────────────────────── */

describe('the ids being edited', () => {
  const selection = (elements: string[], editing?: boolean) => ({
    elements,
    editing,
  });

  test('are the ones an editor is mounted on, and no others', () => {
    expect([
      ...wardleyEditingIds([selection(['p'], true), selection(['q'])]),
    ]).toEqual(['p']);
    // Bare canvas, which is what arrives when an editor closes onto nothing.
    expect([...wardleyEditingIds([])]).toEqual([]);
    expect([...wardleyEditingIds([selection(['p'])])]).toEqual([]);
  });
});

/* ── The watcher, on a stubbed surface over a real Y.Doc ──────────────── */

/** A subscribable the watcher can be driven through, and the test can fire. */
function subject<T>() {
  const listeners: ((value: T) => void)[] = [];
  return {
    subscribe(listener: (value: T) => void) {
      listeners.push(listener);
      return {
        unsubscribe() {
          const at = listeners.indexOf(listener);
          if (at >= 0) listeners.splice(at, 1);
        },
      };
    },
    next(value: T) {
      for (const listener of [...listeners]) listener(value);
    },
  };
}

/** Let every microtask the watcher queued run before asserting. */
const flush = () => new Promise(resolve => setTimeout(resolve, 0));

interface Harness {
  watcher: WardleyPorterWatcher;
  element: WardleyNodeElementModel;
  /** Edit the letter as the inline editor does: its own Yjs undo scope. */
  type(edit: (text: Y.Text) => void): Promise<void>;
  /** Open / close the shape editor on the circle. */
  edit(open: boolean): void;
  /** Write the tag the way `tag.set` does — its own undo entry, then a write. */
  pick(values: string[]): Promise<void>;
  letter(): string;
  values(): string[];
  undo(): Promise<void>;
  redo(): Promise<void>;
  canUndo(): boolean;
  canRedo(): boolean;
  entries(): number;
  captureSync: ReturnType<typeof vi.fn>;
}

/**
 * A porter on a stubbed surface over a REAL `Y.Doc`, a real `Y.Text`, a real
 * nested `Y.Map` and a real `Y.UndoManager`.
 *
 * Faithful on the three points the recette of #211 turned on, because a stub
 * that got any of them wrong would prove nothing:
 *
 * - the text and the tag map are bridged into `elementUpdated` by real Yjs
 *   observers, exactly as `watchText` and `observeTags` do, so the watcher is
 *   woken the way the editor wakes it;
 * - the store honours `shouldTransact`, so `withoutTransact` really does write
 *   with an origin the undo manager ignores;
 * - the undo manager is the real one, tracking this client's origin, so
 *   "how many entries did that gesture cost" is measured rather than asserted.
 */
function harness(
  options: {
    letter?: string;
    tags?: Record<string, string[]>;
    kind?: string;
    readonly?: boolean;
    locked?: boolean;
  } = {}
): Harness {
  const doc = new Y.Doc();
  const root = doc.getMap('element');
  const text = new Y.Text();
  const elementUpdated = subject<{
    id: string;
    props: Record<string, unknown>;
    local: boolean;
  }>();

  doc.transact(() => {
    root.set('text', text);
    text.insert(0, options.letter ?? '');
    if (options.tags) {
      // Integrated FIRST, then filled: a preliminary `Y.Map` holds its content
      // in `_prelimContent` and reads back empty, so a test built on one would
      // assert nothing.
      root.set('tags', new Y.Map<string[]>());
      for (const [id, values] of Object.entries(options.tags)) {
        (root.get('tags') as Y.Map<string[]>).set(id, values);
      }
    }
  }, doc.clientID);

  const undoManager = new Y.UndoManager(root, {
    trackedOrigins: new Set([doc.clientID]),
  });

  let shouldTransact = true;
  const captureSync = vi.fn(() => undoManager.stopCapturing());
  const store = {
    readonly: options.readonly ?? false,
    captureSync,
    transact: (fn: () => void, st: boolean = shouldTransact) =>
      doc.transact(fn, st ? doc.clientID : null),
    withoutTransact: (fn: () => void) => {
      shouldTransact = false;
      fn();
      shouldTransact = true;
    },
  };

  const surface = {
    store,
    elementUpdated,
    getElementById: (id: string) => (id === 'porter-1' ? element : null),
    updateElement: (_id: string, props: Record<string, unknown>) => {
      // Integrating the fresh map is what `updateElement` really does: a
      // preliminary `Y.Map` reads empty, so a stub that just kept the reference
      // would make every assertion below vacuous.
      store.transact(() => root.set('tags', props.tags as Y.Map<string[]>));
    },
  };

  const element = Object.create(WardleyNodeElementModel.prototype, {
    id: { value: 'porter-1' },
    kind: { value: options.kind ?? 'porter' },
    text: { value: text },
    // A GETTER, like the `@field()` accessor it stands in for, which resolves
    // `yMap.get(prop)` on every read. A cached reference would go stale the
    // moment the key itself was rewritten — by `updateElement`, by a remote
    // peer or by an undo — and every write through it would go to a deleted
    // type and be silently lost.
    tags: { get: () => root.get('tags') as Y.Map<string[]> | undefined },
    surface: { value: surface, writable: true },
    isLocked: { value: () => options.locked ?? false },
    clearField: {
      value: () => {
        store.transact(() => root.delete('tags'));
      },
    },
  }) as WardleyNodeElementModel;

  /* The two bridges the model ships, reproduced. */

  // `watchText`: every change of the nested Y.Text, carrying the transaction's
  // own `local` flag — a keystroke, an undo and a redo alike.
  text.observe((_event, transaction) =>
    elementUpdated.next({
      id: 'porter-1',
      props: { text },
      local: transaction.local,
    })
  );

  // `observeTags`: mutations INSIDE the nested map.
  let unobserveTags: (() => void) | null = null;
  const observeTags = () => {
    unobserveTags?.();
    unobserveTags = null;
    const map = root.get('tags') as Y.Map<string[]> | undefined;
    if (!map) return;
    const fn = (_event: unknown, transaction: Y.Transaction) =>
      elementUpdated.next({
        id: 'porter-1',
        props: { tags: map },
        local: transaction.local,
      });
    map.observe(fn);
    unobserveTags = () => map.unobserve(fn);
  };
  observeTags();

  // `syncElementFromY`: the KEY itself being written, re-attaching the nested
  // observer and republishing — and, on a delete, republishing nothing, which
  // is what the real bridge does (it fills `oldValues`, never `props`).
  root.observe((event, transaction) => {
    if (!event.keysChanged.has('tags')) return;
    observeTags();
    if (!element.tags) return;
    elementUpdated.next({
      id: 'porter-1',
      props: { tags: element.tags },
      local: transaction.local,
    });
  });

  const selectionUpdated =
    subject<readonly { elements: readonly string[]; editing?: boolean }[]>();

  const gfx = {
    std: { store },
    selection: { slots: { updated: selectionUpdated } },
    surface,
    surface$: {
      subscribe(listener: (value: typeof surface) => void) {
        listener(surface);
        return () => {};
      },
    },
  };

  const watcher = new WardleyPorterWatcher(gfx as never);
  watcher.mounted();

  return {
    watcher,
    element,
    async type(edit) {
      // Each keystroke is its OWN undo scope, which is what the inline editor
      // produces and what the recette's repro turns on: without this every
      // simulated edit would merge into one entry and the intermediate states
      // an undo lands on would never exist.
      undoManager.stopCapturing();
      store.transact(() => edit(text));
      await flush();
    },
    edit(open) {
      selectionUpdated.next(
        open ? [{ elements: ['porter-1'], editing: true }] : []
      );
    },
    async pick(values) {
      // What `tag.set` does: its own undo checkpoint, then the write.
      store.captureSync();
      setElementTag(element, WARDLEY_COMPETITION_TAG_ID, values);
      await flush();
    },
    letter: () => text.toString(),
    values: () => elementTagValues(element, WARDLEY_COMPETITION_TAG_ID),
    async undo() {
      undoManager.undo();
      await flush();
    },
    async redo() {
      undoManager.redo();
      await flush();
    },
    canUndo: () => undoManager.canUndo(),
    canRedo: () => undoManager.canRedo(),
    entries: () => undoManager.undoStack.length,
    captureSync,
  };
}

/** The invariant, checkable at any instant: the tag is a reading of the text. */
function expectConsistent(h: Harness, where: string) {
  const expected = competitionOfPorterLetter(h.letter());
  expect(h.values(), `${where} — text ${JSON.stringify(h.letter())}`).toEqual(
    expected ? [expected] : []
  );
}

describe('the letter tells the tag what to say', () => {
  test('a typed letter qualifies the glyph as it is typed', async () => {
    const h = harness({ letter: '' });
    h.edit(true);
    await h.type(t => t.insert(0, 'E'));

    expect(h.values()).toEqual([WARDLEY_COMPETITION.establish]);
    // Derived, never captured: the author undoes the letter they typed, not
    // the reading of it.
    expect(h.captureSync).not.toHaveBeenCalled();
    expect(h.entries()).toBe(1);
  });

  test('a letter typed in lower case says the same force', async () => {
    const h = harness({ letter: '' });
    await h.type(t => t.insert(0, 'l'));

    expect(h.values()).toEqual([WARDLEY_COMPETITION.struggle]);
    // The circle keeps what the author typed: this direction states a fact, it
    // does not tidy the drawing — and rewriting it would throw their caret.
    expect(h.letter()).toBe('l');
  });

  test('replacing the letter replaces the force', async () => {
    const h = harness({
      letter: 'R',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.struggle] },
    });
    await h.type(t => {
      t.delete(0, 1);
      t.insert(0, 'R');
    });

    expect(h.values()).toEqual([WARDLEY_COMPETITION.relative]);
  });

  test('a letter nobody can read clears the tag, key and all', async () => {
    const h = harness({
      letter: 'R',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.relative] },
    });
    await h.type(t => t.insert(1, 'R'));

    // `RR` is not a force, and this is exactly the intermediate state an undo
    // of a select-all-and-retype stops on.
    expect(h.letter()).toBe('RR');
    expect(h.values()).toEqual([]);
    expect(readElementTags(h.element)).toEqual({});
  });

  test('an emptied circle clears it too', async () => {
    const h = harness({
      letter: 'R',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.relative] },
    });
    await h.type(t => t.delete(0, 1));

    expect(h.values()).toEqual([]);
  });

  test('it leaves a colleague’s other qualification alone', async () => {
    // The whole reason `tags` is a nested map: two people qualifying one
    // element on two different tags both keep their work.
    const h = harness({
      letter: '',
      tags: { 'acme:criticality': ['acme:criticality/high'] },
    });
    await h.type(t => t.insert(0, 'R'));

    expect(readElementTags(h.element)).toEqual({
      'acme:criticality': ['acme:criticality/high'],
      [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.relative],
    });
  });
});

describe('the tag tells the letter what to draw', () => {
  test('picking a force redraws the circle', async () => {
    const h = harness({ letter: 'R' });
    await h.pick([WARDLEY_COMPETITION.establish]);

    expect(h.letter()).toBe('E');
  });

  test('the rewrite is in place, on the same Y.Text', async () => {
    // The instance is what the element's change watcher and any bound editor
    // hold; swapping it would leave both pointing at a text nobody is editing.
    const h = harness({ letter: 'R' });
    const before = h.element.text;
    await h.pick([WARDLEY_COMPETITION.struggle]);

    expect(h.element.text).toBe(before);
    expect(h.letter()).toBe('L');
  });

  test('clearing the tag leaves the drawing exactly as it is', async () => {
    // Un-picking is a statement about the QUALIFICATION — "I no longer claim
    // which force this is" — and not about the map somebody is still reading.
    // Nothing changes the text, so nothing re-reads it either: the tie is
    // re-tied by the next edit of the letter and by nothing else.
    const h = harness({
      letter: 'L',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.struggle] },
    });
    await h.pick([]);

    expect(h.letter()).toBe('L');
    expect(h.values()).toEqual([]);
  });

  test('a value whose def has vanished draws nothing', async () => {
    const h = harness({ letter: 'R' });
    await h.pick(['wardley:competition/retired']);

    expect(h.letter()).toBe('R');
  });

  test('it never rewrites a circle somebody has their caret in', async () => {
    // C4's lesson, and the reason the editing set is tracked at all.
    const h = harness({ letter: 'R' });
    h.edit(true);
    await h.pick([WARDLEY_COMPETITION.establish]);

    expect(h.letter()).toBe('R');
  });

  test('a remote peer’s qualification is not redrawn here', async () => {
    // `local` partitions the fleet into one writer and N−1 silent observers.
    // Without it every peer would rewrite the same letter on sync, and N−1 of
    // them would get an entry for a gesture they did not make.
    const h = harness({ letter: 'R' });
    h.element.surface.elementUpdated.next({
      id: 'porter-1',
      props: { tags: h.element.tags },
      local: false,
    } as never);
    await flush();

    expect(h.letter()).toBe('R');
  });

  test('a prop that is neither the letter nor the tag changes nothing', async () => {
    const h = harness({
      letter: 'R',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.struggle] },
    });
    h.element.surface.elementUpdated.next({
      id: 'porter-1',
      props: { xywh: '[0,0,60,60]' },
      local: true,
    } as never);
    await flush();

    expect(h.letter()).toBe('R');
    expect(h.values()).toEqual([WARDLEY_COMPETITION.struggle]);
  });
});

describe('the two directions cannot chase each other', () => {
  test('a letter that already says the force is not rewritten', async () => {
    // Semantic comparison, not character by character: `e` already says
    // "struggle to establish", so the derived tag must not turn round and
    // uppercase the author's own letter.
    const h = harness({ letter: '' });
    await h.type(t => t.insert(0, 'e'));

    expect(h.letter()).toBe('e');
    expect(h.values()).toEqual([WARDLEY_COMPETITION.establish]);
  });

  test('picking the force the letter already says writes nothing', async () => {
    const h = harness({ letter: 'L' });
    await h.pick([WARDLEY_COMPETITION.struggle]);

    expect(h.letter()).toBe('L');
  });

  test('a full round settles, and stays settled', async () => {
    const h = harness({ letter: 'R' });

    await h.type(t => {
      t.delete(0, 1);
      t.insert(0, 'E');
    });
    expect([h.letter(), h.values()]).toEqual([
      'E',
      [WARDLEY_COMPETITION.establish],
    ]);

    await h.pick([WARDLEY_COMPETITION.struggle]);
    expect([h.letter(), h.values()]).toEqual([
      'L',
      [WARDLEY_COMPETITION.struggle],
    ]);
  });
});

/* ── The undo ladder: the defect the recette of #211 found ────────────── */

describe('walking the history of a TYPED letter', () => {
  /**
   * The recette's repro, as Yjs sees it: the inline editor writes a
   * select-all-and-retype as several operations in SEPARATE undo scopes, so an
   * undo lands on intermediate texts — two letters at once, then none — that
   * are not a force at all.
   */
  const retyped = async () => {
    const h = harness({
      letter: 'R',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.relative] },
    });
    h.edit(true);
    await h.type(t => t.insert(1, 'E')); // "RE"
    await h.type(t => t.delete(0, 1)); // "E"
    h.edit(false);
    return h;
  };

  test('ends where the author left it', async () => {
    const h = await retyped();

    expect(h.letter()).toBe('E');
    expect(h.values()).toEqual([WARDLEY_COMPETITION.establish]);
  });

  test('every state an undo lands on has a tag that matches its text', async () => {
    const h = await retyped();

    // The defect: an intermediate text used to carry the tag of the text that
    // came after it — "RE" qualified as a force, which two letters never are.
    let step = 0;
    while (h.canUndo()) {
      await h.undo();
      expectConsistent(h, `after undo ${++step}`);
    }
    expect(step).toBe(2);
    // All the way back to the letter the glyph was born with.
    expect(h.letter()).toBe('R');
    expect(h.values()).toEqual([WARDLEY_COMPETITION.relative]);
  });

  test('every state a redo lands on does too, and it ends at E', async () => {
    const h = await retyped();
    while (h.canUndo()) await h.undo();

    let step = 0;
    while (h.canRedo()) {
      await h.redo();
      expectConsistent(h, `after redo ${++step}`);
    }
    // The document returns EXACTLY to where it started, tag included — which is
    // what the recette found it did not.
    expect(h.letter()).toBe('E');
    expect(h.values()).toEqual([WARDLEY_COMPETITION.establish]);
  });

  test('the qualification costs no entry of its own', async () => {
    // The count is the mechanism: two edits typed, two entries to walk back.
    // A tag captured on its own would make it three, and the third would leave
    // an intermediate text carrying a stale force — which is what it did.
    const h = await retyped();

    expect(h.entries()).toBe(2);
  });
});

describe('walking the history of a PICKED force', () => {
  test('a pick costs exactly one entry, redrawing included', async () => {
    const h = harness({ letter: 'R' });
    await h.pick([WARDLEY_COMPETITION.establish]);
    expect([h.letter(), h.values()]).toEqual([
      'E',
      [WARDLEY_COMPETITION.establish],
    ]);
    // The tag write and the redraw it caused, in one entry: the redraw runs
    // inside the very transaction the qualification opened.
    expect(h.entries()).toBe(1);

    await h.undo();

    expect(h.letter()).toBe('R');
    expect(h.canUndo()).toBe(false);
    // …and the letter that came back is READ, like every other letter: the
    // glyph says R, so it is relative competition. This is the one place undo
    // does not restore the state byte for byte — a porter is born reading `R`
    // and carrying no tag, the only state where the drawing and the
    // qualification were ever allowed to disagree. Landing on the consistent
    // state rather than on the unqualified one is the invariant doing its job.
    expectConsistent(h, 'after undoing the pick');
    expect(h.values()).toEqual([WARDLEY_COMPETITION.relative]);
  });

  test('and redoing it puts both back', async () => {
    const h = harness({ letter: 'R' });
    await h.pick([WARDLEY_COMPETITION.establish]);
    await h.undo();
    await h.redo();

    expect(h.letter()).toBe('E');
    expect(h.values()).toEqual([WARDLEY_COMPETITION.establish]);
  });
});

describe('what the watcher refuses to touch', () => {
  test('a read-only document', async () => {
    const h = harness({ letter: 'R', readonly: true });
    await h.type(t => t.insert(1, 'E'));

    expect(h.values()).toEqual([]);
  });

  test('a locked glyph', async () => {
    const h = harness({ letter: '', locked: true });
    await h.type(t => t.insert(0, 'E'));

    expect(h.values()).toEqual([]);
  });

  test('a wardley node that is not a force', async () => {
    // Every other kind wears its name as a separate text element, so its inner
    // text is empty by design — and a letter is not a nature.
    const h = harness({ letter: '', kind: 'component' });
    await h.type(t => t.insert(0, 'R'));

    expect(h.values()).toEqual([]);
  });

  test('anything at all, once it is unmounted', async () => {
    const h = harness({ letter: '' });
    h.watcher.unmounted();
    await h.type(t => t.insert(0, 'E'));

    expect(h.values()).toEqual([]);
  });
});
