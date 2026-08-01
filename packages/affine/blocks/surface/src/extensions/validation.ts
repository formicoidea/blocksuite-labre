import { createIdentifier } from '@labre/global/di';
import type { Bound } from '@labre/global/gfx';
import type {
  GfxPrimitiveElementModel,
  RoleDefs,
  RoleId,
  SurfaceBlockModel,
} from '@labre/std/gfx';
import {
  GfxGroupLikeElementModel,
  InteractivityExtension,
  roleIsA,
} from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';
import { effect, signal } from '@preact/signals-core';

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
 * Rule families. One family = one evaluation function ({@link RULE_FAMILIES}).
 * Wave 1 implements a single family; adding one is adding an entry here and a
 * function below, never a change to the rule shape.
 */
export type RuleFamily = 'element-in-background';

/**
 * A rule is declarative, versioned data owned by its framework (PRD principle
 * 5) — never a subclass, never a closure. It is comparable, serializable and
 * can be shipped by a host.
 */
export interface ValidationRule {
  /** Stable id, namespaced by framework: `wardley.component-outside-map`. */
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
   */
  appliesTo: RoleId;
  /** The framework's role vocabulary, for the inheritance walk. */
  roles: RoleDefs;
  /** i18n key of the message; resolved by the host. The engine holds no prose. */
  messageKey: string;
  /** i18n key of an optional remediation hint. */
  suggestionKey?: string;
  /** Bumped when the rule's meaning changes, so a host can pin behaviour. */
  version: number;
  /**
   * `element-in-background` only: the ROLE of the framework's background
   * (`wardley:map`), i.e. the frame the subject roles must sit on.
   *
   * A role, not an element type: the engine never looks at a shape type, on
   * either side of a rule (see `role.ts`). A background authored before its
   * role existed carries none, frames nothing and raises nothing.
   */
  backgroundRole?: RoleId;
}

/**
 * The result of a rule that did not hold (PRD principle 6): an OBJECT, not a
 * string and not a rendering. It names the rule, the elements at fault and an
 * i18n key — never a sentence.
 */
export interface Violation {
  ruleId: string;
  /** The elements the rule indicts. One for wave 1's family. */
  elementIds: string[];
  severity: ViolationSeverity;
  messageKey: string;
  /** i18n key of a remediation hint, when the rule carries one. */
  suggestion?: string;
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
  const backgroundRole = rule.backgroundRole;
  if (backgroundRole === undefined) return [];

  const backgrounds: Bound[] = [];
  for (const el of elements) {
    if (el.role === undefined) continue;
    if (roleIsA(el.role, backgroundRole, rule.roles)) {
      backgrounds.push(el.elementBound);
    }
  }
  if (backgrounds.length === 0) return [];

  const violations: Violation[] = [];
  for (const el of elements) {
    // Cheapest possible exit for a neutral element: no role, no evaluation.
    if (el.role === undefined) continue;
    if (!roleIsA(el.role, rule.appliesTo, rule.roles)) continue;

    const bound = el.elementBound;
    if (backgrounds.some(bg => bg.contains(bound))) continue;

    violations.push({
      ruleId: rule.id,
      elementIds: [el.id],
      severity: rule.severity,
      messageKey: rule.messageKey,
      ...(rule.suggestionKey ? { suggestion: rule.suggestionKey } : {}),
    });
  }
  return violations;
}

const RULE_FAMILIES: Record<
  RuleFamily,
  (
    rule: ValidationRule,
    elements: readonly GfxPrimitiveElementModel[]
  ) => Violation[]
> = {
  'element-in-background': evaluateElementInBackground,
};

/**
 * Run every rule over every element. Pure and synchronous — the unit of the
 * 16 ms budget (PF5.12), and the only thing the bench measures.
 */
export function evaluateRules(
  rules: readonly ValidationRule[],
  elements: readonly GfxPrimitiveElementModel[]
): Violation[] {
  if (rules.length === 0) return [];

  const violations: Violation[] = [];
  for (const rule of rules) {
    violations.push(...RULE_FAMILIES[rule.family](rule, elements));
  }
  return violations;
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

/** Recompute delay, so a drag re-evaluates once instead of once per frame. */
const VALIDATION_DELAY_MS = 120;

/**
 * Element props that can change a verdict. Everything else — `opacity` and the
 * other `@local()` fields, colours, labels — is ignored, so brushing a canvas
 * (`SpotlightManager` writes `opacity` on every element it dims) neither
 * re-evaluates the surface nor pushes the pending evaluation further away.
 */
export const VERDICT_PROPS = ['xywh', 'rotate', 'role'];

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

  private _rules: readonly ValidationRule[] | null = null;

  /** Registered rules, resolved once. Empty when every framework is flagged off. */
  private get _activeRules(): readonly ValidationRule[] {
    this._rules ??= Array.from(
      this.std.provider.getAll(ValidationRuleIdentifier).values()
    );
    return this._rules;
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
      this._subscriptions.push(change.subscribe(() => this._schedule()));
    }
    this._subscriptions.push(
      surface.elementUpdated.subscribe(({ props }) => {
        // A prop that cannot change a verdict must not even rearm the timer.
        if (props && !VERDICT_PROPS.some(prop => prop in props)) return;
        this._schedule();
      })
    );
    this.evaluate();
  }

  private _schedule() {
    if (this._pending) clearTimeout(this._pending);
    this._pending = setTimeout(() => {
      this._pending = null;
      this.evaluate();
    }, VALIDATION_DELAY_MS);
  }

  /** Evaluate now. Exposed so a host (and the bench) can drive it directly. */
  evaluate() {
    const rules = this._activeRules;
    const surface = this.gfx.surface;
    if (rules.length === 0 || !surface) return;

    const violations = evaluateRules(rules, surface.elementModels);
    // Stay silent when nothing changed: `violations$` is the seam a host panel
    // subscribes to, and a clean board must not wake it on every debounce tick.
    if (violations.length === 0 && this.violations$.peek().length === 0) return;

    // Age the marks BEFORE waking anybody, so the canvas half and the DOM half
    // read the same clock within one evaluation and never disagree about which
    // of the two markers is due.
    const shown = userFacingViolations(violations);
    this.timeline.sync(shown, performance.now());

    this.violations$.value = violations;
    this._overlay?.setViolations(shown, this.timeline);
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
    if (!byRule.has(violation.ruleId)) byRule.set(violation.ruleId, violation);
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
