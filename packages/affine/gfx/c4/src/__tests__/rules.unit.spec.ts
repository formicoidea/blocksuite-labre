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
const UNNAMED_ELEMENT = 'c4.unnamed-element';
const UNTYPED_LINK = 'c4.untyped-link';
const RELATIONSHIP_ENDPOINTS = 'c4.relationship-endpoints';
const RELATIONSHIP_SELF_LOOP = 'c4.relationship-self-loop';
const ISOLATED_SYSTEM = 'c4.isolated-system';
const ISOLATED_CONTAINER = 'c4.isolated-container';
const ISOLATED_COMPONENT = 'c4.isolated-component';
const DATABASE_INITIATES = 'c4.database-initiates';
const HOMELESS_COMPONENT = 'c4.homeless-component';
const PERSON_IN_BOUNDARY = 'c4.person-in-boundary';
const SYSTEM_IN_BOUNDARY = 'c4.system-in-boundary';
const CONTAINER_IN_CONTAINER_BOUNDARY = 'c4.container-in-container-boundary';
const COMPONENT_LEVEL_SKIP = 'c4.component-level-skip';

/** The three rules the zoom slice added, as a set to filter findings by. */
const ZOOM_RULES = [
  SYSTEM_IN_BOUNDARY,
  CONTAINER_IN_CONTAINER_BOUNDARY,
  COMPONENT_LEVEL_SKIP,
];

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

/**
 * A boundary drawn BEFORE the role split: the dashed rectangle, carrying the
 * parent role and saying nothing about which level it is at.
 *
 * Every boundary in every document written before this slice looks like this,
 * which is why it stays the default fixture: the rules that were written on the
 * parent role must go on reading it exactly as they did, and the rules written
 * on a child must not reach it at all.
 */
const boundary = (id: string, x = 200, y = 200, text = 'API Application') =>
  element(id, [x, y, 520, 360], C4_ROLE.boundary, { text });

/** A boundary drawn today, at the system level. */
const systemBoundary = (
  id: string,
  x = 200,
  y = 200,
  text = 'Internet Banking System'
) => element(id, [x, y, 520, 360], C4_ROLE['system-boundary'], { text });

/** A boundary drawn today, at the container level. */
const containerBoundary = (
  id: string,
  x = 200,
  y = 200,
  text = 'API Application'
) => element(id, [x, y, 520, 360], C4_ROLE['container-boundary'], { text });

/**
 * A C4 artefact: the SHAPE, carrying the role and — deliberately — no text at
 * all. Since the component became a group the shape is a body and nothing else;
 * its name is the `c4:title` child beside it ({@link title}). A fixture that
 * still wrote words here would be modelling a document this editor cannot
 * produce, and would quietly excuse a rule that read the wrong place.
 */
const node =
  (role: string, w: number, h: number) =>
  (id: string, x = 100, y = 100) =>
    element(id, [x, y, w, h], role);

const person = node(C4_ROLE.person, 120, 140);
const system = node(C4_ROLE.system, 180, 120);
const container = node(C4_ROLE.container, 180, 120);
const database = node(C4_ROLE.database, 160, 120);
const component = node(C4_ROLE.component, 120, 80);

/**
 * The `c4:title` text child — where a C4 element's name actually lives.
 *
 * Defaults to the kind's own label, because that is what `actions.ts` seeds at
 * creation (`NODE_LABEL[kind]`): a fresh node is NOT nameless, it is prompted.
 */
const title = (id: string, text = 'Person', x = 100, y = 240) =>
  element(id, [x, y, 160, 24], C4_ROLE.title, { text });

/** The other two tiers, for the pin that says a rule about names ignores them. */
const typeLine = (id: string, text = '[Container]', x = 100, y = 268) =>
  element(id, [x, y, 160, 20], C4_ROLE['type-line'], { text });

const description = (id: string, text = 'Does a thing.', x = 100, y = 290) =>
  element(id, [x, y, 160, 40], C4_ROLE.description, { text });

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
      UNNAMED_ELEMENT,
      UNTYPED_LINK,
      RELATIONSHIP_ENDPOINTS,
      RELATIONSHIP_SELF_LOOP,
      ISOLATED_SYSTEM,
      ISOLATED_CONTAINER,
      ISOLATED_COMPONENT,
      DATABASE_INITIATES,
      HOMELESS_COMPONENT,
      PERSON_IN_BOUNDARY,
      SYSTEM_IN_BOUNDARY,
      CONTAINER_IN_CONTAINER_BOUNDARY,
      COMPONENT_LEVEL_SKIP,
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
    // Nine measure against the BOARD — attribution only, since none of them
    // reads a coordinate — and the five membership and zoom rules against a
    // BOUNDARY, which is the frame their question is actually about.
    const framedBy = (role: string) =>
      C4_RULES.filter(rule => rule.backgroundRole === role)
        .map(rule => rule.id)
        .sort();
    // On the PARENT role: the three whose question is about a boundary at ANY
    // level, and which therefore keep reading a boundary drawn before the split.
    expect(framedBy(C4_ROLE.boundary)).toEqual(
      [HOMELESS_COMPONENT, PERSON_IN_BOUNDARY, SYSTEM_IN_BOUNDARY].sort()
    );
    // On the CHILD: the two whose question only means something once the frame
    // has said which level it is at.
    expect(framedBy(C4_ROLE['container-boundary'])).toEqual(
      [CONTAINER_IN_CONTAINER_BOUNDARY, COMPONENT_LEVEL_SKIP].sort()
    );
    // Nothing is framed on the system boundary alone: a component nested in a
    // container boundary is inside the system boundary too, so a rule written
    // that way would indict the conformant drawing — see `componentLevelSkip`.
    expect(framedBy(C4_ROLE['system-boundary'])).toEqual([]);
    expect(framedBy(C4_ROLE.board)).toHaveLength(9);
    for (const rule of C4_RULES)
      expect(rule.backgroundRole, rule.id).toBeDefined();
  });

  it('declares no level the pipework cannot honour, and starts every rule quiet', () => {
    // `blocking-overridable` is carried by the engine and acted on by nobody.
    // Every C4 rule is `audit` in its own declaration: the croquis primes, and
    // `c4.strict` is what promotes the checklist half — see `profiles.ts`.
    for (const rule of C4_RULES) {
      expect(rule.severity, rule.id).toBe('audit');
    }
  });

  /**
   * Provenance, as a TOTALITY test rather than a spot check — BPMN's pattern,
   * for BPMN's reason.
   *
   * The field is optional on the engine's side, but a C4 rule arriving without
   * one is the bug the field exists to prevent: an architecture review asked
   * that a Labre convention never present itself as a norm violation, and a
   * rule with no declared provenance shows no line at all, which is exactly the
   * state that review found.
   */
  it('declares where every rule gets its authority', () => {
    for (const rule of C4_RULES) {
      expect(rule.provenance, rule.id).toBeDefined();
      expect(rule.provenance!.reference, rule.id).toBeTruthy();
    }
  });

  it('claims no STANDARD, because C4 has no specification to cite', () => {
    // The distinguishing fact about this pack. BPMN cites clauses of ISO/IEC
    // 19510; C4 has a review checklist its author publishes, which is a
    // recommendation however widely it is followed. A rule here claiming
    // `standard` would be inventing an authority that does not exist.
    for (const rule of C4_RULES) {
      expect(rule.provenance!.source, rule.id).not.toBe('standard');
      // `organization` is reserved for the org profiles the PRD names, and no
      // framework declares one yet. Pinned so the day one does is a decision.
      expect(rule.provenance!.source, rule.id).not.toBe('organization');
      expect(['recommendation', 'labre-convention'], rule.id).toContain(
        rule.provenance!.source
      );
    }
  });

  it('names the method it recommends, and owns every convention', () => {
    const byProvenance = (source: string) =>
      C4_RULES.filter(rule => rule.provenance?.source === source)
        .map(rule => rule.id)
        .sort();

    // The five that are OURS, and exactly those. Each says so in the citation
    // itself, so a reader of the bubble is never told C4 forbids what C4 does
    // not.
    expect(byProvenance('labre-convention')).toEqual(
      [
        UNTYPED_LINK,
        RELATIONSHIP_SELF_LOOP,
        DATABASE_INITIATES,
        HOMELESS_COMPONENT,
        PERSON_IN_BOUNDARY,
      ].sort()
    );
    for (const rule of C4_RULES) {
      const { source, reference } = rule.provenance!;
      if (source === 'labre-convention') {
        expect(reference, rule.id).toMatch(/Labre/);
      } else {
        // A recommendation names the METHOD, so the user can weigh it. Every
        // one of C4's names C4 — there is no linter to cite here, the way
        // bpmnlint is cited one framework over.
        expect(reference, rule.id).toMatch(/C4 model/);
      }
    }
    expect(byProvenance('recommendation')).toHaveLength(9);
  });

  /**
   * The three zoom rules cite the ABSTRACTIONS, not the review checklist, and
   * they cite the same words.
   *
   * The distinction is the whole reason they are `recommendation` rather than
   * `labre-convention`: the checklist never asks whether a boundary holds the
   * right level, because C4 settles it one layer up, in what the model IS. A
   * reader who opens the bubble has to be able to weigh that for themselves.
   */
  it('cites C4’s own abstractions for the three zoom rules', () => {
    const zoom = C4_RULES.filter(rule => ZOOM_RULES.includes(rule.id));
    expect(zoom).toHaveLength(3);
    const references = new Set(zoom.map(rule => rule.provenance!.reference));
    // ONE citation, read three ways — the same call the three isolation rules
    // make with the checklist.
    expect(references.size).toBe(1);
    for (const rule of zoom) {
      expect(rule.provenance!.source, rule.id).toBe('recommendation');
      expect(rule.provenance!.reference, rule.id).toMatch(/abstractions/);
    }
  });

  it('keeps provenance PURELY descriptive', () => {
    // No evaluator reads it, so a rule with the field and the same rule without
    // it must reach the same verdict. The engine ships its own pin of this;
    // this one is C4's, on C4's own board, because a framework that annotated
    // its way into a behaviour change would not find out from another package's
    // test.
    const stripped = C4_RULES.map(rule => {
      const { provenance: _dropped, ...rest } = rule;
      return rest;
    });
    const board_ = [
      board(),
      person('p'),
      title('t', ''),
      system('a', 600),
      rel('r', 'p', 'a', ''),
    ];
    expect(evaluateRules(stripped, board_)).toEqual(
      evaluateRules(C4_RULES, board_)
    );
    expect(evaluateCheckup(stripped, board_)).toEqual(
      evaluateCheckup(C4_RULES, board_)
    );
    // ...and the check-up half actually found something, so the comparison is
    // not two empty arrays agreeing.
    expect(evaluateCheckup(C4_RULES, board_).length).toBeGreaterThan(0);
  });

  it('keeps the naming checks off the drawing path', () => {
    // Naming is what a user does by TYPING, so a real-time rule of this family
    // would re-evaluate on every keystroke in every title on the board.
    // `moment` is a property of the rule, so the claim is provable rather than
    // promised.
    const onDemand = C4_RULES.filter(rule => rule.moment === 'on-demand');
    expect(onDemand.map(rule => rule.id).sort()).toEqual(
      [UNLABELED_RELATIONSHIP, UNNAMED_ELEMENT].sort()
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

describe('C2 · an element nobody has named', () => {
  it('flags an EMPTIED title, whatever level it belongs to', () => {
    // One rule, one sentence, every artefact: the name is a `c4:title` text and
    // the shape carries none, so there is nothing per-level left to say.
    const violations = checkup([board(), person('p'), title('t', '')]);
    expect(idsOf(violations)).toEqual([UNNAMED_ELEMENT]);
    // The finding lands on the TITLE — that is the element the author edits.
    expect(violations[0].elementIds).toEqual(['t']);
  });

  it('says nothing about a freshly dropped node, which is PROMPTED not nameless', () => {
    // The trap this rule had to be written around. `actions.ts` seeds the
    // kind's own label into the title at creation, so a box reading "Person" is
    // a box whose author has not finished — not a box with no name. Four rules
    // ago this fired on every element the instant it appeared.
    expect(checkup([board(), person('p'), title('t', 'Person')])).toEqual([]);
    expect(checkup([board(), container('c'), title('t', 'Web app')])).toEqual(
      []
    );
  });

  it('counts whitespace as no name at all', () => {
    expect(idsOf(checkup([board(), system('s'), title('t', '   ')]))).toEqual([
      UNNAMED_ELEMENT,
    ]);
  });

  /**
   * The KNOWN LIMIT, pinned so it stays a decision rather than a surprise.
   *
   * `label-presence` evaluates the elements that exist. Delete the title
   * outright — rather than emptying it — and there is no `c4:title` on the board
   * for the rule to be about, so a genuinely nameless component goes unreported.
   *
   * Closing it means asking "does this SHAPE have a title among its group's
   * children?", which is a question about group membership rather than about a
   * label's presence, and no family expresses it today. See the rule's own
   * comment; `c4ComponentSiblings` is where the answer would come from.
   */
  it('says nothing when the title element is DELETED rather than emptied', () => {
    expect(checkup([board(), person('p')])).toEqual([]);
  });

  it('ignores the other two tiers, which are not names', () => {
    // An empty type line or description is a subtitle nobody filled in, and
    // this rule is written on `c4:title` alone.
    expect(
      checkup([
        board(),
        component('k'),
        title('t', 'Sign In Controller'),
        typeLine('tl', ''),
        description('d', ''),
      ])
    ).toEqual([]);
  });

  it('says nothing about the frames, whose words are the user’s own', () => {
    // A board and a boundary are not elements of the model and carry no title
    // child — an untitled sheet is a sheet somebody has not titled yet.
    expect(checkup([board(''), boundary('bd', 200, 200, '')])).toEqual([]);
  });

  it('says nothing about a neutral drawing with no words', () => {
    expect(checkup([board(), sketch('note')])).toEqual([]);
  });
});

describe('C3 · a plain connector between two elements', () => {
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

describe('C4 · what a relationship may run between', () => {
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

describe('C5 · a relationship that loops onto its own element', () => {
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

describe('C6–C8 · an element nothing connects', () => {
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

describe('C9 · a data store that calls somebody', () => {
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

describe('C10 · a component belongs inside a boundary', () => {
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

describe('C11 · a person is never inside the system', () => {
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

  it('still reads a boundary drawn at either level', () => {
    // Framed on the PARENT role, so the split cost it nothing: a person inside
    // a boundary is a person inside a boundary, whichever zoom it is at.
    for (const frame of [
      systemBoundary('bd'),
      containerBoundary('bd'),
      boundary('bd'),
    ]) {
      expect(
        only(
          evaluate([board(), frame, person('p', 300, 300)]),
          PERSON_IN_BOUNDARY
        ),
        String(frame.role)
      ).toHaveLength(1);
    }
  });
});

/* ── The zoom rules ───────────────────────────────────────────────────── */

/**
 * The CONFORMANT nesting, and the fixture the three zoom rules are really
 * written against: a container boundary drawn inside a system boundary, the
 * system's containers in the outer frame, the container's components in the
 * inner one, and the actors outside both.
 *
 * It is the shape of the composed board the export spec uses (`board-stub.ts`),
 * and it is the case that breaks the obvious implementation: a component nested
 * in a container boundary is geometrically inside the system boundary TOO, so a
 * level-skip rule written as "a component is never inside a system boundary"
 * would indict every component on this perfectly correct diagram. Every
 * assertion below that says "silent" is guarding that.
 *
 * Geometry: system boundary x 100…900 / y 100…700; container boundary
 * x 160…600 / y 340…640, wholly inside it.
 */
const zoomed = () => [
  board(),
  element('bd-sys', [100, 100, 800, 600], C4_ROLE['system-boundary'], {
    text: 'Internet Banking System',
  }),
  element('bd-cnt', [160, 340, 440, 300], C4_ROLE['container-boundary'], {
    text: 'API Application',
  }),
  // The containers of the system: inside the system boundary, outside the
  // container one.
  container('c-web', 620, 180),
  database('d-store', 620, 380),
  // The components of that container, inside it.
  component('k-signin', 200, 380),
  component('k-security', 380, 380),
  // The actor and the system the sheet is about, outside every frame.
  person('p', 1000, 200),
  system('s', 1000, 500),
];

describe('C12 · a software system is never inside a boundary', () => {
  it('flags a system drawn inside a system boundary', () => {
    const violations = evaluate([
      board(),
      systemBoundary('bd'),
      system('s', 300, 300),
    ]);
    expect(idsOf(violations)).toEqual([ISOLATED_SYSTEM, SYSTEM_IN_BOUNDARY]);
    const zoom = only(violations, SYSTEM_IN_BOUNDARY)[0];
    expect(zoom.elementIds).toEqual(['s']);
    // Attributed to the frame the question is about, which is where the level
    // of requirement is inherited from.
    expect(zoom.backgroundId).toBe('bd');
  });

  it('flags it inside a CONTAINER boundary, and inside a pre-split one', () => {
    // Framed on the parent role: the boundary already IS a system or a
    // container, so a system inside one is wrong at every level — including on
    // a boundary that never said which level it was at.
    for (const frame of [containerBoundary('bd'), boundary('bd')]) {
      expect(
        only(
          evaluate([board(), frame, system('s', 300, 300)]),
          SYSTEM_IN_BOUNDARY
        ),
        String(frame.role)
      ).toHaveLength(1);
    }
  });

  it('says nothing about a system drawn beside the boundary', () => {
    expect(
      only(
        evaluate([board(), systemBoundary('bd'), system('s', 900, 620)]),
        SYSTEM_IN_BOUNDARY
      )
    ).toEqual([]);
  });

  it('says nothing about a system straddling the dashed line', () => {
    // `element-in-zone` judges a subject against the frame that CONTAINS it, so
    // half in is left alone — the same silence C11 documents.
    expect(
      only(
        evaluate([board(), systemBoundary('bd'), system('s', 150, 150)]),
        SYSTEM_IN_BOUNDARY
      )
    ).toEqual([]);
  });

  it('says nothing about the CONTAINERS inside a system boundary', () => {
    // What a container diagram IS. Written on `c4:system` and on nothing else.
    expect(
      evaluate([
        board(),
        systemBoundary('bd'),
        container('c', 300, 300),
        database('d', 460, 300),
        rel('r', 'c', 'd'),
      ])
    ).toEqual([]);
  });
});

describe('C13 · a container is never inside a container boundary', () => {
  it('flags the zoom paradox — the boundary is that container', () => {
    const violations = evaluate([
      board(),
      containerBoundary('bd'),
      container('c', 300, 300),
    ]);
    expect(idsOf(violations)).toEqual([
      CONTAINER_IN_CONTAINER_BOUNDARY,
      ISOLATED_CONTAINER,
    ]);
    const zoom = only(violations, CONTAINER_IN_CONTAINER_BOUNDARY)[0];
    expect(zoom.elementIds).toEqual(['c']);
    expect(zoom.backgroundId).toBe('bd');
  });

  it('catches the database, the mobile app and the SPA with it', () => {
    // `c4:database` specialises `c4:container` and the two pictures carry
    // `c4:container` outright, so the rule reaches all of them for free.
    expect(
      only(
        evaluate([board(), containerBoundary('bd'), database('d', 300, 300)]),
        CONTAINER_IN_CONTAINER_BOUNDARY
      )
    ).toHaveLength(1);
  });

  it('says nothing about a container inside a SYSTEM boundary', () => {
    // The single most ordinary drawing in C4, and the reason this rule is
    // framed on the child role rather than the parent.
    expect(
      only(
        evaluate([board(), systemBoundary('bd'), container('c', 300, 300)]),
        CONTAINER_IN_CONTAINER_BOUNDARY
      )
    ).toEqual([]);
  });

  it('says nothing about a container inside a PRE-SPLIT boundary', () => {
    // A boundary drawn before the split never said which level it was at, and
    // guessing would mean indicting a container on the strength of a field this
    // rule cannot see.
    expect(
      only(
        evaluate([board(), boundary('bd'), container('c', 300, 300)]),
        CONTAINER_IN_CONTAINER_BOUNDARY
      )
    ).toEqual([]);
  });

  it('says nothing about the COMPONENTS inside a container boundary', () => {
    // What a component diagram IS.
    expect(
      evaluate([
        board(),
        containerBoundary('bd'),
        component('k1', 300, 300),
        component('k2', 460, 300),
        rel('r', 'k1', 'k2'),
      ])
    ).toEqual([]);
  });
});

describe('C14 · a component whose container nobody drew', () => {
  it('flags a component framed by a system boundary alone', () => {
    // The level skip: the sheet jumps from the system to its components, and
    // the reader cannot say which container this one is in. The board draws a
    // container boundary elsewhere — this component simply is not in it.
    const violations = evaluate([
      board(),
      element('bd-sys', [100, 100, 800, 600], C4_ROLE['system-boundary'], {
        text: 'Internet Banking System',
      }),
      containerBoundary('bd-cnt', 160, 340),
      component('k', 660, 180),
    ]);
    expect(idsOf(violations)).toEqual([
      COMPONENT_LEVEL_SKIP,
      ISOLATED_COMPONENT,
    ]);
    const skip = only(violations, COMPONENT_LEVEL_SKIP)[0];
    expect(skip.elementIds).toEqual(['k']);
    // Attributed to the nearest container boundary — the frame the question is
    // about, and the one the author has to move the box into.
    expect(skip.backgroundId).toBe('bd-cnt');
    // ...and C10 says nothing, because the component IS framed by something.
    expect(only(violations, HOMELESS_COMPONENT)).toEqual([]);
  });

  /**
   * THE known limit of this rule, pinned so it stays a decision.
   *
   * `element-in-background` is silent on a board carrying no frame of the role
   * it names, so a sheet with a system boundary, components inside it and NO
   * container boundary anywhere raises nothing — the level skip that is easiest
   * to draw is the one this rule cannot see.
   *
   * Closing it means the rule asking "is this component inside a SYSTEM
   * boundary", which is the framing that indicts the conformant nesting (a
   * component in a container boundary is inside the system boundary too — see
   * the fixture below), so it is not available. What can see it is a BOARD that
   * declares which of the four levels it is drawing: a system boundary on a
   * component diagram is out of place whatever is inside it. That is slice B's
   * question, not this family's.
   */
  it('cannot see the skip when no container boundary is drawn at all', () => {
    const violations = evaluate([
      board(),
      systemBoundary('bd'),
      component('k', 300, 300),
    ]);
    expect(idsOf(violations)).toEqual([ISOLATED_COMPONENT]);
  });

  it('says nothing about a component inside a container boundary', () => {
    expect(
      only(
        evaluate([board(), containerBoundary('bd'), component('k', 300, 300)]),
        COMPONENT_LEVEL_SKIP
      )
    ).toEqual([]);
  });

  /**
   * THE compatibility pin, and the reason C10 was not simply retargeted.
   *
   * A board whose boundaries all carry the parent role — every C4 diagram drawn
   * before this slice — holds no `c4:container-boundary`, so this rule has no
   * frame of its own and `element-in-background` answers a frameless board with
   * silence. The old document keeps exactly the findings it had.
   */
  it('says nothing on a board of PRE-SPLIT boundaries, inside or out', () => {
    const inside = evaluate([
      board(),
      boundary('bd'),
      component('k', 300, 300),
    ]);
    const outside = evaluate([
      board(),
      boundary('bd'),
      component('k', 900, 600),
    ]);
    expect(only(inside, COMPONENT_LEVEL_SKIP)).toEqual([]);
    expect(only(outside, COMPONENT_LEVEL_SKIP)).toEqual([]);
    // ...and C10 reports on that board precisely what it reported before: the
    // component outside every boundary, and nothing about the one inside.
    expect(only(inside, HOMELESS_COMPONENT)).toEqual([]);
    expect(only(outside, HOMELESS_COMPONENT)).toHaveLength(1);
  });

  it('says nothing on a sketch with no frame at all', () => {
    // A component diagram whose author has not drawn any frame yet is a sketch
    // — the silence C10 already documents, kept.
    expect(
      only(evaluate([board(), component('k', 900, 600)]), COMPONENT_LEVEL_SKIP)
    ).toEqual([]);
  });

  /**
   * The one redundancy the composition costs, pinned rather than discovered.
   *
   * A component drawn outside EVERY boundary on a board that has a container
   * boundary raises both C10 and C14 — one saying it belongs to nothing, the
   * other that no container claims it. Suppressing one would need a family that
   * can ask "inside A but not inside B", which none of the eight expresses.
   */
  it('doubles up with C10 on a component outside every frame', () => {
    const violations = evaluate([
      board(),
      containerBoundary('bd'),
      component('k', 900, 620),
    ]);
    expect(idsOf(violations)).toEqual([
      COMPONENT_LEVEL_SKIP,
      HOMELESS_COMPONENT,
      ISOLATED_COMPONENT,
    ]);
  });
});

describe('the conformant nesting the zoom rules must never touch', () => {
  it('says nothing about containers in the system frame and components in the container frame', () => {
    const violations = evaluate(zoomed());
    expect(
      violations.filter(violation => ZOOM_RULES.includes(violation.ruleId))
    ).toEqual([]);
    // The two membership rules are silent on it too: nobody is homeless and
    // nobody has put the person inside the software.
    expect(only(violations, HOMELESS_COMPONENT)).toEqual([]);
    expect(only(violations, PERSON_IN_BOUNDARY)).toEqual([]);
    // ...and the board is NOT trivially quiet — nothing is joined up yet, which
    // is what makes the silences above worth asserting.
    expect(violations.length).toBeGreaterThan(0);
    for (const violation of violations) {
      expect(violation.ruleId).toMatch(/^c4\.isolated-/);
    }
  });

  it('flags exactly the box moved to the wrong zoom', () => {
    // Move one component out of the container frame and into the system frame
    // and the level skip appears — on that box alone.
    const violations = evaluate(
      zoomed().map(el =>
        el.id === 'k-signin' ? component('k-signin', 660, 560) : el
      )
    );
    const skips = only(violations, COMPONENT_LEVEL_SKIP);
    expect(skips).toHaveLength(1);
    expect(skips[0].elementIds).toEqual(['k-signin']);
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
