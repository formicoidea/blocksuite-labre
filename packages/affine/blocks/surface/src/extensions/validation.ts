import { createIdentifier } from '@labre/global/di';
import type { Bound } from '@labre/global/gfx';
import type {
  GfxPrimitiveElementModel,
  RoleDefs,
  RoleId,
  SurfaceBlockModel,
} from '@labre/std/gfx';
import { InteractivityExtension, roleIsA } from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';
import { effect, signal } from '@preact/signals-core';

import { Overlay, OverlayIdentifier } from '../renderer/overlay.js';
import type { RoughCanvas } from '../utils/rough/canvas.js';

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
const VERDICT_PROPS = ['xywh', 'rotate', 'role'];

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

    this.violations$.value = violations;
    this._overlay?.setViolations(violations);
  }
}

/**
 * Bracket geometry in SCREEN pixels. The overlay context is scaled by the
 * viewport zoom, so each is divided by it at paint time — the house convention
 * for annotation overlays (see `snap-overlay.ts`). Without that, the mark is a
 * hairline at zoom 0.2, exactly when a user is zoomed out hunting for the node
 * that drifted off the map.
 */
const MARK_CORNER = 10;
const MARK_PADDING = 6;
const MARK_LINE_WIDTH = 2;
const MARK_COLOR = '#f5a623';

/**
 * PF7, minimal affordance: a discreet amber bracket around each element in
 * violation. An overlay rather than a renderer change — it touches no element
 * model, writes nothing to the document, creates no undo entry, and disappears
 * with the rule that produced it.
 *
 * Deliberately mute: no text, no icon, no panel. Naming the problem is wave 2's
 * job; wave 1 only has to make the element findable.
 */
export class ValidationOverlay extends Overlay {
  static override overlayName = 'validation';

  /**
   * Ids of the indicted elements — NOT their bounds. Bounds are read at paint
   * time so the mark tracks the element it accuses: evaluation is debounced,
   * the renderer is not, so a frozen snapshot would leave the bracket behind
   * at the drag's starting point until 120 ms after the user let go.
   */
  private _elementIds: string[] = [];

  setViolations(violations: readonly Violation[]) {
    const faulty = new Set<string>();
    for (const violation of violations) {
      for (const id of violation.elementIds) faulty.add(id);
    }
    this._elementIds = Array.from(faulty);
    this.refresh();
  }

  override clear() {
    this._elementIds = [];
    super.clear();
  }

  override render(ctx: CanvasRenderingContext2D, _rc: RoughCanvas): void {
    if (this._elementIds.length === 0) return;
    const surface = this.gfx.surface;
    if (!surface) return;

    // The context is scaled by the zoom: divide to keep the mark a constant
    // size on screen at any zoom level.
    const zoom = this.gfx.viewport.zoom;
    const corner = MARK_CORNER / zoom;
    const padding = MARK_PADDING / zoom;

    ctx.save();
    ctx.strokeStyle = MARK_COLOR;
    ctx.lineWidth = MARK_LINE_WIDTH / zoom;
    ctx.beginPath();
    for (const id of this._elementIds) {
      const element = surface.getElementById(id);
      if (!element) continue;

      const bound = element.elementBound;
      const x = bound.x - padding;
      const y = bound.y - padding;
      const maxX = bound.maxX + padding;
      const maxY = bound.maxY + padding;
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
    }
    ctx.stroke();
    ctx.restore();
  }
}
