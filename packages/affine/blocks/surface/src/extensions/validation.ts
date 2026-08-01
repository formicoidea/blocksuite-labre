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
  backgroundBoundaryCoords,
} from '../framework-background/facts.js';
import type { CanvasRenderer } from '../renderer/canvas-renderer.js';
import { Overlay, OverlayIdentifier } from '../renderer/overlay.js';
import type { RoughCanvas } from '../utils/rough/canvas.js';
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
 */
export type RuleFamily =
  | 'element-in-background'
  | 'orientation-against-axis'
  | 'attachment'
  | 'no-overlap';

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
   * Optional second requirement: the subject must also sit at one of the ZONE
   * TRANSITIONS the frame declares, measured ACROSS this axis. Absent means
   * anywhere along the carrier will do.
   */
  boundaryAxis?: string;
  /** How far, in model units, from a transition still counts as on it. */
  boundaryTolerance?: number;
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
 * A rule is declarative, versioned data owned by its framework (PRD principle
 * 5) — never a subclass, never a closure. It is comparable, serializable and
 * can be shipped by a host.
 */
export interface ValidationRule {
  /** Stable id, namespaced by framework: `wardley.change-arrow-against-evolution`. */
  id: string;
  /** Owning framework, `wardley`. Rules never leave their framework. */
  framework: string;
  family: RuleFamily;
  severity: ViolationSeverity;
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
   * `no-overlap`, which is about a pair and not about either half of it. Sorted
   * by id, so the same collision always reports the same way whichever order
   * the surface happened to be walked in.
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
 * Every element on the surface acting as a framework background for SOME rule.
 *
 * Recorded by the manager after each evaluation, and read on the next one — the
 * one fact about a deleted background that nothing else can reconstruct. See
 * {@link ValidationManager._backgrounds}.
 */
function backgroundElementIds(
  rules: readonly ValidationRule[],
  elements: readonly GfxPrimitiveElementModel[]
): ReadonlySet<string> {
  const ids = new Set<string>();
  for (const rule of rules) {
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
 */
function raise(
  rule: ValidationRule,
  elementIds: string[],
  backgroundId?: string
): Violation {
  return {
    ruleId: rule.id,
    elementIds,
    severity: rule.severity,
    messageKey: rule.messageKey,
    ...(rule.messageFallback !== undefined
      ? { messageFallback: rule.messageFallback }
      : {}),
    ...(rule.suggestionKey ? { suggestion: rule.suggestionKey } : {}),
    ...(rule.suggestionFallback !== undefined
      ? { suggestionFallback: rule.suggestionFallback }
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
 * and, when the rule asks for it, at one of the frame's declared zone
 * transitions ({@link backgroundBoundaryCoords}).
 *
 * Both requirements are one finding, not two: "the inertia is not on a
 * dependency" and "it is not at a phase transition" are the same statement
 * about the same symbol, and splitting them would put two badges on one bar.
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
      `attachment rule "${rule.id}" names a node role ` +
        `("${attachment.carrierRole}") as its carrier — "posed on" is a ` +
        `distance to a path, so this rule can never fire.`
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
  // The transition test needs a frame to read the transitions off, so a rule
  // asking for one on a board with no frame simply does not ask.
  const axis =
    attachment.boundaryAxis !== undefined && rule.background !== undefined
      ? backgroundAxisFact(rule.background, attachment.boundaryAxis)
      : undefined;

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
    let onBoundary = true;
    if (carried && axis !== undefined && frame !== null && rule.background) {
      const coords = backgroundBoundaryCoords(rule.background, frame.bound);
      // A transition ACROSS a horizontal axis is a vertical line, i.e. an `x`.
      const line = axis.orientation === 'horizontal' ? coords.x : coords.y;
      const value = axis.orientation === 'horizontal' ? centre[0] : centre[1];
      const slack = attachment.boundaryTolerance ?? attachment.tolerance;
      onBoundary = line.some(at => Math.abs(value - at) <= slack);
    }

    if (carried && onBoundary) continue;
    violations.push(raise(rule, [el.id], frame?.id));
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
 * Average advance width of one character, as a fraction of the font size.
 *
 * The engine measures no text: a canvas in the evaluation path would cost a
 * `measureText` per label per pass, and would make the verdict depend on which
 * fonts a host happens to have loaded — the same map would validate differently
 * in a headless report and in a browser. So the width is DECLARED: `characters
 * × fontSize × this`, the mean advance of a humanist sans (Inter's lowercase
 * averages ~0.52 em, its capitals ~0.64, its spaces ~0.25).
 *
 * ## The precision, measured rather than claimed
 *
 * Against the real renderer at Inter 18 — the numbers a test in
 * `integration-test/.../wardley-validation.spec.ts` prints and pins:
 *
 * | name | drawn | declared |
 * | --- | --- | --- |
 * | `CRM` | 41.0 | 27.0 (−34 %) |
 * | `Customer` | 83.2 | 72.0 (−13 %) |
 * | `Payment gateway` | 152.0 | 135.0 (−11 %) |
 * | `Data centre` | 93.0 – 99.5 | 99.0 (+6 % … −1 %) |
 *
 * A third narrow at worst — an all-caps acronym, since capitals are the widest
 * letters there are — and a few units WIDE at worst, on a name of narrow
 * lowercase letters. (The drawn figure itself moves by a few percent with the
 * web font's loading state, which is the other half of why the engine does not
 * try to measure exactly.)
 *
 * Chosen on the low side of the mean because the residual error of a
 * READABILITY rule belongs on the side of silence — and what is left of it on
 * the wide side is a handful of units, the scale
 * {@link ValidationRule.minPenetration} is calibrated on.
 */
const TEXT_ADVANCE_RATIO = 0.5;

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
 * text reads EMPTY occupies nothing, which is exactly what it draws.
 */
function textInkBound(el: unknown, bound: Bound): Bound {
  const text = el as { text?: unknown; fontSize?: unknown; textAlign?: unknown };
  if (typeof text.fontSize !== 'number' || text.text == null) return bound;

  let longest = 0;
  for (const line of String(text.text).split('\n')) {
    longest = Math.max(longest, line.length);
  }

  const w = Math.min(bound.w, longest * text.fontSize * TEXT_ADVANCE_RATIO);
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
    subjects.push({
      id: el.id,
      // A `text` role is measured by the ink of its text, not by the box it was
      // created at; everything else by its bounds.
      bound: kind === 'text' ? textInkBound(el, el.elementBound) : el.elementBound,
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
};

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
  if (rules.length === 0) return [];

  // No profile registered => not a single extra read on the whole surface.
  const index = profiles.length > 0 ? indexProfiles(profiles) : null;
  const chosen = index ? readChosenProfiles(elements) : null;

  const violations: Violation[] = [];
  for (const rule of rules) {
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

  private _pending: ReturnType<typeof setTimeout> | null = null;

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
    super.unmounted();
  }

  private _unsubscribe() {
    for (const subscription of this._subscriptions) subscription.unsubscribe();
    this._subscriptions = [];
  }

  private _resubscribe(surface: SurfaceBlockModel | null) {
    this._unsubscribe();
    if (!surface) return;

    for (const change of [surface.elementAdded, surface.elementRemoved]) {
      this._subscriptions.push(
        change.subscribe(({ id }) => this._schedule(id))
      );
    }
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
    const role = element.role;
    if (role === undefined) return [];

    const frameworks = new Set<string>();
    for (const rule of this._activeRules) {
      if (rule.backgroundRole === undefined) continue;
      if (roleIsA(role, rule.backgroundRole, rule.roles)) {
        frameworks.add(rule.framework);
      }
    }
    if (frameworks.size === 0) return [];

    return this._activeProfiles.filter(profile =>
      frameworks.has(profile.framework)
    );
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
