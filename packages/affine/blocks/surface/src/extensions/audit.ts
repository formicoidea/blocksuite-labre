/**
 * `map.audit` — the command the **Labre Assistant** invokes to audit a
 * framework map (PF14.1).
 *
 * ## Where the work happens, and where it does not
 *
 * The library does no auditing. It collects the FACTS of the board, hands them
 * to the host's `AuditProvider` with the criteria the frameworks declared, and
 * files whatever comes back into a signal nothing on the real-time path reads.
 * If no provider is registered the command refuses cleanly and levels 1 and 2
 * are exactly as they were.
 *
 * ## Three gates, and they are independent on purpose
 *
 * 1. **`ai-audit`** (`packages/affine/all/src/flags.ts`) — the capability
 *    switch. Off, `AuditViewExtension` is never registered, so the command is
 *    absent from the registry, from both manifests and from the keymap. Same
 *    contract as a block flag: it gates TOOLING and never data — nothing this
 *    command touches is persisted, so switching it off cannot lose anything
 *    even in principle.
 * 2. **The framework's own flag** — the criteria are registered by the
 *    flag-gated view extension (`AuditCriterionExtension`), so a disabled
 *    Wardley contributes no criterion and an audit has nothing to ask about.
 * 3. **The provider** — absent, the command is still enumerable but refuses.
 *    Per ADR 0008, injected-provider presence is deliberately NOT an
 *    `Availability` member; its assigned fallback is "displayed available,
 *    `run` degrades". Making it a fourth availability value would have meant
 *    reopening a closed union for a state the caller can simply be told about.
 */
import {
  type AuditCriterion,
  type AuditElementFact,
  type AuditFacts,
  type AuditFrameFact,
  type AuditProgress,
  type AuditResult,
  type AuditRoleFact,
  type AuditViolationFact,
  getAuditCriteria,
  requestAudit,
  TelemetryProvider,
} from '@labre/affine-shared/services';
import type { Bound } from '@labre/global/gfx';
import type { AnyCommandDescriptor, BlockStdScope } from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
  roleIsA,
} from '@labre/std/gfx';
import { z } from 'zod';

import type { FrameworkBackgroundDef } from '../framework-background/def.js';
import { backgroundPlot } from '../framework-background/def.js';
import { backgroundAxisFacts } from '../framework-background/facts.js';
import {
  ValidationManager,
  ValidationRuleIdentifier,
  type ValidationRule,
  type Violation,
} from './validation.js';

/**
 * `map.audit` takes no required parameter: the assistant audits what is
 * selected. `criterionIds` narrows the run to a subset — an assistant
 * re-checking one criterion after a fix should not pay for the other two — and
 * an EMPTY array means "these zero criteria", i.e. nothing to do, never "all of
 * them". Same reading as `pivot.bind`'s `elementIds`, for the same reason: a
 * caller that filtered a list and came up empty must not have its request
 * silently widened.
 */
export const auditParams = z.object({
  criterionIds: z.array(z.string()).optional(),
});

export type AuditParams = z.infer<typeof auditParams>;

/**
 * The rules registered in this assembly, whatever their framework.
 *
 * Read straight off the DI identifier rather than through `ValidationManager`:
 * the manager resolves the same list once and caches it, but its copy is
 * private and the audit has no business widening the engine's API to read it.
 * Registration is the gate either way — a framework flagged off registered no
 * rule, so both answers are empty for the same reason.
 */
function activeRules(std: BlockStdScope): readonly ValidationRule[] {
  return [...std.provider.getAll(ValidationRuleIdentifier).values()];
}

/**
 * The role vocabulary in play, de-duplicated across every registered rule.
 *
 * Read off the RULES rather than from a second registry, exactly as
 * `ValidationManager.profilesFor` does: a rule already carries its framework's
 * `RoleDefs`, so a framework flagged off contributes no vocabulary for free.
 */
function collectRoles(rules: readonly ValidationRule[]): AuditRoleFact[] {
  const byId = new Map<string, AuditRoleFact>();
  for (const rule of rules) {
    for (const def of Object.values(rule.roles)) {
      if (!def || byId.has(def.id)) continue;
      byId.set(def.id, {
        id: def.id,
        kind: def.kind,
        ...(def.parent !== undefined ? { parent: def.parent } : {}),
        ...(def.labelKey !== undefined ? { labelKey: def.labelKey } : {}),
      });
    }
  }
  return [...byId.values()];
}

/** A frame instance, plus everything needed to place an element inside it. */
interface Frame {
  fact: AuditFrameFact;
  bound: Bound;
  /** The declaration this instance paints, i.e. where its plot geometry is. */
  def: FrameworkBackgroundDef;
}

/**
 * Every framework frame on the surface, as facts.
 *
 * A frame is an element carrying some rule's `backgroundRole` — the same
 * definition the rule families use, so the audit sees exactly the maps the
 * engine sees, and a background authored before its role existed is invisible
 * to both.
 */
function collectFrames(
  rules: readonly ValidationRule[],
  elements: readonly GfxPrimitiveElementModel[]
): Frame[] {
  const frames: Frame[] = [];
  const seen = new Set<string>();

  for (const rule of rules) {
    const backgroundRole = rule.backgroundRole;
    const def = rule.background;
    if (backgroundRole === undefined || def === undefined) continue;

    for (const el of elements) {
      if (el.role === undefined || seen.has(el.id)) continue;
      if (!roleIsA(el.role, backgroundRole, rule.roles)) continue;

      seen.add(el.id);
      const profileId = el.validationProfile;
      frames.push({
        def,
        bound: el.elementBound,
        fact: {
          elementId: el.id,
          framework: rule.framework,
          type: def.type,
          ...(typeof profileId === 'string' ? { profileId } : {}),
          axes: backgroundAxisFacts(def),
          zones: (def.zones ?? []).map(zone => ({
            id: zone.id,
            rect: { ...zone.rect },
          })),
        },
      });
    }
  }
  return frames;
}

/** Squared edge-to-edge gap — the same attribution heuristic the engine uses. */
function gapSquared(frame: Bound, bound: Bound): number {
  const dx = Math.max(frame.x - bound.maxX, bound.x - frame.maxX, 0);
  const dy = Math.max(frame.y - bound.maxY, bound.y - frame.maxY, 0);
  return dx * dx + dy * dy;
}

/**
 * The frame an element belongs to: the one that CONTAINS it, failing that the
 * nearest by edge-to-edge gap, ties broken by the smaller id.
 *
 * Deliberately the same answer `attributeBackground` gives inside the engine —
 * an audit that attributed an element to a different map than the rule that
 * indicted it would produce two findings about one component that disagree
 * about which map it is on.
 */
function attribute(bound: Bound, frames: readonly Frame[]): Frame | null {
  let nearest: Frame | null = null;
  let nearestDistance = Infinity;
  for (const frame of frames) {
    if (frame.bound.contains(bound)) return frame;
    const distance = gapSquared(frame.bound, bound);
    if (
      distance < nearestDistance ||
      (distance === nearestDistance &&
        nearest !== null &&
        frame.fact.elementId < nearest.fact.elementId)
    ) {
      nearestDistance = distance;
      nearest = frame;
    }
  }
  return nearest;
}

/**
 * Where an element's centre sits inside a frame's PLOT, as ratios.
 *
 * Ratios of the plot and not of the element box: a Wardley transition drawn at
 * `0.4` is 40 % of the PLOT, not of the map element, and the margin between the
 * two is exactly where the axis titles live. `backgroundPlot` is the one place
 * that knows the difference, and this is the only reason this function exists
 * rather than a subtraction at the call site.
 *
 * Not clamped: an element just off the left edge reads as `-0.03`, which is a
 * true and useful thing to say. `null` for a degenerate plot.
 */
function plotRatios(
  frame: Frame,
  bound: Bound
): readonly [number, number] | null {
  const plot = backgroundPlot(frame.def, frame.bound.w, frame.bound.h);
  if (!(plot.width > 0) || !(plot.height > 0)) return null;
  const cx = bound.x + bound.w / 2;
  const cy = bound.y + bound.h / 2;
  return [
    (cx - frame.bound.x - plot.x0) / plot.width,
    (cy - frame.bound.y - plot.y0) / plot.height,
  ];
}

/** The declared zone a plot-ratio point falls in, if any. */
function zoneAt(
  frame: Frame,
  at: readonly [number, number]
): string | undefined {
  for (const zone of frame.fact.zones) {
    const { x, y, w, h } = zone.rect;
    if (at[0] >= x && at[0] <= x + w && at[1] >= y && at[1] <= y + h) {
      return zone.id;
    }
  }
  return undefined;
}

/**
 * Levels 1 and 2, copied out of the engine's verdict.
 *
 * `audit` findings are excluded, and not merely because none exist today: the
 * facts handed to an assistant must never contain a previous assistant's
 * opinions, or a second run would start agreeing with itself.
 */
function collectViolations(
  violations: readonly Violation[]
): AuditViolationFact[] {
  const facts: AuditViolationFact[] = [];
  for (const violation of violations) {
    if (violation.severity === 'audit') continue;
    facts.push({
      ruleId: violation.ruleId,
      severity: violation.severity,
      elementIds: [...violation.elementIds],
      messageKey: violation.messageKey,
      ...(violation.backgroundId !== undefined
        ? { backgroundId: violation.backgroundId }
        : {}),
      ...(violation.exemption !== undefined
        ? { exemption: violation.exemption }
        : {}),
    });
  }
  return facts;
}

/**
 * Everything the assistant is told about the board — **render-free** and
 * serializable end to end (ADR 0006 § 5): plain objects, numbers and strings,
 * no element model, no `Bound`, no `TemplateResult`, no function. A test round
 * -trips the whole thing through `JSON.parse(JSON.stringify(...))` and compares.
 *
 * Role-carrying elements only. A neutral rectangle is not an artefact of any
 * framework, so it is not a fact about the map — the same proportionality the
 * engine applies (PRD principle 8), and the reason a board full of free
 * drawings does not turn into a wall of tokens.
 */
export function collectAuditFacts(std: BlockStdScope): AuditFacts {
  const rules = activeRules(std);
  const surface = std.get(GfxControllerIdentifier).surface;
  const elements = surface?.elementModels ?? [];

  // No rule registered means every framework is switched off, and the exact
  // same length check `ValidationManager.mounted` exits on. Without it a dark
  // board still reported its role-carrying elements — ids sent to an assistant
  // with no vocabulary to read them by and no criterion to ask about them.
  // Empty facts, one comparison, nothing walked.
  if (rules.length === 0) {
    return { roles: [], frames: [], elements: [], violations: [] };
  }

  const frames = collectFrames(rules, elements);
  const frameIds = new Set(frames.map(frame => frame.fact.elementId));

  const elementFacts: AuditElementFact[] = [];
  for (const el of elements) {
    const role = el.role;
    if (role === undefined || frameIds.has(el.id)) continue;

    const bound = el.elementBound;
    const frame = attribute(bound, frames);
    if (frame === null) {
      elementFacts.push({ id: el.id, role });
      continue;
    }

    const at = plotRatios(frame, bound);
    const zone = at === null ? undefined : zoneAt(frame, at);
    elementFacts.push({
      id: el.id,
      role,
      frameId: frame.fact.elementId,
      ...(at !== null ? { at } : {}),
      ...(zone !== undefined ? { zone } : {}),
    });
  }

  return {
    roles: collectRoles(rules),
    frames: frames.map(frame => frame.fact),
    elements: elementFacts,
    violations: collectViolations(
      std.getOptional(ValidationManager)?.violations$.peek() ?? []
    ),
  };
}

/**
 * The criteria this run carries: every registered one, or the requested subset.
 *
 * An unknown id is silently skipped rather than refused — an assistant pinned
 * to a criterion a later release retired should degrade to auditing the rest,
 * not fail the whole run over a string.
 */
function selectCriteria(
  std: BlockStdScope,
  criterionIds?: string[]
): AuditCriterion[] {
  const all = getAuditCriteria(std);
  if (criterionIds === undefined) return all;
  const wanted = new Set(criterionIds);
  return all.filter(criterion => wanted.has(criterion.id));
}

/** The single framework of a criteria set, or `undefined` if they disagree. */
function unanimousFramework(
  criteria: readonly AuditCriterion[]
): string | undefined {
  const distinct = new Set(criteria.map(criterion => criterion.framework));
  return distinct.size === 1 ? criteria[0].framework : undefined;
}

/**
 * Whether the current selection is a framework FRAME.
 *
 * The narrowing behind `availability: 'selection:framework'`: an audit is about
 * a map, so the gesture is "select the map, ask for an audit" — the background,
 * not one of the components on it. `isCommandAvailable` currently evaluates
 * `'selection:framework'` as plain `'selection'` (ADR 0008), so the real
 * predicate lives here, which is exactly what `when` is for.
 */
function selectedFrames(std: BlockStdScope): GfxPrimitiveElementModel[] {
  const rules = activeRules(std);
  if (rules.length === 0) return [];

  const selected = std
    .get(GfxControllerIdentifier)
    .selection.selectedElements.filter(
      (el): el is GfxPrimitiveElementModel =>
        el instanceof GfxPrimitiveElementModel
    );

  return selected.filter(el =>
    rules.some(
      rule =>
        rule.backgroundRole !== undefined &&
        el.role !== undefined &&
        roleIsA(el.role, rule.backgroundRole, rule.roles)
    )
  );
}

/**
 * The audit run itself, split out of the descriptor so a caller that already
 * has an `AbortSignal` (a host panel with a Cancel button, a test) can drive it
 * directly and await the result. `run` cannot: `CommandDescriptor.run` returns
 * `void | Promise<void>` and `runCommand` fires and forgets.
 */
export async function runMapAudit(
  std: BlockStdScope,
  options: {
    criterionIds?: string[];
    onProgress?: (progress: AuditProgress) => void;
    signal?: AbortSignal;
  } = {}
): Promise<AuditResult> {
  const criteria = selectCriteria(std, options.criterionIds);
  const facts = collectAuditFacts(std);
  const telemetry = std.getOptional(TelemetryProvider);
  const base = {
    page: 'whiteboard editor' as const,
    framework: unanimousFramework(criteria),
    criterionCount: criteria.length,
    frameCount: facts.frames.length,
  };
  const startedAt = performance.now();

  telemetry?.track('MapAuditStarted', base);

  const result = await requestAudit(
    std,
    { criteria, facts },
    {
      ...(options.onProgress ? { onProgress: options.onProgress } : {}),
      ...(options.signal ? { signal: options.signal } : {}),
    }
  );
  const durationMs = performance.now() - startedAt;

  // Published even for a partial run: an audit interrupted halfway has still
  // said something true, and throwing it away would punish the user for
  // pressing Cancel. `unavailable` and `error` publish an EMPTY list, which
  // clears whatever a previous run left — a stale opinion is worse than none.
  std.getOptional(ValidationManager)?.setAuditFindings(result.findings);

  if (result.status === 'complete') {
    telemetry?.track('MapAuditCompleted', {
      ...base,
      findingCount: result.findings.length,
      durationMs,
    });
  } else {
    telemetry?.track('MapAuditInterrupted', {
      ...base,
      reason: result.status,
      durationMs,
    });
  }

  return result;
}

const mapAudit: AnyCommandDescriptor = {
  id: 'map.audit',
  // `'core'`, not `'wardley'`: the command is framework-agnostic — it audits
  // whatever frame is selected against whatever criteria are registered — and a
  // `'wardley'` owner would have forced the id prefix `wardley.` and made a
  // second, identical command necessary for every framework that follows.
  // `'core'` owners are exempt from the id-prefix rule (ADR 0008).
  owner: 'core',
  kind: 'action',
  labelKey: 'com.labre.command.map.audit',
  labelFallback: 'Audit this map',
  descriptionKey: 'com.labre.command.map.audit.description',
  // `'agent'` is the point of the whole slice — consumer 5 of ADR 0008 — and
  // `'palette'` because a human asking for a review by name is the same
  // request. Deliberately NOT `'senior-menu'`: the 14 slots are for artefacts,
  // and an audit is not one.
  surfaces: ['palette', 'agent'],
  scope: 'edgeless',
  // Keyless by intent. Still bindable from Settings › Shortcuts.
  defaultKeys: { mac: [], other: [] },
  // The serializable half a host catalogue shows: this command needs a frame
  // selected. Narrowed below to "and that frame is a framework background".
  availability: 'selection:framework',
  when: std => selectedFrames(std).length > 0,
  params: auditParams,
  run: (std, _invocation, params) => {
    const parsed = auditParams.safeParse(params ?? {});
    if (!parsed.success) {
      console.error('map.audit: invalid params', parsed.error.issues);
      return;
    }
    // `runCommand` fires and forgets, so the rejection has to die here. It
    // cannot reject — `requestAudit` guards the provider — but a `void` promise
    // escaping a command is how an unhandled rejection reaches a user's console.
    return runMapAudit(std, {
      ...(parsed.data.criterionIds !== undefined
        ? { criterionIds: parsed.data.criterionIds }
        : {}),
    }).then(() => undefined);
  },
};

/**
 * ## Read-only (the `pivot.bind` pattern, PR #89 — and its one deliberate
 * difference)
 *
 * `pivot.bind` guards `!std.store.readonly` inside `run`, because `runCommand`
 * consults neither `when` nor `availability` and `clearField` carries no
 * read-only guard of its own — without it, a palette invocation would mutate a
 * document the user cannot edit.
 *
 * `map.audit` needs no such guard, and adding one would be wrong rather than
 * merely redundant: **it writes nothing**. It reads element geometry and roles,
 * copies the engine's verdict, and stores the answer in a session signal that
 * never reaches a `Y.Doc`. A read-only document is not an edge case for an
 * audit — it is the CASE: reviewing a map you have been given, and cannot
 * change, is what a reviewer does.
 *
 * The invariant `pivot.bind` protects with a guard is protected here by a test
 * instead: `map.audit` on a read-only store runs to completion, publishes its
 * findings, and leaves the document byte-identical. Recorded loudly because
 * "no read-only check" reads like an omission and is a decision.
 */
export const auditCommands: AnyCommandDescriptor[] = [mapAudit];
