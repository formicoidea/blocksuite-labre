import { createIdentifier } from '@labre/global/di';
import type { Bound } from '@labre/global/gfx';
import type { RoleDefs, RoleId } from '@labre/std/gfx';
import {
  GfxPrimitiveElementModel,
  InteractivityExtension,
  roleIsA,
} from '@labre/std/gfx';
import type { ExtensionType } from '@labre/store';
import { signal } from '@preact/signals-core';

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
   * `element-in-background` only: the element `type` of the framework's
   * background (`wardley`), i.e. the "map" the roles must sit on.
   */
  backgroundType?: string;
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
 * are not fully contained by any background of `rule.backgroundType` is in
 * violation.
 *
 * When the surface carries NO background of that type there is no map to be
 * outside of, so the rule yields nothing: a Wardley node dropped on a blank
 * canvas is a sketch, not an error.
 *
 * Cost: two linear passes, one `elementBound` per candidate. Backgrounds are
 * counted in units, so the per-element cost is constant in practice.
 */
function evaluateElementInBackground(
  rule: ValidationRule,
  elements: readonly GfxPrimitiveElementModel[]
): Violation[] {
  const backgrounds: Bound[] = [];
  for (const el of elements) {
    if (el.type === rule.backgroundType) backgrounds.push(el.elementBound);
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

    const surface = this.gfx.surface;
    if (!surface) return;

    for (const change of [
      surface.elementAdded,
      surface.elementRemoved,
      surface.elementUpdated,
    ]) {
      this._subscriptions.push(change.subscribe(() => this._schedule()));
    }
    this.evaluate();
  }

  override unmounted() {
    if (this._pending) clearTimeout(this._pending);
    this._pending = null;
    for (const subscription of this._subscriptions) subscription.unsubscribe();
    this._subscriptions = [];
    super.unmounted();
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
    this.violations$.value = violations;

    const overlay = this._overlay;
    if (overlay) overlay.setViolations(violations, surface.elementModels);
  }
}

/** Corner length of the bracket drawn around a faulty element, in model units. */
const MARK_CORNER = 10;
const MARK_PADDING = 6;
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

  private _bounds: Bound[] = [];

  /** Bounds of the indicted elements, resolved once per evaluation. */
  setViolations(
    violations: readonly Violation[],
    elements: readonly GfxPrimitiveElementModel[]
  ) {
    if (violations.length === 0 && this._bounds.length === 0) return;

    const faulty = new Set<string>();
    for (const violation of violations) {
      for (const id of violation.elementIds) faulty.add(id);
    }
    this._bounds = elements
      .filter(el => faulty.has(el.id))
      .map(el => el.elementBound);
    this.refresh();
  }

  override clear() {
    this._bounds = [];
    super.clear();
  }

  override render(ctx: CanvasRenderingContext2D, _rc: RoughCanvas): void {
    if (this._bounds.length === 0) return;

    ctx.save();
    ctx.strokeStyle = MARK_COLOR;
    ctx.lineWidth = 2;
    ctx.beginPath();
    for (const bound of this._bounds) {
      const x = bound.x - MARK_PADDING;
      const y = bound.y - MARK_PADDING;
      const maxX = bound.maxX + MARK_PADDING;
      const maxY = bound.maxY + MARK_PADDING;
      // Four corner brackets: reads as an annotation, not as a selection box.
      ctx.moveTo(x + MARK_CORNER, y);
      ctx.lineTo(x, y);
      ctx.lineTo(x, y + MARK_CORNER);
      ctx.moveTo(maxX - MARK_CORNER, y);
      ctx.lineTo(maxX, y);
      ctx.lineTo(maxX, y + MARK_CORNER);
      ctx.moveTo(x, maxY - MARK_CORNER);
      ctx.lineTo(x, maxY);
      ctx.lineTo(x + MARK_CORNER, maxY);
      ctx.moveTo(maxX, maxY - MARK_CORNER);
      ctx.lineTo(maxX, maxY);
      ctx.lineTo(maxX - MARK_CORNER, maxY);
    }
    ctx.stroke();
    ctx.restore();
  }
}
