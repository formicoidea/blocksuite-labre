import type { UmlNodeKind } from '@labre/affine-model';
import { Bound } from '@labre/global/gfx';
import type { GfxController } from '@labre/std/gfx';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  UML_ATTRIBUTE_LINES,
  UML_TIER_SIDE_INSET,
  umlCompartmentBoxes,
  umlStackHeight,
  type UmlTierLines,
  umlTierLineCount,
} from '../component.js';
import { UML_NODE_BOX } from '../consts.js';
import {
  UmlCompartmentWatcher,
  umlEditingTransition,
} from '../node/compartment-watcher.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from '../roles.js';

/**
 * The compartment watcher, on a fake document.
 *
 * What is worth proving here is the DECISION and nothing around it: given a
 * classifier whose second tier has outgrown the three lines the stencil sized
 * it for, does the box grow, do the tiers follow, and — the half that costs an
 * author an undo step every time it is wrong — does the watcher hold still when
 * nothing has changed.
 *
 * So the surface is four plain objects and the selection is a slot somebody
 * calls by hand. The watcher reads elements structurally (`id`, `type`, `role`,
 * `text`, `xywh`) exactly so this is possible: a Yjs document standing behind
 * every box would test the store, not the decision. The live document is
 * `integration-test/edgeless/uml-compartments.spec.ts`'s job.
 */

/**
 * The one thing a fake document cannot state: how WIDE a word is.
 *
 * `umlTierWrapper` is the renderer's own `wrapText` over a canvas measurer, and
 * `happy-dom` has no `measureText` worth the name — so it is replaced by an
 * arithmetic one that breaks a line at a fixed character width. Two properties
 * of the real one are kept, because the fit depends on both: it answers
 * `undefined` for an element that states no FACE (which every fixture below but
 * one does, so they are measured by their newlines exactly as before), and it
 * counts VISUAL lines for one that does.
 *
 * The real wrapper is proved where a real canvas exists —
 * `integration-test/edgeless/uml-compartments.spec.ts`.
 */
vi.mock('../node/tier-metrics.js', () => ({
  umlTierWrapper: (face: { fontSize?: number }, width: number) => {
    const size = face.fontSize;
    if (size === undefined || !(width > 0)) return undefined;
    return (line: string) => Math.ceil((line.length * size) / width) || 1;
  },
}));

/* ── The fake document ─────────────────────────────────────────────────── */

interface FakeElement {
  id: string;
  type: string;
  role?: string;
  text?: string;
  kind?: UmlNodeKind;
  xywh: string;
  /** The face, when a fixture wants its words MEASURED rather than counted. */
  fontFamily?: string;
  fontSize?: number;
  fontWeight?: string;
  readonly deserializedXYWH: [number, number, number, number];
  childIds?: string[];
  isLocked(): boolean;
}

/** One element, with `deserializedXYWH` derived so a write is visible in both. */
function element(props: Partial<FakeElement> & { id: string; type: string }) {
  const el: FakeElement = {
    xywh: '[0,0,0,0]',
    isLocked: () => false,
    get deserializedXYWH() {
      return JSON.parse(el.xywh) as [number, number, number, number];
    },
    ...props,
  } as FakeElement;
  return el;
}

type Selection = { elements: readonly string[]; editing?: boolean };

/** A hand-driven `slots.updated`. */
function slot() {
  const listeners: ((value: Selection[]) => void)[] = [];
  return {
    subscribe(listener: (value: Selection[]) => void) {
      listeners.push(listener);
      return {
        unsubscribe() {
          listeners.splice(listeners.indexOf(listener), 1);
        },
      };
    },
    next(value: Selection[]) {
      for (const listener of [...listeners]) listener(value);
    },
  };
}

/**
 * A class, its three tiers and the group holding them — laid out exactly as
 * `createUmlClassifier` lays them, because that is the document an author meets.
 */
function classifier(
  kind: UmlNodeKind = 'class',
  text: { name?: string; attributes?: string; operations?: string } = {}
) {
  const { w, h } = UML_NODE_BOX[kind];
  const boxes = umlCompartmentBoxes(kind, 0, 0, w, h);
  const node = element({
    id: 'shape',
    type: 'umlNode',
    kind,
    // The SHAPE carries a role too, and the resolution needs it: a group's
    // member is sorted by what is stamped on it, never by its position
    // (`component.ts`), so a fixture without one is a group with no shape in it.
    role: UML_ROLE_OF_KIND[kind],
    xywh: new Bound(0, 0, w, h).serialize(),
  });
  const tier = (id: string, role: string, box = boxes.name, body = '') =>
    element({
      id,
      type: 'text',
      role,
      text: body,
      xywh: new Bound(box.x, box.y, box.w, box.h).serialize(),
    });

  const name = tier('name', UML_ROLE.name, boxes.name, text.name ?? 'Class');
  const attributes = tier(
    'attributes',
    UML_ROLE.attributes,
    boxes.attributes,
    text.attributes ?? '+ a : A\n+ b : B\n+ c : C'
  );
  const operations = tier(
    'operations',
    UML_ROLE.operations,
    boxes.operations,
    text.operations ?? '+ run() : void'
  );
  const group = element({
    id: 'group',
    type: 'group',
    childIds: [node.id, name.id, attributes.id, operations.id],
  });

  return { node, name, attributes, operations, group };
}

/** The watcher, mounted on a surface holding `elements`. */
function mount(elements: FakeElement[], options: { readonly?: boolean } = {}) {
  const updated = slot();
  const store = {
    readonly: options.readonly ?? false,
    captureSync: vi.fn(),
    transact: vi.fn((fn: () => void) => fn()),
  };
  const gfx = {
    std: { store },
    surface: {
      elementModels: elements,
      getElementById: (id: string) => elements.find(el => el.id === id) ?? null,
    },
    selection: { slots: { updated } },
  };
  const watcher = new UmlCompartmentWatcher(gfx as unknown as GfxController);
  watcher.mounted();

  /** Open an editor on `id`, then close it — the one gesture that commits. */
  const commit = (id: string) => {
    updated.next([{ elements: [id], editing: true }]);
    updated.next([]);
  };

  return { commit, store, updated, watcher };
}

/** What a tier's box says, in the form the fixtures compare. */
const boxOf = (el: FakeElement) => el.xywh;
const serialize = (box: { x: number; y: number; w: number; h: number }) =>
  new Bound(box.x, box.y, box.w, box.h).serialize();

/* ── The measurement ───────────────────────────────────────────────────── */

describe('how many lines a tier holds', () => {
  it('counts the newlines the author typed, plus one', () => {
    expect(umlTierLineCount('+ a : A')).toBe(1);
    expect(umlTierLineCount('+ a : A\n+ b : B\n+ c : C')).toBe(3);
    // A trailing newline is a line: the caret is sitting on it, and the next
    // word the author types lands there.
    expect(umlTierLineCount('+ a : A\n')).toBe(2);
  });

  /**
   * An empty tier is ONE line, not none: §14.2.4 draws a state's behaviour
   * compartment ruled off and waiting, and a zero-height compartment would put
   * its separator on top of the name's.
   */
  it('gives an empty tier, and a missing one, a single line', () => {
    expect(umlTierLineCount('')).toBe(1);
    expect(umlTierLineCount(undefined)).toBe(1);
    expect(umlTierLineCount(null)).toBe(1);
  });

  /**
   * The PO's recette of 14/09/2026, at the level the mistake was made.
   *
   * A tier is created with `hasMaxWidth`, so the canvas renderer BREAKS a long
   * signature at the compartment's width before it paints it — and a count that
   * saw only the author's newlines told the watcher a three-line compartment
   * would do for six painted lines. Measured on a 200-unit class: the editor had
   * grown the box to 93 units while the author typed, and the commit put it back
   * to 54.6, painting the remainder through the separator under it.
   *
   * The wrapper is injected, so what is proved here is the ARITHMETIC — the real
   * one is `umlTierWrapper`, and it is the renderer's own `wrapText`.
   */
  it('counts the lines the renderer WRAPS, not just the ones typed', () => {
    // Anything past ten characters takes a second visual line.
    const wrap = (line: string) => Math.ceil(line.length / 10) || 1;

    expect(umlTierLineCount('+ a : A', wrap)).toBe(1);
    expect(umlTierLineCount('+ findByCustomerIdAndStatus() : X', wrap)).toBe(4);
    // Typed newlines and wrapped ones add up, line by line.
    expect(umlTierLineCount('+ a : A\n+ findByCustomerId() : X', wrap)).toBe(4);
    // A blank line is still a line, whatever a measurer says about it.
    expect(umlTierLineCount('\n\n', wrap)).toBe(3);
  });
});

describe('how tall a stack has to be', () => {
  /**
   * The two functions are one walk read in opposite directions, and this is the
   * invariant that says so: at exactly the height `umlStackHeight` asks for, the
   * operations compartment — which always takes "the rest" — comes out at
   * exactly the lines it holds.
   */
  it('is the height at which the last compartment fits its lines exactly', () => {
    const lines: UmlTierLines = { name: 1, attributes: 5, operations: 2 };
    const height = umlStackHeight('class', lines)!;
    const boxes = umlCompartmentBoxes('class', 0, 0, 200, height, lines);
    const perLine = boxes.attributes!.h / 5;
    expect(boxes.operations!.h).toBeCloseTo(perLine * 2, 6);
  });

  it('asks for more height as a compartment gains lines', () => {
    const three = umlStackHeight('class', { attributes: 3 })!;
    const five = umlStackHeight('class', { attributes: 5 })!;
    expect(five).toBeGreaterThan(three);
    // The stencil's own shape is what a caller who has read nothing gets.
    expect(umlStackHeight('class', {})).toBe(
      umlStackHeight('class', { attributes: UML_ATTRIBUTE_LINES })
    );
  });

  /**
   * A package is a folder, an actor a stick figure, a junction a dot. None of
   * them is a divided box, so "how tall must this be for its words" has no
   * answer — and `null` is what says so, rather than a number nobody should act
   * on.
   */
  it('has no answer for a kind that is a picture', () => {
    for (const kind of ['package', 'actor', 'use-case', 'junction'] as const) {
      expect(umlStackHeight(kind, { name: 4 }), kind).toBeNull();
    }
  });
});

describe('the compartment layout, told the line counts', () => {
  it('is unchanged when it is told nothing', () => {
    const { w, h } = UML_NODE_BOX.class;
    expect(umlCompartmentBoxes('class', 0, 0, w, h, {})).toEqual(
      umlCompartmentBoxes('class', 0, 0, w, h)
    );
    expect(
      umlCompartmentBoxes('class', 0, 0, w, h, {
        name: 1,
        attributes: UML_ATTRIBUTE_LINES,
      })
    ).toEqual(umlCompartmentBoxes('class', 0, 0, w, h));
  });

  it('pushes the second separator down as the attributes tier grows', () => {
    const { w, h } = UML_NODE_BOX.class;
    const three = umlCompartmentBoxes('class', 0, 0, w, h);
    const five = umlCompartmentBoxes('class', 0, 0, w, h, { attributes: 5 });

    // The FIRST line does not move: it is the bottom of the name compartment,
    // and the name still holds one line.
    expect(five.splits[0]).toBe(three.splits[0]);
    expect(five.splits[1]).toBeGreaterThan(three.splits[1]);
    // …and the tier that takes "the rest" gives the room up.
    expect(five.operations!.h).toBeLessThan(three.operations!.h);
  });

  it('leaves a glyph label alone whatever it is told', () => {
    const { w, h } = UML_NODE_BOX.actor;
    expect(umlCompartmentBoxes('actor', 0, 0, w, h, { name: 4 })).toEqual(
      umlCompartmentBoxes('actor', 0, 0, w, h)
    );
  });
});

/* ── The watcher ───────────────────────────────────────────────────────── */

describe('when an edit into a compartment commits', () => {
  let parts: ReturnType<typeof classifier>;

  beforeEach(() => {
    parts = classifier();
  });

  const all = () => [parts.node, parts.name, parts.attributes, parts.group];

  it('grows the node and re-lays the tiers when the words overflow', () => {
    const { node, name, attributes, operations, group } = parts;
    attributes.text = '+ a : A\n+ b : B\n+ c : C\n+ d : D\n+ e : E';
    const before = node.xywh;

    const { commit, store } = mount([
      node,
      name,
      attributes,
      operations,
      group,
    ]);
    commit(attributes.id);

    const lines: UmlTierLines = { name: 1, attributes: 5, operations: 1 };
    const height = umlStackHeight('class', lines)!;
    expect(height).toBeGreaterThan(UML_NODE_BOX.class.h);
    expect(node.xywh).not.toBe(before);
    expect(node.deserializedXYWH[3]).toBeCloseTo(height, 6);

    // …and every tier is where the taller stack puts it, which is what keeps
    // the separators (read off these boxes by the renderer) between the words.
    const boxes = umlCompartmentBoxes('class', 0, 0, 200, height, lines);
    expect(boxOf(name)).toBe(serialize(boxes.name));
    expect(boxOf(attributes)).toBe(serialize(boxes.attributes!));
    expect(boxOf(operations)).toBe(serialize(boxes.operations!));

    // One gesture, one undo entry.
    expect(store.captureSync).toHaveBeenCalledTimes(1);
    expect(store.transact).toHaveBeenCalledTimes(1);
  });

  /**
   * The PO's recette of 14/09/2026: ONE typed attribute line, too long for the
   * compartment, which the canvas renderer therefore paints as several.
   *
   * Before this, the count was the author's newlines — so the watcher saw one
   * line, sized the compartment for one, and put back a box the editor had
   * already (correctly) grown. The wrapped remainder was painted through the
   * separator and into the operations compartment.
   *
   * The tier carries a FACE here and nowhere else in this file, because that is
   * what makes it measurable at all: an element nothing has painted has no
   * wrapping.
   */
  it('grows for the lines the renderer WRAPS, not just the ones typed', () => {
    const { node, name, attributes, operations, group } = parts;
    const [, , w] = node.deserializedXYWH;
    const tierWidth = w - w * UML_TIER_SIDE_INSET * 2;
    // 60 characters at 13px in a 168-unit compartment: five painted lines by the
    // fake wrapper's arithmetic, and one line by a newline count.
    attributes.text = '+'.repeat(60);
    attributes.fontSize = 13;
    attributes.fontFamily = 'Inter';
    attributes.fontWeight = '400';
    const painted = Math.ceil((60 * 13) / tierWidth);
    expect(painted).toBeGreaterThan(1);

    const { commit } = mount([node, name, attributes, operations, group]);
    commit(attributes.id);

    const lines: UmlTierLines = {
      name: 1,
      attributes: painted,
      operations: 1,
    };
    const height = umlStackHeight('class', lines)!;
    expect(node.deserializedXYWH[3]).toBeCloseTo(height, 6);
    // The compartment itself is tall enough for what is in it — which is the
    // half the author sees: the separator sits UNDER the last painted line.
    const boxes = umlCompartmentBoxes('class', 0, 0, w, height, lines);
    expect(boxOf(attributes)).toBe(serialize(boxes.attributes!));
    expect(boxes.attributes!.h).toBeGreaterThan(
      umlCompartmentBoxes('class', 0, 0, w, height, { ...lines, attributes: 1 })
        .attributes!.h
    );
  });

  /**
   * The common case by far: an author opens a tier, retypes a type name and
   * leaves. Nothing about the stack changed, so an unchanged write would push an
   * empty undo entry and cost them a ctrl-Z for nothing
   * (`docs/contribute/07-dev-practices.md`).
   */
  it('writes nothing at all when the stack already fits', () => {
    const { node, name, attributes, operations, group } = parts;
    attributes.text = '+ a : A\n+ b : B\n+ renamed : C';
    const before = all().map(boxOf).concat(boxOf(operations));

    const { commit, store } = mount([
      node,
      name,
      attributes,
      operations,
      group,
    ]);
    commit(attributes.id);

    expect(all().map(boxOf).concat(boxOf(operations))).toEqual(before);
    expect(store.captureSync).not.toHaveBeenCalled();
    expect(store.transact).not.toHaveBeenCalled();
  });

  /**
   * A remote peer typing five lines into the tier moves no editing selection on
   * THIS peer, so nothing leaves the editing set and nothing is re-laid here.
   * Which is the point: without it every peer in the fleet would re-apply the
   * same growth, the way the connector, frame and mindmap cascades once did (PR
   * #253).
   */
  it('ignores a tier that grew without an editor of ours on it', () => {
    const { node, name, attributes, operations, group } = parts;
    const { commit, updated, store } = mount([
      node,
      name,
      attributes,
      operations,
      group,
    ]);
    const before = node.xywh;

    // The remote write lands…
    attributes.text = '+ a : A\n+ b : B\n+ c : C\n+ d : D\n+ e : E';
    // …and this peer merely selects the component, or clicks elsewhere.
    updated.next([{ elements: [group.id] }]);
    updated.next([]);

    expect(node.xywh).toBe(before);
    expect(store.transact).not.toHaveBeenCalled();

    // The same edit committed HERE is what the growth follows.
    commit(attributes.id);
    expect(node.xywh).not.toBe(before);
  });

  it('holds still while the editor is still open', () => {
    const { node, name, attributes, operations, group } = parts;
    attributes.text = '+ a : A\n+ b : B\n+ c : C\n+ d : D\n+ e : E';
    const before = node.xywh;

    const { updated, store } = mount([
      node,
      name,
      attributes,
      operations,
      group,
    ]);
    // Keystroke after keystroke, the selection is re-emitted with the editor
    // still mounted: a re-layout on any of them would move the box under the
    // caret.
    updated.next([{ elements: [attributes.id], editing: true }]);
    updated.next([{ elements: [attributes.id], editing: true }]);

    expect(node.xywh).toBe(before);
    expect(store.transact).not.toHaveBeenCalled();
  });

  it('writes nothing in a read-only document', () => {
    const { node, name, attributes, operations, group } = parts;
    attributes.text = '+ a : A\n+ b : B\n+ c : C\n+ d : D\n+ e : E';
    const before = node.xywh;

    const { commit, store } = mount(
      [node, name, attributes, operations, group],
      { readonly: true }
    );
    commit(attributes.id);

    expect(node.xywh).toBe(before);
    expect(store.transact).not.toHaveBeenCalled();
  });

  it('writes nothing on a locked component', () => {
    const { node, name, attributes, operations, group } = parts;
    attributes.text = '+ a : A\n+ b : B\n+ c : C\n+ d : D\n+ e : E';
    node.isLocked = () => true;
    const before = node.xywh;

    const { commit } = mount([node, name, attributes, operations, group]);
    commit(attributes.id);

    expect(node.xywh).toBe(before);
  });

  /**
   * A tier whose group was released and whose shape was dragged away is words on
   * a canvas. There is no box to grow and no stack to fit, and guessing at one
   * would move text nobody asked to move.
   */
  it('writes nothing for a tier with no component behind it', () => {
    const { attributes } = parts;
    const before = attributes.xywh;
    const { commit, store } = mount([attributes]);
    commit(attributes.id);
    expect(attributes.xywh).toBe(before);
    expect(store.transact).not.toHaveBeenCalled();
  });

  /**
   * An actor's word is a `uml:label`, and an actor is a stick figure: there is
   * no compartment stack under it to overflow. The role is a trigger, the KIND
   * is what answers.
   */
  it('writes nothing when the shape is a picture rather than a divided box', () => {
    const { w, h } = UML_NODE_BOX.actor;
    const boxes = umlCompartmentBoxes('actor', 0, 0, w, h);
    const node = element({
      id: 'shape',
      type: 'umlNode',
      kind: 'actor',
      role: UML_ROLE_OF_KIND.actor,
      xywh: new Bound(0, 0, w, h).serialize(),
    });
    const label = element({
      id: 'label',
      type: 'text',
      role: UML_ROLE.label,
      text: 'A very\nlong\nname',
      xywh: new Bound(
        boxes.name.x,
        boxes.name.y,
        boxes.name.w,
        boxes.name.h
      ).serialize(),
    });
    const group = element({
      id: 'group',
      type: 'group',
      childIds: [node.id, label.id],
    });
    const before = node.xywh;

    const { commit, store } = mount([node, label, group]);
    commit(label.id);

    expect(node.xywh).toBe(before);
    expect(store.transact).not.toHaveBeenCalled();
  });

  /**
   * The height only ever goes UP. A box an author dragged taller was dragged
   * taller for the operations (§11.4.4), and reclaiming it would be undoing a
   * gesture nobody asked this watcher to judge — while the tiers still move, so
   * the separators follow the words up.
   */
  it('moves the separators up on a shorter tier, and leaves the box alone', () => {
    const tall = 400;
    const { node, name, attributes, operations, group } = classifier();
    node.xywh = new Bound(0, 0, 200, tall).serialize();
    attributes.text = '+ a : A';

    const { commit } = mount([node, name, attributes, operations, group]);
    commit(attributes.id);

    expect(node.deserializedXYWH[3]).toBe(tall);
    const boxes = umlCompartmentBoxes('class', 0, 0, 200, tall, {
      name: 1,
      attributes: 1,
      operations: 1,
    });
    expect(boxOf(attributes)).toBe(serialize(boxes.attributes!));
    // …and the operations tier takes everything the attributes gave back.
    expect(boxOf(operations)).toBe(serialize(boxes.operations!));
  });

  it('stops writing once it is unmounted', () => {
    const { node, name, attributes, operations, group } = parts;
    attributes.text = '+ a : A\n+ b : B\n+ c : C\n+ d : D\n+ e : E';
    const before = node.xywh;

    const { commit, watcher, store } = mount([
      node,
      name,
      attributes,
      operations,
      group,
    ]);
    watcher.unmounted();
    commit(attributes.id);

    expect(node.xywh).toBe(before);
    expect(store.transact).not.toHaveBeenCalled();
  });
});

/* ── The commit seam ───────────────────────────────────────────────────── */

/**
 * The same arithmetic `C4TypeLineWatcher` reads its commits off, and the only
 * part of the seam worth being wrong about: an id that APPEARS in the editing
 * set has merely started, an id in both is still going, and only one that has
 * LEFT is a commit.
 */
describe('which ids just stopped being edited', () => {
  const selection = (elements: string[], editing?: boolean) => ({
    elements,
    editing,
  });

  it('reports nothing while the editor is still mounted', () => {
    const first = umlEditingTransition(new Set(), [selection(['t'], true)]);
    expect(first.left).toEqual([]);
    expect([...first.editing]).toEqual(['t']);
    expect(
      umlEditingTransition(first.editing, [selection(['t'], true)]).left
    ).toEqual([]);
  });

  it('reports the tier the moment the editor lets go of it', () => {
    const editing = new Set(['t']);
    expect(umlEditingTransition(editing, [selection(['t'])]).left).toEqual([
      't',
    ]);
    expect(umlEditingTransition(editing, [selection(['other'])]).left).toEqual([
      't',
    ]);
    expect(umlEditingTransition(editing, []).left).toEqual(['t']);
  });

  it('follows an author moving straight from one compartment into the next', () => {
    const moved = umlEditingTransition(new Set(['attributes']), [
      selection(['operations'], true),
    ]);
    expect(moved.left).toEqual(['attributes']);
    expect([...moved.editing]).toEqual(['operations']);
  });
});
