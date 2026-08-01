import {
  evaluateRules,
  type ValidationRule,
  type Violation,
} from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

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
    // On its carrier, 150 units from the transition it should be marking.
    expect(idsOf(evaluate([background(), link(), bar(onTransition + 150, y)])))
      .toEqual([W2]);
  });

  it('gives the same finding whichever half of the rule failed', () => {
    // "Not on a dependency" and "not at a transition" are one statement about
    // one symbol: one badge on one bar, never two.
    const both = evaluate([background(), link(), bar(200, 150)]);

    expect(both).toHaveLength(1);
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

  /** Where the ink of one of those labels ends, in model units. */
  const inkWidth = (text: string) => text.length * 18 * 0.5;

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
      // "ERP" left-aligned in a 120-wide box: 27 units of ink, 93 of margin.
      const short = label('l1', 400, 394, { text: 'ERP' });
      // A dependency running down the blank part of that box.
      const link = edge('d1', WARDLEY_ROLE.dependency, [480, 300], [480, 500]);

      expect(inkWidth('ERP')).toBeLessThan(80);
      expect(evaluate([background(), link, short])).toEqual([]);
    });

    it('says nothing about two labels whose words do not touch', () => {
      // Boxes overlap by 60 units; the words are 33 units apart.
      const a = label('l1', 400, 394, { text: 'ERP' });
      const b = label('l2', 460, 394, { text: 'Cloud' });

      expect(evaluate([background(), a, b])).toEqual([]);
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
      const a = label('l1', 400, 394, { text: 'ERP' });
      // Three units of shared ink: the tail of one letter and the shoulder of
      // the next, on a map 1600 units wide.
      expect(
        evaluate([background(), a, label('l2', 424, 394, { text: 'Cloud' })])
      ).toEqual([]);
      // Six, and the two words are genuinely one blur.
      expect(
        idsOf(evaluate([background(), a, label('l2', 421, 394, { text: 'Cloud' })]))
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
