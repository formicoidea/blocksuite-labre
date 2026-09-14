import type { UmlNodeKind } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import {
  UML_ACTOR_FIGURE,
  UML_ATTRIBUTE_LINES,
  UML_NAME_GAP,
  UML_PACKAGE_TAB,
  UML_TIER_LINE_HEIGHT,
  UML_TIER_MARGIN,
  UML_TIER_SIDE_INSET,
  type UmlComponentElement,
  type UmlComponentGroup,
  umlCompartmentBoxes,
  umlComponentSiblings,
  umlGroupOf,
  umlNodeOfComponent,
  umlTierText,
} from '../component.js';
import {
  UML_BODY_FONT_SIZE,
  UML_NAME_FONT_SIZE,
  UML_NODE_BOX,
} from '../consts.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from '../roles.js';

/** Every kind the model declares, read off a table that is total over it. */
const ALL_KINDS = Object.keys(UML_NODE_BOX) as UmlNodeKind[];

/** One line of the name face — the unit nearly every offset here is built of. */
const NAME_LINE = UML_NAME_FONT_SIZE * UML_TIER_LINE_HEIGHT;

/** A kind's own default box, placed at the origin. */
const atOrigin = (kind: UmlNodeKind) => {
  const { w, h } = UML_NODE_BOX[kind];
  return umlCompartmentBoxes(kind, 0, 0, w, h);
};

describe('where a uml classifier writes its compartments', () => {
  it('stacks name, attributes and operations with two separators', () => {
    const { name, attributes, operations, splits } = atOrigin('class');

    // A margin, then one line of the name face.
    expect(name.y).toBe(UML_TIER_MARGIN);
    expect(name.h).toBeCloseTo(NAME_LINE);

    // The first separator closes the name compartment; the attributes open on
    // it, and the second separator closes them.
    expect(splits).toHaveLength(2);
    expect(splits[0]).toBeCloseTo(UML_TIER_MARGIN + NAME_LINE + UML_NAME_GAP);
    expect(attributes!.y).toBeCloseTo(splits[0]);
    expect(splits[1]).toBeCloseTo(attributes!.y + attributes!.h);
    expect(operations!.y).toBeCloseTo(splits[1]);

    // Three lines of the feature face for the attributes; the operations take
    // the REST down to the bottom margin, which is what makes a box dragged
    // taller a box with more room for operations.
    expect(attributes!.h).toBeCloseTo(
      UML_BODY_FONT_SIZE * UML_TIER_LINE_HEIGHT * UML_ATTRIBUTE_LINES
    );
    expect(operations!.y + operations!.h).toBeCloseTo(
      UML_NODE_BOX.class.h - UML_TIER_MARGIN
    );
  });

  it('gives a class, an interface and an enumeration the same rectangle', () => {
    // They are ONE drawing in §9.2.4, told apart by the keyword written above
    // the name — never by their geometry. A layout that diverged here would put
    // a visible difference on a distinction the notation makes in words.
    const class_ = JSON.stringify(atOrigin('class'));
    expect(JSON.stringify(atOrigin('interface'))).toBe(class_);
    expect(JSON.stringify(atOrigin('enumeration'))).toBe(class_);
  });

  it('stops an object one tier early: name, slots, one separator', () => {
    // §9.8.4 — an instance specification has values, not behaviour.
    const { attributes, operations, splits } = atOrigin('object');
    expect(splits).toHaveLength(1);
    expect(operations).toBeUndefined();
    expect(attributes).toBeDefined();
    // The slots take everything left, which is the tier an author of an object
    // diagram actually types in.
    expect(attributes!.y + attributes!.h).toBeCloseTo(
      UML_NODE_BOX.object.h - UML_TIER_MARGIN
    );
  });

  it('insets every compartment by the same proportional gutter', () => {
    for (const kind of ALL_KINDS) {
      const { w } = UML_NODE_BOX[kind];
      const boxes = atOrigin(kind);
      const inset = w * UML_TIER_SIDE_INSET;
      for (const box of [boxes.name, boxes.attributes, boxes.operations]) {
        if (!box) continue;
        expect(box.x, kind).toBeCloseTo(inset);
        expect(box.w, kind).toBeCloseTo(w - inset * 2);
      }
    }
  });
});

describe('where the four picture kinds write their one label', () => {
  it('gives them a single box and no separator at all', () => {
    for (const kind of ['package', 'note', 'actor', 'use-case'] as const) {
      const boxes = atOrigin(kind);
      expect(boxes.splits, kind).toEqual([]);
      expect(boxes.attributes, kind).toBeUndefined();
      expect(boxes.operations, kind).toBeUndefined();
      expect(boxes.name, kind).toBeDefined();
    }
  });

  it('centres a use case in its ellipse, over two lines', () => {
    // The longest label in the pack — a verb phrase — in the one shape with no
    // corner to hang it in (§18.1.4).
    const { h } = UML_NODE_BOX['use-case'];
    const { name } = atOrigin('use-case');
    expect(name.h).toBeCloseTo(NAME_LINE * 2);
    expect(name.y).toBeCloseTo((h - name.h) / 2);
    // Centred means centred: the gap above equals the gap below.
    expect(name.y).toBeCloseTo(h - (name.y + name.h));
  });

  it('writes an actor under its stick figure, never across it', () => {
    const { h } = UML_NODE_BOX.actor;
    const { name } = atOrigin('actor');
    expect(name.y).toBeCloseTo(h * UML_ACTOR_FIGURE);
    expect(name.h).toBeCloseTo(NAME_LINE);
    expect(name.y + name.h).toBeLessThanOrEqual(h);
  });

  it('writes a package under its tab, centred in the body', () => {
    const { h } = UML_NODE_BOX.package;
    const tab = h * UML_PACKAGE_TAB;
    const { name } = atOrigin('package');
    expect(name.y).toBeGreaterThanOrEqual(tab);
    // Centred in what the tab leaves, which is the body of the folder.
    expect(name.y - tab).toBeCloseTo(h - (name.y + name.h));
  });

  it('fills a note with its own paragraph, top-aligned', () => {
    const { h } = UML_NODE_BOX.note;
    const { name } = atOrigin('note');
    expect(name.y).toBe(UML_TIER_MARGIN);
    expect(name.h).toBeCloseTo(h - UML_TIER_MARGIN * 2);
  });
});

describe('the compartment layout as a whole', () => {
  it('keeps every box inside the node it belongs to', () => {
    // The one invariant that holds for all eight kinds: nothing a component
    // writes may hang outside the shape it is grouped with, or the group's
    // derived bounds would grow past the picture.
    for (const kind of ALL_KINDS) {
      const { w, h } = UML_NODE_BOX[kind];
      const boxes = atOrigin(kind);
      for (const box of [boxes.name, boxes.attributes, boxes.operations]) {
        if (!box) continue;
        expect(box.x, kind).toBeGreaterThanOrEqual(0);
        expect(box.y, kind).toBeGreaterThanOrEqual(0);
        expect(box.x + box.w, kind).toBeLessThanOrEqual(w);
        expect(box.y + box.h, kind).toBeLessThanOrEqual(h + 0.001);
        expect(box.h, kind).toBeGreaterThan(0);
      }
      for (const split of boxes.splits) {
        expect(split, kind).toBeGreaterThan(0);
        expect(split, kind).toBeLessThan(h);
      }
    }
  });

  it('translates with the node, and only the boxes translate', () => {
    // `splits` are offsets DOWN FROM THE TOP, not canvas coordinates: the
    // renderer strokes them relative to the shape it is painting, so moving the
    // node must not move them.
    const { w, h } = UML_NODE_BOX.class;
    const here = umlCompartmentBoxes('class', 0, 0, w, h);
    const there = umlCompartmentBoxes('class', 100, 50, w, h);
    expect(there.name.x).toBeCloseTo(here.name.x + 100);
    expect(there.name.y).toBeCloseTo(here.name.y + 50);
    expect(there.splits).toEqual(here.splits);
  });

  it('gives the bottom tier the height an author drags into the box', () => {
    const { w } = UML_NODE_BOX.class;
    const tall = umlCompartmentBoxes('class', 0, 0, w, 300);
    const short = umlCompartmentBoxes('class', 0, 0, w, 120);
    // Everything above the last separator is unchanged — the margins are
    // absolutes — and the operations compartment absorbs the difference.
    expect(tall.splits).toEqual(short.splits);
    expect(tall.operations!.h - short.operations!.h).toBeCloseTo(180);
  });
});

/* ── Resolution ───────────────────────────────────────────────────────── */

const element = (
  id: string,
  role: string,
  text?: unknown
): UmlComponentElement => ({ id, role, text });

describe('which words belong to which shape', () => {
  const shape = element('n', UML_ROLE_OF_KIND.class);
  const name = element('t1', UML_ROLE.name, 'Order');
  const attributes = element('t2', UML_ROLE.attributes, '+ total : Money');
  const operations = element('t3', UML_ROLE.operations, '+ submit() : void');
  const stranger = element('x', UML_ROLE.name, 'Customer');
  const group: UmlComponentGroup = {
    id: 'g',
    childIds: ['n', 't1', 't2', 't3'],
  };
  const elements = [shape, name, attributes, operations, stranger];

  it('sorts a group into its shape and its three compartments', () => {
    const component = umlComponentSiblings(group, elements);
    expect(component.node).toBe(shape);
    expect(component.name).toBe(name);
    expect(component.attributes).toBe(attributes);
    expect(component.operations).toBe(operations);
    // The neighbouring class's name is in the list and in no way in this group.
    expect(umlTierText(component.name?.text)).toBe('Order');
  });

  it('recognises the shape by ANY node role, never by its position', () => {
    // The group's child order is an implementation detail a reorder, a copy or
    // a regroup rewrites; the role is written on the element and travels.
    for (const kind of ALL_KINDS) {
      const box = element('n', UML_ROLE_OF_KIND[kind]);
      const resolved = umlComponentSiblings(
        { id: 'g', childIds: ['t1', 'n'] },
        [name, box]
      );
      expect(umlNodeOfComponent(resolved), kind).toBe(box);
    }
  });

  it('keeps a label apart from a name, because the roles are apart', () => {
    const label = element('t9', UML_ROLE.label, 'Passer commande');
    const component = umlComponentSiblings(
      { id: 'g', childIds: ['n2', 't9'] },
      [element('n2', UML_ROLE_OF_KIND['use-case']), label]
    );
    expect(component.label).toBe(label);
    expect(component.name).toBeUndefined();
  });

  it('resolves a group with nothing in it to nothing, and says so', () => {
    // A group whose texts were deleted, or a shape somebody ungrouped: not an
    // error, and nothing is guessed at.
    expect(umlComponentSiblings({ id: 'g', childIds: [] }, elements)).toEqual(
      {}
    );
    expect(umlNodeOfComponent({})).toBeUndefined();
  });

  it('lets the FIRST element of each role win', () => {
    const second = element('t4', UML_ROLE.name, 'Later');
    const component = umlComponentSiblings(
      { id: 'g', childIds: ['t1', 't4'] },
      [name, second]
    );
    expect(component.name).toBe(name);
  });

  it('ignores an element with no role at all', () => {
    const plain: UmlComponentElement = { id: 'p' };
    expect(umlComponentSiblings({ id: 'g', childIds: ['p'] }, [plain])).toEqual(
      {}
    );
  });

  it('finds the group an element belongs to, innermost first', () => {
    const outer: UmlComponentGroup = { id: 'outer', childIds: ['n', 'other'] };
    expect(umlGroupOf('t2', [group, outer])).toBe(group);
    expect(umlGroupOf('n', [group, outer])).toBe(group);
    expect(umlGroupOf('nowhere', [group, outer])).toBeUndefined();
  });
});

describe('what a tier says', () => {
  it('stringifies and trims whatever it is handed', () => {
    expect(umlTierText('  Order  ')).toBe('Order');
    expect(umlTierText(undefined)).toBe('');
    expect(umlTierText(null)).toBe('');
    // A `Y.Text` answers `toString()` with its content, which is the whole of
    // the coupling this module is allowed to have with Yjs.
    expect(umlTierText({ toString: () => ' Order ' })).toBe('Order');
  });
});
