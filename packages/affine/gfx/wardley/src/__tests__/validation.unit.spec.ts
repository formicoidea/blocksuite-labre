import {
  backgroundBoundaryCoords,
  evaluateRules,
  type ValidationRule,
  type Violation,
} from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { WARDLEY_BACKGROUND } from '../background';
import { WARDLEY_ROLE } from '../roles';
import { WARDLEY_RULES } from '../rules';
import { MAP_BOUND, TRANSITIONS } from './corpus/fixtures';

/**
 * The three real Wardley rules, rule by rule (PF13.4 / PF13.5 / PF13.6).
 *
 * The corpus spec checks whole maps; this one checks the EDGES of each rule —
 * the dead zone, the tolerances, the role hierarchy, and above all what each
 * rule stays silent about. Silence is the expensive half: a rule that fires on
 * something adjacent is a rule that gets switched off.
 *
 * These replace the pilot rule's spec verbatim in intent: every property that
 * suite pinned down (a well-formed violation with no prose, proportionality,
 * the role hierarchy, gating, the frame matched by role and never by type) is
 * pinned down here, on rules a Wardley practitioner actually asked for.
 */

const W1 = 'wardley.change-arrow-against-evolution';
const W2 = 'wardley.inertia-off-transition';
const W3 = 'wardley.overlapping-artefacts';
const W4 = 'wardley.provider-above-consumer';

/**
 * Element stand-in: the engine only ever reads `id`, `role`, `elementBound`,
 * — for a directional element — its path, and — for a background — whichever
 * props its declaration names. `elementBound` is a GETTER that allocates,
 * exactly like the real accessor.
 */
function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  absolutePath?: [number, number][],
  props?: Record<string, unknown>
): GfxPrimitiveElementModel {
  return {
    id,
    role,
    ...(absolutePath ? { absolutePath } : {}),
    ...props,
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

/** The map itself: a 1600×900 background at the origin, carrying its role. */
const background = () =>
  element(
    'bg',
    [MAP_BOUND.x, MAP_BOUND.y, MAP_BOUND.w, MAP_BOUND.h],
    WARDLEY_ROLE.map
  );

/** A map authored before `wardley:map` existed: same geometry, no role. */
const legacyBackground = () =>
  element('bg', [MAP_BOUND.x, MAP_BOUND.y, MAP_BOUND.w, MAP_BOUND.h]);

/** An edge between two absolute points, with a routed path. */
const edge = (
  id: string,
  role: string | undefined,
  from: [number, number],
  to: [number, number]
) =>
  element(
    id,
    [
      Math.min(from[0], to[0]),
      Math.min(from[1], to[1]),
      Math.abs(to[0] - from[0]) || 1,
      Math.abs(to[1] - from[1]) || 1,
    ],
    role,
    [from, to]
  );

const evaluate = (elements: GfxPrimitiveElementModel[]) =>
  evaluateRules(WARDLEY_RULES, elements);

const idsOf = (violations: readonly Violation[]) =>
  violations.map(violation => violation.ruleId).sort();

describe('what the framework ships', () => {
  it('ships exactly the four rules of the pack, and no pilot', () => {
    // W4 joined the pack with `docs/adr/0010` — and only once M1, M2 and M3
    // had made the direction it reads a statement the user can see and undo.
    expect(WARDLEY_RULES.map(rule => rule.id)).toEqual([W1, W2, W3, W4]);
    // The tracer bullet's rule is gone: it existed to prove the machinery, not
    // because anybody drawing a map wanted it (PO decision, 01/08/2026).
    expect(WARDLEY_RULES.map(rule => rule.id)).not.toContain(
      'wardley.component-outside-map'
    );
  });

  it('namespaces every rule and holds no prose in the engine', () => {
    for (const rule of WARDLEY_RULES) {
      expect(rule.framework).toBe('wardley');
      expect(rule.id.startsWith('wardley.')).toBe(true);
      expect(rule.messageKey).toMatch(/^com\.labre\./);
      // A framework fallback so a host with no catalogue reads a sentence
      // rather than a dotted key — the framework owns the word, not the engine.
      expect(rule.messageFallback).toBeTruthy();
    }
  });

  it('never declares a level the pipework cannot honour', () => {
    // `blocking-overridable` is carried by the engine and acted on by nobody:
    // no gesture is refused anywhere in this library yet. Declaring it would be
    // data claiming an effect that does not exist — see `profiles.ts`.
    for (const rule of WARDLEY_RULES) {
      expect(rule.severity).toBe('warning');
    }
  });
});

describe('W1 · a change arrow pointing against evolution', () => {
  const arrow = (from: [number, number], to: [number, number]) =>
    edge('a1', WARDLEY_ROLE.changeArrow, from, to);

  it('flags an arrow heading back towards genesis', () => {
    const violations = evaluate([background(), arrow([1200, 400], [400, 400])]);

    expect(violations).toHaveLength(1);
    expect(violations[0].elementIds).toEqual(['a1']);
  });

  it('says nothing about an arrow heading towards commodity', () => {
    expect(evaluate([background(), arrow([400, 400], [1200, 400])])).toEqual([]);
  });

  it('produces a well-formed violation object, with no prose', () => {
    const [violation] = evaluate([background(), arrow([1200, 400], [400, 400])]);

    expect(violation).toStrictEqual<Violation>({
      ruleId: W1,
      elementIds: ['a1'],
      severity: 'warning',
      messageKey: 'com.labre.wardley.validation.change-arrow-against-evolution',
      messageFallback: 'This change arrow points against evolution.',
      suggestion:
        'com.labre.wardley.validation.change-arrow-against-evolution.suggestion',
      suggestionFallback:
        'Evolution runs left to right — turn the arrow towards the commodity end, or draw a dependency instead.',
      // The map the arrow was measured against. An id, not a bound and not a
      // rendering: it is what lets "ignore on the whole map" mean THIS map when
      // the board carries several.
      backgroundId: 'bg',
    });
    // Everything human-readable is an i18n key.
    expect(violation.messageKey).toMatch(/^com\.labre\./);
  });

  it('leaves the dead zone around the perpendicular alone', () => {
    // Straight up the value chain: neither with evolution nor against it.
    expect(evaluate([background(), arrow([800, 700], [800, 200])])).toEqual([]);
    // Slightly backwards and steeply up — a hand that slipped, not a claim.
    expect(evaluate([background(), arrow([800, 700], [760, 200])])).toEqual([]);
  });

  it('never touches a dependency', () => {
    // The value-chain link is a different role: "A depends on B" says nothing
    // about which way anything is evolving, whichever way it was drawn.
    const link = edge('d1', WARDLEY_ROLE.dependency, [1200, 400], [400, 400]);

    expect(idsOf(evaluate([background(), link]))).toEqual([]);
  });

  it('says nothing when there is no map to have a sense of evolution', () => {
    // An arrow on a blank canvas is a sketch: there is no frame, so there is no
    // direction it can contradict.
    expect(evaluate([arrow([1200, 400], [400, 400])])).toEqual([]);
  });

  it('matches the frame by ROLE, never by element type', () => {
    // A map authored before `wardley:map` existed frames nothing, so it raises
    // nothing. No backfill, no retro-violation.
    expect(
      evaluate([legacyBackground(), arrow([1200, 400], [400, 400])])
    ).toEqual([]);
  });

  it('says nothing about an arrow it cannot read a direction from', () => {
    // Attached at both ends and never laid out: no path, no verdict. Silence,
    // not a guess.
    const unrouted = element('a1', [400, 400, 1, 1], WARDLEY_ROLE.changeArrow);

    expect(evaluate([background(), unrouted])).toEqual([]);
  });
});

/**
 * W2, as the PO spelled it out on the recette of 02/08/2026:
 *
 * > "The horizontal position of an inertia bar is only valid if it is astride
 * > two evolution phases, that is, superimposed on a dashed vertical axis."
 *
 * One condition, and it is the position. The carrier half this rule used to
 * carry — "and there must be a dependency under it" — was our reading and not
 * the rule; it is gone, with the second sentence that existed to tell the two
 * halves apart. What is pinned here is the pair of captures the PO sent: a bar
 * alone on a divider is RIGHT, a bar between two dividers is WRONG.
 */
describe('W2 · an inertia bar astride a phase transition', () => {
  const y = 450;
  const onTransition = TRANSITIONS[1];

  const OFF_TRANSITION = 'com.labre.wardley.validation.inertia-off-transition';

  /** A link running horizontally across the second phase transition. */
  const link = () =>
    edge(
      'd1',
      WARDLEY_ROLE.dependency,
      [onTransition - 200, y],
      [onTransition + 200, y]
    );

  const bar = (cx: number, cy: number, w = 8) =>
    element('i1', [cx - w / 2, cy - 22, w, 44], WARDLEY_ROLE.inertia);

  it('says nothing about a bar on the boundary, with a link under it', () => {
    expect(evaluate([background(), link(), bar(onTransition, y)])).toEqual([]);
  });

  it('says nothing about a bar ALONE on the boundary (PO capture, 02/08)', () => {
    // The regression this version exists for. A bar dropped squarely on the
    // "Product" divider, on a map whose dependencies all run elsewhere, is a
    // map saying "this does not cross here" — not a mistake.
    const elsewhere = edge(
      'd9',
      WARDLEY_ROLE.dependency,
      [100, 800],
      [400, 800]
    );

    expect(evaluate([background(), elsewhere, bar(onTransition, y)])).toEqual(
      []
    );
    // ...and with no dependency anywhere on the board either.
    expect(evaluate([background(), bar(onTransition, y)])).toEqual([]);
  });

  it('flags a bar between two dividers (PO capture, 02/08)', () => {
    // 150 units from the transition it should straddle — 9.8% of the plot,
    // against a band reaching 5% either side of the divider.
    const violations = evaluate([
      background(),
      link(),
      bar(onTransition + 150, y),
    ]);

    expect(idsOf(violations)).toEqual([W2]);
    expect(violations[0].elementIds).toEqual(['i1']);
    expect(violations[0].backgroundId).toBe('bg');
    expect(violations[0].messageKey).toBe(OFF_TRANSITION);
    expect(violations[0].suggestion).toBe(`${OFF_TRANSITION}.suggestion`);
    expect(violations[0].suggestionFallback).toContain('astride');
    // WHICH frontier it missed — the nearest one, named off the declaration.
    expect(violations[0].boundaryId).toBe('custom-built|product');
  });

  it('flags a bar floating mid-phase, with or without a link', () => {
    // Halfway between the "Product" and "Commodity" dividers, and well clear of
    // both bands — the emptiest place on the axis a bar can be.
    const midPhase = (TRANSITIONS[1] + TRANSITIONS[2]) / 2;

    expect(idsOf(evaluate([background(), link(), bar(midPhase, 150)]))).toEqual([
      W2,
    ]);
    expect(idsOf(evaluate([background(), bar(midPhase, 150)]))).toEqual([W2]);
  });

  it('names the frontier the bar was actually aiming at', () => {
    // Past the middle of the phase: the nearest transition is now the Commodity
    // one. The finding follows the bar, not the first band on the map.
    const [violation] = evaluate([
      background(),
      bar(TRANSITIONS[2] - 200, y),
    ]);

    expect(violation.boundaryId).toBe('product|commodity');
  });

  it('measures the BAR, not a point inside it', () => {
    // "Superimposed on the axis" is about ink. A bar somebody stretched, whose
    // centre is further from the divider than the band reaches and which the
    // divider nevertheless passes straight through, is astride it.
    const wide = bar(onTransition - 90, y, 220);
    expect(evaluate([background(), wide])).toEqual([]);
    // The same width, parked halfway between two dividers: flagged.
    const midPhase = (TRANSITIONS[1] + TRANSITIONS[2]) / 2;
    expect(idsOf(evaluate([background(), bar(midPhase, y, 220)]))).toEqual([W2]);
  });

  it('gives ONE finding per bar, however far off it is', () => {
    const both = evaluate([background(), link(), bar(200, 150)]);

    expect(both).toHaveLength(1);
    expect(both[0].messageKey).toBe(OFF_TRANSITION);
  });

  it('judges a RESIZED map exactly as it judges the reference one', () => {
    // The band is a ratio of the plot, so the same gesture gets the same
    // verdict at any size. The defect it replaces was an absolute 40 units:
    // 5.5% of the plot on an 800-wide map and 1.3% on a 3200-wide one.
    for (const scale of [0.5, 1, 2]) {
      const w = 1600 * scale;
      const map = element('bg', [0, 0, w, (w * 9) / 16], WARDLEY_ROLE.map);
      const [transition] = backgroundBoundaryCoords(
        WARDLEY_BACKGROUND,
        new Bound(0, 0, w, (w * 9) / 16)
      ).x.slice(1);
      const at = (fraction: number) =>
        transition + fraction * (w - 40 - 30);
      const cy = ((w * 9) / 16) * 0.5;

      // Inside the band (4% of the plot off the line): green at every size.
      expect(evaluate([map, bar(at(0.04), cy)])).toEqual([]);
      // Outside it (8%): flagged at every size.
      const [violation] = evaluate([map, bar(at(0.08), cy)]);
      expect(violation?.messageKey).toBe(OFF_TRANSITION);
    }
  });

  it('says nothing about a bar drawn on no map at all', () => {
    // A bar on a blank board is a sketch, not a misplaced symbol: with no frame
    // there is no frontier for it to be astride of.
    expect(evaluate([bar(700, 150)])).toEqual([]);
  });

  /**
   * PO, 25/08/2026: W2 is only ACTIVE while the dashed columns are displayed.
   *
   * The dividers are a per-part toggle of the map (`showColumnDividers`, the
   * "Columns (dividers)" button of the Wardley toolbar). Switch them off and
   * the user is looking at a plain card: telling them a bar is not astride a
   * line that is not on the canvas is a finding whose gesture aims at nothing.
   *
   * Scoped, never weakened — every case below is one the rule still reports the
   * moment the columns come back.
   */
  describe('only while the dashed columns are shown (PO, 25/08)', () => {
    const mapWith = (showColumnDividers: boolean) =>
      element(
        'bg',
        [MAP_BOUND.x, MAP_BOUND.y, MAP_BOUND.w, MAP_BOUND.h],
        WARDLEY_ROLE.map,
        undefined,
        { showColumnDividers }
      );

    const midPhase = (TRANSITIONS[1] + TRANSITIONS[2]) / 2;

    it('says nothing about a bar ANYWHERE once the columns are hidden', () => {
      for (const cx of [200, midPhase, TRANSITIONS[1] + 150, 1500]) {
        expect(evaluate([mapWith(false), bar(cx, y)])).toEqual([]);
      }
      // Including with a dependency under it, which the rule stopped asking
      // about on 02/08 and must not start asking about again here.
      expect(evaluate([mapWith(false), link(), bar(midPhase, y)])).toEqual([]);
    });

    it('judges exactly as before while the columns are shown', () => {
      // The toggle in its normal position — which is the default of every map
      // ever drawn — changes nothing at all.
      expect(idsOf(evaluate([mapWith(true), bar(midPhase, y)]))).toEqual([W2]);
      expect(evaluate([mapWith(true), bar(onTransition, y)])).toEqual([]);
    });

    it('leaves the other three rules untouched with the columns hidden', () => {
      // W2 is the only rule measured against the dividers. Hiding them must not
      // turn the map into a place where nothing is checked — that would be a
      // toggle nobody would dare use.
      const hidden = mapWith(false);
      const arrow = edge(
        'a1',
        WARDLEY_ROLE.changeArrow,
        [1200, 400],
        [400, 400]
      );
      const overlapping = [
        element('n1', [400, 400, 18, 18], WARDLEY_ROLE.component),
        element('n2', [404, 400, 18, 18], WARDLEY_ROLE.component),
      ];

      expect(
        idsOf(evaluate([hidden, arrow, ...overlapping, bar(midPhase, y)]))
      ).toEqual([W1, W3]);
    });

    it('is the DIVIDERS that decide, not the other five toggles', () => {
      // Every other part of the map can be hidden and W2 still speaks: the rule
      // is about the frontier, and only the frontier's own toggle scopes it.
      const noLabels = element(
        'bg',
        [MAP_BOUND.x, MAP_BOUND.y, MAP_BOUND.w, MAP_BOUND.h],
        WARDLEY_ROLE.map,
        undefined,
        {
          showColumnDividers: true,
          showXAxis: false,
          showYAxis: false,
          showColumnLabels: false,
          showCornerLabels: false,
          showVisibilityLabels: false,
        }
      );

      expect(idsOf(evaluate([noLabels, bar(midPhase, y)]))).toEqual([W2]);
    });

    it('keeps judging a map that carries no toggle at all', () => {
      // A stand-in, a host-built element, a document whose props were never
      // materialised: a prop the instance does not carry is not the user hiding
      // anything, so the rule stays exactly as it was. This is what every other
      // case in this file relies on.
      expect(idsOf(evaluate([background(), bar(midPhase, y)]))).toEqual([W2]);
    });
  });
});

describe('W3 · overlapping nodes and labels', () => {
  const node = (id: string, x: number, y: number, role?: string) =>
    element(id, [x, y, 18, 18], role ?? WARDLEY_ROLE.component);

  /**
   * A real label: the CREATION BOX the toolbox gives it (120 × 26, whatever it
   * says) plus the words actually written in it. The engine reads the words —
   * measuring the box is what the PO's acceptance caught.
   */
  const label = (
    id: string,
    x: number,
    y: number,
    { text = 'Customer', w = 120, align = 'left' } = {}
  ) =>
    ({
      id,
      role: WARDLEY_ROLE.label,
      text,
      fontSize: 18,
      textAlign: align,
      get elementBound() {
        return new Bound(x, y, w, 26);
      },
    }) as unknown as GfxPrimitiveElementModel;

  /**
   * The ink of the names used below, at font 18, as the engine sizes them —
   * letter by letter, not by an average. Spelled out so a test that depends on
   * a few units of margin says where those units come from.
   */
  const INK = { ERP: 33.5, Customer: 77.2, Cloud: 44.5 };

  it('flags two nodes on top of each other, naming BOTH', () => {
    const violations = evaluate([
      background(),
      node('n1', 400, 400),
      node('n2', 404, 400),
    ]);

    expect(idsOf(violations)).toEqual([W3]);
    // A pair finding: neither element alone is at fault, so both are named.
    expect(violations[0].elementIds).toEqual(['n1', 'n2']);
  });

  it('names the pair in a stable order, whatever the walk order was', () => {
    const forwards = evaluate([
      background(),
      node('n1', 400, 400),
      node('n2', 404, 400),
    ]);
    const backwards = evaluate([
      background(),
      node('n2', 404, 400),
      node('n1', 400, 400),
    ]);

    expect(forwards[0].elementIds).toEqual(backwards[0].elementIds);
  });

  it('flags a label written across a node', () => {
    expect(
      idsOf(evaluate([background(), node('n1', 400, 400), label('l1', 380, 394)]))
    ).toEqual([W3]);
  });

  it('flags a label crossed out by the dependency under it', () => {
    const link = edge('d1', WARDLEY_ROLE.dependency, [300, 407], [700, 407]);

    expect(idsOf(evaluate([background(), link, label('l1', 400, 394)]))).toEqual([
      W3,
    ]);
  });

  /**
   * The two false positives the PO's acceptance brought back (01/08/2026), and
   * the mistakes they must not take down with them.
   *
   * Both had the same cause: a label is created 120 to 200 units wide whatever
   * it says, so the rule was measuring a box the user cannot see. Both are
   * reproduced here as the acceptance saw them — a WIDE box with a SHORT name
   * in it — so a change that brings the box geometry back fails loudly.
   */
  describe('measures the words, not the box they were created in', () => {
    it('says nothing about a link crossing the empty half of a label box', () => {
      // "ERP" left-aligned in a 120-wide box: ~33 units of ink, ~87 of margin.
      const short = label('l1', 400, 394, { text: 'ERP' });
      // A dependency running down the blank part of that box.
      const link = edge('d1', WARDLEY_ROLE.dependency, [480, 300], [480, 500]);

      expect(INK.ERP).toBeLessThan(80);
      expect(evaluate([background(), link, short])).toEqual([]);
    });

    it('says nothing about two labels whose words do not touch', () => {
      // Boxes overlap by 60 units; the words are ~27 units apart.
      const a = label('l1', 400, 394, { text: 'ERP' });
      const b = label('l2', 460, 394, { text: 'Cloud' });

      expect(evaluate([background(), a, b])).toEqual([]);
    });

    it('sizes a name letter by letter, not by an average', () => {
      // Seven narrow letters. An average advance reads `utility` half as wide
      // again as it is drawn and puts a ghost 20 units past the last one — the
      // PO's first capture, with another word in the box.
      const narrow = label('l1', 400, 394, { text: 'utility', w: 200 });
      const past = edge('d1', WARDLEY_ROLE.dependency, [455, 300], [455, 500]);
      const inside = edge('d2', WARDLEY_ROLE.dependency, [420, 300], [420, 500]);

      expect(evaluate([background(), past, narrow])).toEqual([]);
      expect(idsOf(evaluate([background(), inside, narrow]))).toEqual([W3]);
    });

    it('still flags a link drawn through the word itself', () => {
      const short = label('l1', 400, 394, { text: 'ERP' });
      const link = edge('d1', WARDLEY_ROLE.dependency, [410, 300], [410, 500]);

      expect(idsOf(evaluate([background(), link, short]))).toEqual([W3]);
    });

    it('still flags two names written on top of each other', () => {
      const a = label('l1', 400, 394);
      const b = label('l2', 430, 394);

      const violations = evaluate([background(), a, b]);
      expect(idsOf(violations)).toEqual([W3]);
      expect(violations[0].elementIds).toEqual(['l1', 'l2']);
    });

    it('reads the ink where the alignment puts it', () => {
      // Same box, same word: only `textAlign` says which end of the box the
      // 72 units of ink sit at, and the rule has to agree with the renderer.
      const right = label('l1', 400, 394, { align: 'right' });
      const overLeftEnd = edge('d1', WARDLEY_ROLE.dependency, [410, 300], [410, 500]);
      const overRightEnd = edge('d2', WARDLEY_ROLE.dependency, [500, 300], [500, 500]);

      expect(evaluate([background(), overLeftEnd, right])).toEqual([]);
      expect(idsOf(evaluate([background(), overRightEnd, right]))).toEqual([W3]);
    });

    it('measures an element that exposes no text by its box, as before', () => {
      // A host element, or a fixture, that carries no text at all: there is
      // nothing to measure, so nothing is narrowed and nothing changes.
      const boxOnly = element('l1', [400, 394, 120, 26], WARDLEY_ROLE.label);
      const link = edge('d1', WARDLEY_ROLE.dependency, [480, 300], [480, 500]);

      expect(idsOf(evaluate([background(), boxOnly, link]))).toEqual([W3]);
    });
  });

  /**
   * `minPenetration: 4` — the second half of the calibration. Not every touch
   * is a collision: what counts is how far into each other the two go.
   */
  describe('ignores a collision shallower than the declared threshold', () => {
    it('lets a link graze the edge of a name in silence', () => {
      const name = label('l1', 400, 394);
      // The label runs from y 394 to y 420. A link one unit under its top edge
      // touches the box and strikes out nothing.
      const grazing = edge('d1', WARDLEY_ROLE.dependency, [300, 395], [700, 395]);
      const through = edge('d2', WARDLEY_ROLE.dependency, [300, 401], [700, 401]);

      expect(evaluate([background(), grazing, name])).toEqual([]);
      // Seven units in — past the threshold, into the letters.
      expect(idsOf(evaluate([background(), through, name]))).toEqual([W3]);
    });

    it('lets two names share a hair of ink in silence', () => {
      // "ERP" ends at 433.5.
      const a = label('l1', 400, 394, { text: 'ERP' });
      // Three units of shared ink: the tail of one letter and the shoulder of
      // the next, on a map 1600 units wide.
      expect(
        evaluate([background(), a, label('l2', 430, 394, { text: 'Cloud' })])
      ).toEqual([]);
      // Six, and the two words are genuinely one blur.
      expect(
        idsOf(evaluate([background(), a, label('l2', 427, 394, { text: 'Cloud' })]))
      ).toEqual([W3]);
    });

    it('measures the DEPTH of a crossing, not the length of it', () => {
      // A link running the whole length of a name but only one unit under its
      // bottom edge crosses far more of it than a link that clips one corner —
      // and is still not what makes a name unreadable.
      const name = label('l1', 400, 394);
      const under = edge('d1', WARDLEY_ROLE.dependency, [300, 419], [700, 419]);

      expect(evaluate([background(), under, name])).toEqual([]);
    });
  });

  it('measures a link along its PATH, never by its bounding box', () => {
    // The box of this diagonal covers the whole quadrant; the line itself runs
    // nowhere near the label. Measuring boxes would indict every label on the
    // map, which is exactly why the geometry follows the role's `kind`.
    const diagonal = edge('d1', WARDLEY_ROLE.dependency, [300, 300], [900, 800]);

    expect(evaluate([background(), diagonal, label('l1', 780, 320)])).toEqual([]);
  });

  it('says nothing about two links that cross', () => {
    // Dependencies cross all the time on a real value chain: that is the map
    // working, not the map broken. Link/link is deliberately not declared.
    const a = edge('d1', WARDLEY_ROLE.dependency, [300, 300], [900, 800]);
    const b = edge('d2', WARDLEY_ROLE.dependency, [300, 800], [900, 300]);

    expect(evaluate([background(), a, b])).toEqual([]);
  });

  it('says nothing about close neighbours that do not touch', () => {
    expect(
      evaluate([background(), node('n1', 400, 400), node('n2', 440, 400)])
    ).toEqual([]);
  });

  it('says nothing about two boxes that share an EDGE', () => {
    // Exactly abutting: zero shared area, perfectly readable — and precisely
    // what alignment and snap produce all day. `Bound.isOverlapWithBound`
    // answers `true` here, which is why the family does not use it.
    expect(
      evaluate([background(), node('n1', 400, 400), node('n2', 418, 400)])
    ).toEqual([]);
    // ...nor about one unit of real overlap. Since the PO's acceptance the
    // rule declares `minPenetration: 4`: a shared hair between two 18-unit
    // artefacts is a hand on a trackpad, not something anybody misreads.
    expect(
      evaluate([background(), node('n1', 400, 400), node('n2', 417, 400)])
    ).toEqual([]);
    // Past the threshold it is an overlap again, and the family's own epsilon
    // is what it always was.
    expect(
      idsOf(evaluate([background(), node('n1', 400, 400), node('n2', 413, 400)]))
    ).toEqual([W3]);
  });

  it('measures a rotated node by its bounding box — a known limit', () => {
    // `elementBound` is the AXIS-ALIGNED box of a rotated element, so a 120×26
    // label at 45° presents as roughly 103×103 and can collide with something
    // its ink never touches. Pinned rather than fixed: a false POSITIVE on a
    // warning-level readability rule is the right way round, and an oriented
    // box costs a separating-axis test in the inner loop of the only
    // super-linear family. See `subjectsCollide`.
    const rotated = {
      id: 'l1',
      role: WARDLEY_ROLE.label,
      get elementBound() {
        // What the model returns for a 120×26 label rotated 45° about its
        // centre: the enclosing axis-aligned square.
        return new Bound(400, 400, 103, 103);
      },
    } as unknown as GfxPrimitiveElementModel;

    // A node in the corner of that square: outside the ink, inside the box.
    expect(
      idsOf(evaluate([background(), rotated, node('n1', 404, 404)]))
    ).toEqual([W3]);
  });

  it('covers a specialisation through the role hierarchy', () => {
    // `wardley:market` specialises `wardley:component`: the pair written on the
    // parent catches it without ever naming it.
    const violations = evaluate([
      background(),
      node('m1', 400, 400, WARDLEY_ROLE.market),
      node('e1', 404, 400, WARDLEY_ROLE.ecosystem),
    ]);

    expect(violations[0]?.elementIds).toEqual(['e1', 'm1']);
  });

  it('leaves roles outside the declared pairs alone', () => {
    // A pipeline body and its handle overlap BY CONSTRUCTION — the handle
    // straddles the top edge. Neither role is in a declared pair, so the rule
    // stays quiet: proportionality means silence, not a softer warning.
    const body = element('b1', [400, 400, 120, 25], WARDLEY_ROLE.pipeline);
    const handle = element('h1', [451, 391, 18, 18], WARDLEY_ROLE.handle);

    expect(evaluate([background(), body, handle])).toEqual([]);
  });

  it('reports one finding per colliding pair', () => {
    // Three nodes in a heap is three couples, each named once.
    const violations = evaluate([
      background(),
      node('n1', 400, 400),
      node('n2', 404, 400),
      node('n3', 408, 400),
    ]);

    expect(violations).toHaveLength(3);
    expect(violations.map(v => v.elementIds.join('+')).sort()).toEqual([
      'n1+n2',
      'n1+n3',
      'n2+n3',
    ]);
  });

  it('still attributes a finding to the map it happened on', () => {
    // The rule does not measure against the frame — an overlap is an overlap
    // anywhere — but the finding names one, so "ignore on the whole map" has a
    // map to be written on.
    const [violation] = evaluate([
      background(),
      node('n1', 400, 400),
      node('n2', 404, 400),
    ]);

    expect(violation.backgroundId).toBe('bg');
  });
});

describe('W4 · a provider above its consumer', () => {
  /** A component node centred on an absolute model point. */
  const at = (id: string, x: number, y: number) =>
    element(id, [x - 9, y - 9, 18, 18], WARDLEY_ROLE.component);

  /**
   * A dependency BOUND to two nodes: `consumer` needs `provider`. The
   * orientation is stated at the call site — it is the persisted `source →
   * target` pair, and reading it off the geometry instead is the shortcut ADR
   * 0010 § 4 rejects.
   */
  const needs = (
    id: string,
    consumer: GfxPrimitiveElementModel,
    provider: GfxPrimitiveElementModel,
    role: string | undefined = WARDLEY_ROLE.dependency
  ) => {
    const a = consumer.elementBound.center as [number, number];
    const b = provider.elementBound.center as [number, number];
    return {
      ...edge(id, role, a, b),
      source: { id: consumer.id },
      target: { id: provider.id },
    } as unknown as GfxPrimitiveElementModel;
  };

  it('flags a dependency whose provider sits higher than its consumer', () => {
    const consumer = at('n1', 400, 700);
    const provider = at('n2', 800, 200);
    const violations = evaluate([
      background(),
      consumer,
      provider,
      needs('d1', consumer, provider),
    ]);

    expect(violations).toHaveLength(1);
    // The relation, and both ends of it: the finding is about an ORDER, and
    // neither node alone is at fault. The edge is named because reversing it is
    // one of the two honest ways out, and that gesture lives on the edge.
    expect(violations[0].elementIds).toEqual(['d1', 'n1', 'n2']);
  });

  it('says nothing when the consumer is above what it needs', () => {
    const consumer = at('n1', 400, 200);
    const provider = at('n2', 800, 700);

    expect(
      evaluate([background(), consumer, provider, needs('d1', consumer, provider)])
    ).toEqual([]);
  });

  it('produces a well-formed violation object, with no prose', () => {
    const consumer = at('n1', 400, 700);
    const provider = at('n2', 800, 200);
    const [violation] = evaluate([
      background(),
      consumer,
      provider,
      needs('d1', consumer, provider),
    ]);

    expect(violation).toStrictEqual<Violation>({
      ruleId: W4,
      elementIds: ['d1', 'n1', 'n2'],
      severity: 'warning',
      messageKey: 'com.labre.wardley.validation.provider-above-consumer',
      messageFallback: 'This component sits above the one that depends on it.',
      suggestion:
        'com.labre.wardley.validation.provider-above-consumer.suggestion',
      suggestionFallback:
        'Needs run downwards on a Wardley map: move the provider below its consumer — or, if the link was drawn the wrong way round, reverse it.',
      backgroundId: 'bg',
    });
  });

  it('tolerates two components drawn level, and speaks past the slack', () => {
    // The declared slack is 2% of a 900-high map, i.e. 18 units.
    const consumer = at('n1', 400, 500);
    const inside = at('n2', 800, 510);
    expect(
      evaluate([background(), consumer, inside, needs('d1', consumer, inside)])
    ).toEqual([]);

    const outside = at('n2', 800, 460);
    expect(
      idsOf(evaluate([background(), consumer, outside, needs('d1', consumer, outside)]))
    ).toEqual([W4]);
  });

  it('reads the DIRECTION, not the layout — the same pair, reversed', () => {
    // The whole point of the ADR in one assertion: two nodes, one geometry, two
    // opposite verdicts depending only on which end the edge calls its source.
    const high = at('n1', 400, 200);
    const low = at('n2', 800, 700);

    expect(idsOf(evaluate([background(), high, low, needs('d1', high, low)]))).toEqual(
      []
    );
    expect(idsOf(evaluate([background(), high, low, needs('d1', low, high)]))).toEqual(
      [W4]
    );
  });

  it('never evaluates an edge with a free end', () => {
    const consumer = at('n1', 400, 700);
    const provider = at('n2', 800, 200);
    // Released over empty canvas: a position, no id. It relates nothing.
    const floating = {
      ...needs('d1', consumer, provider),
      target: { position: [800, 200] },
    } as unknown as GfxPrimitiveElementModel;

    expect(evaluate([background(), consumer, provider, floating])).toEqual([]);
  });

  it('never evaluates an edge whose end no longer exists', () => {
    const consumer = at('n1', 400, 700);
    const provider = at('n2', 800, 200);
    // The provider was deleted between two evaluations: a dangling id says
    // nothing about a layout.
    expect(evaluate([background(), consumer, needs('d1', consumer, provider)])).toEqual(
      []
    );
  });

  it('never compares a pair that straddles two maps', () => {
    const consumer = at('n1', 400, 700);
    const provider = at('n2', 2400, 200);
    const secondMap = element('bg2', [2000, 0, 1600, 900], WARDLEY_ROLE.map);

    expect(
      idsOf(
        evaluate([
          background(),
          secondMap,
          consumer,
          provider,
          needs('d1', consumer, provider),
        ])
      )
    ).toEqual([]);
  });

  it('says nothing when there is no map to be ordered against', () => {
    const consumer = at('n1', 400, 700);
    const provider = at('n2', 800, 200);

    expect(evaluate([consumer, provider, needs('d1', consumer, provider)])).toEqual(
      []
    );
  });

  it('never falls on an edge carrying another role, or none', () => {
    const consumer = at('n1', 400, 700);
    const provider = at('n2', 800, 200);
    // A change arrow is oriented too, and its verb is not "depends on". A
    // neutral connector claims nothing at all.
    expect(
      idsOf(
        evaluate([
          background(),
          consumer,
          provider,
          needs('a1', consumer, provider, WARDLEY_ROLE.changeArrow),
        ])
      )
      // W1 has its own say about where that arrow points; W4 has none.
    ).not.toContain(W4);
    // A neutral connector, bound to both nodes and drawn the "wrong" way: no
    // role, so nothing about it is ever evaluated (PRD principle 8).
    const neutral = {
      ...edge('c1', undefined, [400, 700], [800, 200]),
      source: { id: 'n1' },
      target: { id: 'n2' },
    } as unknown as GfxPrimitiveElementModel;
    expect(idsOf(evaluate([background(), consumer, provider, neutral]))).toEqual(
      []
    );
  });

  it('says nothing about an edge that links an element to itself', () => {
    const alone = at('n1', 400, 700);

    expect(evaluate([background(), alone, needs('d1', alone, alone)])).toEqual([]);
  });

  it('costs one finding per RELATION, never per pair of nodes', () => {
    // Three nodes in a correct chain plus one link drawn upside-down: the rule
    // reports the relation somebody drew, and says nothing about the two nodes
    // that merely happen to be one above the other.
    const top = at('n1', 400, 200);
    const middle = at('n2', 600, 500);
    const bottom = at('n3', 800, 800);
    const violations = evaluate([
      background(),
      top,
      middle,
      bottom,
      needs('ok1', top, middle),
      needs('ok2', middle, bottom),
      needs('bad', bottom, middle),
    ]);

    expect(violations.map(v => v.elementIds.join('+'))).toEqual(['bad+n2+n3']);
  });
});

describe('proportionality: only the framework’s own roles are evaluated', () => {
  it('never evaluates a neutral element, wherever it sits', () => {
    const violations = evaluate([
      background(),
      // A generalist square, a free text, an unroled bar: no role at all, so
      // no rule of any family looks at them — even piled on top of each other.
      element('sq', [400, 400, 40, 40]),
      element('tx', [405, 405, 120, 26]),
      element('bar', [410, 400, 8, 44]),
      edge('cn', undefined, [1200, 400], [400, 400]),
    ]);

    expect(violations).toEqual([]);
  });

  it('ignores a role belonging to another framework', () => {
    expect(
      evaluate([
        background(),
        element('e1', [400, 400, 40, 40], 'edgy:facet'),
        element('e2', [404, 400, 40, 40], 'edgy:facet'),
      ])
    ).toEqual([]);
  });
});

describe('gating: no rule registered means no evaluation', () => {
  it('returns nothing when the framework flag is off', () => {
    // Flag off => the flag-gated WardleyViewExtension never registers its
    // rules => the manager resolves an empty rule list.
    const noRules: readonly ValidationRule[] = [];

    expect(
      evaluateRules(noRules, [
        background(),
        edge('a1', WARDLEY_ROLE.changeArrow, [1200, 400], [400, 400]),
      ])
    ).toEqual([]);
  });
});
