import type { C4NodeKind } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { createC4Node } from '../actions';
import {
  c4ComponentSiblings,
  c4ComponentTiers,
  c4StatedDescription,
  c4StatedName,
  c4StatedTechnology,
  c4TierBoxes,
  c4TierText,
} from '../component';
import {
  DESCRIPTION_FONT_SIZE,
  DESCRIPTION_PLACEHOLDER,
  NODE_LABEL,
  NODE_PALETTE,
  NODE_SIZE,
  PERSON_BODY_TOP,
  TIER_LINE_HEIGHT,
  TIER_MARGIN,
  TIER_STACK_HEIGHT,
  TITLE_FONT_SIZE,
  TITLE_LINES,
  TITLE_TYPE_GAP,
  TYPE_DESCRIPTION_GAP,
  TYPE_FONT_SIZE,
} from '../consts';
import { C4_ROLE, C4_ROLE_OF_KIND } from '../roles';
import { C4_TYPE_PLACEHOLDER } from '../type-line';

/**
 * A C4 component — the shape and its own words, grouped.
 *
 * The PO's recette of 28/08/2026 replaced a "Details" popover with the picture
 * itself: an element's type line and its description are canvas TEXT elements
 * now, created beside the shape and edited in place. This file covers the two
 * questions that arrangement raises — where the words go, and whose they are.
 */

const ALL_KINDS = Object.keys(NODE_SIZE) as C4NodeKind[];

/* ── Where the words go ───────────────────────────────────────────────── */

describe('where a component’s three tiers are placed', () => {
  const stack = (kind: C4NodeKind) => {
    const { w, h } = NODE_SIZE[kind];
    const boxes = c4TierBoxes(kind, 0, 0, w, h);
    return {
      w,
      h,
      boxes,
      ordered: [boxes.title, boxes.typeLine, boxes.description],
    };
  };

  it('stacks all three inside the node, in order, without overlapping', () => {
    for (const kind of ALL_KINDS) {
      const { w, h, ordered } = stack(kind);
      const names = ['title', 'type line', 'description'];

      ordered.forEach((box, index) => {
        const where = `${kind} ${names[index]}`;
        // Inside the element, on all four sides.
        expect(box.x, where).toBeGreaterThan(0);
        expect(box.x + box.w, where).toBeLessThan(w);
        expect(box.y, where).toBeGreaterThan(0);
        expect(box.y + box.h, where).toBeLessThanOrEqual(h);
        // Every tier has room to actually hold a line.
        expect(box.h, where).toBeGreaterThan(0);
        // …and opens strictly below the one before it.
        if (index > 0) {
          const above = ordered[index - 1];
          expect(box.y, where).toBeGreaterThan(above.y + above.h);
        }
      });

      // Centred, and all three the same width as each other.
      for (const box of ordered) {
        expect(box.x, kind).toBeCloseTo((w - box.w) / 2, 6);
        expect(box.w, kind).toBe(ordered[0].w);
      }
    }
  });

  /**
   * The rhythm the PO's follow-up asked for: room to write, and gaps that mean
   * something. The name and its type line are ONE heading and sit close; the
   * description is a second statement and sits further off.
   */
  it('breathes: equal margins, and a wider gap under the type line', () => {
    for (const kind of ALL_KINDS) {
      const { h, boxes, ordered } = stack(kind);
      const bodyTop =
        kind === 'person' || kind === 'person-ext' ? h * PERSON_BODY_TOP : 0;

      const topMargin = boxes.title.y - bodyTop;
      const bottomMargin = h - (boxes.description.y + boxes.description.h);
      expect(topMargin, kind).toBeCloseTo(TIER_MARGIN, 6);
      expect(bottomMargin, kind).toBeCloseTo(TIER_MARGIN, 6);

      const headingGap = boxes.typeLine.y - (boxes.title.y + boxes.title.h);
      const sentenceGap =
        boxes.description.y - (boxes.typeLine.y + boxes.typeLine.h);
      expect(headingGap, kind).toBeCloseTo(TITLE_TYPE_GAP, 6);
      expect(sentenceGap, kind).toBeCloseTo(TYPE_DESCRIPTION_GAP, 6);
      expect(sentenceGap, kind).toBeGreaterThan(headingGap);

      // The stack fills the box between its margins — no dead band anywhere.
      const stackHeight =
        boxes.description.y + boxes.description.h - boxes.title.y;
      expect(stackHeight, kind).toBeCloseTo(TIER_STACK_HEIGHT, 6);
      void ordered;
    }
  });

  it('gives the title two lines, because system names are long', () => {
    // "Internet Banking System" does not fit across 187 units at 20px, and a
    // one-line title box would have every real name spilling out of its tier on
    // the day it was typed.
    const { boxes } = stack('container');
    expect(boxes.title.h).toBe(
      TITLE_FONT_SIZE * TIER_LINE_HEIGHT * TITLE_LINES
    );
    expect(boxes.title.h).toBeGreaterThan(boxes.typeLine.h);
    // The type line is ONE line: it is a single bracketed statement.
    expect(boxes.typeLine.h).toBe(TYPE_FONT_SIZE * TIER_LINE_HEIGHT);
  });

  it('starts a person’s stack below the head, not across it', () => {
    // The person is the stencil's own exception: the head stands clear ABOVE a
    // body of the standard height, and the words are laid out in the BODY.
    const person = stack('person');
    const boxed = c4TierBoxes('system', 0, 0, NODE_SIZE.system.w, person.h);
    expect(person.boxes.title.y).toBeGreaterThan(boxed.title.y);
    // …a head's worth lower, and the whole stack still clears the silhouette.
    expect(person.boxes.title.y).toBeCloseTo(
      person.h * PERSON_BODY_TOP + TIER_MARGIN,
      6
    );
  });

  it('carries the node’s own origin', () => {
    const { w, h } = NODE_SIZE.container;
    const at0 = c4TierBoxes('container', 0, 0, w, h);
    const moved = c4TierBoxes('container', 500, -200, w, h);
    for (const tier of ['title', 'typeLine', 'description'] as const) {
      expect(moved[tier].x, tier).toBe(at0[tier].x + 500);
      expect(moved[tier].y, tier).toBe(at0[tier].y - 200);
    }
  });
});

/* ── Whose words they are ─────────────────────────────────────────────── */

describe('resolving a component’s tiers', () => {
  const title = { id: 'a', role: C4_ROLE.title, text: 'Billing' };
  const type = { id: 't', role: C4_ROLE['type-line'], text: '[Container: Go]' };
  const descr = { id: 'd', role: C4_ROLE.description, text: 'Does things.' };
  const groups = [{ id: 'g', childIds: ['n', 'a', 't', 'd'] }];

  it('finds the words grouped with the node, by role', () => {
    const tiers = c4ComponentTiers('n', groups, [descr, type, title]);
    expect(tiers.title).toBe(title);
    expect(tiers.typeLine).toBe(type);
    expect(tiers.description).toBe(descr);
  });

  it('finds nothing for a node that is grouped with nothing', () => {
    // The pinned fallback: an ungrouped node, a released group, a deleted tier.
    // None of them is an error, and none of them is guessed at.
    expect(c4ComponentTiers('other', groups, [type, descr])).toEqual({});
    expect(c4ComponentTiers('n', [], [type, descr])).toEqual({});
  });

  it('ignores a text of the right role in somebody else’s group', () => {
    const theirs = {
      id: 'x',
      role: C4_ROLE['type-line'],
      text: '[Container: Rust]',
    };
    const tiers = c4ComponentTiers('n', groups, [theirs, type]);
    expect(tiers.typeLine).toBe(type);
  });

  it('keeps the first of a role, so a duplicated tier cannot flip', () => {
    const second = {
      id: 'd2',
      role: C4_ROLE.description,
      text: 'Or this one.',
    };
    const tiers = c4ComponentTiers(
      'n',
      [{ id: 'g', childIds: ['n', 'd', 'd2'] }],
      [descr, second]
    );
    expect(tiers.description).toBe(descr);
  });

  it('hands back everything grouped with an element, the element included', () => {
    expect(c4ComponentSiblings('t', groups)).toEqual(['n', 'a', 't', 'd']);
    expect(c4ComponentSiblings('nowhere', groups)).toEqual([]);
  });
});

/**
 * The NAME, which is the one tier with somewhere else to look.
 *
 * It moved onto a `c4:title` child in the PO's follow-up; an element drawn
 * before that keeps its name in the shape's own inner text, and the fallback is
 * the whole of that compatibility story.
 */
describe('the name a component states', () => {
  const title = { id: 'a', role: C4_ROLE.title, text: 'Billing' };

  it('reads the title tier when there is one', () => {
    expect(c4StatedName({ title }, 'stale shape text')).toBe('Billing');
  });

  it('falls back to the shape’s inner text for an element drawn before', () => {
    // No title child at all: the name really is on the shape.
    expect(c4StatedName({}, 'Legacy System')).toBe('Legacy System');
    expect(c4StatedName({}, '  Legacy System  ')).toBe('Legacy System');
    // A `Y.Text` on a real element; anything with a `toString` will do.
    expect(c4StatedName({}, { toString: () => 'Ledger' })).toBe('Ledger');
  });

  it('tests for the tier’s EXISTENCE, not for its emptiness', () => {
    // A title the author deliberately cleared has been cleared. Reaching past it
    // to the shape would resurrect a name nobody can see or edit.
    expect(c4StatedName({ title: { id: 'a', text: '  ' } }, 'ghost')).toBe('');
  });

  it('says nothing when neither exists', () => {
    expect(c4StatedName({}, undefined)).toBe('');
    expect(c4StatedName({}, null)).toBe('');
  });

  it('never reads the creation prompt as nothing, unlike the other two', () => {
    // An unnamed container IS a container: `Container(x, "Container")` is true,
    // where blanking it would hand the reader `?` — less information, not more
    // honesty. The other two prompts suppress because "built with a technology
    // called technology" is not true of anything.
    for (const kind of ALL_KINDS) {
      expect(
        c4StatedName({ title: { id: 'a', text: NODE_LABEL[kind] } }, undefined),
        kind
      ).toBe(NODE_LABEL[kind]);
    }
  });
});

describe('what a tier states', () => {
  it('reads whatever a text element carries, as a trimmed string', () => {
    expect(c4TierText(undefined)).toBe('');
    expect(c4TierText({ id: 'x' })).toBe('');
    expect(c4TierText({ id: 'x', text: '  hello  ' })).toBe('hello');
    // On a real element it is a `Y.Text`; anything with a `toString` will do.
    expect(c4TierText({ id: 'x', text: { toString: () => 'ok' } })).toBe('ok');
  });

  it('reads the untouched prompts as nothing stated', () => {
    // Every tier exists from creation, so an element nobody has typed on carries
    // the stencil's own words. Exporting them as data would put "technology" in
    // the technology slot of a file somebody pastes into a renderer.
    for (const kind of ALL_KINDS) {
      expect(
        c4StatedTechnology({ id: 't', text: C4_TYPE_PLACEHOLDER[kind] }),
        kind
      ).toBe('');
    }
    expect(
      c4StatedDescription({ id: 'd', text: DESCRIPTION_PLACEHOLDER })
    ).toBe('');
    expect(c4StatedDescription({ id: 'd', text: '  Description  ' })).toBe('');
  });

  it('reads what the author actually wrote', () => {
    expect(c4StatedTechnology({ id: 't', text: '[Container: Java]' })).toBe(
      'Java'
    );
    expect(c4StatedTechnology({ id: 't', text: 'Java' })).toBe('Java');
    expect(c4StatedDescription({ id: 'd', text: 'A customer.' })).toBe(
      'A customer.'
    );
  });

  it('reads an absent tier as nothing, never as a blank statement', () => {
    expect(c4StatedTechnology(undefined)).toBe('');
    expect(c4StatedDescription(undefined)).toBe('');
  });
});

/* ── What the creation gesture actually builds ────────────────────────── */

interface Added extends Record<string, unknown> {
  id: string;
  type: string;
}

/**
 * A `std` reduced to what `createC4Node` touches: a surface that records what it
 * was asked to add, a viewport, an index generator and the three no-ops
 * `finish` calls.
 */
function recordingStd() {
  const added: Added[] = [];
  let next = 0;
  let selected: { elements: string[]; editing: boolean } | null = null;
  const gfx = {
    surface: {
      addElement: (props: Record<string, unknown>) => {
        const id = `e${added.length}`;
        added.push({ ...props, id } as Added);
        return id;
      },
    },
    viewport: { centerX: 0, centerY: 0 },
    layer: { generateIndex: () => `a${next++}` },
    doc: { captureSync: () => {} },
    tool: { setTool: () => {} },
    selection: {
      set: (state: { elements: string[]; editing: boolean }) => {
        selected = state;
      },
    },
  };
  return {
    std: { get: () => gfx } as unknown as BlockStdScope,
    added,
    selection: () => selected,
  };
}

describe('creating a C4 component', () => {
  const build = (kind: C4NodeKind) => {
    const harness = recordingStd();
    createC4Node(harness.std, kind);
    const [shape, title, typeLine, description, group] = harness.added;
    return { ...harness, shape, title, typeLine, description, group };
  };

  it('builds five elements: the shape, its three words, and the group', () => {
    for (const kind of ALL_KINDS) {
      const { added, shape, title, typeLine, description, group } = build(kind);
      expect(
        added.map(element => element.type),
        kind
      ).toEqual(['c4Node', 'text', 'text', 'text', 'group']);
      // The group holds exactly the other four, and nothing else.
      expect(group.children, kind).toEqual({
        [shape.id]: true,
        [title.id]: true,
        [typeLine.id]: true,
        [description.id]: true,
      });
    }
  });

  /**
   * The half of the PO's follow-up that is an ABSENCE.
   *
   * The name is a text child now, so the shape must carry none: inner text on
   * the shape would be a second, invisible name under the real one, free to
   * disagree with it and exported by neither.
   */
  it('leaves the shape with no text of its own', () => {
    for (const kind of ALL_KINDS) {
      const { shape } = build(kind);
      expect(shape.text, kind).toBeUndefined();
      // …nor any of the props that exist only to lay text out inside a box.
      expect(shape.textVerticalAlign, kind).toBeUndefined();
      expect(shape.padding, kind).toBeUndefined();
      expect(shape.textFitMode, kind).toBeUndefined();
    }
  });

  it('stamps the C4 role on the shape and all three tiers, never on the group', () => {
    for (const kind of ALL_KINDS) {
      const { shape, title, typeLine, description, group } = build(kind);
      // The artefact's own role, which the rules, the facts and the export all
      // key on. The wrapper round a box is not a second box.
      expect(shape.role, kind).toBe(C4_ROLE_OF_KIND[kind]);
      expect(title.role, kind).toBe(C4_ROLE.title);
      expect(typeLine.role, kind).toBe(C4_ROLE['type-line']);
      expect(description.role, kind).toBe(C4_ROLE.description);
      expect(group.role, kind).toBeUndefined();
    }
  });

  it('opens every tier on the stencil’s own prompt', () => {
    for (const kind of ALL_KINDS) {
      const { title, typeLine, description } = build(kind);
      expect(title.text, kind).toBe(NODE_LABEL[kind]);
      expect(typeLine.text, kind).toBe(C4_TYPE_PLACEHOLDER[kind]);
      expect(description.text, kind).toBe(DESCRIPTION_PLACEHOLDER);
    }
  });

  it('writes all three tiers in the kind’s own colour, at the notation’s sizes', () => {
    for (const kind of ALL_KINDS) {
      const { title, typeLine, description } = build(kind);
      for (const tier of [title, typeLine, description]) {
        // White on eight of the nine, black on the pale component — the one
        // wash white would be unreadable on.
        expect(tier.color, kind).toBe(NODE_PALETTE[kind].text);
        // Centred, and wrapping inside their own width rather than running out
        // over the canvas.
        expect(tier.textAlign, kind).toBe('center');
        expect(tier.hasMaxWidth, kind).toBe(true);
      }
      expect(title.fontSize, kind).toBe(TITLE_FONT_SIZE);
      expect(typeLine.fontSize, kind).toBe(TYPE_FONT_SIZE);
      expect(description.fontSize, kind).toBe(DESCRIPTION_FONT_SIZE);
      // The name is the only tier with weight on it: at 20px over a 16px
      // sentence, size alone does not say "this is the heading of the box".
      expect(title.fontWeight, kind).toBe('600');
      expect(typeLine.fontWeight, kind).toBe('400');
      expect(description.fontWeight, kind).toBe('400');
    }
    expect(build('component').title.color).toBe('#000000');
    expect(build('container').title.color).toBe('#ffffff');
  });

  it('lays the words out where the tier geometry says, in painting order', () => {
    const { shape, title, typeLine, description } = build('container');
    const { w, h } = NODE_SIZE.container;
    const boxes = c4TierBoxes('container', -w / 2, -h / 2, w, h);
    const serialized = (box: { x: number; y: number; w: number; h: number }) =>
      `[${box.x},${box.y},${box.w},${box.h}]`;
    expect(shape.xywh).toBe(`[${-w / 2},${-h / 2},${w},${h}]`);
    expect(title.xywh).toBe(serialized(boxes.title));
    expect(typeLine.xywh).toBe(serialized(boxes.typeLine));
    expect(description.xywh).toBe(serialized(boxes.description));
    // Strictly increasing indexes: two elements sharing one sort by id, and an
    // id is a nanoid — the words would land under the fill about half the time.
    const indexes = [
      shape.index,
      title.index,
      typeLine.index,
      description.index,
    ];
    expect(indexes).toEqual([...indexes].sort());
    expect(new Set(indexes).size).toBe(4);
  });

  it('leaves the GROUP selected, which is what the gesture produced', () => {
    const { group, selection } = build('system');
    expect(selection()).toEqual({ elements: [group.id], editing: false });
  });

  it('gives the group no title, so nothing announces itself as "Group 3"', () => {
    expect(build('system').group.title).toBeUndefined();
  });
});
