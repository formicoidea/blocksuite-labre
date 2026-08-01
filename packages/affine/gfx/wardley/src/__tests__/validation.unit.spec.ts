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

/**
 * Element stand-in: the engine only ever reads `id`, `role`, `elementBound`
 * and — for a directional element — its path. `elementBound` is a GETTER that
 * allocates, exactly like the real accessor.
 */
function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  absolutePath?: [number, number][]
): GfxPrimitiveElementModel {
  return {
    id,
    role,
    ...(absolutePath ? { absolutePath } : {}),
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
  it('ships exactly the three rules of this slice, and no pilot', () => {
    expect(WARDLEY_RULES.map(rule => rule.id)).toEqual([W1, W2, W3]);
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

describe('W2 · an inertia bar off its dependency or off the transition', () => {
  const y = 450;
  const onTransition = TRANSITIONS[1];

  const OFF_CARRIER = 'com.labre.wardley.validation.inertia-off-carrier';
  const OFF_ZONE =
    'com.labre.wardley.validation.inertia-off-equilibrium-zone';

  /** A link running horizontally across the second phase transition. */
  const link = () =>
    edge(
      'd1',
      WARDLEY_ROLE.dependency,
      [onTransition - 200, y],
      [onTransition + 200, y]
    );

  const bar = (cx: number, cy: number) =>
    element('i1', [cx - 4, cy - 22, 8, 44], WARDLEY_ROLE.inertia);

  it('says nothing about a bar across a link, on the boundary', () => {
    expect(evaluate([background(), link(), bar(onTransition, y)])).toEqual([]);
  });

  it('flags a bar floating in white space', () => {
    const violations = evaluate([background(), link(), bar(700, 150)]);

    expect(idsOf(violations)).toEqual([W2]);
    expect(violations[0].elementIds).toEqual(['i1']);
    expect(violations[0].backgroundId).toBe('bg');
  });

  it('flags a bar on the link but in the middle of a phase', () => {
    // On its carrier, 150 units from the transition it should be marking —
    // 9.8% of the plot, well outside the declared 10%-wide band.
    expect(idsOf(evaluate([background(), link(), bar(onTransition + 150, y)])))
      .toEqual([W2]);
  });

  /**
   * The PO recette of 01/08/2026, reproduced.
   *
   * Two bars dropped squarely on the "Product" and "Commodity" dividers, on a
   * map that carries dependencies elsewhere but none under them. Both were
   * flagged — correctly — and both were told they were "not on a dependency at
   * a phase transition", which is only half true and hides the half that
   * matters: the transition condition was satisfied to the unit.
   */
  describe('the recette capture', () => {
    const elsewhere = () =>
      edge('d9', WARDLEY_ROLE.dependency, [100, 800], [400, 800]);

    it('blames the CARRIER, and says so, for a bar exactly on the divider', () => {
      const [violation] = evaluate([
        background(),
        elsewhere(),
        bar(onTransition, y),
      ]);

      expect(violation.messageKey).toBe(OFF_CARRIER);
      // And never the other sentence: the bar is ON the transition, to the unit.
      expect(violation.messageKey).not.toBe(OFF_ZONE);
      expect(violation.suggestionFallback).toContain('draw the bar across');
    });

    it('goes green the moment a dependency runs under the bar', () => {
      expect(evaluate([background(), link(), bar(onTransition, y)])).toEqual([]);
    });

    it('blames the ZONE for a bar on a link far from any transition', () => {
      const midPhase = onTransition + 250;
      const far = edge(
        'd1',
        WARDLEY_ROLE.dependency,
        [midPhase - 100, y],
        [midPhase + 100, y]
      );
      const [violation] = evaluate([background(), far, bar(midPhase, y)]);

      expect(violation.messageKey).toBe(OFF_ZONE);
      expect(violation.messageFallback).toContain('punctuated equilibrium');
      expect(violation.suggestion).toBe(`${OFF_ZONE}.suggestion`);
    });
  });

  it('gives ONE finding whichever half failed, and names the actionable one', () => {
    // Two requirements, one symbol, one badge — but the sentence is the one the
    // user can act on. Both halves wrong: the carrier comes first, because
    // where a bar sits means nothing until it is attached to something.
    const both = evaluate([background(), link(), bar(200, 150)]);

    expect(both).toHaveLength(1);
    expect(both[0].messageKey).toBe(OFF_CARRIER);
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
      const carrier = edge(
        'd1',
        WARDLEY_ROLE.dependency,
        [transition - 0.2 * w, cy],
        [transition + 0.2 * w, cy]
      );

      // Inside the band (4% of the plot off the line): green at every size.
      expect(evaluate([map, carrier, bar(at(0.04), cy)])).toEqual([]);
      // Outside it (8%): flagged at every size, and for the ZONE.
      const [violation] = evaluate([map, carrier, bar(at(0.08), cy)]);
      expect(violation?.messageKey).toBe(OFF_ZONE);
    }
  });

  it('says nothing when the map carries no dependency yet', () => {
    // A map being drawn is not a map with a misplaced symbol.
    expect(evaluate([background(), bar(700, 150)])).toEqual([]);
  });

  it('never mistakes a change arrow for a dependency', () => {
    // The carrier role is `wardley:dependency`, and the change arrow does not
    // specialise it — a bar drawn on an arrow is still unattached. The map
    // carries a real dependency elsewhere, so this is the rule refusing the
    // arrow as a carrier rather than the rule staying quiet for want of one.
    const arrow = edge(
      'a1',
      WARDLEY_ROLE.changeArrow,
      [onTransition - 200, y],
      [onTransition + 200, y]
    );
    const elsewhere = edge(
      'd2',
      WARDLEY_ROLE.dependency,
      [200, 800],
      [600, 800]
    );

    expect(
      idsOf(evaluate([background(), arrow, elsewhere, bar(onTransition, y)]))
    ).toEqual([W2]);
  });

  it('follows a CURVED dependency, not the chord under it', () => {
    // A curved connector stores its whole shape in two points carrying
    // tangents, so reading the bare coordinates gives the chord. A bar sitting
    // exactly on the drawn curve, 150 units above that chord, must be accepted:
    // a rule confidently wrong about what the user can plainly see is worse
    // than one that says nothing.
    const apexY = 300;
    const chordY = 450;
    // Symmetric cubic from (x-400, 450) to (x+400, 450) bulging to y = 300 at
    // its midpoint — control points 200 above give exactly that apex.
    const curved = {
      id: 'd1',
      role: WARDLEY_ROLE.dependency,
      absolutePath: [
        Object.assign([onTransition - 400, chordY], {
          absOut: [onTransition - 400, chordY - 200],
        }),
        Object.assign([onTransition + 400, chordY], {
          absIn: [onTransition + 400, chordY - 200],
        }),
      ],
      get elementBound() {
        return new Bound(onTransition - 400, apexY, 800, chordY - apexY);
      },
    } as unknown as GfxPrimitiveElementModel;

    // On the curve's apex, on the transition: silence.
    expect(evaluate([background(), curved, bar(onTransition, apexY)])).toEqual(
      []
    );
    // On the CHORD, 150 units below the drawn line: flagged.
    expect(
      idsOf(evaluate([background(), curved, bar(onTransition, chordY)]))
    ).toEqual([W2]);
  });
});

describe('W3 · overlapping nodes and labels', () => {
  const node = (id: string, x: number, y: number, role?: string) =>
    element(id, [x, y, 18, 18], role ?? WARDLEY_ROLE.component);
  const label = (id: string, x: number, y: number) =>
    element(id, [x, y, 120, 26], WARDLEY_ROLE.label);

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
    // ...and one unit of real overlap is still an overlap.
    expect(
      idsOf(evaluate([background(), node('n1', 400, 400), node('n2', 417, 400)]))
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
