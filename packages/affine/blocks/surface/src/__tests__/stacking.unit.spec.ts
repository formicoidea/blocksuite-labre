import { describe, expect, it } from 'vitest';

import type { StackedElement } from '../framework-background/stacking';
import { stackingIndexFor } from '../framework-background/stacking';

/**
 * "A framework background is a floor, never a lid", read off hand-written
 * stacks — three fields per element and no document, which is the whole point
 * of {@link StackedElement}.
 *
 * `indexOverBackgrounds`, the depth this rule delegates to, keeps its own
 * tests next to the Wardley zone that first needed it
 * (`gfx/wardley/src/__tests__/areas.unit.spec.ts`, "where a zone goes in the
 * stack").
 */

/** A board-sized background. */
const board = (index: string, xywh = '[0,0,1600,1000]'): StackedElement => ({
  index,
  xywh,
  isBackground: true,
});

/** A small artefact sitting inside that board. */
const node = (index: string, xywh = '[100,100,80,80]'): StackedElement => ({
  index,
  xywh,
  isBackground: false,
});

/** Applying the rule once, so a second call can be asked for. */
const settle = (
  element: StackedElement,
  siblings: StackedElement[]
): StackedElement => {
  const index = stackingIndexFor(element, siblings);
  return index === null ? element : { ...element, index };
};

describe('an artefact never stays buried under a background', () => {
  it('is raised just above the background that covers it', () => {
    const index = stackingIndexFor(node('a0'), [board('a1')])!;
    expect(index).not.toBeNull();
    expect(index > 'a1').toBe(true);
  });

  it('is left alone when the background is already below it', () => {
    expect(stackingIndexFor(node('a2'), [board('a1')])).toBeNull();
  });

  it('is left alone when the background above it is somewhere else', () => {
    expect(
      stackingIndexFor(node('a0'), [board('a1', '[5000,5000,1600,1000]')])
    ).toBeNull();
  });

  it('lands below the artefacts already drawn on that background', () => {
    const index = stackingIndexFor(node('a0'), [board('a1'), node('a3')])!;
    expect(index > 'a1').toBe(true);
    expect(index < 'a3').toBe(true);
  });
});

describe('a background never covers what is drawn on it', () => {
  it('goes to the back of the surface when it lids free artefacts', () => {
    const index = stackingIndexFor(board('a3'), [node('a1'), node('a2')])!;
    expect(index < 'a1').toBe(true);
  });

  it('stops at the floor it lies on rather than at the back', () => {
    // A board dropped on a map, over that map's artefacts: it belongs between
    // the two, not under the map.
    const index = stackingIndexFor(board('a4'), [board('a1'), node('a2')])!;
    expect(index > 'a1').toBe(true);
    expect(index < 'a2').toBe(true);
  });

  it('is raised above a background that covers it (superposed boards)', () => {
    const index = stackingIndexFor(board('a0'), [board('a2')])!;
    expect(index > 'a2').toBe(true);
  });

  it('is left alone when it overlaps nothing', () => {
    expect(
      stackingIndexFor(board('a1'), [node('a0', '[5000,5000,80,80]')])
    ).toBeNull();
  });

  it('is left alone on an empty canvas', () => {
    expect(stackingIndexFor(board('a0'), [])).toBeNull();
  });

  it('is left alone when it is already under everything it overlaps', () => {
    expect(stackingIndexFor(board('a0'), [node('a1'), node('a2')])).toBeNull();
  });
});

/**
 * The recette of 2026-09-15 (PO, UML): "au déplacement ou au redimensionnement
 * le board passe au premier plan, occultant ainsi les objets qui sont inclus
 * dedans".
 *
 * A UML diagram frame holds inner BACKGROUNDS of its own — a subject, a
 * partition, a composite state, a combined fragment — and a C4 board holds
 * boundaries. Each is drawn inside the sheet and therefore above it, so the
 * "superposed boards" clause read the sheet as buried under its own content and
 * raised it on every move. When the inner background was the topmost element of
 * the stack, the opaque sheet landed at the very front.
 */
describe('a sheet is never raised above the backgrounds drawn on it', () => {
  /** An inner background — a UML subject on a diagram frame. */
  const inner = (
    index: string,
    xywh = '[900,600,380,260]'
  ): StackedElement => ({
    index,
    xywh,
    isBackground: true,
  });

  it('leaves a moved frame under the inner background it encloses', () => {
    expect(stackingIndexFor(board('Zz'), [inner('a3')])).toBeNull();
  });

  it('does not fly to the front over its own artefacts', () => {
    // The recette's stack exactly: two classes, then a subject drawn on an
    // empty corner of the sheet, then the sheet is moved.
    expect(
      stackingIndexFor(board('Zz'), [node('a1'), node('a2'), inner('a3')])
    ).toBeNull();
  });

  it('still raises a peer board of the same size', () => {
    // Two boards dropped on the same spot enclose each other, which is no
    // statement at all: they are peers and the old answer stands.
    const index = stackingIndexFor(board('a0'), [board('a2')])!;
    expect(index > 'a2').toBe(true);
  });

  it('still raises a frame that merely OVERLAPS another background', () => {
    // Half on, half off: neither is the other's sheet.
    const other = board('a2', '[800,0,1600,1000]');
    const index = stackingIndexFor(board('a0'), [other])!;
    expect(index > 'a2').toBe(true);
  });

  it('still lowers a sheet dropped over free artefacts', () => {
    // The carve-out touches `buried` alone: a sheet that lids what was drawn
    // before it is still a lid and still goes under it.
    const index = stackingIndexFor(board('a3'), [node('a1'), node('a2')])!;
    expect(index < 'a1').toBe(true);
  });
});

describe('the rule is idempotent, which is what makes undo safe', () => {
  const cases: [string, StackedElement, StackedElement[]][] = [
    ['an artefact raised off a floor', node('a0'), [board('a1')]],
    ['a lid sent to the back', board('a3'), [node('a1'), node('a2')]],
    ['a lid stopped at its floor', board('a4'), [board('a1'), node('a2')]],
    ['a board raised over a board', board('a0'), [board('a2')]],
  ];

  it.each(cases)('%s settles in one step', (_name, element, siblings) => {
    const settled = settle(element, siblings);
    expect(settled.index).not.toBe(element.index);
    expect(stackingIndexFor(settled, siblings)).toBeNull();
  });
});

describe('what the rule declines to touch', () => {
  it('answers nothing for a stack it is already happy with', () => {
    // The state every case above converges to: the floor, then what is drawn
    // on it.
    const stack = [board('a0'), node('a1'), node('a2')];
    stack.forEach((element, at) => {
      const siblings = stack.filter((_, other) => other !== at);
      expect(stackingIndexFor(element, siblings)).toBeNull();
    });
  });

  it('leaves the upper of two superposed boards alone', () => {
    // The rule answers about the element the user just placed or moved, not
    // about the pair: the board placed later is the one that ends up on top,
    // and asking again about it changes nothing. Asking about the LOWER board
    // would raise it in turn — which is exactly what moving it must do.
    expect(stackingIndexFor(board('a2'), [board('a1'), node('a3')])).toBeNull();
  });
});
