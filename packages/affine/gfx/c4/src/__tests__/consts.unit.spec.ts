import type { C4NodeKind } from '@labre/affine-model';
import { describe, expect, it } from 'vitest';

import {
  BOUNDARY_LABEL,
  DESCRIPTION_FONT_SIZE,
  NODE_BOX,
  NODE_LABEL,
  NODE_PALETTE,
  NODE_RADIUS,
  NODE_SIZE,
  PERSON_BODY_TOP,
  PERSON_BOX,
  TIER_MARGIN,
  TIER_STACK_HEIGHT,
  TITLE_FONT_SIZE,
  TYPE_FONT_SIZE,
} from '../consts';
import { C4_TYPE_WORD, c4TypeLine } from '../type-line';

/**
 * The per-kind tables.
 *
 * All three are `Record<C4NodeKind, …>`, so TypeScript already refuses a table
 * with a kind missing. What a test adds is the half the type cannot state: that
 * the nine kinds are actually the nine the pack means, that the colour code says
 * what C4's stencil says, and that nothing in a table is silently empty.
 */

const ALL_KINDS = [
  'person',
  'person-ext',
  'system',
  'system-ext',
  'container',
  'database',
  'mobile',
  'browser',
  'component',
] as const satisfies readonly C4NodeKind[];

const HEX6 = /^#[0-9a-f]{6}$/;

describe('the C4 per-kind tables', () => {
  it('covers the nine kinds, and no more', () => {
    for (const table of [NODE_SIZE, NODE_PALETTE, NODE_LABEL]) {
      expect(Object.keys(table).sort()).toEqual([...ALL_KINDS].sort());
    }
  });

  it('gives every kind a size a label can be read at', () => {
    for (const kind of ALL_KINDS) {
      const { w, h } = NODE_SIZE[kind];
      expect(w, kind).toBeGreaterThan(0);
      expect(h, kind).toBeGreaterThan(0);
    }
  });

  /**
   * The reference stencil repeats ONE `v:textRect` — `106.3 × 74.409` — on the
   * system, the container, the component, the database, the phone and the
   * browser window. Seven of the nine kinds are that box at ×2, which is what
   * lets a row of C4 elements line up without anybody arranging them.
   */
  it('gives seven of the nine kinds the stencil’s one footprint', () => {
    for (const kind of ALL_KINDS) {
      if (kind === 'person' || kind === 'person-ext') continue;
      expect(NODE_SIZE[kind], kind).toEqual(NODE_BOX);
      // Wide and squat: a C4 box holds a name, a technology and a sentence.
      expect(NODE_BOX.h).toBeLessThan(NODE_BOX.w);
    }
  });

  /**
   * The height is DERIVED from what the box has to hold, which is the PO's call
   * of 28/08/2026: grow the shapes if that is what it takes to have room to
   * write. The width stays the stencil's, because every glyph is proportioned
   * off it — a person's head radius included.
   *
   * Asserted as the arithmetic rather than as a number, so that changing a tier
   * size or a gap moves the footprint with it instead of leaving a box that
   * silently no longer fits its own contents.
   */
  it('derives the box height from the tiers it has to hold', () => {
    expect(NODE_BOX.h).toBe(TIER_MARGIN * 2 + TIER_STACK_HEIGHT);
    // Equal margins above and below the stack: it sits IN the box, not in the
    // top of it.
    expect(NODE_BOX.h - TIER_STACK_HEIGHT).toBe(TIER_MARGIN * 2);
    // Taller than the stencil's own 74.409 × 2 textRect, and that is the growth
    // the recette asked for: that rect held a name a renderer could paint at any
    // size it liked, this one holds three real text elements at fixed ones.
    expect(NODE_BOX.h).toBeGreaterThan(74.409 * 2);
  });

  /**
   * …and the two people are the stencil's OWN exception, not a preference.
   *
   * Their silhouette is one path whose head arc is drawn about a centre above
   * the body's top edge, so the head stands clear of a body that is itself the
   * standard height — 122.18 in total against 74.409. The stencil's sheet shows
   * it: the person's group is translated further down the page to make room.
   */
  it('gives the person the taller box its head needs', () => {
    for (const kind of ['person', 'person-ext'] as const) {
      expect(NODE_SIZE[kind], kind).toEqual(PERSON_BOX);
    }
    expect(PERSON_BOX.w).toBe(NODE_BOX.w);
    expect(PERSON_BOX.h).toBeGreaterThan(NODE_BOX.h);
    // The body under the head is the standard box exactly.
    expect(PERSON_BOX.h * (1 - PERSON_BODY_TOP)).toBeCloseTo(NODE_BOX.h, 0);
  });

  /**
   * The stencil rounds two kinds and no others: `rx="4.252"` on the phone,
   * `rx="1.4173"` on the browser window, and a plain `<rect>` with no `rx` at
   * all on every boxed level. The glyph-bodied kinds carry zero because their
   * native rect paints nothing.
   */
  it('rounds only the two devices, as the stencil does', () => {
    expect(Object.keys(NODE_RADIUS).sort()).toEqual([...ALL_KINDS].sort());
    expect(NODE_RADIUS.mobile).toBeGreaterThan(NODE_RADIUS.browser);
    expect(NODE_RADIUS.browser).toBeGreaterThan(0);
    for (const kind of ALL_KINDS) {
      if (kind === 'mobile' || kind === 'browser') continue;
      expect(NODE_RADIUS[kind], kind).toBe(0);
    }
  });

  /**
   * The three tiers get smaller as they get more detailed — the stencil's 10 / 6
   * / 8, which is the one ordering that keeps a name reading as the name.
   */
  it('sizes the three text tiers as the stencil does', () => {
    expect(TITLE_FONT_SIZE).toBeGreaterThan(DESCRIPTION_FONT_SIZE);
    expect(DESCRIPTION_FONT_SIZE).toBeGreaterThan(TYPE_FONT_SIZE);
  });

  it('gives every kind words to start from', () => {
    for (const kind of ALL_KINDS) {
      expect(NODE_LABEL[kind], kind).toBeTruthy();
    }
  });

  it('paints the colour code C4 paints', () => {
    for (const kind of ALL_KINDS) {
      const paint = NODE_PALETTE[kind];
      for (const value of [paint.fill, paint.border, paint.text]) {
        expect(value, kind).toMatch(HEX6);
      }
    }

    // The two externals are one grey: "outside the scope of this diagram" is one
    // statement, and the level of the thing outside it is not the point.
    expect(NODE_PALETTE['person-ext']).toEqual(NODE_PALETTE['system-ext']);

    // The three drawn flavours are CONTAINERS and take the container's colour
    // exactly — what differs is the silhouette, never the level.
    for (const kind of ['database', 'mobile', 'browser'] as const) {
      expect(NODE_PALETTE[kind], kind).toEqual(NODE_PALETTE.container);
    }

    // The component is the one kind with black text: white on that pale wash is
    // unreadable, which is the stencil's own reason.
    expect(NODE_PALETTE.component.text).toBe('#000000');
    for (const kind of ALL_KINDS) {
      if (kind === 'component') continue;
      expect(NODE_PALETTE[kind].text, kind).toBe('#ffffff');
    }
  });

  it('names both boundary variants', () => {
    expect(Object.keys(BOUNDARY_LABEL).sort()).toEqual(['container', 'system']);
    for (const words of Object.values(BOUNDARY_LABEL)) {
      expect(words).toBeTruthy();
    }
  });
});

/**
 * The derived middle tier — the line the reader actually uses to tell a
 * container from a component when both are the same rectangle.
 *
 * A total table over the nine kinds, because the wording is the notation and
 * two of the entries look like mistakes until you check the stencil: a
 * `database` says **Container**, and an external element says the same word as
 * the kind it is external to.
 */
describe('the derived type line', () => {
  const WITHOUT: Record<C4NodeKind, string> = {
    person: '[Person]',
    'person-ext': '[Person]',
    system: '[Software System]',
    'system-ext': '[Software System]',
    container: '[Container]',
    database: '[Container]',
    mobile: '[Container]',
    browser: '[Container]',
    component: '[Component]',
  };

  it('says what the stencil says, for every one of the nine kinds', () => {
    expect(Object.keys(C4_TYPE_WORD).sort()).toEqual([...ALL_KINDS].sort());
    for (const kind of ALL_KINDS) {
      expect(c4TypeLine(kind), kind).toBe(WITHOUT[kind]);
    }
  });

  it('labels the cylinder a Container, exactly as the stencil’s desc does', () => {
    // `[Container: technology]`, not `[Database: …]`. A database is a container
    // and the cylinder is a picture of one, not a fourth level. (The mermaid
    // export still emits `ContainerDb` — a different question, in a different
    // grammar.)
    expect(c4TypeLine('database', 'PostgreSQL')).toBe(
      '[Container: PostgreSQL]'
    );
  });

  it('greys an external element without renaming it', () => {
    expect(c4TypeLine('person-ext')).toBe(c4TypeLine('person'));
    expect(c4TypeLine('system-ext')).toBe(c4TypeLine('system'));
  });

  it('appends the technology only when the author actually set one', () => {
    expect(c4TypeLine('container', 'Java')).toBe('[Container: Java]');
    expect(c4TypeLine('component', 'Spring MVC')).toBe(
      '[Component: Spring MVC]'
    );
    // Absent, empty and blank are the same statement — no technology — and none
    // of them may produce a dangling `[Container: ]`.
    for (const nothing of [undefined, '', '   ', '\n\t']) {
      expect(c4TypeLine('container', nothing), JSON.stringify(nothing)).toBe(
        '[Container]'
      );
    }
  });

  it('keeps the line one line', () => {
    expect(c4TypeLine('container', '  Spring   Boot \n 3 ')).toBe(
      '[Container: Spring Boot 3]'
    );
  });
});
