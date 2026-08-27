import type {
  EndpointTriplet,
  ValidationRule,
} from '@labre/affine-block-surface';
import type { RoleId } from '@labre/std/gfx';

import { C4_BOUNDARY_BACKGROUND } from './background.js';
import { C4_ROLE, C4_ROLES } from './roles.js';

/**
 * C4 validation rules — the review checklist, as DATA.
 *
 * DATA owned by the framework, versioned per rule: the engine
 * (`@labre/affine-block-surface`) knows how to evaluate a FAMILY, never a
 * concrete rule, so adding a C4 rule is adding an entry to the array at the
 * bottom of this file. Registered from the flag-gated `C4ViewExtension`, so
 * switching the `c4` flag off removes the rules with the rest of the tooling —
 * diagrams already drawn keep rendering, they simply stop being checked
 * (`docs/adr/0009`).
 *
 * ## Where the rules come from
 *
 * C4 has no specification. What it has instead is Simon Brown's **diagram
 * review checklist** (c4model.com), a short list of questions to ask of a
 * finished diagram before handing it to somebody — and the notation's whole
 * claim is that a diagram passing it can be read by a person who was not in the
 * room. Four of its questions are answerable from the model alone and are the
 * four this pack asks:
 *
 * - is every ELEMENT named, and typed? (`c4.unnamed-*`)
 * - does every RELATIONSHIP carry a label saying what it is for?
 *   (`c4.unlabeled-relationship`)
 * - is every relationship one a reader can follow — between two things the
 *   model has, in one direction? (`c4.relationship-endpoints`,
 *   `c4.untyped-link`)
 * - does every element earn its place on the sheet?
 *   (`c4.isolated-*`, `c4.homeless-component`)
 *
 * Where a rule is OURS rather than the checklist's, its own comment says so —
 * there are two (`c4.person-in-boundary` and `c4.database-initiates`), and both
 * are idioms of the notation rather than requirements of it, which is why both
 * stay `audit` at every level.
 *
 * ## Severity: the CROQUIS primes, so nearly everything is `audit`
 *
 * The same promise `wardley/rules.ts:30` and `bpmn/rules.ts` make, and one step
 * further. Every rule here is declared `audit`, and the default profile —
 * `c4.sketch` — keeps it there. A C4 diagram is drawn from the outside in: the
 * boxes go down first, the arrows next, the words last, and for the whole of
 * that a checklist is describing a drawing whose author already knows it is
 * unfinished. `c4.strict` is the level somebody chooses when the diagram has
 * become a deliverable, and it promotes the eight checklist rules to `warning`.
 *
 * `blocking-overridable` appears nowhere. NOTHING downstream implements a
 * blocking level — no gesture is refused anywhere in this library — so shipping
 * the value would be data claiming an effect that does not exist. Nothing in
 * C4 would sit there even if it did: a checklist is a set of questions, not a
 * set of prohibitions.
 *
 * ## What the whole file stays silent about
 *
 * A diagram drawn before the roles existed carries no role on anything, so it
 * is never evaluated and never says a word (PRD principle 8). A board drawn
 * before anybody added a boundary has no frame for the two boundary rules to be
 * about, and both are silent by construction.
 *
 * ## Three questions this pack deliberately does NOT ask
 *
 * Not gaps in the engine — gaps in what a v1 C4 element can be asked. Each one
 * is a rule the day the model carries the fact it would read:
 *
 * - **an empty boundary.** "A boundary round nothing is a claim about nothing"
 *   is a `role-count` question, and `role-count` counts ONE subject role per
 *   rule. The four levels are deliberately FLAT (`roles.ts` says why at
 *   length), so there is no single role meaning "any C4 element" for the rule
 *   to count — and four rules each saying "this boundary holds no component"
 *   would fire on the three perfectly ordinary boundaries holding one of the
 *   other kinds.
 * - **levels mixed on one board.** A C4 diagram is drawn at ONE level —
 *   containers of a system, or components of a container, never both — and a
 *   board that mixes them is the commonest way a C4 diagram becomes unreadable.
 *   The board carries no level in v1 (D3): it is a titled card, and the title
 *   is free text. Nothing on the model says which of the four sheets this is,
 *   so nothing can say the sheet has been broken.
 * - **the technology of a container or a component.** The checklist asks for it
 *   ("Java/Spring", "React SPA", "PostgreSQL") and the notation draws it as a
 *   second line under the name. In v1 an element's words are ONE free-text
 *   label (D2), so "has a technology" and "has a name" are the same string and
 *   `label-presence` cannot tell the two apart. A rule reading a `technology`
 *   prop is one line of data behind the model change.
 */

/**
 * Every C4 role that is an ELEMENT of the model — the four levels, and
 * therefore the whole alphabet a relationship is read against.
 *
 * `c4:database` is absent and covered: it is a `c4:container` by declaration
 * (`roles.ts`), so `roleIsA` reaches it from the container entry, and `mobile`
 * and `browser` are containers with no role of their own at all. The two frames
 * — the board and the boundary — are absent and MEANT to be: a relationship
 * dragged onto the sheet, or onto the dashed rectangle round part of it, is
 * somebody pointing at something, and pointing at things is what a whiteboard
 * is for.
 */
const C4_ELEMENT_ROLES = [
  C4_ROLE.person,
  C4_ROLE.system,
  C4_ROLE.container,
  C4_ROLE.component,
] as const;

/**
 * Every ordered pair of the four levels — the ALPHABET, and nothing more.
 *
 * Not a grammar: this table sanctions all sixteen sentences, person → person
 * included. It exists so {@link untypedLink} can say "between two C4 elements"
 * — which is the only thing `flagNeutral` reads a matrix FOR — without also
 * inheriting a judgement that belongs to {@link relationshipEndpoints}.
 *
 * ## Why the two tables are not one, which they were for a day
 *
 * `relation-endpoints` raises an off-matrix finding for every rule declaring a
 * matrix, so two rules sharing one grammar report the same wrong sentence
 * TWICE, with two brackets and two suggestions for one gesture to fix. BPMN
 * never met this because its neutral-link rule reuses a matrix on which
 * off-matrix is structurally unreachable (one triplet, one role). C4's grammar
 * has exactly one removal, so it is reachable, and the alphabet has to be
 * declared separately for the neutral rule to stay the single-verdict rule its
 * own comment promises.
 */
export const C4_ELEMENT_MATRIX: readonly EndpointTriplet[] =
  C4_ELEMENT_ROLES.flatMap(source =>
    C4_ELEMENT_ROLES.map(target => ({
      source,
      edge: C4_ROLE.relationship,
      target,
    }))
  );

/**
 * The sanctioned sentences of a relationship: **anything uses anything, except
 * a person using a person.**
 *
 * C4 is deliberately permissive here and the matrix says so. A person uses a
 * system; a container reads from a database; a component calls a system. The
 * notation puts no level barrier on an arrow — a C4 diagram is drawn at one
 * level, so the pairs that would be odd are odd because of the SHEET they are
 * on, which is a judgement this pack cannot make (see the header on D3).
 *
 * The one sentence C4 does not have is **person → person**. Two people talking
 * to each other is a true and important thing about an organisation, and it is
 * not software: the model has no drawing for it, and a diagram that shows one
 * is a diagram whose author reached for the wrong canvas. It is the only
 * removal, and it is why the grammar is the alphabet minus one line rather than
 * fifteen lines written out — the rule is "all of them but that one", and the
 * data reads best when it says what the rule says.
 *
 * Exported so a test asserts THIS table rather than a copy of it.
 */
export const C4_RELATIONSHIP_MATRIX: readonly EndpointTriplet[] =
  C4_ELEMENT_MATRIX.filter(
    triplet =>
      !(triplet.source === C4_ROLE.person && triplet.target === C4_ROLE.person)
  );

/* ── Naming: does the drawing say anything at all? ─────────────────────── */

/**
 * **C1** — an arrow nobody has labelled.
 *
 * The checklist item C4 practitioners quote most often, and the one the
 * notation is least forgiving about: an unlabelled arrow between two boxes says
 * only "these two are connected", which the reader could already see. What a
 * relationship is FOR — "sends the order to", "reads the customer file from",
 * "authenticates against" — is the whole content of the line, and the role's
 * own default verb is deliberately the weakest one in the pack ("uses") so that
 * a diagram never has words put in its mouth by the tool (`roles.ts`).
 *
 * ## `on-demand`, and `audit`
 *
 * Both softenings are the ones {@link unnamedPerson} and its three siblings
 * make, for the same reasons: a relationship is CREATED unlabelled — the
 * gesture drops a line and the author types on it a second later — so a
 * real-time rule would bracket every arrow the instant it appeared, which is
 * not validation but arguing with the act of drawing (PRD principle 3). "Four
 * arrows are unlabelled" is a sentence for the check-up panel, once, when
 * somebody asks whether the diagram is finished.
 *
 * The `label-presence` family reads the subject's OWN `text`, which for a
 * relationship is the connector's label — where C4 puts the words — so the
 * question can be asked at all.
 */
const unlabeledRelationship: ValidationRule = {
  id: 'c4.unlabeled-relationship',
  framework: 'c4',
  family: 'label-presence',
  severity: 'audit',
  appliesTo: C4_ROLE.relationship,
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.unlabeled-relationship',
  messageFallback: 'This relationship has no label.',
  suggestionKey: 'com.labre.c4.validation.unlabeled-relationship.suggestion',
  suggestionFallback:
    'Write what one element does with the other — "Sends the order to", "Reads the customer file from". An unlabelled arrow says only that the two are connected, which the reader could already see.',
  version: 1,
  // Explicitly on-demand, and it stays explicit: `moment: undefined` means
  // REALTIME, and the engine watches `text` for exactly this family when a
  // real-time rule of it is registered. Dropping this line would hand the
  // drawing path a debounced re-evaluation per keystroke.
  moment: 'on-demand',
  // Attribution only — the count reads no geometry — so an arbitration made on
  // one board covers that board and no other.
  backgroundRole: C4_ROLE.board,
  label: { present: true },
};

/**
 * The four naming rules, one per level, built from one description.
 *
 * `label-presence` names ONE subject role (`appliesTo`), and the four levels of
 * C4 are FLAT by declaration — a container is not a kind of system — so there
 * is no single role for "any element" to be written on. Four rules is therefore
 * the shape the vocabulary forces, and it is the better shape anyway: the
 * sentence a user reads names the thing they are looking at, and a profile can
 * move one level without the others.
 *
 * Three rules, not four, would be a mistake worth naming: `c4:container` covers
 * the DATABASE, the mobile app and the single-page app for free, because
 * `roleIsA` walks the parent chain and all three are containers (`roles.ts`).
 * An unnamed cylinder is caught by the container rule, not by a fifth one.
 */
function namingRule(
  level: 'person' | 'system' | 'container' | 'component',
  role: RoleId,
  message: string,
  suggestion: string
): ValidationRule {
  return {
    id: `c4.unnamed-${level}`,
    framework: 'c4',
    family: 'label-presence',
    severity: 'audit',
    appliesTo: role,
    roles: C4_ROLES,
    messageKey: `com.labre.c4.validation.unnamed-${level}`,
    messageFallback: message,
    suggestionKey: `com.labre.c4.validation.unnamed-${level}.suggestion`,
    suggestionFallback: suggestion,
    version: 1,
    // See `unlabeledRelationship`: a box is created empty and typed into a
    // second later, so the naming check belongs to the moment somebody asks
    // whether the diagram is done.
    moment: 'on-demand',
    backgroundRole: C4_ROLE.board,
    label: { present: true },
  };
}

/**
 * **C2** — a person nobody has named.
 *
 * The checklist's first question, on the level where it costs the reader most:
 * a nameless stick figure is a diagram claiming somebody uses this system
 * without saying who, which is precisely the fact a C1 context diagram exists
 * to establish.
 */
const unnamedPerson = namingRule(
  'person',
  C4_ROLE.person,
  'This person has no name.',
  'Name the ROLE rather than the individual — "Personal banking customer", "Back-office staff". Who uses the system is the fact a context diagram exists to establish.'
);

/** **C3** — a software system nobody has named. */
const unnamedSystem = namingRule(
  'system',
  C4_ROLE.system,
  'This software system has no name.',
  'Give it the name the organisation actually uses for it. A grey box with no name tells the reader there is something out there and nothing else.'
);

/**
 * **C4** — a container nobody has named.
 *
 * Covers the database, the mobile app and the single-page app for free: all
 * three ARE containers (`roles.ts`), so `roleIsA` reaches them from this one
 * rule and the vocabulary can gain a fourth picture without gaining a rule.
 */
const unnamedContainer = namingRule(
  'container',
  C4_ROLE.container,
  'This container has no name.',
  'Name the deployable thing — "API Application", "Web Application", "Database". C4 asks for the technology too; write it in the same label until the model carries it separately.'
);

/** **C5** — a component nobody has named. */
const unnamedComponent = namingRule(
  'component',
  C4_ROLE.component,
  'This component has no name.',
  'Name the responsibility it carries — "Sign In Controller", "Security Component". A component is the one level where an unnamed box is indistinguishable from a placeholder.'
);

/* ── Grammar: what an arrow may run between ────────────────────────────── */

/**
 * **C6** — a plain connector between two C4 elements is a relationship nobody
 * typed.
 *
 * The gap every other rule in this file falls through, and BPMN's `B4`
 * one framework over. The C4 relationship tool stamps a role; quick-connect and
 * auto-complete do not, so releasing the canvas' own link gesture between two
 * boxes produces a connector carrying NO role — which says nothing to the
 * grammar, nothing to the degree counts, and nothing to the naming check. A
 * diagram joined that way LOOKS connected and validates as if nobody had joined
 * anything: every element is isolated, no arrow is unlabelled, and the picture
 * on screen shows arrows.
 *
 * So the rule is not really about the connector: it is about the verdicts that
 * go quiet behind it.
 *
 * ## Why it declares a matrix it never judges anything against
 *
 * `flagNeutral` reads the rule's own ALPHABET to decide which role-less links
 * it may presume were meant as relationships, so the matrix is how this rule
 * says "between two C4 elements" — and, by saying only that, how it stays
 * silent about everything else. A plain connector onto the BOARD, onto a
 * boundary, onto a sticky note, onto a shape somebody dropped to think with is
 * an annotation and none of C4's business.
 *
 * Nothing else in the declaration fires. The matrix is
 * {@link C4_ELEMENT_MATRIX} — every ordered pair of the four levels, person →
 * person included — so off-matrix is structurally UNREACHABLE here and the one
 * sentence C4 forbids stays {@link relationshipEndpoints}' finding alone. That
 * separation is the whole reason the alphabet and the grammar are two tables;
 * sharing one made this rule report the same wrong arrow a second time.
 * `forbidSelfLoop` is absent for the same reason. This rule raises exactly one
 * kind of finding.
 */
const untypedLink: ValidationRule = {
  id: 'c4.untyped-link',
  framework: 'c4',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: C4_ROLES,
  // The rule's own words are never read: `flagNeutral` is the only verdict it
  // can reach, and it carries its own. Declared all the same, because the shape
  // requires them and a rule with no sentence is a rule nobody can review.
  messageKey: 'com.labre.c4.validation.untyped-link',
  messageFallback:
    'This link between two C4 elements says nothing the model records.',
  suggestionKey: 'com.labre.c4.validation.untyped-link.suggestion',
  suggestionFallback:
    'Draw it again with the relationship tool. A plain connector is on the diagram and absent from the model, so nothing can be said about what it means or which way round it reads.',
  version: 1,
  backgroundRole: C4_ROLE.board,
  endpoints: {
    edgeRole: C4_ROLE.relationship,
    // The ALPHABET, and nothing else — see the header. Built from the same four
    // roles C7's grammar is, so the two can never disagree about what "a C4
    // element" is, and permissive enough that this rule judges no sentence.
    allowed: C4_ELEMENT_MATRIX,
    flagNeutral: {
      messageKey: 'com.labre.c4.validation.untyped-link.neutral',
      messageFallback: 'These two elements are joined by an untyped link.',
      suggestionKey: 'com.labre.c4.validation.untyped-link.neutral.suggestion',
      suggestionFallback:
        'The diagram shows an arrow and the model holds none — nothing uses anything here. Draw it again with the relationship tool so it can carry a label and a direction.',
    },
  },
};

/**
 * **C7** — a relationship runs between two things the model has, one way, and
 * never from an element to itself.
 *
 * The grammar, and it is short because C4's is: the matrix sanctions every
 * ordered pair of the four levels but person → person (see
 * {@link C4_RELATIONSHIP_MATRIX} for why that one is out).
 *
 * ## The self-loop, and what it costs a reader
 *
 * A relationship whose two ends are the same box says an element uses itself.
 * On a C4 diagram that is never information: at every level, what a thing does
 * internally is what the NEXT level down is for — a system that calls itself is
 * a container diagram waiting to be drawn, and a container that calls itself is
 * a component diagram. The arrow is the author noticing something real and
 * drawing it on the wrong sheet.
 *
 * ## Deliberately NOT `forbidDuplicate`
 *
 * Two arrows between the same two boxes going the same way is exactly how C4
 * says a thing is used for two different reasons — "Reads from" and "Writes
 * to", drawn separately because each carries its own label. That is the
 * notation working, and a duplicate check would indict it. (The Context Mapping
 * call is the opposite one, and for the opposite reason: there the same pattern
 * twice is a claim made twice.)
 *
 * ## Off-matrix is REACHABLE here, unlike in most packs
 *
 * The single removal gives the rule something to say: a relationship drawn from
 * one person to another is on the matrix's alphabet and off its table, so it is
 * a finding rather than silence. Everything else that could be an end — the
 * board, a boundary, a sticky note, a legend glyph — is outside the alphabet,
 * and an edge with an end outside the alphabet takes the whole link out of the
 * conversation.
 */
const relationshipEndpoints: ValidationRule = {
  id: 'c4.relationship-endpoints',
  framework: 'c4',
  family: 'relation-endpoints',
  severity: 'audit',
  // No `appliesTo`: the subject is a RELATION, and the role that names it is
  // declared where the family reads it.
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.relationship-endpoints',
  messageFallback: 'This relationship runs between two people.',
  suggestionKey: 'com.labre.c4.validation.relationship-endpoints.suggestion',
  suggestionFallback:
    'C4 draws how software is used, so it has no arrow for two people talking to each other. Draw what they each use instead — or say it on a different board, where the model is people.',
  version: 1,
  backgroundRole: C4_ROLE.board,
  endpoints: {
    edgeRole: C4_ROLE.relationship,
    allowed: C4_RELATIONSHIP_MATRIX,
    forbidSelfLoop: true,
    selfLoop: {
      messageKey: 'com.labre.c4.validation.relationship-endpoints.self-loop',
      messageFallback:
        'This relationship loops back onto the element it leaves.',
      suggestionKey:
        'com.labre.c4.validation.relationship-endpoints.self-loop.suggestion',
      suggestionFallback:
        'What an element does inside itself is what the next diagram down is for: zoom into it and draw the parts. On this sheet the loop tells the reader nothing.',
    },
  },
};

/* ── Degree: does the element earn its place on the sheet? ─────────────── */

/**
 * The three isolation rules, one per connectable level, built from one
 * description.
 *
 * `edge-degree` names ONE subject role, and the levels are flat, so this is the
 * same three-or-four-rule shape {@link namingRule} explains — and the same free
 * coverage: `c4:container` reaches the database, the mobile app and the
 * single-page app.
 *
 * ## The floor is DISJUNCTIVE, and that is the whole rule
 *
 * `eitherMin: 1` — at least one relationship on ONE side. The four ordinary
 * bounds cannot say it: `minIn: 1` indicts every element at the top of a
 * diagram (a person uses things and is used by nothing), `minOut: 1` every
 * element at the bottom (a database is written to and calls nobody), and both
 * together indict a conformant diagram from end to end. What C4 asks is that a
 * reader can see WHY the box is on the sheet, and one arrow either way answers
 * it.
 *
 * ## `audit` at BOTH levels, and the person is out
 *
 * An unconnected box is a diagram that is not finished, not a diagram that is
 * wrong — the boxes go down before the arrows, always — so the finding belongs
 * to the panel at every level of requirement. And the PERSON has no rule of its
 * own at all: dropping the actors on the sheet first and connecting them last
 * is how a context diagram gets drawn, and a persona parked on the side while
 * the author thinks is the single most common intermediate state there is.
 */
function isolationRule(
  level: 'system' | 'container' | 'component',
  role: RoleId,
  message: string
): ValidationRule {
  return {
    id: `c4.isolated-${level}`,
    framework: 'c4',
    family: 'edge-degree',
    severity: 'audit',
    appliesTo: role,
    roles: C4_ROLES,
    messageKey: `com.labre.c4.validation.isolated-${level}`,
    messageFallback: message,
    suggestionKey: `com.labre.c4.validation.isolated-${level}.suggestion`,
    suggestionFallback:
      'Draw the relationship that puts it in the picture — what uses it, or what it uses. An element nothing touches leaves the reader unable to see why it is on the diagram.',
    version: 1,
    backgroundRole: C4_ROLE.board,
    degree: {
      edgeRole: C4_ROLE.relationship,
      // One relationship on ONE side. See the header on why no conjunction of
      // the per-direction bounds expresses this.
      eitherMin: 1,
    },
  };
}

/** **C8** — a software system nothing reaches and that reaches nothing. */
const isolatedSystem = isolationRule(
  'system',
  C4_ROLE.system,
  'Nothing connects this software system to the rest of the diagram.'
);

/** **C9** — a container nothing reaches and that reaches nothing. */
const isolatedContainer = isolationRule(
  'container',
  C4_ROLE.container,
  'Nothing connects this container to the rest of the diagram.'
);

/** **C10** — a component nothing reaches and that reaches nothing. */
const isolatedComponent = isolationRule(
  'component',
  C4_ROLE.component,
  'Nothing connects this component to the rest of the diagram.'
);

/**
 * **C11** — a data store that calls somebody.
 *
 * OURS, not the checklist's, and an idiom rather than a law — which is why it
 * is `audit` at both levels and says so in its own sentence.
 *
 * A C4 diagram is read as a set of sentences, and the one a database is the
 * subject of almost never exists: containers read from and write to the store,
 * and the store sits there. An arrow LEAVING a cylinder is, nine times out of
 * ten, a hand that dragged from the wrong end — the two boxes are right, the
 * label is right, and the sentence is backwards. The tenth time it is a
 * replicating database or a store with a change-feed, which is a real thing to
 * mean and which this rule deliberately reports quietly rather than refuses.
 *
 * `maxOut: 0`, on `c4:database` — and on nothing else. It cannot be written on
 * `c4:container`, which would indict every application on the board.
 */
const databaseInitiates: ValidationRule = {
  id: 'c4.database-initiates',
  framework: 'c4',
  family: 'edge-degree',
  severity: 'audit',
  appliesTo: C4_ROLE.database,
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.database-initiates',
  messageFallback: 'A relationship leaves this data store.',
  suggestionKey: 'com.labre.c4.validation.database-initiates.suggestion',
  suggestionFallback:
    'Containers read from and write to a store; a store usually calls nobody, so the arrow is often drawn from the wrong end. Turn it round — unless this really is a store that pushes, in which case say so in the label.',
  version: 1,
  backgroundRole: C4_ROLE.board,
  degree: {
    edgeRole: C4_ROLE.relationship,
    maxOut: 0,
  },
};

/* ── Membership: which frame does the element belong to? ───────────────── */

/**
 * **C12** — a component drawn outside any boundary.
 *
 * A component is the one level of C4 that means nothing on its own: it is a
 * part OF a container, and the container it is part of is drawn on the canvas
 * as the boundary round it. A component floating beside every boundary belongs
 * to nothing the diagram names, so the reader cannot say what it is inside.
 *
 * ## Containment, and the silence around it
 *
 * The subject must be fully inside SOME element carrying `c4:boundary`, and the
 * rule is silent whenever there is none on the board at all — a component
 * diagram sketched before anybody drew the container frame is a sketch, and so
 * is one drawn before the role existed. That silence is what keeps this from
 * being the rule that lights a whole board up on its first minute.
 *
 * ## Where the finding lands, and why the profile picker follows it
 *
 * `element-in-background` attributes the finding to the BOUNDARY — that is the
 * frame the question is asked about — so the level of requirement this rule is
 * judged at is the one chosen on that boundary, not on the board. That is why
 * `C4ViewExtension` registers the validation dropdown on the boundary as well
 * as on the board: a rule framed against an instance the user cannot select a
 * profile on would sit at the default level for ever.
 */
const homelessComponent: ValidationRule = {
  id: 'c4.homeless-component',
  framework: 'c4',
  family: 'element-in-background',
  severity: 'audit',
  appliesTo: C4_ROLE.component,
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.homeless-component',
  messageFallback: 'This component sits outside every boundary.',
  suggestionKey: 'com.labre.c4.validation.homeless-component.suggestion',
  suggestionFallback:
    'A component is a part of a container, and the container is the boundary drawn round it. Move it inside the one it belongs to, or draw the boundary that says which container this is.',
  version: 1,
  // The frame, and the whole question. No `background` declaration is carried:
  // `element-in-background` measures against the element BOX and reads no
  // margin, so a geometry declaration here would be data nothing reads.
  backgroundRole: C4_ROLE.boundary,
};

/**
 * **C13** — a person drawn inside a boundary.
 *
 * OURS, like {@link databaseInitiates}, and `audit` at both levels for the same
 * reason. A boundary says "these things are parts of one system, or of one
 * container". A person is never a part of the software: they are who USES it,
 * which is exactly the distinction the boundary exists to draw — a context
 * diagram whose actors are inside the box has erased the only line it had.
 *
 * ## The family is `element-in-zone`, and why
 *
 * The question is "is this element OUTSIDE that frame", and
 * `element-in-background` cannot ask it: it has one polarity, INSIDE, with no
 * `expect` to turn round. `element-in-zone` has the polarity, and the boundary
 * declares exactly one zone covering its whole plot (`background.ts` — it
 * carries the boundary's name and paints nothing), so citing that zone is
 * citing the inside of the boundary. Nothing is restated: the geometry comes
 * from the declaration the renderer paints from, so a boundary that is moved,
 * resized or re-margined moves this rule with it.
 *
 * ## What it stays silent about, and why that is the right amount
 *
 * `element-in-zone` judges a subject only against the frame that CONTAINS it,
 * so a person straddling the dashed edge — half in, half out — raises nothing:
 * only a person drawn wholly within a boundary is a person the author has put
 * inside the system. A person on a board with no boundary at all is silence
 * twice over. Both are the drawing hand being left alone.
 */
const personInBoundary: ValidationRule = {
  id: 'c4.person-in-boundary',
  framework: 'c4',
  family: 'element-in-zone',
  severity: 'audit',
  appliesTo: C4_ROLE.person,
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.person-in-boundary',
  messageFallback: 'This person is drawn inside a boundary.',
  suggestionKey: 'com.labre.c4.validation.person-in-boundary.suggestion',
  suggestionFallback:
    'A boundary encloses the parts of one system; a person is never one of them — they are who uses it. Move them outside, and let the relationship cross the dashed line.',
  version: 1,
  backgroundRole: C4_ROLE.boundary,
  // The frame's own declaration, carried as data exactly like `roles` is: it is
  // where the plot and its one zone are written, and the engine resolves the
  // rectangle from it rather than knowing anything about C4.
  background: C4_BOUNDARY_BACKGROUND,
  inZone: {
    // The boundary's single full-plot zone — see the header. It exists to carry
    // the boundary's name and paints nothing, so it IS the inside of the frame.
    zoneIds: ['name'],
    expect: 'outside',
  },
};

/**
 * The pack, whole: thirteen rules, all registered, all live.
 *
 * Four families, and no more than four are needed — C4 has one connecting
 * object, four flat levels and two frames, so there is no swimlane question, no
 * graph traversal and no cardinality per frame to ask about.
 */
export const C4_RULES: readonly ValidationRule[] = [
  // Naming: does the drawing say anything at all?
  unlabeledRelationship,
  unnamedPerson,
  unnamedSystem,
  unnamedContainer,
  unnamedComponent,
  // Grammar: what an arrow may run between, and whether it is an arrow at all.
  untypedLink,
  relationshipEndpoints,
  // Degree: does the element earn its place on the sheet?
  isolatedSystem,
  isolatedContainer,
  isolatedComponent,
  databaseInitiates,
  // Membership: which frame does the element belong to?
  homelessComponent,
  personInBoundary,
];
