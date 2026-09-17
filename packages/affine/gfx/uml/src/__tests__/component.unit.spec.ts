import type { UmlNodeKind } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import {
  UML_ACTOR_FIGURE,
  UML_ATTRIBUTE_LINES,
  UML_BESIDE_LABEL_GAP,
  UML_BESIDE_LABEL_KINDS,
  UML_BESIDE_LABEL_WIDTH,
  UML_CUBE_DEPTH,
  UML_HEAD_LABEL_KINDS,
  UML_NAME_GAP,
  UML_PACKAGE_TAB,
  UML_SIGNAL_POINT,
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
import { UML_UNLABELLED_KINDS } from '../keywords.js';
import { UML_ROLE, UML_ROLE_OF_KIND } from '../roles.js';

/** Every kind the model declares, read off a table that is total over it. */
const ALL_KINDS = Object.keys(UML_NODE_BOX) as UmlNodeKind[];

/** The three deployment targets, whose tiers are laid against the FRONT FACE. */
const CUBE_KINDS = [
  'node',
  'device',
  'execution-environment',
] as const satisfies readonly UmlNodeKind[];

/**
 * The two signal pentagons, whose tier is pulled back out of the POINT and so
 * is neither the element's full insetted width nor a face's (§16.3.4).
 */
const SIGNAL_KINDS = [
  'send-signal',
  'accept-event',
] as const satisfies readonly UmlNodeKind[];

/**
 * The kinds whose one tier is measured against the element's own box — which is
 * every kind except the cubes (measured against the face they are written in),
 * the four glyphs whose label is written OUTSIDE the element entirely, and the
 * two pentagons whose label gives up the width of their point.
 */
const OWN_BOX_KINDS = ALL_KINDS.filter(
  kind =>
    !UML_BESIDE_LABEL_KINDS.has(kind) &&
    // …and the lifeline, whose one tier is measured against the HEAD the
    // renderer draws across the top of a 16-unit column rather than against
    // the column itself (§17.2.4).
    !UML_HEAD_LABEL_KINDS.has(kind) &&
    !(CUBE_KINDS as readonly UmlNodeKind[]).includes(kind) &&
    !(SIGNAL_KINDS as readonly UmlNodeKind[]).includes(kind)
);

/** Every kind that is a SHAPE the notation draws rather than a divided box. */
const PICTURE_KINDS: readonly UmlNodeKind[] = [
  'package',
  'note',
  'actor',
  'use-case',
  ...CUBE_KINDS,
  ...UML_BESIDE_LABEL_KINDS,
  // Phase 2, the behaviour artefacts — every one of them but the `state`,
  // which is the one divided box of the two families (§14.2.4).
  'action',
  'object-node',
  ...SIGNAL_KINDS,
  'initial',
  'activity-final',
  'flow-final',
  'decision',
  'fork',
  'final-state',
  'choice',
  'junction',
  'shallow-history',
  'deep-history',
  'entry-point',
  'exit-point',
  'terminate',
  // Phase 3, the sequence artefacts (§17.2.4): a head with a spine, a bar on
  // one, and the cross that ends one. Not a compartment between them.
  ...UML_HEAD_LABEL_KINDS,
  'execution',
  'destruction',
];

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

  /**
   * A component (§11.6.4) and an artifact (§19.3.4) are the object's layout
   * exactly: a name over ONE body tier. What differs is what the tier holds —
   * slots, parts, file contents — and that is the ROLE on the text element, not
   * the geometry.
   */
  it.each(['component', 'artifact'] as const)(
    'lays %s out like an object: name, body, one separator',
    kind => {
      const { attributes, operations, splits } = atOrigin(kind);
      expect(splits).toHaveLength(1);
      expect(operations).toBeUndefined();
      expect(attributes).toBeDefined();
      expect(attributes!.y + attributes!.h).toBeCloseTo(
        UML_NODE_BOX[kind].h - UML_TIER_MARGIN
      );
      // …and the split lands where the object's does, because it is the same
      // walk down the same box.
      expect(splits[0]).toBeCloseTo(UML_TIER_MARGIN + NAME_LINE + UML_NAME_GAP);
    }
  );

  /**
   * §14.2.4: a state is a name compartment over its INTERNAL ACTIVITIES — the
   * `entry / …`, `do / …`, `exit / …` lines a machine runs while it rests
   * there. The object's layout exactly, and the one behaviour kind that is a
   * divided box rather than a picture or a mark.
   */
  it('lays a state out like an object: name, behaviour, one separator', () => {
    const { attributes, operations, splits } = atOrigin('state');
    expect(splits).toHaveLength(1);
    expect(operations).toBeUndefined();
    expect(attributes).toBeDefined();
    expect(attributes!.y + attributes!.h).toBeCloseTo(
      UML_NODE_BOX.state.h - UML_TIER_MARGIN
    );
    expect(splits[0]).toBeCloseTo(UML_TIER_MARGIN + NAME_LINE + UML_NAME_GAP);
  });

  it('insets every compartment by the same proportional gutter', () => {
    for (const kind of OWN_BOX_KINDS) {
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

describe('where the picture kinds write their one label', () => {
  it('gives them a single box and no separator at all', () => {
    for (const kind of PICTURE_KINDS) {
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

  /**
   * §19.4.4: the three deployment targets are one cube, and the name goes in
   * the FRONT FACE — the only one of its three faces not drawn at an angle.
   * Two lines, because the seed is a keyword over an instance name.
   */
  it.each(CUBE_KINDS)('writes %s inside the cube’s front face', kind => {
    const { w, h } = UML_NODE_BOX[kind];
    const depth = Math.min(w, h) * UML_CUBE_DEPTH;
    const { name } = atOrigin(kind);

    // Below the roof, above the bottom edge, and clear of the right-hand face.
    expect(name.y).toBeGreaterThanOrEqual(depth);
    expect(name.y + name.h).toBeLessThanOrEqual(h);
    expect(name.x + name.w).toBeLessThanOrEqual(w - depth);
    expect(name.h).toBeCloseTo(NAME_LINE * 2);

    // Centred in the face, not in the element: the gap above the words equals
    // the gap below them, measured from the face's own top edge.
    expect(name.y - depth).toBeCloseTo(h - (name.y + name.h));
  });

  /**
   * §11.3.4 and §10.4.4: a port is a 16-unit square and an interface glyph is a
   * ball on a stick, so neither has an inside. The name goes BESIDE the
   * picture — the one tier in this module that lands outside the element it
   * belongs to, which is what {@link UML_BESIDE_LABEL_KINDS} exists to declare.
   */
  it('writes a port, the two interface glyphs and the hourglass beside themselves', () => {
    for (const kind of UML_BESIDE_LABEL_KINDS) {
      const { w, h } = UML_NODE_BOX[kind];
      const { name } = atOrigin(kind);

      // Clear to the RIGHT of the glyph, by the declared gap.
      expect(name.x, kind).toBeCloseTo(w + UML_BESIDE_LABEL_GAP);
      expect(name.w, kind).toBe(UML_BESIDE_LABEL_WIDTH);
      // …and vertically centred on it, so a 16-unit port and its name read as
      // one thing.
      expect(name.y + name.h / 2, kind).toBeCloseTo(h / 2);
      expect(name.h, kind).toBeCloseTo(NAME_LINE);
    }
  });

  /**
   * §15.3.4 and §15.4.4: an action's verb phrase and an object node's value
   * name are written INSIDE the box, centred — the use case's answer, on a
   * rectangle instead of an ellipse.
   */
  it.each(['action', 'object-node'] as const)(
    'centres %s in its own box',
    kind => {
      const { w, h } = UML_NODE_BOX[kind];
      const { name } = atOrigin(kind);
      expect(name.y).toBeCloseTo(h - (name.y + name.h));
      expect(name.x).toBeCloseTo(w * UML_TIER_SIDE_INSET);
      expect(name.x + name.w).toBeCloseTo(w - w * UML_TIER_SIDE_INSET);
    }
  );

  /**
   * §16.3.4: the pentagons' words are pulled back out of the POINT — the tip a
   * send signal sticks out to the right, the notch an accept event bites in
   * from the left — measured with the very number the renderer draws that point
   * from, so a name can never run out through it.
   */
  it('pulls a signal label back out of its own point', () => {
    const { w } = UML_NODE_BOX['send-signal'];
    const point = w * UML_SIGNAL_POINT;
    const inset = w * UML_TIER_SIDE_INSET;

    const send = atOrigin('send-signal').name;
    // Flush left, and short of the tip on the right.
    expect(send.x).toBeCloseTo(inset);
    expect(send.x + send.w).toBeCloseTo(w - point - inset);

    const accept = atOrigin('accept-event').name;
    // The mirror: clear of the notch on the left, flush right.
    expect(accept.x).toBeCloseTo(point + inset);
    expect(accept.x + accept.w).toBeCloseTo(w - inset);

    // Same column width for both, because it is the same pentagon turned.
    expect(send.w).toBeCloseTo(accept.w);
  });

  /**
   * The control nodes of §15.3.4 and the pseudostates of §14.2.4 carry NO
   * words: a disc, a bar, a bullseye and a cross have nothing written in them.
   *
   * `umlCompartmentBoxes` still hands back a box — a box is always computable
   * from a box — and the authority on whether a text element is ever created is
   * `UML_UNLABELLED_KINDS`. What this pins is that the box it hands back is
   * CLAMPED to the mark: two lines of a 16px face is 45 units and a junction is
   * 16 tall, so an unclamped tier would hang half of itself off the top of the
   * dot.
   */
  it('clamps the box of a mark that carries no words at all', () => {
    for (const kind of UML_UNLABELLED_KINDS) {
      const { w, h } = UML_NODE_BOX[kind];
      const { name, splits } = atOrigin(kind);
      expect(splits, kind).toEqual([]);
      expect(name.y, kind).toBeGreaterThanOrEqual(0);
      expect(name.y + name.h, kind).toBeLessThanOrEqual(h + 0.001);
      expect(name.x + name.w, kind).toBeLessThanOrEqual(w + 0.001);
      // Centred, whatever is left of it.
      expect(name.y, kind).toBeCloseTo(h - (name.y + name.h));
    }
    // Not vacuous, and not the whole pack either: fifteen marks — phase 2's
    // thirteen control nodes and pseudostates, plus §17.2.4's execution bar and
    // destruction cross, which the notation names no more than it names a
    // bullseye.
    expect(UML_UNLABELLED_KINDS.size).toBe(15);
    expect(UML_UNLABELLED_KINDS.has('action')).toBe(false);
    expect(UML_UNLABELLED_KINDS.has('state')).toBe(false);
  });
});

describe('the compartment layout as a whole', () => {
  it('keeps every box inside the node it belongs to', () => {
    // The invariant that holds for every kind with an INSIDE: nothing a
    // component writes may hang outside the shape it is grouped with, or the
    // group's derived bounds would grow past the picture.
    //
    // The exceptions are the notation's own and are declared rather than
    // discovered: a port's name and an interface glyph's are written beside
    // them, because a 16-unit square has nowhere to put one (§11.3.4, §10.4.4),
    // and a lifeline's is written in the HEAD the renderer draws across the top
    // of its spine, which is wider than the spine (§17.2.4).
    for (const kind of ALL_KINDS.filter(
      k => !UML_BESIDE_LABEL_KINDS.has(k) && !UML_HEAD_LABEL_KINDS.has(k)
    )) {
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
