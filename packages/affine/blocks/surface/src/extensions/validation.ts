import type { AuditFinding } from '@labre/affine-shared/services';
import { createIdentifier } from '@labre/global/di';
import { Bound, lineIntersects } from '@labre/global/gfx';
import type {
  RoleDefs,
  RoleId,
  SurfaceBlockModel,
  ValidationException,
} from '@labre/std/gfx';
import {
  GfxGroupLikeElementModel,
  GfxPrimitiveElementModel,
  InteractivityExtension,
  roleIsA,
} from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';
import { effect, signal } from '@preact/signals-core';

// Straight at the two leaf modules rather than at the barrel: `index.js` also
// re-exports the RENDERER, which would pull a canvas into the evaluation path
// and make a cycle out of what is a one-way read of pure declaration data.
import type { FrameworkBackgroundDef } from '../framework-background/def.js';
import {
  backgroundAxisFact,
  type BackgroundTransitionBand,
  backgroundTransitionBands,
} from '../framework-background/facts.js';
import type { CanvasRenderer } from '../renderer/canvas-renderer.js';
import { Overlay, OverlayIdentifier } from '../renderer/overlay.js';
import type { RoughCanvas } from '../utils/rough/canvas.js';
import { type QualityNudge, QualityNudgeIdentifier } from './map-quality.js';
import { ViolationTimeline } from './violation-timeline.js';

/**
 * Minimal validation engine (PF5, wave 1).
 *
 * A framework declares its rules as DATA and registers them; the engine walks
 * the surface and produces VIOLATION OBJECTS. It renders no text, decides no
 * wording and knows no concrete framework — it only knows roles (PF1) and
 * geometry.
 *
 * Structural twin of `./spotlight.ts`: a generic mechanism living with the
 * surface, opted into by a framework through a DI identifier.
 *
 * ## Gating (PF4 reversed flag contract)
 *
 * The engine registers **no rule of its own**. Rules are registered by the
 * flag-gated `…ViewExtension` of their framework (validation is tooling, not
 * content — see `docs/adr/0009`), so a disabled framework contributes no rule
 * and {@link ValidationManager} short-circuits before touching a single
 * element. Flag off costs exactly one empty-map check.
 */

/**
 * How severely a violation is meant to bite. The engine only carries the value
 * through to the violation; acting on it is the host's decision.
 *
 * - `blocking-overridable` — the host may block, and must let the user override.
 * - `warning` — surfaced, never blocking. The sketch always wins.
 * - `audit` — collected for reporting, invisible to the drawing user.
 */
export type ViolationSeverity = 'blocking-overridable' | 'warning' | 'audit';

/**
 * What a PROFILE can say about a rule: one of the three severities, or `'off'`
 * — the rule is not evaluated at all, and costs nothing.
 */
export type ProfileSeverity = ViolationSeverity | 'off';

/**
 * Rule families. One family = one evaluation function ({@link RULE_FAMILIES}).
 * Adding one is adding an entry here and a function below, never a change to
 * the shape of a rule.
 *
 * - `element-in-background` — the subject must sit inside the framework's frame.
 * - `orientation-against-axis` — a DIRECTIONAL subject (an arrow, an edge) must
 *   not run against the declared sense of one of the frame's axes.
 * - `attachment` — the subject must be posed ON a carrier element, and
 *   optionally at one of the frame's zone transitions.
 * - `no-overlap` — declared pairs of roles must not collide. The first family
 *   that is not element-local: it evaluates PAIRS.
 * - `relative-order-along-axis` — the two elements a TYPED EDGE links must sit
 *   in the order that edge states, along one axis of the frame. The first
 *   family whose subject is a RELATION rather than an element or a proximity.
 * - `tone-convention` — the subject must be drawn in one of the tones the
 *   frame's own palette declares for it. On-demand only, in practice.
 * - `majority-fact` — a remark about the MAP, raised when a declared fact holds
 *   for a majority of the subjects. Silent while nothing carries the fact.
 */
export type RuleFamily =
  | 'element-in-background'
  | 'orientation-against-axis'
  | 'attachment'
  | 'no-overlap'
  | 'relative-order-along-axis'
  | 'tone-convention'
  | 'majority-fact';

/**
 * WHEN a rule is evaluated (PF5.14).
 *
 * - `realtime` — the default, and what every rule was before this existed:
 *   evaluated on the debounced path while the user draws, inside the 16 ms
 *   budget.
 * - `on-demand` — evaluated ONLY when the user asks for a check-up, and never
 *   during a gesture. {@link evaluateRules} skips these before touching a
 *   single element, so a framework can ship a control that would not fit the
 *   frame — or that is simply not urgent — without spending a microsecond of
 *   the drawing budget on it.
 *
 * The split is a property of the RULE, not of the caller: a rule that must not
 * interrupt says so once, in its own declaration, and no evaluation path has to
 * remember. That is what makes "zero real-time cost" provable at the bench
 * rather than promised in a comment.
 */
export type ValidationMoment = 'realtime' | 'on-demand';

/** `orientation-against-axis` configuration. */
export interface AgainstAxisDef {
  /** Id of the axis in the rule's {@link ValidationRule.background}. */
  axis: string;
  /**
   * Dead zone, in degrees, around the perpendicular. A subject at exactly 90°
   * to the axis runs neither with it nor against it, and a rule that indicted
   * it would be indicting a drawing hand rather than a mistake — so the verdict
   * only falls beyond `90 + toleranceDeg` away from the axis' forward sense.
   */
  toleranceDeg: number;
}

/**
 * What a finding SAYS: an i18n key, plus the framework's own wording for a host
 * that ships no catalogue for it, for the message and for the remediation hint.
 *
 * Split out of {@link ValidationRule} because a rule can have more than one way
 * of failing, and a family that knows WHICH one failed must be able to say so.
 * A single message covering two distinct mistakes is a message that describes
 * neither: "not on a dependency at a phase transition" leaves the user to guess
 * which half they got wrong, on a symbol that is eight units wide.
 */
export interface RuleMessage {
  /** i18n key of the message; resolved by the host. The engine holds no prose. */
  messageKey: string;
  /**
   * The FRAMEWORK's own wording, used when the host ships no catalogue for the
   * key — exactly the `labelKey` + `fallback` pair a {@link ValidationProfile}
   * and a background label already carry. The framework owns the word; the
   * library still never invents one.
   */
  messageFallback?: string;
  /** i18n key of an optional remediation hint. */
  suggestionKey?: string;
  /** The framework's own wording for {@link suggestionKey}. */
  suggestionFallback?: string;
}

/** `attachment` configuration. */
export interface AttachmentDef {
  /**
   * The role of the element the subject must be posed ON.
   *
   * It has to be an **edge** role: "posed on" is measured as a distance to a
   * PATH, and a node has none. A rule naming a node role here matches nothing
   * and warns once rather than failing silently — a rule that never fires and
   * never says why is the worst thing declarative data can do.
   */
  carrierRole: RoleId;
  /** How far, in model units, the subject may sit from its carrier. */
  tolerance: number;
  /**
   * Optional second requirement: the subject's centre must also sit inside one
   * of the frame's declared TRANSITION BANDS, measured across this axis. Absent
   * means anywhere along the carrier will do.
   *
   * How wide "at a transition" is comes from the FRAME
   * ({@link FrameworkBackgroundDef.transitionBandWidth}), never from a number
   * of model units here: the band is a ratio of the plot, so it holds when the
   * map is resized. A rule asking for a boundary against a frame that declares
   * no band warns once and drops the requirement rather than indicting every
   * subject on the board.
   */
  boundaryAxis?: string;
  /**
   * The words for the boundary half, when the rule wants to say something other
   * than its own message. Absent means both halves report identically — which
   * is the right shape for a rule whose two requirements are one sentence, and
   * the wrong one for a rule the user has two different ways of fixing.
   */
  offBoundary?: RuleMessage;
}

/**
 * One `no-overlap` combination: two roles that must not collide. Order carries
 * no meaning — `[label, node]` and `[node, label]` are the same requirement.
 *
 * Which GEOMETRY each side is measured with is not declared here: it follows
 * the role's own `kind` in {@link ValidationRule.roles}. An `edge` role is
 * measured along its PATH, because the bounding box of a diagonal link covers
 * half the map and would indict every label anywhere near it; a `text` role by
 * the ink of its text, because a text box is created at a width that says
 * nothing about what it reads; a `node` role by its bounds.
 */
export type OverlapPair = readonly [RoleId, RoleId];

/**
 * `tone-convention` configuration (PF13.8 / Q5).
 *
 * A framework's colour code is a CONVENTION, not a decoration: on a Wardley map
 * the landscape is drawn in greys, red is reserved for what is changing and
 * green for benefits. A component someone coloured red for emphasis is saying
 * something the author did not mean.
 *
 * ## Why palette ENTRIES and not colours
 *
 * The sanctioned colours are named against the frame's own declared palette
 * ({@link BackgroundChromeDef.palette}) — the same `@name` indirection every
 * background label and wash already uses. A rule therefore never restates a hex
 * the background already owns, and a host restyling the frame restyles the
 * convention with it, in one place.
 *
 * ## Why TONES and not exact colours
 *
 * The convention is about tones, so the comparison is too: an element is judged
 * on the tone family its colour falls into ({@link toneOf}), never on matching
 * a palette entry byte for byte. Otherwise every legitimate shade of grey the
 * shape toolbar can produce would be a finding, which is a rule nobody would
 * keep switched on for five minutes.
 *
 * A colour the engine cannot classify — a CSS variable it has no theme to
 * resolve, a gradient, `transparent` — yields SILENCE. Guessing would mean
 * indicting a user over a colour nobody in this process can actually see.
 */
export interface ToneConventionDef {
  /**
   * Names of the entries, in the rule's {@link ValidationRule.background}
   * palette, whose tones the subject may be drawn in. A rule naming entries
   * that resolve to no classifiable tone at all warns once and evaluates
   * nothing, rather than indicting every element on the board.
   */
  palette: readonly string[];
}

/**
 * `majority-fact` configuration (PF13.8 / Q6).
 *
 * "Most of what you have mapped is an activity — the phase names for activities
 * would read better." A remark about the MAP, raised from a count over its
 * elements, and deliberately never imposed.
 *
 * ## The gate, and why it is silence rather than a warning
 *
 * The fact is read off a declared element prop that may not exist yet — Wardley's
 * `nature` is the type-3 classification, and nothing writes it today. A family
 * that guessed would produce a remark about a majority it computed over an empty
 * population, i.e. a sentence with no evidence behind it. So a surface where NO
 * subject carries the fact raises nothing at all, silently: the rule is shipped,
 * inert, and starts working by itself the day the fact lands. Nothing to
 * remember, nothing to switch on.
 */
export interface MajorityDef {
  /**
   * The element prop carrying the fact, read duck-typed: the engine must not
   * import a framework's model to count something declared by data.
   */
  fact: string;
  /** The value that must hold for a majority of the subjects. */
  value: string;
 * `relative-order-along-axis` configuration — the family of `docs/adr/0010`'s
 * W4, "a provider component may not be positioned higher than its consumer".
 *
 * The rule reads a RELATION: given a typed edge, it compares the two elements
 * that edge links along one axis of the frame, in the order the edge states.
 * That order comes from the persisted `source → target` pair and from nowhere
 * else — deriving it from the geometry would make the rule compare the layout
 * against itself, so it could never fire (ADR 0010 § 4a).
 */
export interface RelativeOrderDef {
  /**
   * The EDGE role whose orientation is read. An element matching it (or
   * specialising it) with both ends bound is one subject of the rule; every
   * other edge on the board is none of its business — a Wardley change arrow is
   * oriented too, and says nothing about who depends on whom.
   */
  edgeRole: RoleId;
  /** Id of the axis in the rule's {@link ValidationRule.background}. */
  axis: string;
  /**
   * Which end the edge states should be FURTHER ALONG the axis' forward sense
   * (the direction of increasing value: up for a vertical axis, right for a
   * horizontal one).
   *
   * `'source-ahead'` for `wardley:dependency`: the source is the consumer, so
   * it sits higher on the visibility axis and the target is what it rests on.
   * Needs descend from source to target; value flows back up.
   */
  expect: 'source-ahead' | 'target-ahead';
  /**
   * Slack before the verdict falls, as a RATIO of the frame's extent along that
   * axis — never a number of model units.
   *
   * Same lesson the transition band learned on the PO recette of 01/08/2026: an
   * absolute tolerance is four times as strict on a map four times as big, and
   * nothing on screen explains why. Two components drawn level are not a
   * mistake — an architect lines up a chain before spreading it out — so the
   * rule only speaks when one is genuinely below the other.
   *
   * Absent means zero: any inversion at all, however small, is reported.
   */
  toleranceRatio?: number;
}

/**
 * A rule is declarative, versioned data owned by its framework (PRD principle
 * 5) — never a subclass, never a closure. It is comparable, serializable and
 * can be shipped by a host.
 */
export interface ValidationRule extends RuleMessage {
  /** Stable id, namespaced by framework: `wardley.change-arrow-against-evolution`. */
  id: string;
  /** Owning framework, `wardley`. Rules never leave their framework. */
  framework: string;
  family: RuleFamily;
  severity: ViolationSeverity;
  /**
   * When this rule runs. Absent = `'realtime'`, which is what every rule
   * written before PF5.14 means and what the vast majority of rules want.
   *
   * `'on-demand'` takes the rule OUT of {@link evaluateRules} entirely — not
   * out of the canvas affordance, out of the evaluation — and into
   * {@link evaluateCheckup}, which only a user gesture calls.
   */
  moment?: ValidationMoment;
  /**
   * The role this rule is written on. An element matches when its own role IS
   * that role or SPECIALISES it ({@link roleIsA}), so a rule on
   * `wardley:component` covers `wardley:market` for free. An element with no
   * role (a generalist square, a free text) never matches — proportionality,
   * PRD principle 8.
   *
   * Absent for `no-overlap`, whose subjects are declared per PAIR: the rule has
   * no single subject role, and naming one would be data that lies.
   */
  appliesTo?: RoleId;
  /** The framework's role vocabulary, for the inheritance walk. */
  roles: RoleDefs;
  /** Bumped when the rule's meaning changes, so a host can pin behaviour. */
  version: number;
  /**
   * The ROLE of the framework's background (`wardley:map`), i.e. the frame the
   * subject roles are measured against.
   *
   * A role, not an element type: the engine never looks at a shape type, on
   * either side of a rule (see `role.ts`). A background authored before its
   * role existed carries none, frames nothing and raises nothing.
   *
   * Required by `element-in-background` and by any family reading the frame's
   * declared facts; optional for `no-overlap`, where it only decides whether a
   * finding can be waived map-wide.
   */
  backgroundRole?: RoleId;
  /**
   * The framework's background DECLARATION, carried as data exactly like
   * {@link roles} is.
   *
   * This is what lets a rule read the frame's SEMANTICS — which axes it has and
   * which way they run, where its zones meet — without the engine owning a
   * registry of backgrounds or importing a renderer. The facts come out of
   * `../framework-background/facts.js`, and are a pure function of this
   * declaration plus the bounds of the instance a finding is measured against.
   */
  background?: FrameworkBackgroundDef;
  /** `orientation-against-axis` only. */
  against?: AgainstAxisDef;
  /** `attachment` only. */
  attachment?: AttachmentDef;
  /** `no-overlap` only: the combinations that must not collide. */
  overlap?: readonly OverlapPair[];
  /** `relative-order-along-axis` only. */
  relativeOrder?: RelativeOrderDef;
  /**
   * `no-overlap` only: how DEEP a collision has to be, in model units, before
   * it is worth reporting. Absent or `0` means any shared area at all.
   *
   * Penetration depth, not shared area: how far the two geometries reach INTO
   * each other — `min(overlapX, overlapY)` for two boxes, and for a path the
   * greatest distance any point of it gets under the edge of the box it
   * crosses. A link clipping the corner of a name and a link drawn through the
   * middle of it share the same "they overlap"; only the second one is
   * something the eye trips over.
   *
   * Two paths crossing have no depth to measure — a line has no width — so a
   * declared crossing is reported whatever this says.
   */
  minPenetration?: number;
  /** `tone-convention` only. */
  tone?: ToneConventionDef;
  /** `majority-fact` only. */
  majority?: MajorityDef;
}

/**
 * A level of requirement, as DATA (PF9) — the same declarative, versioned,
 * host-shippable shape as a rule, a role or a background.
 *
 * A framework exposes several: Wardley ships a permissive learning profile and
 * a strict one; BPMN would ship descriptive / analytic / executable. A profile
 * says, for each rule of its framework, how hard that rule bites — or that it
 * does not apply at all.
 *
 * ## What "absent from {@link rules}" means
 *
 * The rule keeps its OWN declared severity. A profile is an override table, not
 * an allow-list: a rule the framework ships later must not silently vanish from
 * a strict profile that was written before it existed. A profile that wants a
 * rule gone says so — `'off'` — and a profile that wants it louder says that
 * too. Nothing is ever raised implicitly (PF9.4): every severity a user gets is
 * either the one the rule declares or one this table spells out.
 *
 * ## Scope
 *
 * A profile is CHOSEN per root instance, on the framework's background element
 * (`GfxPrimitiveElementModel.validationProfile`) — see PF9.1. Two maps on one
 * canvas therefore hold two independent levels of requirement, and a background
 * that names none is checked against its framework's {@link isDefault} profile.
 */
export interface ValidationProfile {
  /** Stable id, namespaced by framework: `wardley.sketch`. */
  id: string;
  /** Owning framework, `wardley`. A profile never applies across frameworks. */
  framework: string;
  /** i18n key of the human name; resolved by the host. No prose here either. */
  labelKey: string;
  /**
   * The framework's own wording when the host ships no catalogue for the key —
   * the same `labelKey` + `fallback` pair the background declaration uses for
   * its axis and phase labels. The framework owns the word; the library still
   * never invents one.
   */
  fallback?: string;
  /**
   * The one profile that applies when a background names none — and the one
   * that, chosen explicitly, writes NOTHING on the element. It is the most
   * permissive reasonable level, because the sketch wins (PRD principle 3).
   */
  isDefault?: boolean;
  /** Severity override per rule id. A rule absent here keeps its own. */
  rules: Readonly<Record<string, ProfileSeverity>>;
}

/**
 * Severity `profile` gives `rule` — the rule's own when the profile is silent
 * about it, or when there is no profile at all.
 */
export function profileSeverity(
  rule: ValidationRule,
  profile: ValidationProfile | undefined
): ProfileSeverity {
  // Own keys only: `rules` is an object literal shipped by a framework, so
  // `rules['constructor']` must not resolve to something off the prototype.
  return profile !== undefined && Object.hasOwn(profile.rules, rule.id)
    ? profile.rules[rule.id]
    : rule.severity;
}

/**
 * The profile a background of `framework` is checked against when it names
 * none: the one flagged {@link ValidationProfile.isDefault}, or — failing that
 * — the first one registered, so a framework that forgot the flag still has a
 * resolvable answer instead of silently losing its profiles.
 */
export function defaultProfileOf(
  profiles: readonly ValidationProfile[],
  framework: string
): ValidationProfile | undefined {
  let first: ValidationProfile | undefined;
  for (const profile of profiles) {
    if (profile.framework !== framework) continue;
    if (profile.isDefault) return profile;
    first ??= profile;
  }
  return first;
}

/** Profiles arranged for lookup: by id, and the default of each framework. */
interface ProfileIndex {
  byId: Map<string, ValidationProfile>;
  defaults: Map<string, ValidationProfile>;
}

function indexProfiles(profiles: readonly ValidationProfile[]): ProfileIndex {
  const byId = new Map<string, ValidationProfile>();
  const defaults = new Map<string, ValidationProfile>();
  for (const profile of profiles) {
    byId.set(profile.id, profile);
    if (defaults.has(profile.framework)) continue;
    const fallback = defaultProfileOf(profiles, profile.framework);
    if (fallback) defaults.set(profile.framework, fallback);
  }
  return { byId, defaults };
}

/**
 * The profile a finding of `rule` is judged by: the one its background NAMES,
 * or the framework's default.
 *
 * A profile id belonging to another framework is ignored rather than honoured:
 * a background carrying `bpmn.executable` says nothing about a Wardley rule,
 * and a stale id left behind by a paste must never silence one.
 */
function resolveProfile(
  rule: ValidationRule,
  chosenId: string | undefined,
  index: ProfileIndex
): ValidationProfile | undefined {
  const named = chosenId === undefined ? undefined : index.byId.get(chosenId);
  if (named !== undefined && named.framework === rule.framework) return named;
  return index.defaults.get(rule.framework);
}

/**
 * The profile id each role-carrying element names, in one pass.
 *
 * Role-carrying only: a profile is a decision about a framework's background,
 * and a neutral element cannot be one. That keeps the pass on exactly the same
 * cheap guard the rule families already use.
 */
function readChosenProfiles(
  elements: readonly GfxPrimitiveElementModel[]
): Map<string, string> {
  const chosen = new Map<string, string>();
  for (const el of elements) {
    if (el.role === undefined) continue;
    const id = el.validationProfile;
    // Whatever a peer wrote: a client that got it wrong must not break
    // evaluation on this one.
    if (typeof id === 'string') chosen.set(el.id, id);
  }
  return chosen;
}

/**
 * Whether `rule` is `'off'` under EVERY profile in play on this surface — in
 * which case it is not evaluated at all, which is what `'off'` is for.
 *
 * The default counts as in play unconditionally: a background naming nothing
 * falls back to it, and the surface can gain one at any moment. So the
 * short-circuit only fires when the answer cannot change, and errs towards
 * evaluating — a missed skip costs a linear pass, a wrong skip costs a silent
 * rule.
 */
function isRuleSilent(
  rule: ValidationRule,
  chosen: Map<string, string>,
  index: ProfileIndex
): boolean {
  if (profileSeverity(rule, index.defaults.get(rule.framework)) !== 'off') {
    return false;
  }
  for (const id of chosen.values()) {
    const profile = index.byId.get(id);
    // Unknown id, or another framework's: falls back to the default, already
    // known to be off.
    if (profile === undefined || profile.framework !== rule.framework) continue;
    if (profileSeverity(rule, profile) !== 'off') return false;
  }
  return true;
}

/**
 * Re-judge what a rule raised, background by background: rewrite each finding's
 * severity to what its own profile says, and drop the ones the profile turned
 * off.
 *
 * After the family, never before: only the family knows which background a
 * finding was measured against ({@link Violation.backgroundId}), and that is
 * precisely what names the profile. A family measuring against no background
 * has no instance to read a choice from and falls back to the default.
 */
function applyProfiles(
  rule: ValidationRule,
  raised: readonly Violation[],
  chosen: Map<string, string>,
  index: ProfileIndex
): Violation[] {
  const kept: Violation[] = [];
  for (const violation of raised) {
    const chosenId =
      violation.backgroundId === undefined
        ? undefined
        : chosen.get(violation.backgroundId);
    const severity = profileSeverity(
      rule,
      resolveProfile(rule, chosenId, index)
    );
    if (severity === 'off') continue;
    violation.severity = severity;
    kept.push(violation);
  }
  return kept;
}

/**
 * The result of a rule that did not hold (PRD principle 6): an OBJECT, not a
 * string and not a rendering. It names the rule, the elements at fault and an
 * i18n key — never a sentence.
 */
export interface Violation {
  ruleId: string;
  /**
   * The elements the rule indicts — one for an element-local family, TWO for
   * `no-overlap` (which is about a pair and not about either half of it), and
   * THREE for `relative-order-along-axis`: the two elements the relation links
   * plus the edge that states it.
   *
   * The edge is in there deliberately. The finding has two honest resolutions —
   * move a node, or reverse the relation — and the second one is only reachable
   * from the edge, which carries the inversion command (`docs/adr/0010` M3). A
   * finding that named the nodes alone would show the user two brackets and no
   * way to the gesture that fixes half the cases.
   *
   * Always sorted by id, so the same situation reports the same way whichever
   * order the surface happened to be walked in.
   */
  elementIds: string[];
  severity: ViolationSeverity;
  messageKey: string;
  /** The framework's own wording for {@link messageKey}. */
  messageFallback?: string;
  /** i18n key of a remediation hint, when the rule carries one. */
  suggestion?: string;
  /** The framework's own wording for {@link suggestion}. */
  suggestionFallback?: string;
  /**
   * The background this finding is attributed to — for `element-in-background`,
   * the NEAREST one, none of them having contained the element (that is what
   * being in violation means here).
   *
   * Recorded by the family at the moment it picks it, because nothing
   * downstream can reconstruct it: a board carries several maps, and "which one
   * did the user mean" is a question only the evaluation is in a position to
   * answer. It is what makes the `map` exemption scope mean ONE map instead of
   * every map on the document — see {@link ExemptionScope}.
   *
   * A heuristic, and an honest one: nearest by edge-to-edge gap
   * ({@link gapSquared}), ties broken by the smaller id so that it never
   * depends on the order the surface happened to be walked in.
   *
   * Absent for a family that measures against no background.
   */
  backgroundId?: string;
  /**
   * The named FRONTIER of that background the finding is about, when the family
   * measured against one: `custom-built|product` for a transition band
   * ({@link BackgroundTransitionBand}).
   *
   * "This bar is outside the equilibrium zone" is only half an answer — the
   * other half is which zone it should have been in, and the band already knows
   * its own name. Recorded at the moment the family picks the frontier, for the
   * same reason {@link backgroundId} is: nothing downstream can reconstruct
   * which of several transitions the user was aiming at.
   *
   * Absent for a family that measures against no such region.
   */
  boundaryId?: string;
  /**
   * Set when a user exception covers this finding (PF8), and names the SCOPE
   * that covers it. Absent = live.
   *
   * The engine keeps reporting the violation either way — an exception changes
   * its STATE, it never makes it vanish, so a board can never hide an
   * arbitration it made (PF8.3). Suppressing the canvas affordance is a
   * downstream filter ({@link liveViolations}); the panel and the bubble keep
   * the whole list.
   */
  exemption?: ExemptionScope;
}

/**
 * How far an exception reaches.
 *
 * - `element` — written on the element itself: the rule is disarmed for it and
 *   for nothing else on the board (PF8.2).
 * - `map` — written on ONE background element, the one named by the finding's
 *   {@link Violation.backgroundId}: the rule is disarmed for the elements
 *   measured against THAT map, and for no other map on the board (PF8.4).
 *
 * There is no third scope, and in particular no document-wide one: an exception
 * is always carried by an element that can be selected, copied and deleted, so
 * it has an owner, a lifetime and no hidden global state to garbage-collect.
 * A board with three maps therefore holds three independent arbitrations, and
 * deleting one map takes exactly its own with it.
 */
export type ExemptionScope = 'element' | 'map';

/**
 * Complain once per distinct problem. A family runs on every evaluation, so a
 * bare `console.warn` about a malformed rule would fill the console at 8 Hz
 * while somebody drags.
 */
const warned = new Set<string>();

function warnOnce(reason: string): void {
  if (warned.has(reason)) return;
  warned.add(reason);
  console.warn(`[validation] ${reason}`);
}

/** One instance of a framework background, as the families read it. */
interface BackgroundInstance {
  id: string;
  bound: Bound;
}

/**
 * Every background instance on the surface carrying the rule's frame role.
 *
 * Empty when the rule declares no frame role, and empty on a board whose maps
 * were all authored before that role existed — which is what makes an old
 * document stay a sketch instead of lighting up.
 */
function backgroundsOf(
  rule: ValidationRule,
  elements: readonly GfxPrimitiveElementModel[]
): BackgroundInstance[] {
  const backgroundRole = rule.backgroundRole;
  if (backgroundRole === undefined) return [];

  const backgrounds: BackgroundInstance[] = [];
  for (const el of elements) {
    if (el.role === undefined) continue;
    if (roleIsA(el.role, backgroundRole, rule.roles)) {
      backgrounds.push({ id: el.id, bound: el.elementBound });
    }
  }
  return backgrounds;
}

/**
 * Every element on the surface acting as a framework background for a REAL-TIME
 * rule.
 *
 * Recorded by the manager after each evaluation, and read on the next one — the
 * one fact about a deleted background that nothing else can reconstruct. See
 * {@link ValidationManager._backgrounds}.
 *
 * ## Why the moment is filtered here too
 *
 * This runs on the gesture path, once per evaluation, and it is a FULL surface
 * walk per rule. `evaluateRules` already refuses to walk an on-demand rule, so
 * leaving it in here would have handed the drawing budget back exactly what the
 * second moment took away from it — measured at +58 % on the manager's tick with
 * the two Wardley check-up rules registered, and invisible to a bench that times
 * `evaluateRules` alone.
 *
 * It is also the right answer and not merely the cheap one: `_backgrounds`
 * exists to decide whether an incremental REAL-TIME pass must fall back to a
 * full sweep. An on-demand rule never takes part in that pass, so the frames it
 * measures against have nothing to invalidate — and a framework whose only rules
 * are on-demand has no incremental pass to protect in the first place.
 */
export function backgroundElementIds(
  rules: readonly ValidationRule[],
  elements: readonly GfxPrimitiveElementModel[]
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const rule of rules) {
    if (!isRealtime(rule)) continue;
    for (const background of backgroundsOf(rule, elements)) ids.add(background.id);
  }
  return ids;
}

/**
 * The instance a finding is attributed to: the one that CONTAINS the subject,
 * failing that the nearest by edge-to-edge gap.
 *
 * Same question `evaluateElementInBackground` answers inline, asked by the
 * families whose subjects normally ARE on the map — an inertia bar, an arrow, a
 * pair of overlapping labels. Ties go to the smaller id so a persisted
 * arbitration never depends on the order a `Y.Map` was rebuilt in.
 */
function attributeBackground(
  bound: Bound,
  backgrounds: readonly BackgroundInstance[]
): BackgroundInstance | null {
  let nearest: BackgroundInstance | null = null;
  let nearestDistance = Infinity;
  for (const background of backgrounds) {
    if (background.bound.contains(bound)) return background;
    const distance = gapSquared(background.bound, bound);
    if (
      distance < nearestDistance ||
      (distance === nearestDistance &&
        nearest !== null &&
        background.id < nearest.id)
    ) {
      nearestDistance = distance;
      nearest = background;
    }
  }
  return nearest;
}

/**
 * Build the finding of `rule` against `elementIds`. One place, so every family
 * carries the rule's keys, its fallbacks and its background attribution the
 * same way.
 *
 * `words` is how a family with several ways of failing says WHICH one did: the
 * finding is still the rule's — same id, same severity, same arbitration — but
 * the sentence the user reads is the one that fits their mistake.
 */
function raise(
  rule: ValidationRule,
  elementIds: string[],
  backgroundId?: string,
  words: RuleMessage = rule
): Violation {
  return {
    ruleId: rule.id,
    elementIds,
    severity: rule.severity,
    messageKey: words.messageKey,
    ...(words.messageFallback !== undefined
      ? { messageFallback: words.messageFallback }
      : {}),
    ...(words.suggestionKey ? { suggestion: words.suggestionKey } : {}),
    ...(words.suggestionFallback !== undefined
      ? { suggestionFallback: words.suggestionFallback }
      : {}),
    ...(backgroundId !== undefined ? { backgroundId } : {}),
  };
}

/**
 * "Is this element on the framework's background?"
 *
 * An element carrying `rule.appliesTo` (or a specialisation of it) whose bounds
 * are not fully contained by any element carrying `rule.backgroundRole` is in
 * violation. BOTH sides are roles — the engine never reads a shape type.
 *
 * When the surface carries NO background with that role there is no map to be
 * outside of, so the rule yields nothing: a Wardley node dropped on a blank
 * canvas is a sketch, not an error — and so is a map authored before the role
 * existed.
 *
 * Cost: two linear passes, one `elementBound` per candidate. Backgrounds are
 * counted in units, so the per-element cost is constant in practice.
 */
function evaluateElementInBackground(
  rule: ValidationRule,
  elements: readonly GfxPrimitiveElementModel[]
): Violation[] {
  const subjectRole = rule.appliesTo;
  if (subjectRole === undefined) return [];

  const backgrounds = backgroundsOf(rule, elements);
  if (backgrounds.length === 0) return [];

  const violations: Violation[] = [];
  for (const el of elements) {
    // Cheapest possible exit for a neutral element: no role, no evaluation.
    if (el.role === undefined) continue;
    if (!roleIsA(el.role, subjectRole, rule.roles)) continue;

    const bound = el.elementBound;
    // One pass, and it answers two questions at once: is this element on ANY
    // map (in which case there is nothing to report), and if not, which map is
    // it nearest to. The second answer is the finding's `backgroundId`, and it
    // has to be taken here — a board carries several maps, and by the time the
    // violation reaches the UI there is no way left to tell which one the user
    // was working on.
    let nearest: { id: string; bound: Bound } | null = null;
    let nearestDistance = Infinity;
    let framed = false;
    for (const background of backgrounds) {
      if (background.bound.contains(bound)) {
        framed = true;
        break;
      }
      const distance = gapSquared(background.bound, bound);
      // Strictly nearer wins; an exact tie is broken by the smaller id, never
      // by which background the surface happened to be walked in first.
      // `backgroundId` decides where a PERSISTED decision gets written and read
      // back, so it cannot depend on the iteration order of a Map rebuilt from
      // a Y.Map on every load and every merge.
      if (
        distance < nearestDistance ||
        (distance === nearestDistance &&
          nearest !== null &&
          background.id < nearest.id)
      ) {
        nearestDistance = distance;
        nearest = background;
      }
    }
    if (framed) continue;

    violations.push(raise(rule, [el.id], nearest?.id));
  }
  return violations;
}

/**
 * Squared width of the GAP between two bounds — zero when they touch or
 * overlap, otherwise the distance from edge to edge. Squared because it is only
 * ever compared against another one, so the square root would buy nothing and
 * cost a call per background per violating element.
 *
 * Edges, not centres. "Nearest centre" reads plausibly and is wrong as soon as
 * the maps differ in size: a component 20 units off the right edge of a large
 * map is 900 units from its centre, so a small map 60 units further away wins —
 * and the element gets attributed to a map it is nowhere near. Comparing gaps
 * gives the answer the eye gives, whatever the two maps measure.
 *
 * A background that CONTAINS the element never reaches this: containment exits
 * the loop first, and a framed element raises nothing at all.
 */
function gapSquared(background: Bound, bound: Bound): number {
  const dx = Math.max(background.x - bound.maxX, bound.x - background.maxX, 0);
  const dy = Math.max(background.y - bound.maxY, bound.y - background.maxY, 0);
  return dx * dx + dy * dy;
}

/**
 * A point in model space. Mutable rather than `readonly` only so it satisfies
 * the house `IVec` (`number[]`) the geometry helpers take; nothing writes to it.
 */
type Point = [number, number];

/**
 * How many points a CURVED segment is sampled into. A Wardley map is ~1600
 * units wide and the tightest tolerance any rule declares is 24, so 32 chords
 * put the sampling error two orders of magnitude below the thing being
 * measured. Paid only by an element that actually carries tangents.
 */
const CURVE_SAMPLES = 32;

/** A point on the cubic Bézier `p0 → p1` with control points `c0`, `c1`. */
function cubicAt(
  p0: Point,
  c0: Point,
  c1: Point,
  p1: Point,
  t: number
): Point {
  const u = 1 - t;
  const a = u * u * u;
  const b = 3 * u * u * t;
  const c = 3 * u * t * t;
  const d = t * t * t;
  return [
    a * p0[0] + b * c0[0] + c * c1[0] + d * p1[0],
    a * p0[1] + b * c0[1] + c * c1[1] + d * p1[1],
  ];
}

/** Anything but a rounding difference away from `p`. */
function departsFrom(candidate: unknown, p: Point): candidate is Point {
  return (
    isPoint(candidate) &&
    (Math.abs(candidate[0] - p[0]) > 1e-6 || Math.abs(candidate[1] - p[1]) > 1e-6)
  );
}

/**
 * The POLYLINE a directional element exposes, in absolute model coordinates —
 * `null` for anything that is not one.
 *
 * Duck-typed on purpose. The engine must not import a connector model: it knows
 * roles and geometry, and "an element that runs from here to there" is
 * geometry. Two sources, in order:
 *
 * 1. `absolutePath` — the ROUTED path, which is what the user sees and what a
 *    right-angled connector actually traces;
 * 2. the free endpoints of an unattached edge, for an element the layout has
 *    not routed yet (a freshly pasted connector, a fixture in a unit test).
 *
 * An edge attached at both ends and never laid out has neither, and gets no
 * verdict at all — silence, not a guess.
 *
 * ## Curved edges
 *
 * A routed path is not always a polyline. A curved connector stores its whole
 * shape in TWO points carrying tangents (`absOut` on the first, `absIn` on the
 * second) — so reading the bare coordinates gives the CHORD, and a bar sitting
 * exactly on the drawn curve reads as 150 units off it. Wardley draws straight
 * connectors, but the connector toolbar lets the mode be changed, and a rule
 * that is confidently wrong about what the user can plainly see is worse than
 * one that says nothing.
 *
 * Detected by geometry, not by mode: a point whose tangent departs from itself
 * is a curve, whatever the element type calls it. The segment is then sampled
 * ({@link CURVE_SAMPLES}) so every downstream test — distance, intersection —
 * measures the drawn shape.
 */
function elementPath(el: unknown): Point[] | null {
  const edge = el as {
    absolutePath?: unknown;
    source?: { position?: unknown };
    target?: { position?: unknown };
  };

  const raw = edge.absolutePath;
  if (Array.isArray(raw) && raw.length >= 2) {
    const anchors: Point[] = [];
    for (const point of raw) {
      const x = (point as Record<number, unknown>)?.[0];
      const y = (point as Record<number, unknown>)?.[1];
      if (typeof x !== 'number' || typeof y !== 'number') return null;
      anchors.push([x, y]);
    }

    const points: Point[] = [anchors[0]];
    for (let i = 1; i < anchors.length; i++) {
      const from = anchors[i - 1];
      const to = anchors[i];
      const out = (raw[i - 1] as { absOut?: unknown })?.absOut;
      const into = (raw[i] as { absIn?: unknown })?.absIn;
      // Straight unless a tangent says otherwise — the common case, and the
      // one that must not pay for the other.
      if (!departsFrom(out, from) && !departsFrom(into, to)) {
        points.push(to);
        continue;
      }
      const c0 = isPoint(out) ? out : from;
      const c1 = isPoint(into) ? into : to;
      for (let s = 1; s <= CURVE_SAMPLES; s++) {
        points.push(cubicAt(from, c0, c1, to, s / CURVE_SAMPLES));
      }
    }
    return points;
  }

  const from = edge.source?.position;
  const to = edge.target?.position;
  if (isPoint(from) && isPoint(to)) return [from, to];
  return null;
}

function isPoint(value: unknown): value is Point {
  return (
    Array.isArray(value) &&
    value.length >= 2 &&
    typeof value[0] === 'number' &&
    typeof value[1] === 'number'
  );
}

/**
 * Which way a directional element RUNS: the unit vector from where it starts to
 * where it ends.
 *
 * End to end, not segment by segment: an elbowed arrow wanders, but what it
 * says is where it came from and where it points. `null` for an element with no
 * path, or one whose ends coincide — a zero-length arrow means nothing and is
 * not a mistake worth a message.
 */
function elementDirection(el: unknown): Point | null {
  const path = elementPath(el);
  if (path === null) return null;
  const [sx, sy] = path[0];
  const [ex, ey] = path[path.length - 1];
  const dx = ex - sx;
  const dy = ey - sy;
  const length = Math.hypot(dx, dy);
  if (length === 0) return null;
  return [dx / length, dy / length];
}

/** Squared distance from `p` to the segment `a…b`. */
function pointSegmentDistanceSquared(p: Point, a: Point, b: Point): number {
  const vx = b[0] - a[0];
  const vy = b[1] - a[1];
  const lengthSquared = vx * vx + vy * vy;
  let t = 0;
  if (lengthSquared > 0) {
    t = ((p[0] - a[0]) * vx + (p[1] - a[1]) * vy) / lengthSquared;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
  }
  const dx = p[0] - (a[0] + t * vx);
  const dy = p[1] - (a[1] + t * vy);
  return dx * dx + dy * dy;
}

/** Squared distance from `p` to the nearest point of the polyline `path`. */
function pointPathDistanceSquared(p: Point, path: readonly Point[]): number {
  let best = Infinity;
  for (let i = 1; i < path.length; i++) {
    const d = pointSegmentDistanceSquared(p, path[i - 1], path[i]);
    if (d < best) best = d;
  }
  return best;
}

/** The centre of a bound, as a point. */
function centreOf(bound: Bound): Point {
  return [bound.x + bound.w / 2, bound.y + bound.h / 2];
}

/**
 * "Does this arrow run against the axis?"
 *
 * The subject's direction is confronted with the declared FORWARD sense of one
 * axis of the frame it sits on (PF5.15). The verdict is an angle and nothing
 * else: no shape type, no colour, no element type — an arrow is a subject
 * because it carries the role, and it is wrong because of where it points.
 *
 * A subject with no direction ({@link elementDirection}) and a frame that
 * declares no such axis both yield silence rather than a guess.
 *
 * Cost: one `elementBound` and one path read per subject, plus the frame
 * attribution. Constant per element — the frames are counted in units.
 */
function evaluateOrientationAgainstAxis(
  rule: ValidationRule,
  elements: readonly GfxPrimitiveElementModel[]
): Violation[] {
  const subjectRole = rule.appliesTo;
  const against = rule.against;
  const def = rule.background;
  if (subjectRole === undefined || against === undefined || def === undefined) {
    return [];
  }

  const axis = backgroundAxisFact(def, against.axis);
  if (axis === undefined) return [];

  const backgrounds = backgroundsOf(rule, elements);
  // No frame on the board, no sense to run against: a lone arrow is a sketch.
  if (backgrounds.length === 0) return [];

  // Beyond this angle from the axis' forward sense, the subject runs against
  // it. Perpendicular (90°) plus the declared dead zone.
  const limit = Math.cos(((90 + against.toleranceDeg) * Math.PI) / 180);

  const violations: Violation[] = [];
  for (const el of elements) {
    if (el.role === undefined) continue;
    if (!roleIsA(el.role, subjectRole, rule.roles)) continue;

    const direction = elementDirection(el);
    if (direction === null) continue;

    const alignment = direction[0] * axis.forward[0] + direction[1] * axis.forward[1];
    if (alignment >= limit) continue;

    violations.push(
      raise(rule, [el.id], attributeBackground(el.elementBound, backgrounds)?.id)
    );
  }
  return violations;
}

/**
 * "Is this posed on what it is supposed to be posed on?"
 *
 * The subject must sit within `tolerance` of an element carrying the declared
 * CARRIER role (PF5.16) — the carrier being an edge, measured along its path —
 * and, when the rule asks for it, inside one of the frame's declared TRANSITION
 * BANDS ({@link backgroundTransitionBands}).
 *
 * One finding, and it says which half failed. The two requirements are still a
 * single badge on a single symbol — two would be pedantry on a bar eight units
 * wide — but they are two different mistakes with two different gestures to fix
 * them, so the finding carries the words of the one that actually failed. When
 * BOTH fail it reports the carrier: a symbol attached to nothing has to find
 * something to be about before where it sits can mean anything.
 *
 * Silence when the board carries no carrier at all: a map with no dependency
 * yet is a map being drawn, not a map with a misplaced symbol.
 */
function evaluateAttachment(
  rule: ValidationRule,
  elements: readonly GfxPrimitiveElementModel[]
): Violation[] {
  const subjectRole = rule.appliesTo;
  const attachment = rule.attachment;
  if (subjectRole === undefined || attachment === undefined) return [];

  // A carrier is something with a PATH. Declaring anything else here produces a
  // rule that can never fire; say so once instead of shrugging.
  const carrierKind = rule.roles[attachment.carrierRole]?.kind;
  if (carrierKind !== undefined && carrierKind !== 'edge') {
    warnOnce(
      `attachment rule "${rule.id}" names a "${carrierKind}" role ` +
        `("${attachment.carrierRole}") as its carrier — only an "edge" role ` +
        `has a path, and "posed on" is a distance to one, so this rule can ` +
        `never fire.`
    );
    return [];
  }

  const carriers: Point[][] = [];
  const subjects: GfxPrimitiveElementModel[] = [];
  for (const el of elements) {
    if (el.role === undefined) continue;
    if (roleIsA(el.role, attachment.carrierRole, rule.roles)) {
      const path = elementPath(el);
      if (path !== null) carriers.push(path);
    } else if (roleIsA(el.role, subjectRole, rule.roles)) {
      subjects.push(el);
    }
  }
  if (subjects.length === 0 || carriers.length === 0) return [];

  const backgrounds = backgroundsOf(rule, elements);
  const toleranceSquared = attachment.tolerance * attachment.tolerance;
  // The transition test needs a frame to read the bands off, so a rule asking
  // for one on a board with no frame simply does not ask.
  const def = rule.background;
  let axis =
    attachment.boundaryAxis !== undefined && def !== undefined
      ? backgroundAxisFact(def, attachment.boundaryAxis)
      : undefined;
  if (axis !== undefined && def?.transitionBandWidth === undefined) {
    // A width the frame never declared is not a width the engine may invent:
    // guessing one would indict every subject on the board over a number
    // nobody wrote down.
    warnOnce(
      `attachment rule "${rule.id}" asks for the "${attachment.boundaryAxis}" ` +
        `transitions, but its background declares no "transitionBandWidth" — ` +
        `the boundary half of this rule is not evaluated.`
    );
    axis = undefined;
  }
  // Bands are a function of the frame's bounds, and a board carries units of
  // frames against hundreds of subjects: read once per frame, not per bar.
  const bandsOf = new Map<string, BackgroundTransitionBand[]>();

  const violations: Violation[] = [];
  for (const el of subjects) {
    const bound = el.elementBound;
    const centre = centreOf(bound);

    let carried = false;
    for (const path of carriers) {
      if (pointPathDistanceSquared(centre, path) <= toleranceSquared) {
        carried = true;
        break;
      }
    }

    const frame = attributeBackground(bound, backgrounds);
    let inBand = true;
    // The frontier the subject missed: the nearest one, which is the one the
    // user was aiming at and the only one a suggestion can point back to.
    let missed: BackgroundTransitionBand | undefined;
    if (carried && axis !== undefined && frame !== null && def) {
      let bands = bandsOf.get(frame.id);
      if (bands === undefined) {
        const all = backgroundTransitionBands(def, frame.bound);
        // A transition ACROSS a horizontal axis is a vertical band, i.e. an `x`.
        bands = axis.orientation === 'horizontal' ? all.x : all.y;
        bandsOf.set(frame.id, bands);
      }
      const value = axis.orientation === 'horizontal' ? centre[0] : centre[1];
      inBand = false;
      let nearest = Infinity;
      for (const band of bands) {
        if (value >= band.min && value <= band.max) {
          inBand = true;
          break;
        }
        const away = Math.abs(value - band.at);
        if (away < nearest) {
          nearest = away;
          missed = band;
        }
      }
      // A frame with no transition at all asks nothing of the subject.
      if (bands.length === 0) inBand = true;
    }

    if (carried && inBand) continue;
    // Carrier first: the more actionable of the two, and the only one that
    // makes the other one mean anything.
    const violation = raise(
      rule,
      [el.id],
      frame?.id,
      carried ? attachment.offBoundary : rule
    );
    if (carried && missed !== undefined) violation.boundaryId = missed.id;
    violations.push(violation);
  }
  return violations;
}

/** One participant of a `no-overlap` pass, with its geometry read once. */
interface OverlapSubject {
  id: string;
  /** Bounds, narrowed to the ink for a `text` role — see {@link textInkBound}. */
  bound: Bound;
  /** Non-null for an `edge` role: the polyline it is measured along. */
  path: Point[] | null;
  /** Which of the rule's declared role slots this element fills. */
  slots: boolean[];
}

/**
 * How much shared extent counts as an overlap rather than a shared edge.
 *
 * Two boxes that TOUCH — a label ending exactly where a node begins — share no
 * area and are perfectly readable, which is precisely what alignment and snap
 * produce all day. The house `Bound.isOverlapWithBound` answers `true` for them
 * (it compares against `+EPSILON`, so equality passes), so this asks for real
 * shared extent instead. Small enough that a pixel of genuine overlap still
 * counts, large enough that float noise on a snapped edge does not.
 */
const OVERLAP_EPSILON = 1e-6;

/** Do these two bounds share AREA, as opposed to an edge? */
function boundsOverlap(a: Bound, b: Bound): boolean {
  return (
    b.maxX - a.minX > OVERLAP_EPSILON &&
    a.maxX - b.minX > OVERLAP_EPSILON &&
    b.maxY - a.minY > OVERLAP_EPSILON &&
    a.maxY - b.minY > OVERLAP_EPSILON
  );
}

/**
 * Do these two subjects actually collide, given each one's geometry?
 *
 * ## Known limit: a ROTATED node is measured by its bounding box
 *
 * `elementBound` is the axis-aligned box of a rotated element, so a 120×26
 * label at 45° presents as roughly 103×103 — the same inflation this family
 * refuses to accept for an edge, where the fix was to measure along the path.
 * A rotated NODE has no equivalent cheap answer: it needs an oriented box and a
 * separating-axis test on both sides of every pair, in the inner loop of the
 * only super-linear family here.
 *
 * Deliberately not built, and deliberately written down. Rotating a Wardley
 * node is not a gesture the framework has; the day a framework rotates its
 * artefacts is the day this is worth the inner loop, and {@link OverlapSubject}
 * is where the oriented box would go. Until then the failure mode is a
 * false POSITIVE on a rotated pair — a warning too many, never a miss — which
 * is the right way round for a readability rule that is only ever a warning.
 * A test pins the behaviour so a change to it cannot be silent.
 *
 * A rotated `text` role holds the same line, and has to be MADE to: narrowing
 * a rotated box to the band an unrotated renderer would draw in is how a miss
 * gets built (at 180° the words are at the other end of it). So
 * {@link textInkBound} hands a rotated element its whole box back.
 */
function subjectsCollide(
  a: OverlapSubject,
  b: OverlapSubject,
  minPenetration: number
): boolean {
  // Bounding boxes first: on a dense map almost every pair dies here, and this
  // is the test the O(n²) sweep is really made of.
  if (!boundsOverlap(a.bound, b.bound)) return false;
  if (a.path === null && b.path === null) {
    return (
      minPenetration <= 0 || boundsPenetration(a.bound, b.bound) > minPenetration
    );
  }
  // Two paths: zero-width lines, so there is no depth to measure and a declared
  // crossing is reported as it always was.
  if (a.path !== null && b.path !== null) return pathsCross(a.path, b.path);

  const path = (a.path ?? b.path) as Point[];
  const bound = a.path === null ? a.bound : b.bound;
  if (!pathHitsBound(path, bound)) return false;
  return (
    minPenetration <= 0 || pathPenetration(path, bound) > minPenetration
  );
}

/**
 * How far two overlapping boxes reach INTO each other: the smaller of the two
 * axis overlaps, which is the distance one of them would have to move to come
 * free. Corner-grazing gives a small number on both axes; a name written across
 * a node gives the height of the letters.
 */
function boundsPenetration(a: Bound, b: Bound): number {
  return Math.min(
    Math.min(a.maxX - b.minX, b.maxX - a.minX),
    Math.min(a.maxY - b.minY, b.maxY - a.minY)
  );
}

/**
 * The deepest any point of `path` gets under an edge of `bound` — 0 when the
 * path only touches it, negative when it misses entirely.
 *
 * "Depth" is the distance to the NEAREST edge, so a link crossing a label
 * lengthwise through the middle scores half the line height, and one clipping a
 * corner scores almost nothing. Exact, not sampled: that distance is the
 * minimum of four linear functions of the position along the segment, hence
 * concave, so its maximum is attained either at an end of the segment or where
 * two of the four swap places — at most eight candidates, all of them tested.
 *
 * Only ever reached by a pair that already collides, i.e. off the hot path of
 * the sweep.
 */
function pathPenetration(path: readonly Point[], bound: Bound): number {
  const edges = (p: Point) => [
    p[0] - bound.minX,
    bound.maxX - p[0],
    p[1] - bound.minY,
    bound.maxY - p[1],
  ];
  const depthAt = (from: number[], to: number[], t: number) => {
    let depth = Infinity;
    for (let k = 0; k < 4; k++) {
      depth = Math.min(depth, from[k] + t * (to[k] - from[k]));
    }
    return depth;
  };

  let deepest = -Infinity;
  for (let i = 1; i < path.length; i++) {
    const from = edges(path[i - 1]);
    const to = edges(path[i]);
    deepest = Math.max(deepest, depthAt(from, to, 0), depthAt(from, to, 1));
    for (let m = 0; m < 4; m++) {
      for (let n = m + 1; n < 4; n++) {
        const slope = to[m] - from[m] - (to[n] - from[n]);
        if (slope === 0) continue;
        const t = (from[n] - from[m]) / slope;
        if (t <= 0 || t >= 1) continue;
        deepest = Math.max(deepest, depthAt(from, to, t));
      }
    }
  }
  return deepest;
}

/**
 * Advance width of one character, as a fraction of the font size, by CLASS.
 *
 * The engine measures no text: a canvas in the evaluation path would cost a
 * `measureText` per label per pass, and would make the verdict depend on which
 * fonts a host happens to have loaded — the same map would validate differently
 * in a headless report and in a browser. So the width is DECLARED, and read off
 * this table.
 *
 * ## Why a table and not one mean advance
 *
 * A single ratio was the first answer and it was wrong in the direction that
 * matters. Letters differ by a factor of FOUR — `i` is 0.24 em and `W` is 0.9 —
 * so an average tuned on `Customer` reads `utility` half as wide again as it is
 * drawn, and a link 15 units past the last letter of a lowercase name lands
 * inside the ghost. That is the very false positive this geometry exists to
 * remove, and it survived the first version for every narrow-lettered name.
 *
 * Five classes, still constant per character, still no canvas, still the same
 * answer on every host:
 *
 * | class | em | characters |
 * | --- | --- | --- |
 * | thin | 0.26 | `i l I j` and the punctuation, brackets and the SPACE |
 * | narrow | 0.35 | `f t r " *` |
 * | wide | 0.85 | `m w M W @ %` |
 * | capital | 0.62 | `A`–`Z`, the rest of them |
 * | full-width | 1.00 | anything from U+2E80 up: CJK, kana, hangul |
 * | nothing | 0.00 | combining marks, zero-width joiners, variation selectors |
 * | default | 0.53 | everything else, lowercase and digits |
 *
 * ## The precision, measured rather than claimed
 *
 * Against the real renderer at Inter 18, over the 28-name bench in
 * `integration-test/.../wardley-validation.spec.ts` — which prints every line
 * and fails outside ±15 % on ANY of them:
 *
 * | name | drawn | declared |
 * | --- | --- | --- |
 * | `utility` | 46.4 | 45.7 (−1 %) |
 * | `little` | 36.6 | 36.2 (−1 %) |
 * | `ERP` | 33.7 | 33.5 (−1 %) |
 * | `Customer` | 83.2 | 77.2 (−7 %) |
 * | `Payment gateway` | 152.0 | 144.9 (−5 %) |
 * | `Cloud` | 49.7 | 44.5 (**−11 %**, the worst of the 28) |
 * | `WWWWWWWWWW` | 170.8 | 153.0 (−10 %) |
 * | `付款` | 36.0 | 36.0 (0 %) |
 *
 * **Never wide, on any of the 28** — which is the property that matters: an
 * over-estimate is a ghost past the last letter, and a link crossing it is
 * precisely the false positive this geometry exists to remove. What is left is
 * a few units of silence at the end of a name, on the scale
 * {@link ValidationRule.minPenetration} is calibrated on.
 *
 * (The drawn figure itself moves by a few percent with the web font's loading
 * state — the other half of why the engine does not try to measure exactly.)
 */
const TEXT_ADVANCE = /* @__PURE__ */ (() => {
  const table: Record<string, number> = Object.create(null);
  for (const char of " .,:;!|'`()[]{}/\\-ilIj") table[char] = 0.26;
  for (const char of 'ftr"*') table[char] = 0.35;
  for (const char of 'mwMW@%') table[char] = 0.85;
  return table;
})();

/** Width of one character, in em. See {@link TEXT_ADVANCE}. */
function charAdvance(char: string): number {
  const declared = TEXT_ADVANCE[char];
  if (declared !== undefined) return declared;
  const code = char.codePointAt(0) ?? 0;
  // Code points that draw nothing OF THEIR OWN, and so advance nothing: a
  // combining mark sits on the letter before it, a zero-width space or joiner
  // is not there at all, and a variation selector only says how to draw its
  // neighbour. Billed at full price they turn "élément" pasted from a Mac
  // (decomposed: nine code points, seven glyphs) into a fifth of a name's worth
  // of white paper — a false positive, which is the one thing this must not
  // manufacture. Before the full-width test, since U+FE0F is above it.
  if (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x200b && code <= 0x200d) ||
    code === 0xfe0f
  ) {
    return 0;
  }
  // Full-width scripts, where one character IS one em.
  if (code >= 0x2e80) return 1;
  // The rest of the capitals: wider than lowercase, narrower than `M`.
  if (code >= 65 && code <= 90) return 0.62;
  return 0.53;
}

/** Width of one line of text, in model units. */
function lineWidth(line: string, fontSize: number): number {
  let em = 0;
  for (const char of line) em += charAdvance(char);
  return em * fontSize;
}

/**
 * The box the TEXT of an element actually occupies, inside the box the element
 * was created with.
 *
 * A text element is created at a width that says nothing about its content — a
 * Wardley label is 120 to 200 units wide whether it reads "ERP" or "Customer
 * relationship management" — so its box carries empty margin on the side its
 * `textAlign` runs away from. Measuring that box makes the rule report things
 * the user cannot see, which is exactly the report they stop believing.
 *
 * Narrowed on the horizontal only, and never widened: the height stored on the
 * element IS the rendered block (the editor writes `lineHeight × lines` back on
 * every edit), and the renderer lays the lines out from the TOP of the box.
 * An element exposing no text is left exactly as it was, so a fixture or a
 * host element that carries none is measured by its box as before; one whose
 * text reads EMPTY gets a width of zero, and {@link evaluateNoOverlap} drops it
 * from the pass entirely — it draws nothing, so it collides with nothing.
 *
 * ## A ROTATED text is measured by its whole box
 *
 * `elementBound` is the axis-aligned box of a rotated element, and this cuts a
 * band out of it where an UNROTATED renderer would put the ink. At 180° the
 * words are at the other end of the box, so the band would be white paper and
 * the letters outside it: a MISS, not a warning too many. A rotated text
 * therefore keeps its whole box — over-reporting, which is the failure mode the
 * family already accepts for a rotated node, and the one a readability warning
 * can afford.
 */
function textInkBound(el: unknown, bound: Bound): Bound {
  const text = el as {
    text?: unknown;
    fontSize?: unknown;
    textAlign?: unknown;
    rotate?: unknown;
  };
  if (typeof text.fontSize !== 'number' || text.text == null) return bound;
  if (typeof text.rotate === 'number' && text.rotate !== 0) return bound;

  let longest = 0;
  // NFC first: the same name typed here and pasted from a Mac can arrive as the
  // same glyphs in a different number of code points, and a width that depends
  // on which one would be a rule that answers differently on identical text.
  for (const line of String(text.text).normalize('NFC').split('\n')) {
    longest = Math.max(longest, lineWidth(line, text.fontSize));
  }

  const w = Math.min(bound.w, longest);
  const x =
    text.textAlign === 'center'
      ? bound.x + (bound.w - w) / 2
      : text.textAlign === 'right'
        ? bound.maxX - w
        : bound.x;
  return new Bound(x, bound.y, w, bound.h);
}

function pathHitsBound(path: readonly Point[], bound: Bound): boolean {
  for (let i = 1; i < path.length; i++) {
    if (bound.containsPoint(path[i - 1]) || bound.containsPoint(path[i])) {
      return true;
    }
    if (bound.intersectLine(path[i - 1], path[i]) !== null) return true;
  }
  return false;
}

function pathsCross(a: readonly Point[], b: readonly Point[]): boolean {
  for (let i = 1; i < a.length; i++) {
    for (let j = 1; j < b.length; j++) {
      if (lineIntersects(a[i - 1], a[i], b[j - 1], b[j])) return true;
    }
  }
  return false;
}

/**
 * "Do these two things sit on top of each other?" (PF5.13)
 *
 * The first family that is not element-local: it evaluates PAIRS, so a finding
 * names two elements and neither of them alone is at fault. Which pairs is
 * declared data — `[label, node]`, `[label, link]` — and the geometry each side
 * is measured with follows the role's own `kind`, so an edge is measured along
 * its path and never by the bounding box of its diagonal.
 *
 * ## Cost, and the dirty set
 *
 * Naive it is O(p²) over the PARTICIPANTS — the elements carrying one of the
 * declared roles, never the whole surface — with every bound read exactly once
 * and a rectangle test as the inner loop. That is what the bench measures on
 * the reference map, and it fits.
 *
 * With an {@link IncrementalContext} it is O(|dirty| × p): findings that name
 * only untouched elements are carried over from the previous evaluation, and
 * only the couples involving something that MOVED are re-tested. A drag on a
 * dense map is one element against the participants, not the whole grid against
 * itself.
 */
function evaluateNoOverlap(
  rule: ValidationRule,
  elements: readonly GfxPrimitiveElementModel[],
  incremental?: IncrementalContext
): Violation[] {
  const pairs = rule.overlap;
  if (pairs === undefined || pairs.length === 0) return [];

  // The distinct roles the pairs mention, and the pairs re-expressed as index
  // couples into that list — so the inner loop compares booleans, not strings.
  const slots: RoleId[] = [];
  const couples: [number, number][] = [];
  for (const [a, b] of pairs) {
    const ia = slots.indexOf(a) >= 0 ? slots.indexOf(a) : slots.push(a) - 1;
    const ib = slots.indexOf(b) >= 0 ? slots.indexOf(b) : slots.push(b) - 1;
    couples.push([ia, ib]);
  }

  const subjects: OverlapSubject[] = [];
  for (const el of elements) {
    // Neutral element: never a participant, whatever it sits on.
    if (el.role === undefined) continue;
    let matched = false;
    const filled = slots.map(slot => {
      const isA = roleIsA(el.role, slot, rule.roles);
      matched ||= isA;
      return isA;
    });
    if (!matched) continue;
    const kind = rule.roles[el.role]?.kind;
    // A `text` role is measured by the ink of its text, not by the box it was
    // created at; everything else by its bounds.
    const bound =
      kind === 'text' ? textInkBound(el, el.elementBound) : el.elementBound;
    // A text emptied of its words draws NOTHING, and a zero-width box is still
    // a vertical line that a wider box can be said to contain. Out of the pass:
    // it cannot make anything unreadable. Only a TEXT — a perfectly vertical
    // connector has a flat box too, and is measured along its path.
    if (kind === 'text' && bound.w === 0) continue;
    subjects.push({
      id: el.id,
      bound,
      // An `edge` role is measured along its path.
      path: kind === 'edge' ? elementPath(el) : null,
      slots: filled,
    });
  }
  if (subjects.length < 2) return [];

  const backgrounds = backgroundsOf(rule, elements);
  const declared = (a: OverlapSubject, b: OverlapSubject) =>
    couples.some(
      ([i, j]) => (a.slots[i] && b.slots[j]) || (a.slots[j] && b.slots[i])
    );

  const minPenetration = rule.minPenetration ?? 0;
  const found: Violation[] = [];
  const test = (a: OverlapSubject, b: OverlapSubject) => {
    if (!declared(a, b) || !subjectsCollide(a, b, minPenetration)) return;
    // Sorted, so the same collision reads the same way every time — and the
    // frame is read off the SAME half whichever end the pair was reached from,
    // or a full pass and an incremental one could attribute one collision to
    // two different maps.
    const [first, second] = a.id < b.id ? [a, b] : [b, a];
    found.push(
      raise(
        rule,
        [first.id, second.id],
        attributeBackground(first.bound, backgrounds)?.id
      )
    );
  };

  const sweep = () => {
    for (let i = 0; i < subjects.length; i++) {
      for (let j = i + 1; j < subjects.length; j++) test(subjects[i], subjects[j]);
    }
    return found;
  };
  if (incremental === undefined) return sweep();

  const { dirty } = incremental;

  /**
   * Anything that IS or WAS a frame sends the whole surface back through the
   * sweep.
   *
   * A frame is not a participant, so no pair-wise re-test ever reaches the
   * findings attributed to it — and moving, resizing or DELETING one changes
   * every one of those attributions, which is what decides the map-wide
   * arbitration and the profile in force. Deletion is the case that made this
   * necessary and the one a "is a current background dirty" test cannot see:
   * once the map is gone `backgrounds` is empty, nothing looks dirty, and the
   * findings measured against it would vanish from a live board.
   */
  const frameTouched =
    backgrounds.some(background => dirty.has(background.id)) ||
    incremental.previous.some(
      violation =>
        violation.backgroundId !== undefined &&
        dirty.has(violation.backgroundId)
    );
  if (frameTouched) return sweep();

  /**
   * ...and so does a change big enough that the shortcut is no longer one.
   *
   * The dirty path costs `dirtyParticipants × p`; the sweep costs `p²/2`. Past
   * the crossover the "optimisation" is several times the price of the thing it
   * replaces — measured at 8× and OUT of the 16 ms budget for a lasso drag over
   * a third of a 500-element map, against 2.2 ms for the sweep it was avoiding.
   * One comparison buys back the worst case entirely.
   */
  let dirtyParticipants = 0;
  const isDirty = subjects.map(subject => {
    const changed = dirty.has(subject.id);
    if (changed) dirtyParticipants++;
    return changed;
  });
  if (dirtyParticipants * 2 >= subjects.length) return sweep();

  // Only the couples involving something that changed. Everything else keeps
  // the verdict it already had.
  for (let i = 0; i < subjects.length; i++) {
    if (!isDirty[i]) continue;
    for (let j = 0; j < subjects.length; j++) {
      if (j === i) continue;
      // A dirty–dirty couple is reachable from both ends and must be tested
      // once. The earlier index already tested it against everything, so only
      // look forward — no per-couple key, and nothing allocated in the loop
      // that is the whole cost of this path.
      if (j < i && isDirty[j]) continue;
      test(subjects[i], subjects[j]);
    }
  }

  const alive = new Set(subjects.map(subject => subject.id));
  // The `backgroundId` is deliberately NOT filtered on here: a pair-wise
  // finding depends on its frame only for ATTRIBUTION, and any change to that
  // frame already took the whole surface through the sweep above. Dropping
  // findings on it as well is how a live overlap disappeared when its map was
  // deleted.
  const carried = incremental.previous.filter(
    violation =>
      violation.ruleId === rule.id &&
      violation.elementIds.every(id => !dirty.has(id) && alive.has(id))
  );
  return [...carried, ...found];
}

/**
 * The tone families a colour can fall into — the granularity a colour CONVENTION
 * is actually written at ("the landscape is grey, red is what changes"), and
 * deliberately not finer. A framework's palette entry and a user's colour are
 * both reduced to one of these before they are compared.
 */
export type ColourTone =
  | 'grey'
  | 'red'
  | 'orange'
  | 'yellow'
  | 'green'
  | 'teal'
  | 'blue'
  | 'purple'
  | 'magenta';

/**
 * Hue windows, in degrees, in ascending order. The last one wraps back onto
 * red, which is why the table is read as "first upper bound above the hue".
 */
const TONE_HUES: readonly (readonly [number, ColourTone])[] = [
  [15, 'red'],
  [45, 'orange'],
  [70, 'yellow'],
  [160, 'green'],
  [200, 'teal'],
  [260, 'blue'],
  [300, 'purple'],
  [345, 'magenta'],
  [360, 'red'],
];

/**
 * Tone words, longest first so a substring can never win over the name that
 * contains it. This is how a THEME TOKEN is classified — `--affine-palette-shape-red`
 * carries its own answer in its name, and reading it is the only way to classify
 * a variable the engine has no stylesheet to resolve.
 */
const TONE_WORDS: readonly (readonly [string, ColourTone])[] = [
  ['magenta', 'magenta'],
  ['purple', 'purple'],
  ['orange', 'orange'],
  ['yellow', 'yellow'],
  ['green', 'green'],
  ['white', 'grey'],
  ['black', 'grey'],
  ['blue', 'blue'],
  ['teal', 'teal'],
  ['grey', 'grey'],
  ['gray', 'grey'],
  ['red', 'red'],
];

/** Below this saturation a colour reads as a grey whatever its hue says. */
const GREY_SATURATION = 0.15;

/** Below this alpha nothing is on screen, so there is nothing to judge. */
const INVISIBLE_ALPHA = 0.08;

/** `#rgb`, `#rgba`, `#rrggbb`, `#rrggbbaa` → `[r, g, b, a]` in 0..1. */
function parseHex(value: string): [number, number, number, number] | null {
  const hex = value.slice(1);
  const short = hex.length === 3 || hex.length === 4;
  if (!short && hex.length !== 6 && hex.length !== 8) return null;

  const size = short ? 1 : 2;
  const channels: number[] = [];
  for (let i = 0; i < hex.length; i += size) {
    const chunk = hex.slice(i, i + size);
    const parsed = Number.parseInt(short ? chunk + chunk : chunk, 16);
    if (Number.isNaN(parsed)) return null;
    channels.push(parsed / 255);
  }
  return [channels[0], channels[1], channels[2], channels[3] ?? 1];
}

/**
 * Which tone family a colour belongs to, or `undefined` when the engine cannot
 * honestly say.
 *
 * Two readings, in order: the NUMBER when the colour is a hex the process can
 * actually see, and the NAME when it is a theme token it cannot. Anything else —
 * `transparent`, a gradient, an `rgb()` triple, a variable with no tone in its
 * name — is unclassifiable, and unclassifiable means silence: a convention rule
 * that guessed would indict a user over a colour nobody here can see.
 */
export function toneOf(value: string | undefined): ColourTone | undefined {
  if (!value) return undefined;
  const raw = value.trim().toLowerCase();
  if (raw === '' || raw === 'transparent') return undefined;

  if (raw.startsWith('#')) {
    const rgba = parseHex(raw);
    if (rgba === null) return undefined;
    const [r, g, b, a] = rgba;
    if (a < INVISIBLE_ALPHA) return undefined;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lightness = (max + min) / 2;
    const span = max - min;
    // Saturation of the HSL model, and the two ends of the lightness scale
    // where hue stops meaning anything at all.
    const saturation =
      span === 0 ? 0 : span / (1 - Math.abs(2 * lightness - 1));
    if (saturation < GREY_SATURATION || lightness < 0.06 || lightness > 0.96) {
      return 'grey';
    }

    let hue: number;
    if (max === r) hue = ((g - b) / span) % 6;
    else if (max === g) hue = (b - r) / span + 2;
    else hue = (r - g) / span + 4;
    hue = (hue * 60 + 360) % 360;

    for (const [limit, tone] of TONE_HUES) if (hue < limit) return tone;
    return 'red';
  }

  for (const [word, tone] of TONE_WORDS) if (raw.includes(word)) return tone;
  return undefined;
}

/**
 * The colour-bearing props the engine reads, duck-typed.
 *
 * Duck-typed for the same reason {@link elementPath} is: the engine must not
 * import a shape model, a text model or a connector model to answer a question
 * that is about pixels. An element that carries none of these has no colour to
 * be judged on and is skipped on the cheapest possible test.
 */
const COLOUR_PROPS = ['fillColor', 'strokeColor', 'color'] as const;

/**
 * Every string a `Color` value can present. A theme PAIR (`{ light, dark }`)
 * yields both members: they are one decision seen under two themes, and the
 * caller treats them as alternatives rather than as two separate colours.
 */
function colourStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value === null || typeof value !== 'object') return [];
  const out: string[] = [];
  for (const key of ['normal', 'light', 'dark']) {
    const member = (value as Record<string, unknown>)[key];
    if (typeof member === 'string') out.push(member);
  }
  return out;
}

/**
 * Whether this element is drawn in a tone the convention does not sanction.
 *
 * Per PROP, not per string: a `{ light, dark }` pair is ONE colour, so it
 * offends only when neither of its two members lands on a sanctioned tone. A
 * prop whose colour cannot be classified is skipped, and an element whose props
 * are all unclassifiable is never indicted.
 *
 * An unfilled shape's `fillColor` is deliberately ignored: it is stored, it is
 * not painted, and a rule about what the map LOOKS like has no business reading
 * a colour that is not on screen.
 */
function departsFromTones(
  el: GfxPrimitiveElementModel,
  allowed: ReadonlySet<ColourTone>
): boolean {
  const record = el as unknown as Record<string, unknown>;
  const filled = record['filled'];

  for (const prop of COLOUR_PROPS) {
    if (prop === 'fillColor' && filled === false) continue;

    let classified = false;
    let sanctioned = false;
    for (const raw of colourStrings(record[prop])) {
      const tone = toneOf(raw);
      if (tone === undefined) continue;
      classified = true;
      if (allowed.has(tone)) {
        sanctioned = true;
        break;
      }
    }
    if (classified && !sanctioned) return true;
  }
  return false;
}

/**
 * "Is this drawn in one of the tones the frame sanctions for it?" (PF13.8 / Q5)
 *
 * The sanctioned tones come from the FRAME's own palette, resolved through the
 * `@name` indirection every background label already uses — so the rule restates
 * no colour the background owns, and a host restyling the frame restyles the
 * convention with it. See {@link ToneConventionDef}.
 *
 * A rule whose named entries resolve to nothing classifiable warns once and
 * evaluates nothing: a convention with no reference colour is not a convention,
 * and indicting the whole board over a broken declaration is the one outcome
 * worse than silence.
 */
function evaluateToneConvention(
  rule: ValidationRule,
  elements: readonly GfxPrimitiveElementModel[]
): Violation[] {
  const subjectRole = rule.appliesTo;
  const tone = rule.tone;
  const def = rule.background;
  if (subjectRole === undefined || tone === undefined || def === undefined) {
    return [];
  }

  const palette = def.chrome?.palette;
  const allowed = new Set<ColourTone>();
  for (const name of tone.palette) {
    // Straight at the entry rather than through `backgroundColor('@name')`,
    // which answers a broken magenta for a name the palette does not carry —
    // and a magenta the rule never asked for would silently become a sanctioned
    // tone.
    const entry = palette?.[name];
    const classified = entry === undefined ? undefined : toneOf(entry);
    if (classified !== undefined) allowed.add(classified);
  }
  if (allowed.size === 0) {
    warnOnce(
      `tone-convention rule "${rule.id}" names no palette entry that resolves ` +
        `to a classifiable tone — it is not evaluated.`
 * The two ids a typed edge BINDS, or `null`.
 *
 * Duck-typed exactly like {@link elementPath}, and for the same reason: the
 * engine knows roles and geometry, and must not import a connector model. An
 * end holding a bare `position` and no `id` is bound to nothing.
 *
 * `null` is the ADR's own guard, and it is not marginal — releasing the link
 * tool over empty canvas produces such an edge at any time, and a palette
 * sample of a stroke style is one by construction. An edge that relates nothing
 * is never evaluated.
 */
function boundEnds(el: unknown): [string, string] | null {
  const edge = el as { source?: { id?: unknown }; target?: { id?: unknown } };
  const source = edge.source?.id;
  const target = edge.target?.id;
  if (typeof source !== 'string' || typeof target !== 'string') return null;
  // A self-loop states nothing about an order: it is one element, compared with
  // itself, and no move can ever resolve it.
  if (source === target) return null;
  return [source, target];
}

/**
 * "Are these two in the order their relation states?" — W4 (`docs/adr/0010`).
 *
 * The first family whose subject is a RELATION. For every element carrying the
 * declared edge role, the two elements it binds are projected onto one axis of
 * the frame and compared in the order the edge states: for
 * `wardley:dependency`, the source is the consumer and must sit higher on the
 * visibility axis than what it needs.
 *
 * The order comes from the persisted `source → target` pair, never from the
 * geometry — that is the whole point, and the reason this rule can fire at all.
 * Every other input is declaration: which axis, which way it runs, how much
 * slack, all read off the frame the framework already declares.
 *
 * ## What it stays silent about, and why each one matters
 *
 * - **no frame on the board** — nothing declares an axis, so there is no order
 *   to be in. A chain drawn on blank canvas is a sketch;
 * - **an edge with a free end** — it relates nothing (see {@link boundEnds});
 * - **an end whose element is gone** — a dangling id says nothing about a
 *   layout;
 * - **a pair straddling TWO frames** — "higher than" is a question inside one
 *   frame of reference, and two maps have two;
 * - **an edge carrying no role, or another role** — proportionality (PRD
 *   principle 8). A change arrow is oriented too and is not a dependency.
 *
 * ## Cost
 *
 * Linear in the EDGES: one pass to index the elements by id, one pass over the
 * edges, and two constant-time frame attributions per edge. There is no graph
 * closure and no pair-wise sweep — the rule is about a relation somebody drew,
 * never about every couple of nodes that could have had one. A cycle A→B→A is
 * two edges and is judged as two edges: at least one of them is against the
 * order, and that one is reported.
 */
function evaluateRelativeOrder(
  rule: ValidationRule,
  elements: readonly GfxPrimitiveElementModel[]
): Violation[] {
  const order = rule.relativeOrder;
  const def = rule.background;
  if (order === undefined || def === undefined) return [];

  const axis = backgroundAxisFact(def, order.axis);
  if (axis === undefined) {
    warnOnce(
      `relative-order rule "${rule.id}" measures along "${order.axis}", which ` +
        `its background does not declare — the rule is not evaluated.`
    );
    return [];
  }

  const backgrounds = backgroundsOf(rule, elements);
  const violations: Violation[] = [];
  for (const el of elements) {
    if (el.role === undefined) continue;
    if (!roleIsA(el.role, subjectRole, rule.roles)) continue;
    if (!departsFromTones(el, allowed)) continue;

    violations.push(
      raise(rule, [el.id], attributeBackground(el.elementBound, backgrounds)?.id)
    );
  }
  return violations;
}

/**
 * "Is most of what is on this map of one declared nature?" (PF13.8 / Q6)
 *
 * A remark about the MAP, so the finding names the BACKGROUND and nothing else:
 * no single element is at fault, and drawing a badge on one of two hundred
 * components would be an accusation aimed at a bystander.
 *
 * Counted PER MAP. A board carrying a map of activities beside a map of
 * practices holds two different answers, and a tally over the whole surface
 * would give both of them the wrong one.
 *
 * ## The gate
 *
 * A surface where NOT ONE subject carries the fact yields nothing, silently —
 * see {@link MajorityDef}. That is the state the Wardley `nature` is in today,
 * and the rule ships inert rather than waiting in a branch somewhere for
 * somebody to remember it.
 */
function evaluateMajorityFact(
  rule: ValidationRule,
  elements: readonly GfxPrimitiveElementModel[]
): Violation[] {
  const subjectRole = rule.appliesTo;
  const majority = rule.majority;
  if (subjectRole === undefined || majority === undefined) return [];

  const backgrounds = backgroundsOf(rule, elements);
  // No frame on the board: no map for the remark to be about.
  if (backgrounds.length === 0) return [];

  const tally = new Map<
    string,
    { subjects: number; known: number; matching: number }
  >();
  for (const el of elements) {
    if (el.role === undefined) continue;
    if (!roleIsA(el.role, subjectRole, rule.roles)) continue;

    const frame = attributeBackground(el.elementBound, backgrounds);
    if (frame === null) continue;
    let counts = tally.get(frame.id);
    if (counts === undefined) {
      counts = { subjects: 0, known: 0, matching: 0 };
      tally.set(frame.id, counts);
    }
    counts.subjects += 1;

    const fact = (el as unknown as Record<string, unknown>)[majority.fact];
    // Whatever a peer wrote, and whatever a framework has not written yet.
    if (typeof fact !== 'string' || fact === '') continue;
    counts.known += 1;
    if (fact === majority.value) counts.matching += 1;
  }

  const violations: Violation[] = [];
  // Sorted, so a board with two qualifying maps always reports them the same
  // way whichever order the surface happened to be walked in.
  for (const id of [...tally.keys()].sort()) {
    const counts = tally.get(id)!;
    // THE GATE: nothing here carries the fact, so there is no majority to be in.
    if (counts.known === 0) continue;
    // A strict majority of the SUBJECTS, not of the ones that happen to be
    // classified: half a map left unclassified is not a mandate.
    if (counts.matching * 2 <= counts.subjects) continue;
    violations.push(raise(rule, [id], id));
  // No frame, no frame of reference: a chain on blank canvas is a sketch.
  if (backgrounds.length === 0) return [];

  const byId = new Map<string, GfxPrimitiveElementModel>();
  const edges: GfxPrimitiveElementModel[] = [];
  for (const el of elements) {
    byId.set(el.id, el);
    // Cheapest possible exit for a neutral element: no role, no evaluation.
    if (el.role === undefined) continue;
    if (roleIsA(el.role, order.edgeRole, rule.roles)) edges.push(el);
  }
  if (edges.length === 0) return [];

  const horizontal = axis.orientation === 'horizontal';
  // How far along the axis' FORWARD sense a bound sits. One number, so the
  // comparison below reads the same whichever way the axis runs.
  const along = (bound: Bound): number => {
    const centre = centreOf(bound);
    return centre[0] * axis.forward[0] + centre[1] * axis.forward[1];
  };

  const violations: Violation[] = [];
  for (const edge of edges) {
    const ends = boundEnds(edge);
    if (ends === null) continue;
    const [sourceId, targetId] = ends;
    const source = byId.get(sourceId);
    const target = byId.get(targetId);
    if (source === undefined || target === undefined) continue;

    const sourceBound = source.elementBound;
    const targetBound = target.elementBound;
    const frame = attributeBackground(sourceBound, backgrounds);
    // Two maps, two frames of reference: the question does not arise.
    if (frame === null) continue;
    if (attributeBackground(targetBound, backgrounds)?.id !== frame.id) continue;

    const ahead = along(sourceBound) - along(targetBound);
    const expected = order.expect === 'source-ahead' ? ahead : -ahead;
    const span = horizontal ? frame.bound.w : frame.bound.h;
    const tolerance = (order.toleranceRatio ?? 0) * span;
    if (expected >= -tolerance) continue;

    violations.push(
      raise(rule, [edge.id, sourceId, targetId].sort(), frame.id)
    );
  }
  return violations;
}

/**
 * What a caller knows about a change, when it knows anything.
 *
 * `dirty` is every element id added, removed or updated since the findings in
 * `previous` were computed. Handed in only by the manager's debounced path,
 * where exactly that is known; every other caller — the first evaluation, a
 * gesture that must land immediately, the bench, a test — evaluates in full.
 *
 * Only {@link evaluateNoOverlap} honours it. The element-local families are
 * already constant per element and would gain nothing but a way to be subtly
 * wrong.
 */
export interface IncrementalContext {
  dirty: ReadonlySet<string>;
  previous: readonly Violation[];
}

const RULE_FAMILIES: Record<
  RuleFamily,
  (
    rule: ValidationRule,
    elements: readonly GfxPrimitiveElementModel[],
    incremental?: IncrementalContext
  ) => Violation[]
> = {
  'element-in-background': evaluateElementInBackground,
  'orientation-against-axis': evaluateOrientationAgainstAxis,
  attachment: evaluateAttachment,
  'no-overlap': evaluateNoOverlap,
  'tone-convention': evaluateToneConvention,
  'majority-fact': evaluateMajorityFact,
  'relative-order-along-axis': evaluateRelativeOrder,
};

/** A rule the drawing path evaluates. `moment` absent means `'realtime'`. */
function isRealtime(rule: ValidationRule): boolean {
  return (rule.moment ?? 'realtime') === 'realtime';
}

/** The exceptions an element carries, always an array, never a copy to keep. */
export function elementExceptions(
  element: GfxPrimitiveElementModel
): readonly ValidationException[] {
  const stored = element.validationExceptions;
  // The value comes out of a Y.Map, so it is whatever a peer wrote: a client
  // that got it wrong must not break evaluation on this one.
  return Array.isArray(stored) ? stored : [];
}

/** Whether `element` is excused from `ruleId`. */
export function hasException(
  element: GfxPrimitiveElementModel,
  ruleId: string
): boolean {
  return elementExceptions(element).some(
    exception => exception?.ruleId === ruleId
  );
}

/**
 * Stamp `exemption` on the findings a user exception already covers.
 *
 * Called only when a rule actually raised something, so a conformant board — the
 * common case, and the one the 16 ms budget is measured on — pays nothing at
 * all for the feature.
 */
function applyExceptions(
  rule: ValidationRule,
  raised: readonly Violation[],
  elements: readonly GfxPrimitiveElementModel[]
): void {
  const byId = new Map<string, GfxPrimitiveElementModel>();
  for (const el of elements) byId.set(el.id, el);

  const excused = (id: string | undefined) => {
    if (id === undefined) return false;
    const el = byId.get(id);
    return el !== undefined && hasException(el, rule.id);
  };

  for (const violation of raised) {
    // EVERY indicted element must be excused: a rule indicting two elements of
    // which only one is excused is still a live finding.
    const perElement = violation.elementIds.every(excused);
    // Narrower scope first, so revoking walks from the local decision outward
    // and each click visibly changes the state instead of doing nothing.
    if (perElement) violation.exemption = 'element';
    // ...and the map scope reads THIS finding's own background, never "some
    // background on the board carries the exception". An arbitration made on
    // one map says nothing about the map next to it.
    else if (excused(violation.backgroundId)) violation.exemption = 'map';
    // Nothing covers it (any more). Stamped rather than left alone because an
    // incremental pass CARRIES OVER finding objects from the last evaluation
    // (see {@link IncrementalContext}), and one that kept a stale `exemption`
    // would read as excused on a board where the exception has been revoked.
    else delete violation.exemption;
  }
}

/**
 * Run every rule over every element. Pure and synchronous — the unit of the
 * 16 ms budget (PF5.12), and the only thing the bench measures.
 *
 * `profiles` is the level of requirement in force (PF9). Omitted, every rule is
 * judged by its own declared severity, which is exactly what a framework
 * shipping no profile gets.
 *
 * `incremental` is what the caller knows about what CHANGED. Omitted — the
 * default, and what every test and the bench's full-evaluation case pass — the
 * whole surface is re-judged from scratch. Handed in, the pair-wise family
 * re-tests only the couples a change can have affected; the answer is the same,
 * it is just reached without walking the grid against itself.
 */
export function evaluateRules(
  rules: readonly ValidationRule[],
  elements: readonly GfxPrimitiveElementModel[],
  profiles: readonly ValidationProfile[] = [],
  incremental?: IncrementalContext
): Violation[] {
  return runRules(rules, elements, profiles, 'realtime', incremental);
}

/**
 * Run every rule of one MOMENT over every element. The body both
 * {@link evaluateRules} and {@link evaluateCheckup} are made of — one pipeline,
 * so a profile, an exception and a background attribution mean exactly the same
 * thing whichever moment a rule is declared at.
 *
 * The moment is tested INSIDE the loop rather than by filtering the array: one
 * property read per rule, no allocation, and the "an on-demand rule costs the
 * drawing path nothing" claim is true of every evaluation and not just of the
 * ones that bothered to filter.
 */
function runRules(
  rules: readonly ValidationRule[],
  elements: readonly GfxPrimitiveElementModel[],
  profiles: readonly ValidationProfile[],
  moment: ValidationMoment,
  incremental?: IncrementalContext
): Violation[] {
  if (rules.length === 0) return [];

  // No profile registered => not a single extra read on the whole surface.
  const index = profiles.length > 0 ? indexProfiles(profiles) : null;
  const chosen = index ? readChosenProfiles(elements) : null;

  const violations: Violation[] = [];
  for (const rule of rules) {
    // The other moment's rules are not this pass's business — checked FIRST,
    // so an on-demand rule never reaches a profile lookup, let alone an
    // element (PF5.14).
    if ((isRealtime(rule) ? 'realtime' : 'on-demand') !== moment) continue;
    // `'off'` everywhere means never walked: the cheapest exit there is, taken
    // before a single element is touched.
    if (index && chosen && isRuleSilent(rule, chosen, index)) continue;

    let raised = RULE_FAMILIES[rule.family](rule, elements, incremental);
    if (index && chosen && raised.length > 0) {
      raised = applyProfiles(rule, raised, chosen, index);
    }
    if (raised.length === 0) continue;

    // Exceptions are read LAST, and independently of the profile: an
    // arbitration a user made is theirs, and changing the level of requirement
    // never revokes one (PF9.3).
    applyExceptions(rule, raised, elements);
    violations.push(...raised);
  }
  return violations;
}

/** The registered rules a check-up runs — and nothing else ever evaluates. */
export function onDemandRules(
  rules: readonly ValidationRule[]
): readonly ValidationRule[] {
  return rules.filter(rule => !isRealtime(rule));
}

/**
 * Run the ON-DEMAND rules over the surface (PF5.14). The exact mirror of
 * {@link evaluateRules}, for the moment the drawing path never touches.
 *
 * Synchronous and total: this is what a test, a host and a report call. The
 * manager drives the same pipeline one rule at a time so a long check-up can
 * yield the thread — see {@link ValidationManager.runCheckup} — and both reach
 * the same answer, because both are {@link runRules}.
 *
 * The findings are ordinary {@link Violation} objects and go through the same
 * profile and exception passes as any other. What makes them REMARKS rather
 * than verdicts is where they land: they never reach `violations$`, so they
 * never reach the timeline, the bracket or the badge. A framework declares them
 * `audit` on top of that, which is the severity for "collected, invisible to the
 * drawing user" — belt and braces, and the braces are structural.
 */
export function evaluateCheckup(
  rules: readonly ValidationRule[],
  elements: readonly GfxPrimitiveElementModel[],
  profiles: readonly ValidationProfile[] = []
): Violation[] {
  return runRules(rules, elements, profiles, 'on-demand');
}

/**
 * One check-up, as the panel reads it: what it found, when it was asked for,
 * and how far it has got.
 *
 * ONE timestamp for the whole run, taken when the user asked — a single click is
 * a single question, whatever number of rules it happens to walk. The same rule
 * `setException` follows for an arbitration.
 *
 * Session state, never persisted: a document says what it contains, not when
 * somebody last looked at it.
 */
export interface CheckupRun {
  /**
   * The INSTANCE this run is about — the map the user asked about, and the only
   * one its remarks are allowed to be measured on.
   *
   * A check-up walks the whole surface, because that is where the elements are;
   * a board carries several maps, and without this the panel on one map would
   * confidently list the components of the one next to it, and a map nobody has
   * ever checked would show somebody else's timestamp. That is precisely the
   * "tally over the whole surface" {@link evaluateMajorityFact} refuses to
   * compute, reintroduced one layer up.
   *
   * The filter is applied in {@link ValidationManager.runCheckup}, on
   * {@link Violation.backgroundId} — recorded by every family that measures
   * against a frame — so `results` is already about this instance and nothing
   * downstream has to remember to narrow it.
   */
  backgroundId: string;
  /** Epoch ms, taken at the moment of the gesture. */
  at: number;
  /** The remarks so far — complete once {@link done} reaches {@link total}. */
  results: readonly Violation[];
  /** Rules evaluated so far. */
  done: number;
  /** Rules this run has to walk. `done < total` means it is still going. */
  total: number;
  /**
   * Set when a rule threw and the run stopped early.
   *
   * The run is still reported FINISHED (`done === total`), because the one thing
   * a failure must not do is leave the panel believing a check-up is in flight:
   * that reads as "Checking…" for ever and disables the only button that could
   * try again. A visible failure the user can retry beats a silent lock.
   */
  error?: true;
}

/**
 * How long a check-up may hold the thread before yielding it back.
 *
 * One frame, so a check-up that turns out to be expensive costs a dropped frame
 * at worst instead of a locked tab. A rule is the unit of interruption — the
 * smallest slice that has a meaning — so a single rule slower than this still
 * runs to completion and the next one waits for the following task.
 *
 * The rules shipped today cost well under a millisecond between them, so the
 * yield never fires in the delivered configuration — which would leave the
 * generation counter and the supersession path as code nothing reaches. It is
 * therefore a DEFAULT rather than a constant: {@link ValidationManager.checkupSliceMs}
 * is settable, and lowering it makes every rule a slice, which is how a test
 * exercises the yield and the race with the real rules instead of a stub.
 */
export const CHECKUP_SLICE_MS = 16;

/**
 * Grant `ruleId` an exception on `element`, unless it already has one.
 *
 * The write goes through the declared `@field()` accessor, so it lands in the
 * Y.Map, syncs to every peer, joins the undo stack and survives a copy — see the
 * note on `GfxPrimitiveElementModel.validationExceptions`.
 */
export function grantException(
  element: GfxPrimitiveElementModel,
  ruleId: string,
  author?: string,
  now: number = Date.now()
): void {
  if (hasException(element, ruleId)) return;
  element.validationExceptions = [
    ...elementExceptions(element),
    // The timestamp is taken at the moment of the gesture, and an absent author
    // stays ABSENT rather than becoming an empty string.
    { ruleId, at: now, ...(author !== undefined ? { author } : {}) },
  ];
}

/** Remove `ruleId`'s exception from `element`, if it has one. */
export function revokeException(
  element: GfxPrimitiveElementModel,
  ruleId: string
): void {
  const current = elementExceptions(element);
  const next = current.filter(exception => exception?.ruleId !== ruleId);
  if (next.length === current.length) return;

  if (next.length > 0) {
    element.validationExceptions = next;
    return;
  }
  // The last one goes, so the KEY goes. Assigning `undefined` through the
  // accessor would leave the key in the Y.Map holding an undefined value —
  // invisible through the getter, but synced to every peer and shipped in every
  // snapshot. `clearField` removes it, so an element whose exceptions were all
  // revoked really is indistinguishable from one that never had any, in the
  // document and not just in this tab.
  element.clearField('validationExceptions');
}

/** One stored exception, and the element it is actually written on. */
export interface AnchoredException {
  /** The element carrying the exception — a group member, or the element. */
  element: GfxPrimitiveElementModel;
  ruleId: string;
}

/**
 * The exceptions `element` ANSWERS FOR, i.e. the ones a menu on it should be
 * able to revoke.
 *
 * Same rule the canvas mark follows ({@link anchorOf}): an exception is
 * answered for by the outermost canvas group containing the element that
 * carries it, or by that element when it is not grouped. So the entry lives on
 * the whole Wardley component rather than on the bare node inside it, moves
 * down to the element the moment the group is dissolved, and appears on a
 * framework background for the map-wide arbitration it carries.
 *
 * Reads STORED exceptions, not current violations: an exception outlives the
 * violation that prompted it (move the component back onto the map and the
 * finding goes, the arbitration stays), and it is the arbitration the user is
 * asking to take back.
 */
export function exceptionsAnchoredOn(
  element: GfxPrimitiveElementModel,
  surface: SurfaceBlockModel
): AnchoredException[] {
  const candidates: GfxPrimitiveElementModel[] = [element];
  if (element instanceof GfxGroupLikeElementModel) {
    for (const descendant of element.descendantElements) {
      if (descendant instanceof GfxPrimitiveElementModel) {
        candidates.push(descendant);
      }
    }
  }

  const anchored: AnchoredException[] = [];
  for (const candidate of candidates) {
    const exceptions = elementExceptions(candidate);
    if (exceptions.length === 0) continue;
    // Anything whose anchor is somebody else belongs to somebody else's menu —
    // that is what keeps the entry on the outermost group and off its members.
    if (anchorOf(candidate.id, surface)?.id !== element.id) continue;
    for (const exception of exceptions) {
      if (exception?.ruleId) {
        anchored.push({ element: candidate, ruleId: exception.ruleId });
      }
    }
  }
  return anchored;
}

/** One rule's arbitration taken back, as reported to telemetry. */
export interface RevokedException {
  ruleId: string;
  framework: string;
  scope: ExemptionScope;
  /** How many elements the single gesture wrote to. */
  elementCount: number;
}

/** A framework registers its rules here; nothing else registers rules. */
export const ValidationRuleIdentifier =
  createIdentifier<ValidationRule>('ValidationRule');

/**
 * Register a framework's rules. Call it from the FLAG-GATED view extension —
 * validation is tooling, so a disabled framework must contribute nothing.
 *
 * ```ts
 * context.register(ValidationRuleExtension(WARDLEY_RULES));
 * ```
 */
export function ValidationRuleExtension(
  rules: readonly ValidationRule[]
): ExtensionType {
  return {
    setup: di => {
      for (const rule of rules) {
        di.addImpl(ValidationRuleIdentifier(rule.id), () => rule);
      }
    },
  };
}

/** A framework registers its profiles here; nothing else registers profiles. */
export const ValidationProfileIdentifier =
  createIdentifier<ValidationProfile>('ValidationProfile');

/**
 * Register a framework's profiles. Call it from the FLAG-GATED view extension,
 * beside {@link ValidationRuleExtension}: a level of requirement is tooling, so
 * a disabled framework offers none — and the id already written on a background
 * simply goes unread until the flag comes back.
 *
 * ```ts
 * context.register(ValidationProfileExtension(WARDLEY_PROFILES));
 * ```
 */
export function ValidationProfileExtension(
  profiles: readonly ValidationProfile[]
): ExtensionType {
  return {
    setup: di => {
      for (const profile of profiles) {
        di.addImpl(ValidationProfileIdentifier(profile.id), () => profile);
      }
    },
  };
}

/** Recompute delay, so a drag re-evaluates once instead of once per frame. */
const VALIDATION_DELAY_MS = 120;

/**
 * Element props that can change a verdict. Everything else — `opacity` and the
 * other `@local()` fields, colours, labels — is ignored, so brushing a canvas
 * (`SpotlightManager` writes `opacity` on every element it dims) neither
 * re-evaluates the surface nor pushes the pending evaluation further away.
 */
export const VERDICT_PROPS = [
  'xywh',
  'rotate',
  'role',
  // The two ends of a typed edge ARE the relation's orientation since
  // `docs/adr/0010`, so re-pointing one — or reversing the edge, which writes
  // both — changes a verdict exactly as much as moving a node does. Without
  // these, an inversion would leave the finding on screen until the next
  // unrelated drag woke the engine.
  'source',
  'target',
  // A user exception changes a verdict as much as a move does: without this,
  // granting one on a peer's tab would leave the mark up until the next drag.
  'validationExceptions',
  // Changing the level of requirement re-judges everything measured against
  // this background (PF9). Written on a background, read for every finding
  // attributed to it — and, like an exception, it can be DELETED (choosing the
  // default back removes the key), which is why `touchesVerdict` reads
  // `oldValues` too.
  'validationProfile',
];

/**
 * Whether an `elementUpdated` payload can have changed a verdict.
 *
 * It has to read `oldValues` as well as `props`, because a Y.Map **delete**
 * fills only the former (`syncElementFromY` puts a key in `props` for `add` and
 * `update` only). `validationExceptions` is the first {@link VERDICT_PROPS}
 * entry whose normal life includes being removed — `xywh` and `rotate` are
 * never deleted, `role` is only ever added — so this branch had never been
 * exercised. Reading `props` alone means an UNDO of an exception, which deletes
 * the key, wakes nothing: the board keeps showing a finding as excused when the
 * document no longer says so, and its Revoke button becomes a no-op.
 *
 * A payload carrying neither is unreadable, so it counts as "might have": the
 * cost of a spurious re-evaluation is a debounce tick, the cost of a missed one
 * is a board that lies.
 */
export function touchesVerdict(payload: {
  props?: Record<string, unknown>;
  oldValues?: Record<string, unknown>;
}): boolean {
  const { props, oldValues } = payload;
  if (!props && !oldValues) return true;
  return VERDICT_PROPS.some(
    prop =>
      (props !== undefined && prop in props) ||
      (oldValues !== undefined && prop in oldValues)
  );
}

/** Shared answer for "this element is nobody's frame", allocated once. */
const EMPTY_FRAMEWORKS: ReadonlySet<string> = new Set<string>();

/**
 * Owns the evaluation and the reactive violation list. No-op until a framework
 * registers a rule.
 */
export class ValidationManager extends InteractivityExtension {
  static override key = 'validation-manager';

  /**
   * Current violations. The reactive seam a host panel (wave 2) subscribes to;
   * wave 1 ships only the canvas affordance.
   */
  readonly violations$ = signal<readonly Violation[]>([]);

  /**
   * Level 3 — what an AI audit reported, and ONLY that (PF14.1).
   *
   * A second signal rather than a marked subset of {@link violations$}, and the
   * reason is the invariant the whole audit seam exists to protect: **the
   * deterministic engine never depends on the AI**. Nothing in `evaluate()`
   * reads this signal, writes it or is slowed by it; nothing here is ever
   * recomputed, carried over by an incremental pass, or judged by a profile.
   * The 16 ms budget is measured on a function that cannot see this field.
   *
   * Merging the two lists and discriminating by severity would have been
   * cheaper to type and much more expensive to reason about: every consumer of
   * `violations$` — the overlay, the timeline, the bubble, the exception
   * toolbar, `userFacingViolations`, the incremental carry-over — would have
   * had to learn to skip entries it must never touch, and forgetting one of
   * them in some future slice would put a model's opinion behind a canvas
   * bracket. Two signals make that a type error instead of a review.
   *
   * The findings ARE violation objects (`AuditFinding` is assignable to
   * {@link Violation}, pinned by a test), so a host panel renders them with the
   * code it already has. They are session state, never persisted: an audit is
   * an opinion at a moment, and the document says what it contains, not what a
   * model thought of it on Tuesday.
   */
  readonly auditFindings$ = signal<readonly AuditFinding[]>([]);

  /**
   * Publish an audit's results. The ONLY writer of {@link auditFindings$}, and
   * deliberately dumb: it stores, it does not evaluate, re-judge or merge.
   *
   * Replaces rather than appends — a run's findings are a whole answer about
   * the board as it was, so accumulating two runs would show a user a
   * contradiction and call it a list.
   */
  setAuditFindings(findings: readonly AuditFinding[]): void {
    this.auditFindings$.value = findings;
  }

  /**
   * Which violations are still FRESH, i.e. still owed the loud bracket.
   *
   * It lives here rather than inside the overlay because the affordance has two
   * halves on two different technologies — a canvas bracket that fades, and a
   * DOM badge that takes over — and they are mutually exclusive: the badge
   * appears only once the bracket is fully gone. Two copies of "when did I
   * first see this" would drift, and the handover would show both at once or
   * neither.
   *
   * Session state, never persisted: a document says which rules it breaks, not
   * when you happened to look at them.
   */
  readonly timeline = new ViolationTimeline();

  /**
   * The last check-up (PF5.14), or `null` while none has been asked for.
   *
   * A SEPARATE signal from {@link violations$}, and that separation is the whole
   * design: a remark never reaches the timeline, the bracket or the badge,
   * because it never reaches the list those three read. "Outside the canvas
   * affordance" is therefore a property of the wiring, not a filter somebody has
   * to remember to apply.
   *
   * Reset to `null` on unmount and never persisted: a document says what it
   * contains, not when somebody last checked it.
   */
  readonly checkup$ = signal<CheckupRun | null>(null);

  /**
   * The element whose Map quality panel is OPEN, or `null` — the seam between
   * the toolbar entry that asks for it (`validation-toolbar.ts`, PF7.11) and the
   * widget that draws it.
   *
   * A signal rather than a DOM call because the two live in different trees: the
   * entry is a lit template inside `editor-menu-button`'s shadow root, and the
   * panel is a widget on the root block. Session state, like every other "what
   * is open" in this file.
   */
  readonly mapQualityFor$ = signal<string | null>(null);

  private _pending: ReturnType<typeof setTimeout> | null = null;

  /**
   * Bumped by every {@link runCheckup}, so a run that yielded the thread can
   * tell it has been superseded and drop its partial results on the floor
   * instead of overwriting a newer answer.
   */
  private _checkupGeneration = 0;

  /**
   * How long {@link runCheckup} may hold the thread between two rules.
   *
   * Settable rather than fixed so the interruption and the supersession are
   * TESTABLE with the rules a framework actually ships: at the shipped default
   * the Wardley check-up costs half a millisecond and never yields, which would
   * leave the whole race path unreached by anything. Dropped to zero, every rule
   * becomes a slice.
   */
  checkupSliceMs = CHECKUP_SLICE_MS;

  /**
   * Element ids added, removed or updated since the last verdict — the dirty
   * set of PF5.13. Filled by the subscriptions, drained by every evaluation.
   */
  private _dirty = new Set<string>();

  /** Whether {@link violations$} holds a verdict a dirty set can build on. */
  private _evaluated = false;

  /**
   * The ids that were framework BACKGROUNDS at the last evaluation.
   *
   * `no-overlap` already sends the surface back through a full sweep when a
   * frame is touched, and it finds a DELETED one by looking for its id in the
   * previous findings — the only trace a departed element leaves. That trace
   * does not exist when the frame's profile put the rule on `'off'`: the
   * findings measured against it were dropped by `applyProfiles`, so `previous`
   * is empty, the deletion looks like an ordinary one, and the overlap that
   * comes back to life under the default profile is never reported. No family
   * can close that hole — an element that is gone from the surface AND absent
   * from the findings is invisible to everything except a memory of it.
   *
   * So the manager keeps that memory. A dirty id that used to be a background
   * forces the full pass, whatever the previous findings say or fail to say —
   * which makes `incremental === full` true by construction rather than by the
   * luck of no shipped profile using `'off'` yet.
   */
  private _backgrounds: ReadonlySet<string> = new Set();

  private _rules: readonly ValidationRule[] | null = null;

  /** Registered rules, resolved once. Empty when every framework is flagged off. */
  private get _activeRules(): readonly ValidationRule[] {
    this._rules ??= Array.from(
      this.std.provider.getAll(ValidationRuleIdentifier).values()
    );
    return this._rules;
  }

  private _nudges: readonly QualityNudge[] | null = null;

  /**
   * Registered nudges, resolved once. Empty when no framework ships one, or
   * when every framework is flagged off.
   */
  private get _activeNudges(): readonly QualityNudge[] {
    this._nudges ??= Array.from(
      this.std.provider.getAll(QualityNudgeIdentifier).values()
    );
    return this._nudges;
  }

  private _profiles: readonly ValidationProfile[] | null = null;

  /**
   * Registered profiles, resolved once. Empty when no framework ships one, in
   * which case every rule is judged by its own declared severity.
   */
  private get _activeProfiles(): readonly ValidationProfile[] {
    this._profiles ??= Array.from(
      this.std.provider.getAll(ValidationProfileIdentifier).values()
    );
    return this._profiles;
  }

  private _subscriptions: { unsubscribe(): void }[] = [];

  private _disposeSurfaceEffect: (() => void) | null = null;

  private get _overlay(): ValidationOverlay | null {
    return this.std.getOptional(
      OverlayIdentifier(ValidationOverlay.overlayName)
    ) as ValidationOverlay | null;
  }

  override mounted() {
    // Flag off (no rule registered) => never subscribe, never evaluate.
    // The cost of validation on a board with no framework enabled is this
    // single length check, once.
    if (this._activeRules.length === 0) return;

    // The surface is a SIGNAL, not a fact: it can legitimately be null at
    // mount and arrive later, and it is replaced if the surface block is. A
    // one-shot peek here would leave validation silently dead for the whole
    // session — hence tracking it rather than reading it once.
    this._disposeSurfaceEffect = effect(() => {
      this._resubscribe(this.gfx.surface$.value);
    });
  }

  override unmounted() {
    if (this._pending) clearTimeout(this._pending);
    this._pending = null;
    this._disposeSurfaceEffect?.();
    this._disposeSurfaceEffect = null;
    this._unsubscribe();
    this._dirty.clear();
    this._evaluated = false;
    this._backgrounds = new Set();
    this.timeline.clear();
    // Supersede any check-up still yielding between two rules, and forget the
    // last one: both are session state, and a stale answer outliving the
    // surface it was measured on is a panel that lies.
    this._checkupGeneration += 1;
    this.checkup$.value = null;
    this.mapQualityFor$.value = null;
    // Session state, and the session is over. An audit describes a board at a
    // moment; carrying one across a remount would show it against a different
    // surface (PF14.1).
    this.auditFindings$.value = [];
    super.unmounted();
  }

  private _unsubscribe() {
    for (const subscription of this._subscriptions) subscription.unsubscribe();
    this._subscriptions = [];
  }

  private _resubscribe(surface: SurfaceBlockModel | null) {
    this._unsubscribe();
    if (!surface) return;

    this._subscriptions.push(
      surface.elementAdded.subscribe(({ id }) => this._schedule(id))
    );
    this._subscriptions.push(
      surface.elementRemoved.subscribe(({ id }) => {
        // A check-up measured on a map that no longer exists is an answer about
        // nothing. The panel is closed by then (the widget watches the same
        // signal), but the result would otherwise sit in memory waiting to be
        // shown against whatever the user opens next.
        this._forgetCheckupOf(id);
        this._schedule(id);
      })
    );
    this._subscriptions.push(
      surface.elementUpdated.subscribe(payload => {
        // A prop that cannot change a verdict must not even rearm the timer.
        if (!touchesVerdict(payload)) return;
        this._schedule(payload.id);
      })
    );
    // A new surface knows nothing about the last one: judge it in full.
    this.evaluate();
  }

  private _schedule(id: string) {
    this._dirty.add(id);
    if (this._pending) clearTimeout(this._pending);
    this._pending = setTimeout(() => {
      this._pending = null;
      this.evaluate(true);
    }, VALIDATION_DELAY_MS);
  }

  /**
   * Evaluate now. Exposed so a host (and the bench) can drive it directly.
   *
   * `incremental` is the DEBOUNCED path's privilege and nobody else's: it is
   * the only caller that knows exactly which elements moved since the last
   * verdict. Everything else — a gesture that must land on the spot, a surface
   * arriving, a host asking — pays for a full pass, because a full pass is
   * always right and a wrong dirty set is a board that lies.
   */
  evaluate(incremental = false) {
    const rules = this._activeRules;
    const surface = this.gfx.surface;
    // Whatever happens below, what accumulated is now accounted for: a dirty
    // set left behind would be replayed against a later, unrelated snapshot.
    const dirty = this._dirty;
    this._dirty = new Set();
    if (rules.length === 0 || !surface) return;

    const previous = this.violations$.peek();
    // A frame that WAS there and is now dirty invalidates attributions no
    // pair-wise re-test would reach — including, when its profile silenced the
    // rule, findings that were never recorded for the family to find.
    const frameTouched = [...dirty].some(id => this._backgrounds.has(id));
    const violations = evaluateRules(
      rules,
      surface.elementModels,
      this._activeProfiles,
      incremental && this._evaluated && dirty.size > 0 && !frameTouched
        ? { dirty, previous }
        : undefined
    );
    this._evaluated = true;
    this._backgrounds = backgroundElementIds(rules, surface.elementModels);
    // Stay silent when nothing changed: `violations$` is the seam a host panel
    // subscribes to, and a clean board must not wake it on every debounce tick.
    if (violations.length === 0 && this.violations$.peek().length === 0) return;

    // Age the marks BEFORE waking anybody, so the canvas half and the DOM half
    // read the same clock within one evaluation and never disagree about which
    // of the two markers is due.
    //
    // Exempted findings are dropped HERE and only here: `violations$` keeps
    // them, so the bubble and a host panel see the full picture, while the
    // flash and the bracket see only what is still asking for something.
    const shown = liveViolations(userFacingViolations(violations));
    this.timeline.sync(shown, performance.now());

    this.violations$.value = violations;
    this._overlay?.setViolations(shown, this.timeline);
  }

  /** The registered rule with this id, if its framework is enabled. */
  ruleOf(ruleId: string): ValidationRule | undefined {
    return this._activeRules.find(rule => rule.id === ruleId);
  }

  /**
   * The profiles selectable on `element`, i.e. those of every framework that
   * measures against a background carrying this element's ROLE.
   *
   * Derived from the registered rules rather than from a second registry: a
   * rule already names the role of the frame it measures against
   * (`backgroundRole`), which is the only thing that makes an element a root
   * instance in the engine's eyes. So the answer is gated for free — flag off,
   * no rule, no profile offered — and a framework that ships profiles but no
   * rule offers nothing to choose between, correctly.
   *
   * Empty for a neutral element, and for a background authored before its role
   * existed: no role, no framework, no profile.
   */
  profilesFor(
    element: GfxPrimitiveElementModel
  ): readonly ValidationProfile[] {
    const frameworks = this.frameworksOf(element);
    if (frameworks.size === 0) return [];

    return this._activeProfiles.filter(profile =>
      frameworks.has(profile.framework)
    );
  }

  /**
   * The frameworks `element` is a ROOT INSTANCE of, i.e. those with a registered
   * rule measuring against a background carrying this element's role.
   *
   * The one test that decides whether an element is a framework's frame, and the
   * only one: it is derived from the registered rules rather than from a second
   * registry, so it is gated for free — flag off, no rule, no framework — and
   * every per-instance surface (the profile picker, the nudge checklist, the
   * check-up) agrees about what a root instance is without any of them saying so
   * twice.
   *
   * Empty for a neutral element, and for a background authored before its role
   * existed.
   */
  frameworksOf(element: GfxPrimitiveElementModel): ReadonlySet<string> {
    const role = element.role;
    if (role === undefined) return EMPTY_FRAMEWORKS;

    const frameworks = new Set<string>();
    for (const rule of this._activeRules) {
      if (rule.backgroundRole === undefined) continue;
      if (roleIsA(role, rule.backgroundRole, rule.roles)) {
        frameworks.add(rule.framework);
      }
    }
    return frameworks;
  }

  /**
   * The nudges offered on `element` (PF7.10), in declared order.
   *
   * Same derivation as {@link profilesFor} and gated the same way: a framework
   * that registers no nudge — or whose flag is off — offers none, and the ids
   * already ticked on the element stay written, unread, until it comes back.
   */
  nudgesFor(element: GfxPrimitiveElementModel): readonly QualityNudge[] {
    const frameworks = this.frameworksOf(element);
    if (frameworks.size === 0) return [];

    return this._activeNudges
      .filter(nudge => frameworks.has(nudge.framework))
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  }

  /** The on-demand rules a check-up on `element` would walk (PF5.14). */
  checkupRulesFor(
    element: GfxPrimitiveElementModel
  ): readonly ValidationRule[] {
    const frameworks = this.frameworksOf(element);
    if (frameworks.size === 0) return [];
    return onDemandRules(this._activeRules).filter(rule =>
      frameworks.has(rule.framework)
    );
  }

  /**
   * Whether `element` has a Map quality panel to open at all: a framework of
   * its own declaring a nudge or an on-demand rule.
   *
   * Generic by construction (PF7.11) — nothing here names a framework. A second
   * framework shipping either gets the entry, the panel and the check-up with
   * no code written anywhere.
   */
  hasMapQuality(element: GfxPrimitiveElementModel): boolean {
    return (
      this.nudgesFor(element).length > 0 ||
      this.checkupRulesFor(element).length > 0
    );
  }

  /**
   * Open the Map quality panel on `element`; the widget draws it.
   *
   * Opening on a DIFFERENT instance forgets the last check-up. The panel already
   * refuses to render a run belonging to another map ({@link CheckupRun.backgroundId}),
   * so this is not what makes the display correct — it is what stops a result
   * measured on a map the user has moved on from (or deleted) sitting in memory
   * waiting to be shown again. Reopening on the SAME map keeps its stamp, which
   * is the one case where "last check-up: 01:51" is worth reading.
   */
  openMapQuality(element: GfxPrimitiveElementModel): void {
    this._forgetCheckupOf(element.id, true);
    this.mapQualityFor$.value = element.id;
  }

  closeMapQuality(): void {
    this.mapQualityFor$.value = null;
  }

  /**
   * Drop the current check-up when it is about `backgroundId` — or, with
   * `unless`, when it is about anything else.
   *
   * The two callers are the two ways a run stops being about something the user
   * can look at: the instance it measured was deleted, and the panel moved to a
   * different instance.
   */
  private _forgetCheckupOf(backgroundId: string, unless = false): void {
    const run = this.checkup$.peek();
    if (run === null) return;
    if ((run.backgroundId === backgroundId) !== unless) {
      this.checkup$.value = null;
    }
  }

  /**
   * Run the check-up on `element` (PF5.14).
   *
   * ## It is about ONE instance
   *
   * The walk covers the whole surface — that is where the elements are — but the
   * ANSWER is narrowed to the map that was asked about, on
   * {@link Violation.backgroundId}, which every family measuring against a frame
   * already records. A board carrying two Wardley maps holds two independent
   * answers, and handing the panel a tally over both would be exactly the
   * whole-surface count {@link evaluateMajorityFact} goes out of its way not to
   * compute. Narrowed HERE and not at the rendering: a run that reaches a host,
   * a report or the agent has to already be about one map.
   *
   * ## Why this is async, for two rules that take a microsecond
   *
   * Because the moment exists precisely so that a framework may ship a control
   * that does NOT fit a frame. A check-up walks the surface with no dirty set
   * and no budget over its head, and the honest way to offer that is to be
   * interruptible: the driver evaluates ONE RULE at a time — the smallest slice
   * that has a meaning — and yields the thread whenever the slice has held it
   * for {@link checkupSliceMs}. The panel sees `done` climb towards `total`, so
   * progress is the same value the results arrive in and there is no second
   * signal to keep in step.
   *
   * A run started while another is still yielding SUPERSEDES it: the older one
   * notices its generation is stale on its next slice and drops what it had.
   * Clicking twice therefore gives the second answer, never a race between two.
   *
   * ## A rule that throws
   *
   * ...ends the run, visibly. The failure must not leave the panel believing a
   * check-up is in flight — that reads as "Checking…" for ever and disables the
   * one button that could try again, on every map, until the editor is
   * remounted. So the run is finished with {@link CheckupRun.error} and whatever
   * it had managed to collect.
   *
   * @returns the finished run, or `null` if it was superseded or there was
   * nothing to run.
   */
  async runCheckup(
    element: GfxPrimitiveElementModel
  ): Promise<CheckupRun | null> {
    const rules = this.checkupRulesFor(element);
    const generation = ++this._checkupGeneration;
    const backgroundId = element.id;
    if (rules.length === 0) {
      this.checkup$.value = null;
      return null;
    }

    const at = Date.now();
    const results: Violation[] = [];
    const total = rules.length;
    let sliceStart = performance.now();
    this.checkup$.value = { backgroundId, at, results: [], done: 0, total };

    for (let i = 0; i < total; i++) {
      // The surface is re-read on every slice: the user can keep drawing while
      // this runs, and a rule must be judged against the board as it is now,
      // not against a snapshot taken before the last yield.
      const surface = this.gfx.surface;
      if (!surface || generation !== this._checkupGeneration) return null;

      try {
        for (const remark of evaluateCheckup(
          [rules[i]],
          surface.elementModels,
          this._activeProfiles
        )) {
          // This map's remarks, and only this map's. A family that measures
          // against no frame records no `backgroundId` and is dropped: it has
          // said nothing about the instance the user is looking at.
          if (remark.backgroundId === backgroundId) results.push(remark);
        }
      } catch (error) {
        console.error(`[validation] check-up rule "${rules[i].id}" threw`, error);
        const failed: CheckupRun = {
          backgroundId,
          at,
          results: [...results],
          // Finished, deliberately: see the note above. A locked button is a
          // worse failure than a reported one.
          done: total,
          total,
          error: true,
        };
        this.checkup$.value = failed;
        return failed;
      }

      this.checkup$.value = {
        backgroundId,
        at,
        results: [...results],
        done: i + 1,
        total,
      };

      if (
        i + 1 < total &&
        performance.now() - sliceStart > this.checkupSliceMs
      ) {
        // Back of the queue, so paint and input go first. `setTimeout(0)` and
        // not a microtask: a microtask would yield the call stack and nothing
        // else, which is exactly the freeze this exists to avoid.
        await new Promise(resolve => setTimeout(resolve, 0));
        sliceStart = performance.now();
      }
    }

    return generation === this._checkupGeneration
      ? this.checkup$.peek()
      : null;
  }

  /**
   * The profile `element` is actually checked against — the one it names, or
   * its framework's default. `undefined` when it is not a root instance of any
   * enabled framework, or when its framework ships no profile.
   */
  profileOf(
    element: GfxPrimitiveElementModel
  ): ValidationProfile | undefined {
    const available = this.profilesFor(element);
    const named = available.find(
      profile => profile.id === element.validationProfile
    );
    if (named) return named;
    const framework = available[0]?.framework;
    return framework === undefined
      ? undefined
      : defaultProfileOf(available, framework);
  }

  /**
   * Put `element` on `profileId`, and re-judge the board on the spot.
   *
   * Choosing the DEFAULT clears the key rather than writing it, so a background
   * that never left the default stays byte-identical to one created before
   * profiles existed — and a user who tries strict and comes back leaves no
   * trace. Everything else is one flat string in the same `@field()` the role
   * and the exceptions live in: it syncs, it undoes, it survives a copy and an
   * export, with no block schema change.
   *
   * Exceptions are deliberately left alone. A level of requirement is not an
   * amnesty: raising it must not resurrect decisions the user made, and
   * lowering it must not quietly delete them (PF9.3).
   *
   * @returns whether the document actually changed.
   */
  setProfile(element: GfxPrimitiveElementModel, profileId: string): boolean {
    // The write below goes through a `@field()` accessor, i.e. `store.transact`,
    // which has no readonly guard of its own. A readonly board arbitrates
    // nothing — and `false` keeps the caller's telemetry silent too.
    if (this.std.store.readonly) return false;
    const available = this.profilesFor(element);
    const target = available.find(profile => profile.id === profileId);
    // Never write a profile nobody registered, nor one belonging to a framework
    // this element is not a background of.
    if (!target) return false;

    const isDefault =
      defaultProfileOf(available, target.framework)?.id === target.id;
    const next = isDefault ? undefined : target.id;
    if ((element.validationProfile ?? undefined) === next) return false;

    if (next === undefined) element.clearField('validationProfile');
    else element.validationProfile = next;

    // The 120 ms debounce would get there on its own; the gesture has to land
    // immediately, exactly like an exception does.
    this.evaluate();
    return true;
  }

  /**
   * Which elements an exception of the given scope is written on.
   *
   * `element` — the elements the rule actually indicts, which is what makes the
   * exception local (PF8.2): excusing one component says nothing about the next.
   *
   * `map` — the background element these findings were MEASURED AGAINST, and
   * only that one. It comes from {@link Violation.backgroundId}, recorded by the
   * rule family when it picked the frame, so a board carrying three maps holds
   * three independent arbitrations and a gesture made on one writes on one.
   * That choice is what lets a map-wide arbitration exist with NO block schema
   * change and no hidden per-document store: it is one more value in the same
   * `@field()`, on an element that is selected, copied, exported and deleted
   * like any other. A family that measures against no background records no
   * `backgroundId`, has no map to hang an exception on, and offers no map scope.
   */
  private _targetsOf(
    violations: readonly Violation[],
    scope: ExemptionScope,
    surface: SurfaceBlockModel
  ): GfxPrimitiveElementModel[] {
    const ids =
      scope === 'map'
        ? new Set(
            violations
              .map(violation => violation.backgroundId)
              .filter((id): id is string => id !== undefined)
          )
        : new Set(violations.flatMap(violation => violation.elementIds));

    return Array.from(ids)
      .map(id => surface.getElementById(id))
      .filter((el): el is GfxPrimitiveElementModel => el !== null);
  }

  /**
   * Grant or revoke `ruleId`'s exception at `scope`, over the elements the given
   * violations indict.
   *
   * Takes the whole set rather than one violation on purpose: a Wardley
   * component is a GROUP, so one bubble line can stand for several indicted
   * members, and one click has to settle all of them.
   *
   * Re-evaluates on the spot instead of waiting for the 120 ms debounce the
   * field write would trigger anyway — the gesture must apply immediately
   * (PF8.1).
   *
   * @returns the elements actually written to, so the caller can tell a real
   * arbitration from a no-op and only report the former.
   */
  setException(
    violations: readonly Violation[],
    scope: ExemptionScope,
    granted: boolean,
    author?: string
  ): GfxPrimitiveElementModel[] {
    // Same transact hole as `setProfile`; an empty return is what keeps the
    // bubble from emitting Granted/Revoked telemetry for a write that never
    // happened.
    if (this.std.store.readonly) return [];
    const ruleId = violations[0]?.ruleId;
    const surface = this.gfx.surface;
    if (ruleId === undefined || !surface) return [];
    // Never write an exception for a rule nobody registered: with the framework
    // flagged off there is no rule to arbitrate on.
    if (!this.ruleOf(ruleId)) return [];

    const targets = this._targetsOf(violations, scope, surface).filter(
      element => hasException(element, ruleId) !== granted
    );
    if (targets.length === 0) return [];

    // One timestamp for the whole gesture: a single click is a single decision,
    // whatever number of elements it happens to touch.
    const at = Date.now();
    for (const element of targets) {
      if (granted) grantException(element, ruleId, author, at);
      else revokeException(element, ruleId);
    }

    this.evaluate();
    return targets;
  }

  /**
   * The exceptions on `element` that can still be taken back — those it answers
   * for ({@link exceptionsAnchoredOn}) whose rule is actually REGISTERED.
   *
   * The rule filter is what makes the menu entry disappear with the framework:
   * flag off, no rule reaches the container, so there is nothing to arbitrate
   * on and nothing to offer. The exceptions themselves are untouched — they are
   * document data and outlive the tooling (PF8.6).
   */
  revocableExceptionsOn(
    element: GfxPrimitiveElementModel
  ): AnchoredException[] {
    const surface = this.gfx.surface;
    if (!surface) return [];
    return exceptionsAnchoredOn(element, surface).filter(
      ({ ruleId }) => this.ruleOf(ruleId) !== undefined
    );
  }

  /**
   * Take back every exception `element` answers for, in one gesture.
   *
   * @returns one entry per (rule, scope) actually written, so the caller can
   * report the arbitration and tell a real one from a no-op.
   */
  revokeExceptionsOn(element: GfxPrimitiveElementModel): RevokedException[] {
    // Same transact hole as `setProfile`, same telemetry contract: no entry
    // returned, nothing reported.
    if (this.std.store.readonly) return [];
    const anchored = this.revocableExceptionsOn(element);
    if (anchored.length === 0) return [];

    const reported = new Map<string, RevokedException>();
    for (const { element: target, ruleId } of anchored) {
      const rule = this.ruleOf(ruleId);
      if (!rule) continue;
      revokeException(target, ruleId);

      // An exception written on the framework's own background IS the map-wide
      // one — the same test `applyExceptions` uses to read it back.
      const scope: ExemptionScope =
        rule.backgroundRole !== undefined &&
        target.role !== undefined &&
        roleIsA(target.role, rule.backgroundRole, rule.roles)
          ? 'map'
          : 'element';

      const key = `${ruleId}|${scope}`;
      const entry = reported.get(key);
      if (entry) entry.elementCount += 1;
      else {
        reported.set(key, {
          ruleId,
          framework: rule.framework,
          scope,
          elementCount: 1,
        });
      }
    }

    this.evaluate();
    return Array.from(reported.values());
  }
}

/**
 * Where a mark is DRAWN for one violating element: the outermost canvas group
 * containing it, or the element itself when it is not grouped.
 *
 * A RENDERING decision, not a semantic one. The violation object keeps naming
 * the elements actually at fault (`elementIds`); the group never appears in it,
 * is never evaluated, and carries no role. This exists because a mark drawn on
 * a lone member — a Wardley component is a group of {node, label} — collides
 * with the group's own selection rect and becomes unreadable.
 *
 * Frames are deliberately skipped: they are group-compatible BLOCKS and appear
 * in the group chain, but framing a whole frame would be a wild over-reach.
 */
function anchorOf(elementId: string, surface: SurfaceBlockModel) {
  const element = surface.getElementById(elementId);
  if (!element) return null;

  // `getGroups` walks outward, so the last CANVAS group is the outermost one.
  const canvasGroups = surface
    .getGroups(elementId)
    .filter(group => group instanceof GfxGroupLikeElementModel);
  return canvasGroups[canvasGroups.length - 1] ?? element;
}

/**
 * One anchor and everything reported against it: where to draw, and what the
 * detail bubble has to list when the badge on it is clicked.
 */
export interface ViolationAnchor {
  /** The element the mark is drawn on — the outermost group, or the element. */
  id: string;
  bound: Bound;
  violations: Violation[];
}

/**
 * Group violations by the anchor their mark is drawn on — one entry per
 * anchor, so several violating members of the same group share a single
 * bracket, a single badge and a single bubble.
 *
 * Pure and stateless, and called at paint time by both halves of the
 * affordance, so the mark follows a group that moves and falls back onto the
 * element the moment the group is dissolved, with nothing to invalidate.
 */
export function resolveViolationAnchors(
  violations: readonly Violation[],
  surface: SurfaceBlockModel
): ViolationAnchor[] {
  const anchors = new Map<string, ViolationAnchor>();

  for (const violation of violations) {
    for (const id of violation.elementIds) {
      const anchor = anchorOf(id, surface);
      if (!anchor) continue;

      let entry = anchors.get(anchor.id);
      if (!entry) {
        entry = { id: anchor.id, bound: anchor.elementBound, violations: [] };
        anchors.set(anchor.id, entry);
      }
      // A single violation naming two members of one group resolves to that
      // group twice and must be recorded once. Two SEPARATE violations of the
      // same rule stay separate here — collapsing what is DISPLAYED is the
      // bubble's call, not this function's.
      if (!entry.violations.includes(violation)) {
        entry.violations.push(violation);
      }
    }
  }

  return Array.from(anchors.values());
}

/**
 * Violations the drawing user is meant to SEE. `audit` is collected for
 * reporting and stays invisible on the canvas — that is what the severity
 * means (see {@link ViolationSeverity}), and the UI is the only place that can
 * honour it: the engine reports everything, unfiltered, to the host panel.
 */
export function userFacingViolations(
  violations: readonly Violation[]
): Violation[] {
  return violations.filter(violation => violation.severity !== 'audit');
}

/**
 * Violations still asking for something, i.e. not covered by an exception.
 *
 * This is the whole of PF8's canvas behaviour: an exempted finding is dropped
 * from the timeline, so it never flashes, and from the overlay, so it carries no
 * bracket. It keeps its badge and its line in the bubble, where it reads as
 * "exception" and can be revoked — the state changed, the finding did not
 * disappear.
 */
export function liveViolations(violations: readonly Violation[]): Violation[] {
  return violations.filter(violation => violation.exemption === undefined);
}

/**
 * One violation per RULE, first occurrence wins.
 *
 * What a detail bubble renders is rule-level — a label, a severity, a hint —
 * so two components of the same group both drawn off the map, which are two
 * violations, would produce the same sentence twice. The engine is right to
 * report both (it names the elements); a list that repeats itself is just
 * noise. Which member moved is on the canvas, not in a list.
 */
export function distinctByRule(violations: readonly Violation[]): Violation[] {
  const byRule = new Map<string, Violation>();
  for (const violation of violations) {
    const kept = byRule.get(violation.ruleId);
    // A LIVE finding always wins the slot: two members of one group, one
    // excused and one not, must read as "this rule still applies here" rather
    // than as an exception that quietly covers both.
    if (kept === undefined || (kept.exemption && !violation.exemption)) {
      byRule.set(violation.ruleId, violation);
    }
  }
  return Array.from(byRule.values());
}

/**
 * How loudly an ANCHOR is drawn: the loudest of the violations sharing it, so
 * a fresh finding is not muted by an older one on the same group.
 *
 * The single arbiter between the two markers. `> 0` means the bracket still has
 * the anchor; exactly `0` means it is done and the badge takes over. Both
 * halves call this, on the same timeline, so they can never both claim it.
 */
export function anchorEmphasis(
  anchor: ViolationAnchor,
  timeline: ViolationTimeline,
  now: number
): number {
  let emphasis = 0;
  for (const violation of anchor.violations) {
    emphasis = Math.max(emphasis, timeline.emphasis(violation, now));
  }
  return emphasis;
}

/**
 * Mark geometry in MODEL units, deliberately — the affordance zooms with the
 * board like any element on it.
 *
 * The house convention for annotation overlays is the opposite (divide by the
 * zoom, keep a constant size on screen), and that is right for a snap guide,
 * which is transient and never numerous. It is wrong here. The dimensioning
 * case is a hundred-component map, zoomed out: screen-constant marks grow
 * relative to the content they annotate until the brackets are all you can see
 * and the map underneath is unreadable. Zoomed out far enough these become
 * small along with everything else, and that is the point — a board you cannot
 * read is a worse answer than a mark you have to zoom in to inspect.
 *
 * The one exception is the CLICK target, which lives in DOM and keeps a screen
 * minimum so it stays reachable by thumb (see the widget). Invisible padding
 * around a model-sized visual: the pattern `edgeless-auto-complete` already
 * uses on this canvas.
 */
const MARK_CORNER = 10;
const MARK_LINE_WIDTH = 2;

/**
 * Gap between the anchor's bounds and the mark, in MODEL units. Exported
 * because the badge sits ON the bracket's top-right corner and has to use the
 * same gap to land there.
 */
export const VIOLATION_MARK_PADDING = 6;

/** Diameter of the persistent badge, in MODEL units. */
export const VIOLATION_BADGE_SIZE = 16;

/** The one amber the affordance is drawn in, canvas and DOM alike. */
export const VIOLATION_MARK_COLOR = '#f5a623';

/**
 * The EPHEMERAL half of the PF7 affordance: amber corner brackets that flash on
 * the anchor of a violation the moment it appears, hold for a few seconds, then
 * fade out (see {@link ViolationTimeline}). What stays behind afterwards is the
 * badge — `affine-violation-detail-widget`, a DOM sibling of this overlay.
 *
 * The handover is strict: an anchor whose emphasis has reached zero is skipped
 * here and picked up by the badge, so the two markers are never on screen at
 * the same time. {@link anchorEmphasis} is the single arbiter, read from the
 * one timeline the manager owns.
 *
 * An overlay rather than a renderer change: it touches no element model, writes
 * nothing to the document, creates no undo entry, and disappears with the rule
 * that produced it. The fade is session state too — nothing about "when did I
 * first see this" ever reaches the document.
 *
 * The mark is anchored on the outermost enclosing canvas group rather than on
 * the bare element — see {@link resolveMarkAnchors}. Evaluation is untouched by
 * this: it stays on the element carrying the role, because its position is what
 * the rule is about.
 */
export class ValidationOverlay extends Overlay {
  static override overlayName = 'validation';

  /**
   * The violations themselves — NOT their bounds, and not their groups either.
   * Both are resolved at paint time so the mark tracks what it accuses:
   * evaluation is debounced, the renderer is not, so a frozen snapshot would
   * leave the bracket behind at the drag's starting point until 120 ms after
   * the user let go — and a dissolved group would keep framing nothing.
   */
  private _violations: readonly Violation[] = [];

  /**
   * Handed in with the violations by {@link ValidationManager}, which owns it —
   * the DOM badge reads the same instance, and the two markers must never
   * disagree about whether the bracket is done.
   */
  private _timeline: ViolationTimeline | null = null;

  /** Armed only while something is still fading. */
  private _frame: number | null = null;

  /**
   * Whether the renderer this overlay paints into is gone.
   *
   * It matters because the two ends of the affordance are on different
   * lifecycles: the overlay dies with the surface COMPONENT (the renderer
   * disposes it), while {@link ValidationManager} lives on the gfx scope and
   * keeps its subscriptions on the surface MODEL, which outlives the component.
   * So an evaluation can perfectly well land here after teardown — switch to
   * page mode, edit the doc — and without this flag it would arm an animation
   * loop repainting a dead renderer sixty times a second for three seconds.
   *
   * Not permanent: the overlay is a DI singleton and is handed a new renderer
   * if the surface comes back.
   */
  private _detached = false;

  private readonly _onFrame = () => {
    this._frame = null;
    this._schedule();
  };

  /**
   * Repaint, and keep repainting for as long as a mark is inside its window.
   *
   * This is the only clock the affordance runs, and it stops on its own: a
   * board with no violation, or whose violations have all settled, requests no
   * animation frame at all.
   */
  private _schedule() {
    if (this._detached) return;
    this.refresh();
    if (this._frame !== null) return;
    if (!this._timeline?.isAnimating(performance.now())) return;
    this._frame = requestAnimationFrame(this._onFrame);
  }

  private _cancelFrame() {
    if (this._frame === null) return;
    cancelAnimationFrame(this._frame);
    this._frame = null;
  }

  private _forget() {
    this._cancelFrame();
    this._violations = [];
    // The timeline belongs to the manager and is shared with the badge: drop
    // the reference, never the contents.
    this._timeline = null;
  }

  /**
   * @param violations already filtered to what the user is meant to see.
   * @param timeline the manager's, already synced against these violations.
   */
  setViolations(violations: readonly Violation[], timeline: ViolationTimeline) {
    if (this._detached) return;
    this._violations = violations;
    this._timeline = timeline;
    this._schedule();
  }

  override setRenderer(renderer: CanvasRenderer | null) {
    this._detached = renderer === null;
    super.setRenderer(renderer);
  }

  override clear() {
    this._forget();
    super.clear();
  }

  override dispose() {
    this._detached = true;
    this._forget();
    super.dispose();
  }

  override render(ctx: CanvasRenderingContext2D, _rc: RoughCanvas): void {
    const timeline = this._timeline;
    if (!timeline || this._violations.length === 0) return;
    const now = performance.now();
    // Everything has settled and the badges have it: the cheapest possible
    // exit, before a single group chain is walked. The canvas repaints on
    // every pan, zoom and edit — this overlay must cost nothing between the
    // rare moments it has something to say.
    if (!timeline.isAnimating(now)) return;

    const surface = this.gfx.surface;
    if (!surface) return;

    // Model units, NOT divided by the zoom: the mark scales with the board.
    const corner = MARK_CORNER;
    const padding = VIOLATION_MARK_PADDING;

    ctx.save();
    ctx.strokeStyle = VIOLATION_MARK_COLOR;
    ctx.lineWidth = MARK_LINE_WIDTH;

    for (const anchor of resolveViolationAnchors(this._violations, surface)) {
      const emphasis = anchorEmphasis(anchor, timeline, now);
      // Done fading: the badge has this anchor now, and the two never overlap.
      if (emphasis <= 0) continue;

      const { bound } = anchor;
      const x = bound.x - padding;
      const y = bound.y - padding;
      const maxX = bound.maxX + padding;
      const maxY = bound.maxY + padding;

      ctx.globalAlpha = emphasis;
      ctx.beginPath();
      // Four corner brackets: reads as an annotation, not as a selection box.
      ctx.moveTo(x + corner, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + corner);
      ctx.moveTo(maxX - corner, y);
      ctx.lineTo(maxX, y);
      ctx.lineTo(maxX, y + corner);
      ctx.moveTo(x, maxY - corner);
      ctx.lineTo(x, maxY);
      ctx.lineTo(x + corner, maxY);
      ctx.moveTo(maxX, maxY - corner);
      ctx.lineTo(maxX, maxY);
      ctx.lineTo(maxX - corner, maxY);
      ctx.stroke();
    }

    ctx.restore();
  }
}
