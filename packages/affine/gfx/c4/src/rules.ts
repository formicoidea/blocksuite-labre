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
 * - is every ELEMENT named? (`c4.unnamed-element`, which reads the `c4:title`
 *   text of a component group rather than any of the four levels)
 * - does every RELATIONSHIP carry a label saying what it is for?
 *   (`c4.unlabeled-relationship`)
 * - is every relationship one a reader can follow — between two things the
 *   model has, in one direction? (`c4.relationship-endpoints`,
 *   `c4.untyped-link`, and `c4.relationship-self-loop`, which is ours)
 * - does every element earn its place on the sheet?
 *   (`c4.isolated-*`, `c4.homeless-component`)
 *
 * ## The fifth question, which is not the checklist's but the MODEL's
 *
 * Three rules — `c4.system-in-boundary`, `c4.container-in-container-boundary`
 * and `c4.component-level-skip` — ask something the review checklist never
 * phrases, because C4 says it one level further up, in the abstractions
 * themselves (c4model.com/abstractions):
 *
 * > A software system is made up of one or more containers, each of which
 * > contains one or more components.
 *
 * The four levels are therefore ZOOMS of one element, not four kinds of box, and
 * the boundary is where the canvas says which zoom a part of the sheet is at.
 * From which three things follow with no judgement of ours added: a software
 * system drawn INSIDE a boundary is a mistyped container or a zoom that never
 * happened (the boundary already IS a system or a container); a container drawn
 * inside a CONTAINER boundary is that boundary, drawn inside itself; and a
 * component framed only by a SYSTEM boundary has skipped the container level the
 * model puts between them.
 *
 * None of the three could be asked before `roles.ts` split the boundary into
 * `c4:system-boundary` and `c4:container-boundary`: "inside a boundary" was one
 * undifferentiated fact, and a rule can only read the level off the frame if the
 * frame says it.
 *
 * ## Where each rule's authority comes from, as DATA
 *
 * Every rule declares a {@link RuleProvenance}, and the split is **nine
 * `recommendation` / five `labre-convention`**. `standard` appears nowhere and
 * never will: C4 has no published specification to cite a clause of, which is
 * exactly why the checklist is the source — so the six that read it are
 * `recommendation`, naming the method the way `wardley` and `ddd-context-map`
 * name theirs. The three zoom rules are `recommendation` too, and cite the
 * abstractions page rather than the checklist: what they indict is a statement
 * of C4's own model.
 *
 * The five that are OURS say so out loud, in the field and in their own
 * comments: `c4.untyped-link` (a gesture of this canvas C4 never anticipated),
 * `c4.relationship-self-loop`, `c4.homeless-component` (the MEMBERSHIP is C4's;
 * requiring it to be drawn as a rectangle round the parts is ours),
 * `c4.database-initiates` and `c4.person-in-boundary`.
 *
 * That is the whole point of promoting it to a field: an architecture review
 * asked that a Labre convention never present itself as a norm violation, and
 * a citation the reader can weigh is how the bubble keeps that promise.
 *
 * Provenance and SEVERITY are orthogonal, and this pack is where that shows:
 * three of the five conventions are promoted by `c4.strict` and two are not.
 * What decides is whether the diagram might honestly have meant it, never where
 * the rule came from — see `profiles.ts`.
 *
 * ## Severity: the CROQUIS primes, so nearly everything is `audit`
 *
 * The same promise `wardley/rules.ts:30` and `bpmn/rules.ts` make, and one step
 * further. Every rule here is declared `audit`, and the default profile —
 * `c4.sketch` — keeps it there. A C4 diagram is drawn from the outside in: the
 * boxes go down first, the arrows next, the words last, and for the whole of
 * that a checklist is describing a drawing whose author already knows it is
 * unfinished. `c4.strict` is the level somebody chooses when the diagram has
 * become a deliverable, and it promotes NINE of the fourteen to `warning` — the
 * checklist half, and the three zoom rules, which have no reading under which
 * the drawing meant it (`profiles.ts`).
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
 * before anybody added a boundary has no frame for the five boundary rules to be
 * about, and all five are silent by construction.
 *
 * A boundary drawn before the ROLE SPLIT carries the parent `c4:boundary` and no
 * child, and the split is what makes the difference legible: the two rules framed
 * on the parent reach it exactly as they always did, and the two framed on
 * `c4:container-boundary` find no frame of their own on such a board and say
 * nothing. An old document gains no finding it did not already have — see
 * {@link componentLevelSkip}, which is the whole of that argument.
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
 *   The BOARD carries no level: it is a titled card, and the title is free text,
 *   so nothing on it says which of the four sheets this is and nothing can say
 *   the sheet has been broken. The three zoom rules answer the neighbouring
 *   question and only that one — they read the level off the BOUNDARY, which
 *   does declare one, so they judge what is drawn inside a frame and stay silent
 *   about a board whose author mixed levels without drawing one.
 * - **the technology of a container or a component.** The checklist asks for it
 *   ("Java/Spring", "React SPA", "PostgreSQL") and the notation draws it as a
 *   second line under the name. The blocker that used to be here is GONE — the
 *   type line is its own element now, stamped `c4:type-line`, and
 *   `technologyOfTypeLine` reads the author's half back out of it. What stops
 *   the rule is no longer the model but the QUESTION: `label-presence` asks
 *   whether there are words, and a type line always has some (the kind's own
 *   word is seeded into it). "Has a technology" means "has more than the word
 *   the tool wrote", which is a predicate on the content — a family this engine
 *   does not have, and a bad first reason to invent one. Worth revisiting when
 *   a second framework wants the same shape of question.
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
  provenance: {
    source: 'recommendation',
    reference:
      'C4 model — diagram review checklist (c4model.com): every relationship carries a label saying what it is for',
  },
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
 * **C2** — an element nobody has named.
 *
 * ONE rule for all nine artefacts, and it reads the `c4:title` TEXT rather than
 * any of the four levels.
 *
 * ## Why it is one rule now, where it was four
 *
 * It was four — `c4.unnamed-{person,system,container,component}` — because
 * `label-presence` names one `appliesTo` role, the four levels are flat by
 * declaration, and a shape's name lived in the shape's own inner text. Every
 * one of those premises moved when the component became a GROUP: the shape
 * carries **no text at all**, and an element's name is a text child stamped
 * `c4:title` (`roles.ts` says so at length, and instructs a naming rule to read
 * exactly that role).
 *
 * So there is now a single role meaning "the name of a C4 element", and four
 * rules asking the same question of it would be one question asked four times.
 * The per-level wording goes with them — a title is a title at every level, and
 * the rule can no longer tell a person's from a container's without walking the
 * group, which is not this family's business.
 *
 * ## What it actually fires on, which is narrower than it sounds
 *
 * A fresh node is created with its kind's own label already in the title —
 * `Person`, `Web app`, `API Application` (`actions.ts` seeds `NODE_LABEL[kind]`,
 * a name and a prompt at once). `label-presence` sees words and says nothing.
 * The rule therefore fires on exactly one thing: **a title an author has
 * emptied.** That is a good deal quieter than the four rules it replaces, which
 * fired on every freshly dropped box until somebody typed — and it is the
 * honest reading, because a box reading "Person" is a box whose author has not
 * finished, not a box with no name.
 *
 * ## The known limit: a DELETED title is silence
 *
 * If the title element is removed outright rather than emptied, there is no
 * `c4:title` on the board for this rule to be about, and it says nothing. The
 * component is then genuinely nameless and the check-up will not mention it.
 *
 * That is a real hole and it is named rather than papered over. Closing it means
 * asking a different question — "does this SHAPE have a title among its group's
 * children?" — which is a rule about group membership, not about a label's
 * presence, and no family expresses it today. `c4ComponentSiblings` is where the
 * answer would come from when one does. Until then the drawn diagram is judged
 * and the missing element is not, which is the same direction every other
 * silence in this file leans.
 */
const unnamedElement: ValidationRule = {
  id: 'c4.unnamed-element',
  framework: 'c4',
  family: 'label-presence',
  severity: 'audit',
  // The TITLE, not the artefact: the shape carries no text since the component
  // became a group, so a rule written on `c4:person` would read nothing on
  // every element on the board and report every one of them unnamed.
  appliesTo: C4_ROLE.title,
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.unnamed-element',
  messageFallback: 'This element has no name.',
  suggestionKey: 'com.labre.c4.validation.unnamed-element.suggestion',
  suggestionFallback:
    'Write the name a reader outside the room would recognise — "Personal banking customer" for a person, "API Application" for a container, "Sign In Controller" for a component. The type line under it already says what kind of thing it is, so the name is free to say which one.',
  version: 1,
  provenance: {
    source: 'recommendation',
    reference:
      'C4 model — diagram review checklist (c4model.com): every element has a name',
  },
  // See `unlabeledRelationship`: naming is what a user does by TYPING, so the
  // check belongs to the moment somebody asks whether the diagram is done
  // rather than to every keystroke.
  moment: 'on-demand',
  backgroundRole: C4_ROLE.board,
  label: { present: true },
};

/* ── Grammar: what an arrow may run between ────────────────────────────── */

/**
 * **C3** — a plain connector between two C4 elements is a relationship nobody
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
  provenance: {
    source: 'labre-convention',
    reference:
      'Labre convention — a role-less connector is a gesture of this canvas, not an artefact of the notation',
  },
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
 * **C4** — a relationship runs between two things the model has.
 *
 * The grammar, and it is short because C4's is: the matrix sanctions every
 * ordered pair of the four levels but person → person (see
 * {@link C4_RELATIONSHIP_MATRIX} for why that one is out).
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
 *
 * ## The self-loop is NOT here, and that is the point
 *
 * It was, until {@link relationshipSelfLoop} split it out. The two clauses have
 * different AUTHORITY — the matrix is the C4 model speaking, the loop is our
 * house reading — and one rule cannot honestly answer "where does this come
 * from" twice. See that rule's own comment.
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
  provenance: {
    source: 'recommendation',
    reference:
      'C4 model — the model is software and the people who use it; there is no notation for two people talking to each other',
  },
  backgroundRole: C4_ROLE.board,
  endpoints: {
    edgeRole: C4_ROLE.relationship,
    allowed: C4_RELATIONSHIP_MATRIX,
    // No `forbidSelfLoop`: that clause is `c4.relationship-self-loop` now, and
    // its absence here is what lets exactly one of the two indict a given loop.
  },
};

/**
 * **C5** — a relationship that loops back onto the element it leaves.
 *
 * OURS, not the C4 model's, and split out of {@link relationshipEndpoints} for
 * exactly that reason. The matrix restates something C4 says — the notation has
 * no arrow for two people talking — while nothing in the model or the review
 * checklist forbids an element from being drawn as using itself. Shipping both
 * under one id meant one rule answering "where does this come from" two
 * different ways, which is the "conventions presented as norm violations" trap;
 * the same split BPMN made between its sequence-flow grammar and its own
 * no-self-loop house style.
 *
 * ## What it costs a reader, which is why we keep it at all
 *
 * A relationship whose two ends are the same box says an element uses itself.
 * On a C4 diagram that is never information: at every level, what a thing does
 * internally is what the NEXT level down is for — a system that calls itself is
 * a container diagram waiting to be drawn, and a container that calls itself is
 * a component diagram. The arrow is the author noticing something real and
 * drawing it on the wrong sheet.
 *
 * ## Why the two rules compose safely
 *
 * The ALPHABET GATE, before anything else: an edge with an end outside the four
 * element roles is dropped before either the self-loop test or the matrix test
 * is reached, so a relationship looped onto a boundary or a sticky note is
 * silence from both rules. Past the gate, the family tests the self-loop FIRST
 * and `continue`s unconditionally — the `continue` sits outside the
 * `forbidSelfLoop` guard — so a loop never reaches a matrix at all. C7 declares
 * no `forbidSelfLoop` and therefore says nothing about a loop; this rule
 * declares the permissive ALPHABET rather than C7's grammar, so it has no
 * sentence to judge and no verdict but the loop.
 *
 * That last point is not a detail, and the test suite caught it being wrong:
 * BPMN's split rule safely carries its sibling's matrix because BPMN's matrix
 * sanctions everything in its own alphabet, making off-matrix unreachable.
 * C4's does not — person → person is a genuine removal — so a second rule
 * carrying the grammar reports it a second time on every NON-loop relationship.
 * In this pack exactly one rule may ever hold {@link C4_RELATIONSHIP_MATRIX}.
 *
 * The consequence worth stating, because it is the one a reviewer will ask
 * about: a person looped onto THEMSELVES raises this rule ALONE, not also C7,
 * even though person → person is the one sentence off C7's matrix. The engine
 * never asks the matrix about a self-loop. That is a deliberate reading — the
 * mistake the author made is the loop, and telling them a person may not use a
 * person would be answering a question they did not ask.
 *
 * It carries no `selfLoop` block: with the matrix unreachable here, the rule's
 * own message IS the self-loop message and the family falls back to it.
 */
const relationshipSelfLoop: ValidationRule = {
  id: 'c4.relationship-self-loop',
  framework: 'c4',
  family: 'relation-endpoints',
  severity: 'audit',
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.relationship-self-loop',
  messageFallback: 'This relationship loops back onto the element it leaves.',
  suggestionKey: 'com.labre.c4.validation.relationship-self-loop.suggestion',
  suggestionFallback:
    'What an element does inside itself is what the next diagram down is for: zoom into it and draw the parts. On this sheet the loop tells the reader nothing.',
  version: 1,
  provenance: {
    source: 'labre-convention',
    reference:
      'Labre house style — C4 states no prohibition; what an element does inside itself is the next diagram down',
  },
  backgroundRole: C4_ROLE.board,
  endpoints: {
    edgeRole: C4_ROLE.relationship,
    // {@link C4_ELEMENT_MATRIX}, NOT C7's grammar — the alphabet, so that a
    // relationship looped onto a frame or a sticky note stays outside the
    // conversation, and permissive so that this rule judges no sentence.
    //
    // Carrying C7's table here would report person → person a second time: the
    // matrix is only unreachable for the LOOPS this rule indicts, and every
    // other relationship on the board still walks past it to the off-matrix
    // test. That is the same trap {@link untypedLink} documents, and it is
    // structural in C4: the grammar has a removal in it, so exactly one rule
    // may ever carry it.
    allowed: C4_ELEMENT_MATRIX,
    forbidSelfLoop: true,
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
    // One citation for all three, because they are one requirement written on
    // three roles the vocabulary keeps flat — see the header.
    provenance: {
      source: 'recommendation',
      reference:
        'C4 model — diagram review checklist (c4model.com): a reader can see why every element is on the diagram',
    },
    backgroundRole: C4_ROLE.board,
    degree: {
      edgeRole: C4_ROLE.relationship,
      // One relationship on ONE side. See the header on why no conjunction of
      // the per-direction bounds expresses this.
      eitherMin: 1,
    },
  };
}

/** **C6** — a software system nothing reaches and that reaches nothing. */
const isolatedSystem = isolationRule(
  'system',
  C4_ROLE.system,
  'Nothing connects this software system to the rest of the diagram.'
);

/** **C7** — a container nothing reaches and that reaches nothing. */
const isolatedContainer = isolationRule(
  'container',
  C4_ROLE.container,
  'Nothing connects this container to the rest of the diagram.'
);

/** **C8** — a component nothing reaches and that reaches nothing. */
const isolatedComponent = isolationRule(
  'component',
  C4_ROLE.component,
  'Nothing connects this component to the rest of the diagram.'
);

/**
 * **C9** — a data store that calls somebody.
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
  provenance: {
    source: 'labre-convention',
    reference:
      "Labre convention — a reading idiom; C4 says nothing about which end of a store's arrow is which",
  },
  backgroundRole: C4_ROLE.board,
  degree: {
    edgeRole: C4_ROLE.relationship,
    maxOut: 0,
  },
};

/* ── Membership: which frame does the element belong to? ───────────────── */

/**
 * **C10** — a component drawn outside any boundary.
 *
 * A component is the one level of C4 that means nothing on its own: it is a
 * part OF a container, and the container it is part of is drawn on the canvas
 * as the boundary round it. A component floating beside every boundary belongs
 * to nothing the diagram names, so the reader cannot say what it is inside.
 *
 * ## Why it stays framed on the PARENT role, where it might have been retargeted
 *
 * The obvious move, once the boundary split in two, was to point this rule at
 * `c4:container-boundary` — "a component belongs inside a CONTAINER boundary" —
 * and be done in one rule. It is not taken, and the reason is old documents.
 *
 * `backgroundsOf` matches a frame by `roleIsA`, and a boundary stamped with the
 * PARENT role is not a `c4:container-boundary`: descent runs from child to
 * ancestor, never the other way. So on a diagram drawn before the split — every
 * C4 board that exists today — a retargeted rule would find no frame of its own,
 * and `element-in-background` answers a frameless board with silence. The rule
 * would not fire wrongly; it would stop firing at all, and a check the user has
 * had since the pack shipped would disappear from every document already drawn
 * without anybody being told. (One board is worse than silent: draw a single new
 * container boundary on an old diagram and every component sitting in the old
 * frames becomes homeless at once.)
 *
 * So the requirement is split by what each half actually claims. THIS rule keeps
 * the weaker, older claim — a component must be framed by SOMETHING — which is
 * our drawing convention and reads the same on every document ever saved. The
 * sharper claim, that the something must be a container, is C4's own model and is
 * {@link componentLevelSkip}, framed on the child role and therefore silent on
 * exactly the documents that never said which level their frames were at.
 *
 * The two compose, and the one seam worth stating: a component drawn outside
 * EVERY boundary on a board that has a container boundary raises both — one
 * saying it belongs to nothing, the other that no container claims it. That is
 * redundant, not contradictory, and suppressing it would need a family that can
 * ask "inside A but not inside B", which none of the eight expresses. Two
 * remarks about one box is the honest price of the compatibility above.
 *
 * ## Containment, and the silence around it
 *
 * The subject must be fully inside SOME element carrying `c4:boundary` — the
 * parent role, so both of its children and every pre-split boundary count — and
 * the rule is silent whenever there is none on the board at all — a component
 * diagram sketched before anybody drew the container frame is a sketch, and so
 * is one drawn before the role existed. That silence is what keeps this from
 * being the rule that lights a whole board up on its first minute.
 *
 * ## Where the finding lands, and which level judges it
 *
 * `element-in-background` attributes the finding to the BOUNDARY — that is the
 * frame the question is asked about — and the boundary carries no picker of its
 * own: **the board alone arbitrates the checklist** (PO, 28/08/2026). One
 * diagram, one level of requirement, one place to set it.
 *
 * The two are reconciled in the engine rather than in the toolbar:
 * `inheritChosenProfiles` makes a frame naming no profile inherit the innermost
 * containing frame's choice, so a boundary drawn on a board set to Review
 * checklist is itself on Review checklist, and this rule hardens with the other
 * eight. Nothing is declared here to make that happen — the inheritance reads
 * the containment the diagram already shows.
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
  // The MEMBERSHIP is C4's ("a component is part of a container"); requiring it
  // to be drawn as a rectangle round the parts is ours, and the rule reports
  // the drawing. Same call `context-map.context-off-board` makes.
  provenance: {
    source: 'labre-convention',
    reference: 'Labre convention — membership on this canvas, not a C4 rule',
  },
  // The frame, and the whole question. No `background` declaration is carried:
  // `element-in-background` measures against the element BOX and reads no
  // margin, so a geometry declaration here would be data nothing reads.
  backgroundRole: C4_ROLE.boundary,
};

/**
 * **C11** — a person drawn inside a boundary.
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
 *
 * ## Which level judges it
 *
 * The other rule framed against the boundary, and the same answer: the finding
 * lands on the boundary, the boundary carries no picker, and it inherits the
 * board's choice through the engine's `inheritChosenProfiles`. This one stays
 * `audit` at both levels anyway, so the inheritance changes nothing it reports
 * today — it is what keeps that a decision of the profile table rather than an
 * accident of where the finding happened to be anchored.
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
  provenance: {
    source: 'labre-convention',
    reference:
      'Labre convention — C4 draws no line forbidding it; a boundary encloses parts of a system and a person is not one',
  },
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

/* ── Zoom: is what is inside the frame at the frame's own level? ───────── */

/**
 * The citation the three zoom rules share.
 *
 * One reference for one statement of C4's, read three ways — the same call
 * {@link isolationRule} makes for the three isolation rules. Naming the
 * abstractions rather than the review checklist is the honest half: the
 * checklist never asks this question, and the model answers it before the
 * checklist begins.
 */
const ZOOM_PROVENANCE = {
  source: 'recommendation',
  reference:
    'C4 model — the core abstractions (c4model.com/abstractions): a software system is made up of containers, each of which contains components; the levels are zooms of one element',
} as const;

/**
 * **C12** — a software system drawn inside a boundary.
 *
 * The first of the three zoom rules, and the widest: it is framed on the PARENT
 * role, so ANY boundary counts — a system boundary, a container boundary, and a
 * boundary drawn before either existed.
 *
 * ## What is wrong with the drawing
 *
 * A boundary already IS a system or a container: that is the whole of what the
 * dashed rectangle says. So a software system drawn inside one is a claim the
 * model has no room for — a system inside a system, or a system inside a
 * container — and it is always one of two mistakes. Either the box is a
 * CONTAINER the author drew with the system tool (the commonest, because the two
 * are the same rounded rectangle in a different blue), or the zoom never
 * happened: the author drew the frame for the next level down and then filled it
 * with the level they were already on.
 *
 * Neither reading is a diagram the reader can follow, and no third reading makes
 * it one — which is why the rule can be framed on the parent role without losing
 * anything. Whichever level the boundary is at, a system does not go in it.
 *
 * ## Mechanics: `element-in-zone`, `expect: 'outside'`
 *
 * {@link personInBoundary}'s, exactly, and for its reasons:
 * `element-in-background` has one polarity and no `expect` to turn round, while
 * `element-in-zone` has the polarity and the boundary declares a single full-plot
 * zone (`background.ts`) that IS the inside of the frame. The geometry comes from
 * the declaration the renderer paints from, so a boundary that is moved or
 * resized moves this rule with it.
 *
 * And the same two silences come with it: a system STRADDLING the dashed edge
 * raises nothing (`element-in-zone` judges a subject only against the frame that
 * CONTAINS it, and half in is not in), and a board with no boundary is silence
 * twice over. Both are the drawing hand being left alone.
 */
const systemInBoundary: ValidationRule = {
  id: 'c4.system-in-boundary',
  framework: 'c4',
  family: 'element-in-zone',
  severity: 'audit',
  appliesTo: C4_ROLE.system,
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.system-in-boundary',
  messageFallback: 'This software system is drawn inside a boundary.',
  suggestionKey: 'com.labre.c4.validation.system-in-boundary.suggestion',
  suggestionFallback:
    'A boundary already is a system or a container, so nothing inside it can be a system. If this box is one of the parts, draw it as a container; if it is the thing the boundary is about, move it out and let the frame carry its name.',
  version: 1,
  provenance: ZOOM_PROVENANCE,
  // The PARENT role: any boundary, at any level, including one drawn before the
  // level was written down. A system belongs inside none of them.
  backgroundRole: C4_ROLE.boundary,
  background: C4_BOUNDARY_BACKGROUND,
  inZone: {
    zoneIds: ['name'],
    expect: 'outside',
  },
};

/**
 * **C13** — a container drawn inside a container boundary. The PO's zoom
 * paradox, and the rule this whole slice exists for.
 *
 * A container boundary is the frame of a COMPONENT diagram: it says "this is one
 * container, and here are its parts". A container drawn inside it is therefore
 * either that container drawn inside itself, or a second container on a sheet
 * that has zoomed past the level where containers live. Only components belong
 * in there.
 *
 * ## The frame is the CHILD role, and that is the whole rule
 *
 * `c4:container-boundary`, never the parent. A container inside a SYSTEM boundary
 * is the single most ordinary thing in C4 — it is what a container diagram IS —
 * so a rule framed one role up would indict every correct container diagram ever
 * drawn. The split exists to let this rule name the one frame it is about.
 *
 * A pre-split boundary carries the parent and matches no child, so this rule
 * finds no frame on an old document and says nothing there. That is not a hole
 * being papered over: such a boundary never said which level it was at, and
 * guessing would mean indicting containers on the strength of a variant field
 * this rule cannot see.
 *
 * ## The DATABASE comes free
 *
 * `appliesTo: c4:container` reaches `c4:database` through `roleIsA`, and reaches
 * the mobile app and the single-page app without even that — they carry
 * `c4:container` outright (`roles.ts`). A data store drawn inside a container
 * boundary is the same paradox with a cylinder.
 */
const containerInContainerBoundary: ValidationRule = {
  id: 'c4.container-in-container-boundary',
  framework: 'c4',
  family: 'element-in-zone',
  severity: 'audit',
  appliesTo: C4_ROLE.container,
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.container-in-container-boundary',
  messageFallback: 'This container is drawn inside a container boundary.',
  suggestionKey:
    'com.labre.c4.validation.container-in-container-boundary.suggestion',
  suggestionFallback:
    'A container boundary IS that container, and what goes inside it is its components. Draw this box as a component — or, if the sheet is really about the containers of a system, make the frame a system boundary.',
  version: 1,
  provenance: ZOOM_PROVENANCE,
  // The CHILD role, and it has to be: a container inside a SYSTEM boundary is
  // what a container diagram is made of.
  backgroundRole: C4_ROLE['container-boundary'],
  background: C4_BOUNDARY_BACKGROUND,
  inZone: {
    zoneIds: ['name'],
    expect: 'outside',
  },
};

/**
 * **C14** — a component framed by a system boundary and by no container.
 *
 * The sharp half of {@link homelessComponent} — read that rule's comment first,
 * it carries the argument for why this is a second rule and not a retarget of the
 * first — and the third zoom rule.
 *
 * A component is a part of a CONTAINER. The frame that says which container is a
 * container boundary, so a component framed only by a system boundary has skipped
 * the level the model puts between them: the sheet is a container diagram with
 * components drawn on it, and the reader cannot say which container any of them
 * belongs to. The zoom went from system straight to component.
 *
 * ## Why `element-in-background` and not the zone family the other two use
 *
 * Because the honest question is a POSITIVE one — "is a container claiming this
 * component?" — and the negative reading is not equivalent on this canvas. A
 * container boundary is normally drawn INSIDE a system boundary, so "the
 * component is inside a system boundary" is true of every conformant component
 * diagram that also draws the system frame, and `element-in-zone` judges a
 * subject against whichever frame contains it with no notion of a nearer one.
 * The rule would fire on the correct drawing.
 *
 * `element-in-background` asks the positive question directly: a component not
 * contained by ANY `c4:container-boundary` is in violation, and a component
 * nested in one is silent however many other frames are drawn round it.
 *
 * ## What it stays silent about, which is exactly the compatibility promise
 *
 * A board with no container boundary at all — including every board drawn before
 * the role split, whose boundaries all carry the parent role — has no frame of
 * this rule's for anything to be inside or outside of, and
 * `element-in-background` answers that with silence. An old document therefore
 * gains NOTHING from this rule, and {@link homelessComponent} keeps saying on it
 * precisely what it said before.
 *
 * The same silence covers the honest sketch: a component diagram whose author has
 * not drawn the container frame yet is a sketch, which is the reading
 * {@link homelessComponent} already documents and the one that keeps this from
 * being the rule that lights up a board in its first minute.
 *
 * ## The KNOWN LIMIT, which is the other face of that silence
 *
 * A sheet with a system boundary, components drawn inside it and NO container
 * boundary anywhere raises nothing — and that is the level skip that is easiest
 * to draw. The rule cannot see it, because the only frame it could read is the
 * one nobody drew.
 *
 * Closing it here would mean asking the opposite question — "is this component
 * inside a SYSTEM boundary?" — and that question indicts the CONFORMANT drawing:
 * a container boundary is normally drawn inside a system boundary, so a
 * component correctly nested in the container frame is inside the system frame
 * too, and `element-in-zone` judges it against whichever frame contains it with
 * no notion of a nearer one. A rule that fires on the right diagram is worse than
 * one that misses a wrong one.
 *
 * What can see it is a BOARD that declares which of the four levels it is
 * drawing: on a component diagram a system boundary is out of place whatever is
 * inside it, and the level is then read off the sheet rather than guessed from
 * what happens to be drawn on it. That is the next slice's question (the board
 * `level`), and this limit is the honest reason it is worth asking.
 */
const componentLevelSkip: ValidationRule = {
  id: 'c4.component-level-skip',
  framework: 'c4',
  family: 'element-in-background',
  severity: 'audit',
  appliesTo: C4_ROLE.component,
  roles: C4_ROLES,
  messageKey: 'com.labre.c4.validation.component-level-skip',
  messageFallback: 'No container boundary claims this component.',
  suggestionKey: 'com.labre.c4.validation.component-level-skip.suggestion',
  suggestionFallback:
    'A component is a part of one container, and a system boundary is not a container: as drawn, the sheet jumps from the system to its components and the reader cannot tell which container this is in. Draw the container boundary round the parts that belong to it.',
  version: 1,
  provenance: ZOOM_PROVENANCE,
  // The CHILD role: the frame that names a container, and the only one that can
  // answer this question. No `background` declaration — `element-in-background`
  // measures against the element BOX and reads no margin.
  backgroundRole: C4_ROLE['container-boundary'],
};

/**
 * The pack, whole: fourteen rules, all registered, all live.
 *
 * Four families, and no more than four are needed — C4 has one connecting
 * object, four flat levels and two frames, so there is no swimlane question, no
 * graph traversal and no cardinality per frame to ask about. The three zoom
 * rules added nothing to that list: they are two more `element-in-zone` rules
 * and one more `element-in-background` rule, because the split that made them
 * askable happened in the role VOCABULARY and not in the engine.
 *
 * Fourteen and not thirteen because the grammar and the self-loop are two rules
 * (see {@link relationshipSelfLoop}); fourteen and not seventeen because the four
 * per-level naming rules collapsed into {@link unnamedElement} the moment an
 * element's name became one text role instead of four shapes' inner text.
 */
export const C4_RULES: readonly ValidationRule[] = [
  // Naming: does the drawing say anything at all?
  unlabeledRelationship,
  unnamedElement,
  // Grammar: what an arrow may run between, and whether it is an arrow at all.
  untypedLink,
  relationshipEndpoints,
  relationshipSelfLoop,
  // Degree: does the element earn its place on the sheet?
  isolatedSystem,
  isolatedContainer,
  isolatedComponent,
  databaseInitiates,
  // Membership: which frame does the element belong to?
  homelessComponent,
  personInBoundary,
  // Zoom: is what is inside the frame at the frame's own level?
  systemInBoundary,
  containerInContainerBoundary,
  componentLevelSkip,
];
