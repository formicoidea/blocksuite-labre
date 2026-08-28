import {
  evaluateCheckup,
  evaluateRules,
  type Violation,
} from '@labre/affine-block-surface';
import { Bound } from '@labre/global/gfx';
import type { GfxPrimitiveElementModel } from '@labre/std/gfx';
import { describe, expect, it } from 'vitest';

import { C4_PROFILES } from '../profiles';
import { C4_ROLE } from '../roles';
// Namespace import: one of the pins below is about what this module does NOT
// export, which a named import cannot express.
import * as c4Toolbar from '../toolbar/config';
import { C4_ELEMENT_MATRIX, C4_RELATIONSHIP_MATRIX, C4_RULES } from '../rules';

/**
 * The fourteen C4 rules, rule by rule — and above all what each of them stays
 * SILENT about. Silence is the expensive half: a rule that fires on a croquis is
 * a rule the workshop switches off, and a C4 diagram is drawn as a croquis for
 * most of its life.
 *
 * The fixtures are the `ddd-context-map` ones, one framework over: the engine
 * reads `id`, `role`, `text`, `elementBound` and an edge's `source`/`target`,
 * and nothing else, so a synthetic board is a handful of plain objects.
 */

const UNLABELED_RELATIONSHIP = 'c4.unlabeled-relationship';
const UNNAMED_PERSON = 'c4.unnamed-person';
const UNNAMED_SYSTEM = 'c4.unnamed-system';
const UNNAMED_CONTAINER = 'c4.unnamed-container';
const UNNAMED_COMPONENT = 'c4.unnamed-component';
const UNTYPED_LINK = 'c4.untyped-link';
const RELATIONSHIP_ENDPOINTS = 'c4.relationship-endpoints';
const RELATIONSHIP_SELF_LOOP = 'c4.relationship-self-loop';
const ISOLATED_SYSTEM = 'c4.isolated-system';
const ISOLATED_CONTAINER = 'c4.isolated-container';
const ISOLATED_COMPONENT = 'c4.isolated-component';
const DATABASE_INITIATES = 'c4.database-initiates';
const HOMELESS_COMPONENT = 'c4.homeless-component';
const PERSON_IN_BOUNDARY = 'c4.person-in-boundary';

interface Extra {
  source?: string;
  target?: string;
  text?: string;
  profile?: string;
}

function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  extra: Extra = {}
): GfxPrimitiveElementModel {
  return {
    id,
    role,
    ...(extra.source !== undefined && extra.target !== undefined
      ? { source: { id: extra.source }, target: { id: extra.target } }
      : {}),
    ...(extra.text !== undefined ? { text: extra.text } : {}),
    ...(extra.profile !== undefined
      ? { validationProfile: extra.profile }
      : {}),
    get elementBound() {
      return new Bound(...xywh);
    },
  } as unknown as GfxPrimitiveElementModel;
}

/** The board: 1400×900 at the origin, carrying its role and a title. */
const board = (profile?: string) =>
  element('bg', [0, 0, 1400, 900], C4_ROLE.board, {
    text: 'System context',
    ...(profile !== undefined ? { profile } : {}),
  });

/** A board authored before `c4:board` existed: same card, no role. */
const legacyBoard = () => element('bg', [0, 0, 1400, 900]);

/** A boundary — the dashed rectangle a container's parts are drawn inside. */
const boundary = (id: string, x = 200, y = 200, text = 'API Application') =>
  element(id, [x, y, 520, 360], C4_ROLE.boundary, { text });

const node =
  (role: string, w: number, h: number) =>
  (id: string, x = 100, y = 100, text = 'Named') =>
    element(id, [x, y, w, h], role, { text });

const person = node(C4_ROLE.person, 120, 140);
const system = node(C4_ROLE.system, 180, 120);
const container = node(C4_ROLE.container, 180, 120);
const database = node(C4_ROLE.database, 160, 120);
const component = node(C4_ROLE.component, 120, 80);

/** A typed relationship, labelled unless a test says otherwise. */
const rel = (id: string, source: string, target: string, text = 'Uses') =>
  element(id, [200, 150, 300, 1], C4_ROLE.relationship, {
    source,
    target,
    text,
  });

/** What quick-connect leaves behind: a connector carrying no role at all. */
const wire = (id: string, source: string, target: string) =>
  element(id, [200, 150, 300, 1], undefined, { source, target });

/** A neutral drawing — a note, a cloud, a rectangle somebody thought with. */
const sketch = (id: string, x = 100, y = 600) => element(id, [x, y, 180, 120]);

const evaluate = (elements: GfxPrimitiveElementModel[]) =>
  evaluateRules(C4_RULES, elements);

const checkup = (elements: GfxPrimitiveElementModel[]) =>
  evaluateCheckup(C4_RULES, elements);

const idsOf = (violations: readonly Violation[]) =>
  violations.map(violation => violation.ruleId).sort();

const only = (violations: readonly Violation[], ruleId: string) =>
  violations.filter(violation => violation.ruleId === ruleId);

/** Two systems and the relationship between them: a diagram with nothing wrong. */
const conformant = () => [
  board(),
  system('a'),
  system('b', 600),
  rel('r', 'a', 'b'),
];

describe('what the framework ships', () => {
  it('ships exactly the fourteen rules of the pack, in reading order', () => {
    expect(C4_RULES.map(rule => rule.id)).toEqual([
      UNLABELED_RELATIONSHIP,
      UNNAMED_PERSON,
      UNNAMED_SYSTEM,
      UNNAMED_CONTAINER,
      UNNAMED_COMPONENT,
      UNTYPED_LINK,
      RELATIONSHIP_ENDPOINTS,
      RELATIONSHIP_SELF_LOOP,
      ISOLATED_SYSTEM,
      ISOLATED_CONTAINER,
      ISOLATED_COMPONENT,
      DATABASE_INITIATES,
      HOMELESS_COMPONENT,
      PERSON_IN_BOUNDARY,
    ]);
  });

  it('namespaces every rule and holds no prose in the engine', () => {
    for (const rule of C4_RULES) {
      expect(rule.framework).toBe('c4');
      expect(rule.id.startsWith('c4.')).toBe(true);
      expect(rule.version).toBe(1);
      expect(rule.messageKey).toMatch(/^com\.labre\.c4\.validation\./);
      // A framework fallback, so a host with no catalogue reads a sentence
      // rather than a dotted key — the framework owns the word, not the engine.
      expect(rule.messageFallback, rule.id).toBeTruthy();
      expect(rule.suggestionKey, rule.id).toMatch(
        /^com\.labre\.c4\.validation\./
      );
      expect(rule.suggestionFallback, rule.id).toBeTruthy();
      expect(rule.roles, rule.id).toBeDefined();
    }
  });

  it('names a frame on every rule, so every finding can be waived somewhere', () => {
    // Twelve measure against the BOARD — attribution only, since none of them
    // reads a coordinate — and the two membership rules against the BOUNDARY,
    // which is the frame their question is actually about.
    const framedBy = (role: string) =>
      C4_RULES.filter(rule => rule.backgroundRole === role)
        .map(rule => rule.id)
        .sort();
    expect(framedBy(C4_ROLE.boundary)).toEqual([
      HOMELESS_COMPONENT,
      PERSON_IN_BOUNDARY,
    ]);
    expect(framedBy(C4_ROLE.board)).toHaveLength(12);
  });

  it('declares no level the pipework cannot honour, and starts every rule quiet', () => {
    // `blocking-overridable` is carried by the engine and acted on by nobody.
    // Every C4 rule is `audit` in its own declaration: the croquis primes, and
    // `c4.strict` is what promotes the checklist half — see `profiles.ts`.
    for (const rule of C4_RULES) {
      expect(rule.severity, rule.id).toBe('audit');
    }
  });

  it('keeps the naming checks off the drawing path', () => {
    // A box is created EMPTY and typed into a second later, so a real-time
    // naming rule would bracket every symbol the instant it appeared. `moment`
    // is a property of the rule, so the claim is provable rather than promised.
    const onDemand = C4_RULES.filter(rule => rule.moment === 'on-demand');
    expect(onDemand.map(rule => rule.id).sort()).toEqual(
      [
        UNLABELED_RELATIONSHIP,
        UNNAMED_PERSON,
        UNNAMED_SYSTEM,
        UNNAMED_CONTAINER,
        UNNAMED_COMPONENT,
      ].sort()
    );
    // Absent everywhere else, which is what `'realtime'` means: the default is
    // never restated, so nobody has to wonder whether an omission was a choice.
    for (const rule of C4_RULES) {
      if (onDemand.includes(rule)) continue;
      expect(rule.moment, rule.id).toBeUndefined();
    }
  });

  it('sanctions every pair of levels but person → person', () => {
    const sentences = C4_RELATIONSHIP_MATRIX.map(
      triplet => `${triplet.source} → ${triplet.target}`
    ).sort();
    // Four levels, sixteen ordered pairs, one removal.
    expect(sentences).toHaveLength(15);
    expect(sentences).not.toContain('c4:person → c4:person');
    expect(sentences).toContain('c4:person → c4:system');
    for (const triplet of C4_RELATIONSHIP_MATRIX) {
      expect(triplet.edge).toBe(C4_ROLE.relationship);
    }
    // The database is absent and covered: it IS a container, so `roleIsA`
    // reaches it from the container entries.
    expect(sentences.some(s => s.includes('c4:database'))).toBe(false);
  });

  it('keeps the ALPHABET and the grammar two tables', () => {
    // The alphabet sanctions all sixteen pairs. It has to: `flagNeutral` reads a
    // matrix only to learn which roles a role-less link may be presumed to join,
    // and a rule sharing the grammar would raise the off-matrix finding a second
    // time — two brackets and two suggestions for one gesture to fix.
    expect(C4_ELEMENT_MATRIX).toHaveLength(16);
    expect(C4_RELATIONSHIP_MATRIX).toHaveLength(15);
    const untyped = C4_RULES.find(rule => rule.id === UNTYPED_LINK);
    expect(untyped?.endpoints?.allowed).toBe(C4_ELEMENT_MATRIX);
    const grammar = C4_RULES.find(rule => rule.id === RELATIONSHIP_ENDPOINTS);
    expect(grammar?.endpoints?.allowed).toBe(C4_RELATIONSHIP_MATRIX);
  });

  it('says nothing at all about a conformant diagram', () => {
    expect(evaluate(conformant())).toEqual([]);
    expect(checkup(conformant())).toEqual([]);
  });

  it('says nothing about a diagram drawn before the roles existed', () => {
    // Every artefact role-less: never evaluated, never a word (PRD principle 8).
    expect(
      evaluate([
        legacyBoard(),
        element('a', [100, 100, 180, 120]),
        element('b', [600, 100, 180, 120]),
      ])
    ).toEqual([]);
  });
});

describe('C1 · a relationship nobody has labelled', () => {
  it('flags an unlabelled arrow, on demand', () => {
    const violations = checkup([
      board(),
      system('a'),
      system('b', 600),
      rel('r', 'a', 'b', ''),
    ]);
    expect(idsOf(violations)).toEqual([UNLABELED_RELATIONSHIP]);
    expect(violations[0].elementIds).toEqual(['r']);
    expect(violations[0].backgroundId).toBe('bg');
  });

  it('says nothing on the drawing path', () => {
    // The whole point of the moment: the arrow is drawn, then labelled.
    expect(
      evaluate([board(), system('a'), system('b', 600), rel('r', 'a', 'b', '')])
    ).toEqual([]);
  });

  it('counts whitespace as no label at all', () => {
    expect(
      idsOf(
        checkup([
          board(),
          system('a'),
          system('b', 600),
          rel('r', 'a', 'b', '  '),
        ])
      )
    ).toEqual([UNLABELED_RELATIONSHIP]);
  });

  it('says nothing about a connector carrying no role', () => {
    expect(
      checkup([board(), system('a'), system('b', 600), wire('w', 'a', 'b')])
    ).toEqual([]);
  });
});

describe('C2–C5 · an element nobody has named', () => {
  it('flags each level with its own sentence', () => {
    expect(idsOf(checkup([board(), person('p', 100, 100, '')]))).toEqual([
      UNNAMED_PERSON,
    ]);
    expect(idsOf(checkup([board(), system('s', 100, 100, '')]))).toEqual([
      UNNAMED_SYSTEM,
    ]);
    expect(idsOf(checkup([board(), container('c', 100, 100, '')]))).toEqual([
      UNNAMED_CONTAINER,
    ]);
    expect(idsOf(checkup([board(), component('k', 100, 100, '')]))).toEqual([
      UNNAMED_COMPONENT,
    ]);
  });

  it('catches an unnamed DATABASE with the container rule', () => {
    // The one specialisation the pack declares: a data store IS a container, so
    // `roleIsA` reaches it and there is no fifth naming rule to forget.
    const violations = checkup([board(), database('d', 100, 100, '')]);
    expect(idsOf(violations)).toEqual([UNNAMED_CONTAINER]);
    expect(violations[0].elementIds).toEqual(['d']);
  });

  it('says nothing about a named element', () => {
    expect(
      checkup([board(), person('p'), system('s', 600), component('k', 1000)])
    ).toEqual([]);
  });

  it('says nothing about the frames, whose words are the user’s own', () => {
    // A board and a boundary are not elements of the model, so a rule about
    // people, systems, containers and components falls on neither — an untitled
    // sheet is a sheet somebody has not titled yet.
    expect(checkup([board(''), boundary('bd', 200, 200, '')])).toEqual([]);
  });

  it('says nothing about a neutral drawing with no words', () => {
    expect(checkup([board(), sketch('note')])).toEqual([]);
  });
});

describe('C6 · a plain connector between two elements', () => {
  it('flags the link, and shows the verdicts that go quiet behind it', () => {
    const violations = evaluate([
      board(),
      system('a'),
      system('b', 600),
      wire('w', 'a', 'b'),
    ]);
    // The connector is reported ONCE — and both systems are simultaneously
    // reported isolated, which is exactly the damage the rule exists to name:
    // the diagram shows an arrow and the model holds none.
    expect(idsOf(violations)).toEqual([
      ISOLATED_SYSTEM,
      ISOLATED_SYSTEM,
      UNTYPED_LINK,
    ]);
    expect(only(violations, UNTYPED_LINK)[0].elementIds).toEqual([
      'a',
      'b',
      'w',
    ]);
  });

  it('says nothing about a plain connector onto a frame', () => {
    // The board and the boundary are outside the rule's alphabet: pointing at
    // things is what a whiteboard is for.
    expect(
      evaluate([
        ...conformant(),
        boundary('bd'),
        wire('w1', 'a', 'bd'),
        wire('w2', 'a', 'bg'),
      ])
    ).toEqual([]);
  });

  it('says nothing about a plain connector onto a neutral drawing', () => {
    expect(
      evaluate([...conformant(), sketch('note'), wire('w', 'a', 'note')])
    ).toEqual([]);
  });

  it('says nothing about a connector looping onto one element', () => {
    // A link from an artefact to itself is not evidence that a typed
    // relationship was meant.
    expect(evaluate([...conformant(), wire('w', 'a', 'a')])).toEqual([]);
  });
});

describe('C7 · what a relationship may run between', () => {
  it('flags an arrow drawn between two people', () => {
    const violations = evaluate([
      board(),
      person('p1'),
      person('p2', 600),
      rel('r', 'p1', 'p2'),
    ]);
    // ONCE, and this is the assertion that forced the alphabet and the grammar
    // apart: C6 declares a matrix too, and while it shared this one it reported
    // the same arrow a second time.
    expect(idsOf(violations)).toEqual([RELATIONSHIP_ENDPOINTS]);
    expect(violations[0].elementIds).toEqual(['p1', 'p2', 'r']);
  });

  it('says nothing about a person using a system', () => {
    expect(
      evaluate([board(), person('p'), system('s', 600), rel('r', 'p', 's')])
    ).toEqual([]);
  });

  it('says nothing about a container reading from a database', () => {
    // `c4:database` is a `c4:container`, so the container → container sentence
    // covers it without a triplet of its own.
    expect(
      evaluate([
        board(),
        container('c'),
        database('d', 600),
        rel('r', 'c', 'd'),
      ])
    ).toEqual([]);
  });

  it('says nothing about the same relationship drawn twice', () => {
    // Two arrows the same way round is how C4 says a thing is used for two
    // different reasons — "Reads from" and "Writes to", each with its own label.
    expect(
      evaluate([...conformant(), rel('r2', 'a', 'b', 'Writes to')])
    ).toEqual([]);
  });

  it('says nothing about a relationship with an end on a frame', () => {
    expect(
      evaluate([...conformant(), boundary('bd'), rel('r2', 'a', 'bd')])
    ).toEqual([]);
  });

  it('says nothing about a relationship with a free end', () => {
    expect(evaluate([...conformant(), rel('r2', 'a', 'gone')])).toEqual([]);
  });

  it('says nothing about a self-loop — that is C8 now', () => {
    // C7 declares no `forbidSelfLoop` after the split, and the family
    // `continue`s on a self-loop before reaching any matrix, so this rule has
    // nothing to say about one.
    expect(
      only(
        evaluate([board(), system('a'), rel('r', 'a', 'a')]),
        RELATIONSHIP_ENDPOINTS
      )
    ).toEqual([]);
  });
});

describe('C8 · a relationship that loops onto its own element', () => {
  it('flags the loop, and only the loop', () => {
    const violations = evaluate([board(), system('a'), rel('r', 'a', 'a')]);
    expect(idsOf(violations)).toEqual([RELATIONSHIP_SELF_LOOP]);
    expect(violations[0].elementIds).toEqual(['a', 'r']);
    // No `selfLoop` block on the split rule: with the matrix unreachable, the
    // rule's OWN message is the self-loop message and the family falls back to
    // it.
    expect(violations[0].messageKey).toBe(
      'com.labre.c4.validation.relationship-self-loop'
    );
  });

  /**
   * THE interaction a reviewer will ask about, pinned to what the engine
   * actually does rather than to what reads plausibly.
   *
   * A person looped onto themselves is simultaneously a self-loop AND the one
   * sentence off C7's matrix (person → person). It raises C8 **alone**:
   * `evaluateRelationEndpoints` tests `sourceId === targetId` first and then
   * `continue`s — the `continue` sits OUTSIDE the `forbidSelfLoop` guard — so a
   * self-loop never reaches `inMatrix` for any rule, whatever its matrix says.
   *
   * That is the right answer as well as the actual one: the mistake the author
   * made is the loop, and also telling them a person may not use a person would
   * be answering a question they did not ask.
   */
  it('raises ONLY the loop when the loop is also off C7’s matrix', () => {
    const violations = evaluate([board(), person('p'), rel('r', 'p', 'p')]);
    expect(idsOf(violations)).toEqual([RELATIONSHIP_SELF_LOOP]);
  });

  it('says nothing about a loop on something outside the alphabet', () => {
    // The alphabet GATE runs before the self-loop test, so a relationship
    // looped onto a frame or a sticky note is silence — as it was before the
    // split, and for the same reason.
    expect(
      evaluate([...conformant(), boundary('bd'), rel('r2', 'bd', 'bd')])
    ).toEqual([]);
    expect(
      evaluate([...conformant(), sketch('note'), rel('r2', 'note', 'note')])
    ).toEqual([]);
  });

  it('says nothing about an ordinary relationship between two elements', () => {
    expect(only(evaluate(conformant()), RELATIONSHIP_SELF_LOOP)).toEqual([]);
  });

  it('takes the ALPHABET, never C7’s grammar', () => {
    const byId = new Map(C4_RULES.map(rule => [rule.id, rule]));
    const grammar = byId.get(RELATIONSHIP_ENDPOINTS);
    const loop = byId.get(RELATIONSHIP_SELF_LOOP);
    // The trap this suite caught twice. BPMN's split rule safely carries its
    // sibling's matrix because BPMN's sanctions everything in its own alphabet;
    // C4's has a genuine removal, so a second rule carrying it reports
    // person → person again on every NON-loop relationship. Exactly one rule in
    // this pack may hold the grammar.
    expect(grammar?.endpoints?.allowed).toBe(C4_RELATIONSHIP_MATRIX);
    expect(loop?.endpoints?.allowed).toBe(C4_ELEMENT_MATRIX);
    const holders = C4_RULES.filter(
      rule => rule.endpoints?.allowed === C4_RELATIONSHIP_MATRIX
    );
    expect(holders.map(rule => rule.id)).toEqual([RELATIONSHIP_ENDPOINTS]);
    // One flag each: exactly one of the two can indict a given edge.
    expect(grammar?.endpoints?.forbidSelfLoop).toBeUndefined();
    expect(loop?.endpoints?.forbidSelfLoop).toBe(true);
    // ...and the loop rule carries no `selfLoop` override, so its own words are
    // the ones the user reads.
    expect(loop?.endpoints?.selfLoop).toBeUndefined();
  });
});

describe('C9–C11 · an element nothing connects', () => {
  it('flags a lone system, container and component', () => {
    expect(idsOf(evaluate([board(), system('a')]))).toEqual([ISOLATED_SYSTEM]);
    expect(idsOf(evaluate([board(), container('c')]))).toEqual([
      ISOLATED_CONTAINER,
    ]);
    expect(idsOf(evaluate([board(), component('k')]))).toEqual([
      ISOLATED_COMPONENT,
    ]);
  });

  it('catches a lone DATABASE with the container rule', () => {
    expect(idsOf(evaluate([board(), database('d')]))).toEqual([
      ISOLATED_CONTAINER,
    ]);
  });

  it('says nothing about a PERSON nobody has connected yet', () => {
    // Dropping the actors first and connecting them last is how a context
    // diagram gets drawn: there is no isolation rule on `c4:person`.
    expect(evaluate([board(), person('p')])).toEqual([]);
  });

  it('is satisfied by ONE relationship on EITHER side', () => {
    // The disjunctive floor, and the whole reason the rule needs one: a system
    // at the top of a diagram is used by nobody, and one at the bottom uses
    // nobody. Both are conformant.
    expect(
      evaluate([board(), system('a'), system('b', 600), rel('r', 'a', 'b')])
    ).toEqual([]);
  });

  it('says nothing when only a plain shape is unconnected', () => {
    expect(evaluate([...conformant(), sketch('note')])).toEqual([]);
  });
});

describe('C12 · a data store that calls somebody', () => {
  it('flags a relationship leaving a database', () => {
    const violations = evaluate([
      board(),
      database('d'),
      system('a', 600),
      rel('r', 'd', 'a', 'Pushes to'),
    ]);
    expect(idsOf(violations)).toEqual([DATABASE_INITIATES]);
    expect(violations[0].elementIds).toEqual(['d']);
  });

  it('says nothing about a container writing to a database', () => {
    expect(
      evaluate([
        board(),
        container('c'),
        database('d', 600),
        rel('r', 'c', 'd'),
      ])
    ).toEqual([]);
  });

  it('says nothing about an ordinary container that calls out', () => {
    // Written on `c4:database` and on nothing else: on `c4:container` it would
    // indict every application on the board.
    expect(
      evaluate([board(), container('c'), system('s', 600), rel('r', 'c', 's')])
    ).toEqual([]);
  });
});

describe('C13 · a component belongs inside a boundary', () => {
  it('flags a component drawn outside every boundary', () => {
    const violations = evaluate([
      board(),
      boundary('bd'),
      component('k', 900, 600),
    ]);
    expect(idsOf(violations)).toEqual([HOMELESS_COMPONENT, ISOLATED_COMPONENT]);
    const homeless = only(violations, HOMELESS_COMPONENT)[0];
    expect(homeless.elementIds).toEqual(['k']);
    // Attributed to the BOUNDARY, which is the frame the question is about —
    // and therefore where the level of requirement is chosen.
    expect(homeless.backgroundId).toBe('bd');
  });

  it('says nothing about a component inside one', () => {
    expect(
      idsOf(evaluate([board(), boundary('bd'), component('k', 300, 300)]))
    ).toEqual([ISOLATED_COMPONENT]);
  });

  it('says nothing when the board carries no boundary at all', () => {
    // A component diagram sketched before anybody drew the container frame is a
    // sketch — and so is one drawn before the role existed.
    expect(idsOf(evaluate([board(), component('k', 900, 600)]))).toEqual([
      ISOLATED_COMPONENT,
    ]);
  });

  it('says nothing about the other levels drawn outside a boundary', () => {
    expect(
      evaluate([
        ...conformant(),
        boundary('bd'),
        rel('r2', 'b', 'a', 'Answers'),
      ])
    ).toEqual([]);
  });
});

describe('C14 · a person is never inside the system', () => {
  it('flags a person drawn inside a boundary', () => {
    const violations = evaluate([
      board(),
      boundary('bd'),
      person('p', 300, 300),
    ]);
    expect(idsOf(violations)).toEqual([PERSON_IN_BOUNDARY]);
    expect(violations[0].elementIds).toEqual(['p']);
    expect(violations[0].backgroundId).toBe('bd');
  });

  it('says nothing about a person beside the boundary', () => {
    expect(evaluate([board(), boundary('bd'), person('p', 900, 600)])).toEqual(
      []
    );
  });

  it('says nothing about a person straddling the dashed line', () => {
    // `element-in-zone` judges a subject against the frame that CONTAINS it, so
    // half in and half out is left alone: only a person the author has put
    // wholly inside the system is a person inside the system.
    expect(evaluate([board(), boundary('bd'), person('p', 150, 150)])).toEqual(
      []
    );
  });

  it('says nothing when the board carries no boundary', () => {
    expect(evaluate([board(), person('p', 300, 300)])).toEqual([]);
  });
});

describe('the profile the finding is judged at', () => {
  const strictBoard = () => [
    board('c4.strict'),
    system('a'),
    system('b', 600),
    wire('w', 'a', 'b'),
  ];

  it('keeps everything an audit on the default profile', () => {
    const violations = evaluateRules(
      C4_RULES,
      conformant().concat(wire('w', 'a', 'b')),
      C4_PROFILES
    );
    expect(violations.length).toBeGreaterThan(0);
    for (const violation of violations) {
      expect(violation.severity, violation.ruleId).toBe('audit');
    }
  });

  it('promotes the checklist rules on the board set to strict', () => {
    const violations = evaluateRules(C4_RULES, strictBoard(), C4_PROFILES);
    expect(only(violations, UNTYPED_LINK)[0].severity).toBe('warning');
    // ...and leaves the style rules where they were, at the very level where
    // the user asked for more.
    for (const violation of only(violations, ISOLATED_SYSTEM)) {
      expect(violation.severity).toBe('audit');
    }
  });

  it('judges a boundary-anchored finding by the BOUNDARY’s profile', () => {
    // The mechanism, pinned at the grain this branch can actually test: a
    // finding is judged by the profile of the frame it is ATTRIBUTED to, and the
    // two membership rules are attributed to the boundary.
    //
    // The boundary carries no picker — the board alone arbitrates the checklist
    // (PO, 28/08/2026) — so in the editor that profile arrives by INHERITANCE
    // from the containing board (`inheritChosenProfiles`, added on
    // `claude/c4-recette-wave2`). That engine change is not on this branch, so
    // the profile is written directly here; the two meet at the merge, and the
    // integration check to have then is: board on Review checklist ⇒ a homeless
    // component reports `warning`.
    const strictBoundary = element(
      'bd',
      [200, 200, 520, 360],
      C4_ROLE.boundary,
      { text: 'API', profile: 'c4.strict' }
    );
    const violations = evaluateRules(
      C4_RULES,
      [board(), strictBoundary, component('k', 900, 600)],
      C4_PROFILES
    );
    expect(only(violations, HOMELESS_COMPONENT)[0].severity).toBe('warning');
    // The isolation finding was measured against the BOARD, which nobody moved.
    expect(only(violations, ISOLATED_COMPONENT)[0].severity).toBe('audit');
  });
});

describe('where the level of requirement can be chosen', () => {
  /**
   * `renderToolbar` merges exactly four slots per element — `<flavour>`,
   * `custom:<flavour>` and the two `affine:surface:*` wildcards — and
   * `ToolbarModuleExtension` binds by DI VARIANT, so two modules claiming one
   * `custom:` flavour throw `DuplicateServiceDefinitionError` before the editor
   * finishes setting up.
   *
   * C4 has three things to put on a selected board and two slots, so the legend
   * button and the Validation dropdown share the flag-gated module. This spec is
   * what stops a later slice quietly claiming the same variant a third time and
   * taking the whole edgeless scope down with it.
   */
  it('claims each toolbar flavour exactly once', () => {
    const claims = [
      c4Toolbar.c4BoardToolbarExtension,
      c4Toolbar.c4BoardToolingToolbarExtension,
    ].map(extension => {
      let variant = '';
      const di = {
        addImpl: (identifier: { variant: string }) => {
          variant = identifier.variant;
        },
      };
      (extension as { setup: (di: unknown) => void }).setup(di);
      return variant;
    });
    expect(claims).toEqual([
      'affine:surface:c4Board',
      'custom:affine:surface:c4Board',
    ]);
    expect(new Set(claims).size).toBe(claims.length);
  });

  it('puts the legend and the dropdown on one row, in reading order', () => {
    // `b.` after the always-on `a.toggle-resize`, `z.` last: the user sees
    // resize, legend, then the level, whatever order the modules registered in.
    expect(
      c4Toolbar.c4BoardToolingToolbarConfig.actions.map(action => action.id)
    ).toEqual(['b.legend', 'z.validation']);
  });

  it('gives the BOUNDARY no toolbar module at all', () => {
    // The board alone arbitrates the checklist (PO, 28/08/2026): one diagram,
    // one level of requirement, one place to set it. A second picker on a frame
    // drawn INSIDE the first is a way to make a board disagree with itself.
    //
    // The two boundary-anchored rules — `c4.homeless-component` and
    // `c4.person-in-boundary` — still follow that choice: their findings are
    // attributed to the boundary, and a boundary naming no profile inherits the
    // innermost containing frame's (`inheritChosenProfiles`, in the engine). So
    // this is an arbitration carried by the engine, not a picker we forgot.
    expect(
      Object.keys(c4Toolbar).filter(name => name.includes('Boundary'))
    ).toEqual([]);
  });
});
