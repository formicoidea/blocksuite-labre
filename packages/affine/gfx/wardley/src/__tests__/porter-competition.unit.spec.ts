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
 * 3. The watcher writes ONCE per gesture, in whichever direction the author
 *    worked, and writes NOTHING when the two already agree — which is the whole
 *    of why the two directions cannot chase each other round for ever.
 */
import {
  buildUniverseRegistry,
  tagAppliesToRole,
} from '@labre/affine-shared/services';
import { WardleyNodeElementModel } from '@labre/affine-model';
import { elementTagValues, readElementTags } from '@labre/std/gfx';
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
  wardleyEditingTransition,
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

/* ── The commit seam ──────────────────────────────────────────────────── */

/**
 * The one piece of logic in the letter→tag direction. The canvas text editor
 * binds its inline editor onto the element's `Y.Text`, so "the text changed"
 * fires once per keystroke; "the edit committed" is an id LEAVING the editing
 * selection, and nothing else.
 */
describe('when a letter has been committed', () => {
  const selection = (elements: string[], editing?: boolean) => ({
    elements,
    editing,
  });

  test('says nothing while the circle is still being typed into', () => {
    const first = wardleyEditingTransition(new Set(), [selection(['p'], true)]);
    expect(first.left).toEqual([]);
    expect([...first.editing]).toEqual(['p']);

    const again = wardleyEditingTransition(first.editing, [
      selection(['p'], true),
    ]);
    expect(again.left).toEqual([]);
  });

  test('reports the circle the moment the editor lets go of it', () => {
    const editing = new Set(['p']);
    expect(wardleyEditingTransition(editing, [selection(['p'])]).left).toEqual([
      'p',
    ]);
    expect(
      wardleyEditingTransition(editing, [selection(['other'])]).left
    ).toEqual(['p']);
    // Clicking onto bare canvas: an empty selection list.
    expect(wardleyEditingTransition(editing, []).left).toEqual(['p']);
  });

  test('reports each commit once, and never twice', () => {
    const after = wardleyEditingTransition(new Set(['p']), []);
    expect(after.left).toEqual(['p']);
    expect(wardleyEditingTransition(after.editing, []).left).toEqual([]);
  });
});

/* ── The watcher, on a stubbed surface ────────────────────────────────── */

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
    get count() {
      return listeners.length;
    },
  };
}

interface Harness {
  watcher: WardleyPorterWatcher;
  element: WardleyNodeElementModel;
  /** Commit an edit of the circle, as the shape editor closing would. */
  commit(): void;
  /** Republish the qualification, as `observeTags` does after a menu pick. */
  republishTags(): void;
  /** Write the tag the way `tag.set` does, then republish it. */
  pick(values: string[]): void;
  letter(): string;
  values(): string[];
  captureSync: ReturnType<typeof vi.fn>;
}

/**
 * A porter on a stubbed surface: a real `Y.Doc`, a real `Y.Text` and a real
 * nested `Y.Map`, so both write paths of `setElementTag` and the in-place text
 * rewrite are the real ones. Everything above them is a stub.
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
  });

  const captureSync = vi.fn();
  const elementUpdated = subject<{
    id: string;
    props: Record<string, unknown>;
    local: boolean;
  }>();
  const store = {
    readonly: options.readonly ?? false,
    captureSync,
    transact: (fn: () => void) => doc.transact(fn),
  };

  const surface = {
    store,
    elementUpdated,
    getElementById: (id: string) => (id === 'porter-1' ? element : null),
    updateElement: (_id: string, props: Record<string, unknown>) => {
      // Integrating the fresh map is what `updateElement` really does: a
      // preliminary `Y.Map` reads empty, so a stub that just kept the reference
      // would make every assertion below vacuous.
      doc.transact(() => root.set('tags', props.tags as Y.Map<string[]>));
      Object.defineProperty(element, 'tags', {
        value: root.get('tags'),
        writable: true,
        configurable: true,
      });
    },
  };

  const element = Object.create(WardleyNodeElementModel.prototype, {
    id: { value: 'porter-1' },
    kind: { value: options.kind ?? 'porter' },
    text: { value: text },
    tags: {
      value: root.get('tags') as Y.Map<string[]> | undefined,
      writable: true,
      configurable: true,
    },
    surface: { value: surface, writable: true },
    isLocked: { value: () => options.locked ?? false },
    clearField: {
      value: () => {
        doc.transact(() => root.delete('tags'));
        Object.defineProperty(element, 'tags', {
          value: undefined,
          writable: true,
          configurable: true,
        });
      },
    },
  }) as WardleyNodeElementModel;

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

  const republishTags = () =>
    elementUpdated.next({
      id: 'porter-1',
      props: { tags: element.tags },
      local: true,
    });

  return {
    watcher,
    element,
    commit() {
      selectionUpdated.next([{ elements: ['porter-1'], editing: true }]);
      selectionUpdated.next([]);
    },
    republishTags,
    pick(values: string[]) {
      // What `tag.set` writes, followed by the republish `observeTags` makes.
      const map = element.tags as Y.Map<string[]> | undefined;
      doc.transact(() => {
        if (values.length === 0) map?.delete(WARDLEY_COMPETITION_TAG_ID);
        else if (map) map.set(WARDLEY_COMPETITION_TAG_ID, values);
        else {
          const created = new Y.Map<string[]>();
          root.set('tags', created);
          (root.get('tags') as Y.Map<string[]>).set(
            WARDLEY_COMPETITION_TAG_ID,
            values
          );
          Object.defineProperty(element, 'tags', {
            value: root.get('tags'),
            writable: true,
            configurable: true,
          });
        }
      });
      republishTags();
    },
    letter: () => text.toString(),
    values: () => elementTagValues(element, WARDLEY_COMPETITION_TAG_ID),
    captureSync,
  };
}

describe('the letter tells the tag what to say', () => {
  test('a committed letter qualifies the glyph', () => {
    const h = harness({ letter: 'E' });
    h.commit();

    expect(h.values()).toEqual([WARDLEY_COMPETITION.establish]);
    // One undo entry, taken BEFORE the write: the tag must not be undone
    // together with whatever the author did in the previous 500 ms.
    expect(h.captureSync).toHaveBeenCalledTimes(1);
  });

  test('a letter typed in lower case says the same force', () => {
    const h = harness({ letter: 'l' });
    h.commit();

    expect(h.values()).toEqual([WARDLEY_COMPETITION.struggle]);
    // The circle keeps what the author typed: this direction states a fact, it
    // does not tidy the drawing.
    expect(h.letter()).toBe('l');
  });

  test('replacing the letter replaces the force', () => {
    const h = harness({
      letter: 'R',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.struggle] },
    });
    h.commit();

    expect(h.values()).toEqual([WARDLEY_COMPETITION.relative]);
  });

  test('a letter nobody can read clears the tag, key and all', () => {
    const h = harness({
      letter: 'X',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.relative] },
    });
    h.commit();

    expect(h.values()).toEqual([]);
    // Back to costing nothing, like an element that was never qualified.
    expect(readElementTags(h.element)).toEqual({});
  });

  test('an emptied circle clears it too', () => {
    const h = harness({
      letter: '',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.relative] },
    });
    h.commit();

    expect(h.values()).toEqual([]);
  });

  test('it leaves a colleague’s other qualification alone', () => {
    // The whole reason `tags` is a nested map: two people qualifying one
    // element on two different tags both keep their work.
    const h = harness({
      letter: 'R',
      tags: { 'acme:criticality': ['acme:criticality/high'] },
    });
    h.commit();

    expect(readElementTags(h.element)).toEqual({
      'acme:criticality': ['acme:criticality/high'],
      [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.relative],
    });
  });

  test('an unqualified glyph nobody typed into writes nothing at all', () => {
    const h = harness({ letter: '' });
    h.commit();

    expect(h.captureSync).not.toHaveBeenCalled();
    // No key written at all: an element that is never qualified stays
    // byte-identical to one created before the field existed.
    expect(h.element.tags).toBeUndefined();
    expect(readElementTags(h.element)).toEqual({});
  });
});

describe('the tag tells the letter what to draw', () => {
  test('picking a force rewrites the circle', () => {
    const h = harness({ letter: 'R' });
    h.pick([WARDLEY_COMPETITION.establish]);

    expect(h.letter()).toBe('E');
    expect(h.captureSync).toHaveBeenCalledTimes(1);
  });

  test('the rewrite is in place, on the same Y.Text', () => {
    // The instance is what the element's change watcher and any bound editor
    // hold; swapping it would leave both pointing at a text nobody is editing.
    const h = harness({ letter: 'R' });
    const before = h.element.text;
    h.pick([WARDLEY_COMPETITION.struggle]);

    expect(h.element.text).toBe(before);
    expect(h.letter()).toBe('L');
  });

  test('clearing the tag leaves the drawing exactly as it is', () => {
    // Un-picking is a statement about the QUALIFICATION — "I no longer claim
    // which force this is" — and not about the map somebody is still reading.
    const h = harness({
      letter: 'L',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.struggle] },
    });
    h.pick([]);

    expect(h.letter()).toBe('L');
    expect(h.captureSync).not.toHaveBeenCalled();
  });

  test('a value whose def has vanished draws nothing', () => {
    const h = harness({ letter: 'R' });
    h.pick(['wardley:competition/retired']);

    expect(h.letter()).toBe('R');
    expect(h.captureSync).not.toHaveBeenCalled();
  });

  test('a remote peer’s qualification is not redrawn here', () => {
    // `local` partitions the fleet into one writer and N−1 silent observers.
    // Without it every peer would rewrite the same letter on sync, and N−1 of
    // them would get an undo entry for a gesture they did not make.
    const h = harness({
      letter: 'R',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.struggle] },
    });
    h.element.surface.elementUpdated.next({
      id: 'porter-1',
      props: { tags: h.element.tags },
      local: false,
    } as never);

    expect(h.letter()).toBe('R');
  });

  test('a prop that is not the qualification is not a reason to redraw', () => {
    const h = harness({
      letter: 'R',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.struggle] },
    });
    h.element.surface.elementUpdated.next({
      id: 'porter-1',
      props: { xywh: '[0,0,60,60]' },
      local: true,
    } as never);

    expect(h.letter()).toBe('R');
  });
});

describe('the two directions cannot chase each other', () => {
  test('picking the force the letter already says writes nothing', () => {
    const h = harness({
      letter: 'L',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.struggle] },
    });
    h.republishTags();

    expect(h.letter()).toBe('L');
    expect(h.captureSync).not.toHaveBeenCalled();
  });

  test('committing the letter the tag already names writes nothing', () => {
    const h = harness({
      letter: 'L',
      tags: { [WARDLEY_COMPETITION_TAG_ID]: [WARDLEY_COMPETITION.struggle] },
    });
    h.commit();

    expect(h.values()).toEqual([WARDLEY_COMPETITION.struggle]);
    expect(h.captureSync).not.toHaveBeenCalled();
  });

  test('a full round is one write each way, and then a fixed point', () => {
    const h = harness({ letter: 'R' });

    // The author types E and closes the editor…
    h.commit();
    expect(h.values()).toEqual([WARDLEY_COMPETITION.relative]);
    expect(h.captureSync).toHaveBeenCalledTimes(1);

    // …and the republish that write produces finds the letter already right.
    h.republishTags();
    expect(h.letter()).toBe('R');
    expect(h.captureSync).toHaveBeenCalledTimes(1);

    // The author then picks another force from the menu: one rewrite…
    h.pick([WARDLEY_COMPETITION.establish]);
    expect(h.letter()).toBe('E');
    expect(h.captureSync).toHaveBeenCalledTimes(2);

    // …and committing that very letter afterwards changes nothing.
    h.commit();
    expect(h.values()).toEqual([WARDLEY_COMPETITION.establish]);
    expect(h.captureSync).toHaveBeenCalledTimes(2);
  });
});

describe('what the watcher refuses to touch', () => {
  test('a read-only document', () => {
    const h = harness({ letter: 'E', readonly: true });
    h.commit();
    h.pick([WARDLEY_COMPETITION.struggle]);

    expect(h.values()).toEqual([WARDLEY_COMPETITION.struggle]);
    // The pick above is the test's own write; the watcher added nothing to it.
    expect(h.letter()).toBe('E');
    expect(h.captureSync).not.toHaveBeenCalled();
  });

  test('a locked glyph', () => {
    const h = harness({ letter: 'E', locked: true });
    h.commit();

    expect(h.values()).toEqual([]);
    expect(h.captureSync).not.toHaveBeenCalled();
  });

  test('a wardley node that is not a force', () => {
    // Every other kind wears its name as a separate text element, so its inner
    // text is empty by design — and a letter is not a nature.
    const h = harness({ letter: 'R', kind: 'component' });
    h.commit();

    expect(h.values()).toEqual([]);
    expect(h.captureSync).not.toHaveBeenCalled();
  });

  test('anything at all, once it is unmounted', () => {
    const h = harness({ letter: 'E' });
    h.watcher.unmounted();
    h.commit();

    expect(h.values()).toEqual([]);
  });
});
