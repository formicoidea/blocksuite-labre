import type { C4NodeKind } from '@labre/affine-model';
import type { BlockStdScope } from '@labre/std';
import { describe, expect, it } from 'vitest';

import { createC4Node } from '../actions';
import {
  c4ComponentSiblings,
  c4ComponentTiers,
  c4StatedDescription,
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

describe('where a component’s two tiers are placed', () => {
  it('stacks them inside the node, under the title, without overlapping', () => {
    for (const kind of ALL_KINDS) {
      const { w, h } = NODE_SIZE[kind];
      const { typeLine, description } = c4TierBoxes(kind, 0, 0, w, h);

      // Both inside the element, on all four sides.
      for (const [name, box] of [
        ['type line', typeLine],
        ['description', description],
      ] as const) {
        const where = `${kind} ${name}`;
        expect(box.x, where).toBeGreaterThan(0);
        expect(box.x + box.w, where).toBeLessThan(w);
        expect(box.y, where).toBeGreaterThan(0);
        expect(box.y + box.h, where).toBeLessThanOrEqual(h);
      }

      // Centred, and the same width as each other.
      expect(typeLine.x, kind).toBeCloseTo((w - typeLine.w) / 2, 6);
      expect(description.x, kind).toBe(typeLine.x);
      expect(description.w, kind).toBe(typeLine.w);

      // The description opens BELOW the type line, with the stencil's own blank
      // line between them — the gap that keeps a sentence from reading as a
      // fourth tier of the heading.
      expect(description.y, kind).toBeGreaterThan(typeLine.y + typeLine.h);
    }
  });

  it('starts a person’s stack below the head, not across it', () => {
    // The person is the stencil's own exception: the head stands clear ABOVE a
    // body of the standard height, and the words are laid out in the BODY.
    const { w, h } = NODE_SIZE.person;
    const { typeLine } = c4TierBoxes('person', 0, 0, w, h);
    const boxed = c4TierBoxes('system', 0, 0, NODE_SIZE.system.w, h);
    expect(typeLine.y).toBeGreaterThan(boxed.typeLine.y);
    // …roughly a head's worth lower, and still in the upper half of the body.
    expect(typeLine.y / h).toBeGreaterThan(0.35);
    expect(typeLine.y / h).toBeLessThan(0.75);
  });

  it('carries the node’s own origin', () => {
    const { w, h } = NODE_SIZE.container;
    const at0 = c4TierBoxes('container', 0, 0, w, h);
    const moved = c4TierBoxes('container', 500, -200, w, h);
    expect(moved.typeLine.x).toBe(at0.typeLine.x + 500);
    expect(moved.typeLine.y).toBe(at0.typeLine.y - 200);
    expect(moved.description.x).toBe(at0.description.x + 500);
    expect(moved.description.y).toBe(at0.description.y - 200);
  });
});

/* ── Whose words they are ─────────────────────────────────────────────── */

describe('resolving a component’s tiers', () => {
  const type = { id: 't', role: C4_ROLE['type-line'], text: '[Container: Go]' };
  const descr = { id: 'd', role: C4_ROLE.description, text: 'Does things.' };
  const groups = [{ id: 'g', childIds: ['n', 't', 'd'] }];

  it('finds the words grouped with the node, by role', () => {
    const tiers = c4ComponentTiers('n', groups, [descr, type]);
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
    expect(c4ComponentSiblings('t', groups)).toEqual(['n', 't', 'd']);
    expect(c4ComponentSiblings('nowhere', groups)).toEqual([]);
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
    const [shape, typeLine, description, group] = harness.added;
    return { ...harness, shape, typeLine, description, group };
  };

  it('builds four elements: the shape, its two words, and the group', () => {
    for (const kind of ALL_KINDS) {
      const { added, shape, typeLine, description, group } = build(kind);
      expect(
        added.map(element => element.type),
        kind
      ).toEqual(['c4Node', 'text', 'text', 'group']);
      // The group holds exactly the other three, and nothing else.
      expect(group.children, kind).toEqual({
        [shape.id]: true,
        [typeLine.id]: true,
        [description.id]: true,
      });
    }
  });

  it('stamps the C4 role on the shape and on both tiers, never on the group', () => {
    for (const kind of ALL_KINDS) {
      const { shape, typeLine, description, group } = build(kind);
      // The artefact's own role, which the rules, the facts and the export all
      // key on. The wrapper round a box is not a second box.
      expect(shape.role, kind).toBe(C4_ROLE_OF_KIND[kind]);
      expect(typeLine.role, kind).toBe(C4_ROLE['type-line']);
      expect(description.role, kind).toBe(C4_ROLE.description);
      expect(group.role, kind).toBeUndefined();
    }
  });

  it('opens every tier on the stencil’s own prompt', () => {
    for (const kind of ALL_KINDS) {
      const { shape, typeLine, description } = build(kind);
      expect(shape.text, kind).toBe(NODE_LABEL[kind]);
      expect(typeLine.text, kind).toBe(C4_TYPE_PLACEHOLDER[kind]);
      expect(description.text, kind).toBe(DESCRIPTION_PLACEHOLDER);
    }
  });

  it('writes both tiers in the kind’s own text colour, at the notation’s sizes', () => {
    for (const kind of ALL_KINDS) {
      const { typeLine, description } = build(kind);
      // White on eight of the nine, black on the pale component — the one wash
      // white would be unreadable on.
      expect(typeLine.color, kind).toBe(NODE_PALETTE[kind].text);
      expect(description.color, kind).toBe(NODE_PALETTE[kind].text);
      expect(typeLine.fontSize, kind).toBe(TYPE_FONT_SIZE);
      expect(description.fontSize, kind).toBe(DESCRIPTION_FONT_SIZE);
      // Centred, and wrapping inside their own width rather than running out
      // over the canvas.
      expect(typeLine.textAlign, kind).toBe('center');
      expect(description.hasMaxWidth, kind).toBe(true);
    }
    expect(build('component').typeLine.color).toBe('#000000');
    expect(build('container').typeLine.color).toBe('#ffffff');
  });

  it('lays the words out where the tier geometry says, in painting order', () => {
    const { shape, typeLine, description } = build('container');
    const { w, h } = NODE_SIZE.container;
    const boxes = c4TierBoxes('container', -w / 2, -h / 2, w, h);
    expect(shape.xywh).toBe(`[${-w / 2},${-h / 2},${w},${h}]`);
    expect(typeLine.xywh).toBe(
      `[${boxes.typeLine.x},${boxes.typeLine.y},${boxes.typeLine.w},${boxes.typeLine.h}]`
    );
    expect(description.xywh).toBe(
      `[${boxes.description.x},${boxes.description.y},${boxes.description.w},${boxes.description.h}]`
    );
    // Strictly increasing indexes: two elements sharing one sort by id, and an
    // id is a nanoid — the words would land under the fill about half the time.
    const indexes = [shape.index, typeLine.index, description.index];
    expect(indexes).toEqual([...indexes].sort());
    expect(new Set(indexes).size).toBe(3);
  });

  it('leaves the GROUP selected, which is what the gesture produced', () => {
    const { group, selection } = build('system');
    expect(selection()).toEqual({ elements: [group.id], editing: false });
  });

  it('gives the group no title, so nothing announces itself as "Group 3"', () => {
    expect(build('system').group.title).toBeUndefined();
  });
});
