/**
 * `AuditProvider` — the injectable seam the **Labre Assistant** plugs into
 * (PF14.1, ADR 0008 § surface `'agent'`, ADR 0006 § render-free host seam).
 *
 * ## What this is, and above all what it is not
 *
 * The executor is the Labre Assistant, app-side (PO decision, 01/08/2026). The
 * library embarks **no model, no prompt runner and no dependency on one**. What
 * it owns is the seam and only the seam:
 *
 * - the criteria, as versioned DATA a framework declares
 *   ({@link AuditCriterion}) — the same declarative, host-shippable shape a
 *   validation rule, a role or a background already has;
 * - the FACTS of a map, collected render-free ({@link AuditFacts});
 * - a channel out: {@link AuditFinding}s in `audit` severity, timestamped and
 *   carrying the criterion they came from.
 *
 * ## The one invariant everything else defends
 *
 * **The deterministic engine never depends on the AI.** Levels 1 and 2 —
 * `blocking-overridable` and `warning`, evaluated by `evaluateRules` inside the
 * 16 ms budget — are computed, rendered and arbitrated with no knowledge that
 * this file exists. An audit READS their output as a fact and writes into a
 * separate signal. There is no path by which a provider (slow, absent, hostile
 * or simply wrong) can change a verdict, delay a frame or move a mark on the
 * canvas.
 *
 * That is why {@link normalizeFinding} FORCES `severity: 'audit'` rather than
 * trusting the provider: `audit` is the severity that is invisible to the
 * drawing user (`userFacingViolations`), so a provider returning `'warning'`
 * would otherwise put an AI opinion behind a canvas bracket.
 */
import { createIdentifier } from '@labre/global/di';
import type { BlockStdScope } from '@labre/std';
import type { ExtensionType } from '@labre/store';

/**
 * One audit criterion, as DATA owned by its framework and versioned like a
 * validation rule.
 *
 * The criterion carries its own PROSE, in {@link prompt} — and that is a
 * deliberate exception to the library's "no sentences" rule, not an oversight.
 * A rule's message is addressed to a USER and therefore belongs to a host
 * catalogue (hence `messageKey` + `messageFallback`); a criterion's prompt is
 * addressed to an ASSISTANT, is not displayed anywhere, and is exactly the kind
 * of thing that must be reviewable, diffable and versioned in the repository
 * rather than retyped in an app. The user-facing half still goes through
 * {@link labelKey} + {@link fallback}, unchanged.
 */
export interface AuditCriterion {
  /** Stable id, namespaced by framework: `wardley.A1`. */
  id: string;
  /** Owning framework, e.g. `wardley`. A criterion never crosses frameworks. */
  framework: string;
  /** i18n key of the human name; resolved by the host. */
  labelKey: string;
  /** The framework's own wording when the host ships no catalogue for the key. */
  fallback: string;
  /**
   * The criterion itself, in words, for the assistant. Never rendered.
   *
   * Written as an instruction to a reviewer, not as a message to a user: it
   * states what to look for and what would make the map fail it.
   */
  prompt: string;
  /** Bumped when the criterion's meaning changes, so a host can pin behaviour. */
  version: number;
}

/** A role, as the assistant sees it. Vocabulary only, no geometry. */
export interface AuditRoleFact {
  id: string;
  /**
   * Mirrors `RoleKind` structurally rather than importing it: this package sits
   * below `@labre/std/gfx` in the seam, and the DTO must stay a plain shape a
   * host can implement. Kept in sync by the collector, which fails to compile
   * if `RoleKind` gains a member this union does not have — which is exactly
   * how `'text'` arrived here (MF3).
   */
  kind: 'node' | 'edge' | 'text';
  /** Data hierarchy: `wardley:market` specialises `wardley:component`. */
  parent?: string;
  /** Optional, mirroring `RoleDef.labelKey`: a role may ship without one. */
  labelKey?: string;
}

/** An axis of a framework frame. Same facts the rule families read. */
export interface AuditAxisFact {
  id: string;
  orientation: 'horizontal' | 'vertical';
  /** Unit vector of increasing value, model space (`y` grows downwards). */
  forward: readonly [number, number];
}

/**
 * A named zone of a framework frame, as PLOT RATIOS.
 *
 * Ratios, never model coordinates: a zone is a statement about the frame, and
 * expressing it in model units would make it a statement about how big the user
 * happened to draw the map. `{ x: 0.4, w: 0.3 }` is "Product" on every Wardley
 * map ever drawn.
 */
export interface AuditZoneFact {
  id: string;
  rect: { x: number; y: number; w: number; h: number };
}

/** One framework frame on the board — a Wardley map, a Cynefin grid. */
export interface AuditFrameFact {
  elementId: string;
  framework: string;
  /** Background declaration type, e.g. `'wardley'`. */
  type: string;
  /** The level of requirement in force, when the frame names one. */
  profileId?: string;
  axes: readonly AuditAxisFact[];
  zones: readonly AuditZoneFact[];
}

/** One element measured against a frame. */
export interface AuditElementFact {
  id: string;
  /** Role id, e.g. `wardley:component`. Neutral elements are never collected. */
  role: string;
  /** The frame it was attributed to, when it sits on one. */
  frameId?: string;
  /**
   * Where it sits INSIDE that frame's plot, as ratios — `[0.62, 0.31]` reads as
   * "in Product, fairly high up the value chain" on any Wardley map, at any
   * size. Absent when the element is on no frame.
   */
  at?: readonly [number, number];
  /** The zone its centre falls in, when the frame declares zones. */
  zone?: string;
}

/**
 * A level 1 / level 2 finding, handed to the assistant as a FACT about the map.
 *
 * The deterministic engine's output is an input to the audit and never the
 * other way round. Structurally a subset of the engine's `Violation`, so the
 * collector copies rather than converts — and so this package needs no
 * dependency on `@labre/affine-block-surface`, which depends on it.
 */
export interface AuditViolationFact {
  ruleId: string;
  /** Never `'audit'`: an audit finding is not a fact about the map. */
  severity: 'blocking-overridable' | 'warning';
  elementIds: string[];
  messageKey: string;
  backgroundId?: string;
  /** Set when a user already arbitrated this finding away (PF8). */
  exemption?: 'element' | 'map';
}

/**
 * Everything the assistant is told about the board. **Render-free** (ADR 0006
 * § 5): no `TemplateResult`, no element model, no function, no DOM — a plain
 * object that survives `structuredClone` and a `postMessage`.
 */
export interface AuditFacts {
  /** The role vocabulary in play, so an id is never an opaque string. */
  roles: readonly AuditRoleFact[];
  frames: readonly AuditFrameFact[];
  elements: readonly AuditElementFact[];
  /** Levels 1 and 2, as computed by the deterministic engine. */
  violations: readonly AuditViolationFact[];
}

/** What the assistant is asked to do. */
export interface AuditRequest {
  criteria: readonly AuditCriterion[];
  facts: AuditFacts;
}

/** How far along a run is. Reported, never awaited. */
export interface AuditProgress {
  /** Criteria settled so far. */
  done: number;
  /** Criteria in the request — `request.criteria.length`. */
  total: number;
  /** The criterion currently being evaluated, when the provider says. */
  criterionId?: string;
}

/**
 * One audit result, in the shape of a violation object at `audit` severity.
 *
 * Structurally assignable to the engine's `Violation` (a test pins that), which
 * is what lets a host panel render an audit finding with the very same code it
 * renders a rule finding with — while `userFacingViolations` keeps it off the
 * canvas, because that is what `audit` severity means.
 */
export interface AuditFinding {
  /**
   * Namespaced as `audit:<criterionId>` so it can never collide with a
   * registered rule id, and so `ValidationManager.ruleOf` returns nothing for it
   * — an audit finding is not arbitrable with a user exception. It is an
   * opinion, and an opinion is not a rule to be waived.
   */
  ruleId: string;
  /**
   * The elements the finding is about — **not validated against the surface**.
   *
   * The library checks that these are strings and nothing more. An id naming an
   * element that no longer exists, or one from another document, is published
   * as-is: validating would cost a lookup per id, and a missing id is not
   * *wrong* so much as *stale* — the board moves on while an audit is in
   * flight, which is the normal case for a call that takes seconds.
   *
   * **A host panel must therefore tolerate absent ids**: resolve them
   * defensively and render what it can, rather than assuming every id is a live
   * element. This is the one place the "render it with the code you already
   * have" claim needs a caveat.
   */
  elementIds: string[];
  /** Always `'audit'`. Forced by {@link normalizeFinding}, never trusted. */
  severity: 'audit';
  messageKey: string;
  messageFallback?: string;
  suggestion?: string;
  suggestionFallback?: string;
  backgroundId?: string;
  /** The criterion this came from. */
  criterionId: string;
  /** The criterion's `version` at the time of the run. */
  criterionVersion: number;
  /** When the run that produced it finished, `Date.now()`. */
  at: number;
}

/**
 * How a run ended.
 *
 * - `complete` — the provider settled every criterion.
 * - `aborted` — the caller's `AbortSignal` fired. Findings produced before the
 *   abort are KEPT: an audit interrupted halfway has still said something true.
 * - `error` — the provider threw or rejected. A host's broken build must not
 *   become a crash on a keystroke.
 * - `unavailable` — nothing could answer. Either no provider is registered in
 *   this assembly (the standalone playground, where the whole of levels 1 and 2
 *   still works), or a registered one **declared itself unavailable** — an
 *   assistant behind an app-side feature flag, an exhausted quota, no model
 *   configured. The second case is passed through rather than folded into
 *   `complete`: `unavailable` is the count of users reaching for an audit this
 *   build cannot deliver, and it is worthless if a provider can opt out of it
 *   by answering politely.
 * - `superseded` — a NEWER run for the same editor started while this one was
 *   in flight. Its `findings` are **always empty**: the answer described a
 *   board the user has already moved past, so it is dropped from the return
 *   value as well as from the signal, and a host that awaits without checking
 *   the status cannot render it. Never returned by {@link requestAudit}:
 *   superseding is the library's arbitration between two of its own calls, not
 *   something a provider can declare (one that returns it is read as
 *   `complete`).
 */
export type AuditStatus =
  | 'complete'
  | 'aborted'
  | 'error'
  | 'unavailable'
  | 'superseded';

export interface AuditResult {
  status: AuditStatus;
  findings: readonly AuditFinding[];
  /** Free-form diagnostic for `error`. Never rendered. */
  reason?: string;
}

export interface AuditRunOptions {
  onProgress?: (progress: AuditProgress) => void;
  signal?: AbortSignal;
}

export interface AuditService {
  /**
   * Run the audit. The ONE method of this seam.
   *
   * Contract for hosts:
   * - MUST honour `signal`: stop work and either resolve with what it has or
   *   reject with an `AbortError`. Both are accepted — {@link requestAudit}
   *   normalises them into `status: 'aborted'`.
   * - MUST NOT mutate anything it is handed. `request` is the library's data.
   * - SHOULD call `onProgress` as criteria settle. Purely advisory: a provider
   *   that never calls it is correct, just silent.
   * - MAY reject. The library guards it anyway — see {@link requestAudit}.
   */
  runAudit(
    request: AuditRequest,
    options: AuditRunOptions
  ): Promise<AuditResult>;
}

export const AuditProvider = createIdentifier<AuditService>(
  'LabreAuditService'
);

/**
 * The ONLY way in. **No noop default is registered**, exactly as for
 * `PivotPropertiesProvider`: absence is a *meaningful* state (standalone
 * playground, unit tests, a labreapp build that has not wired its assistant),
 * and making it the tested default is what keeps the degraded path honest.
 */
export function AuditExtension(service: AuditService): ExtensionType {
  return {
    setup: di => {
      di.override(AuditProvider, () => service);
    },
  };
}

/** Multi-instance: one registered {@link AuditCriterion} per impl. */
export const AuditCriterionIdentifier =
  createIdentifier<AuditCriterion>('AuditCriterion');

/**
 * Register a framework's audit criteria. Call it from the FLAG-GATED view
 * extension, beside `ValidationRuleExtension`: criteria are tooling, so a
 * disabled framework contributes none and an audit of its maps has nothing to
 * ask about.
 *
 * ```ts
 * context.register(AuditCriterionExtension(WARDLEY_AUDIT_CRITERIA));
 * ```
 */
export function AuditCriterionExtension(
  criteria: readonly AuditCriterion[]
): ExtensionType {
  return {
    setup: di => {
      for (const criterion of criteria) {
        di.addImpl(AuditCriterionIdentifier(criterion.id), () => criterion);
      }
    },
  };
}

/** Every criterion registered in this editor assembly. */
export function getAuditCriteria(std: BlockStdScope): AuditCriterion[] {
  return [...std.provider.getAll(AuditCriterionIdentifier).values()];
}

/** Whether a rejection is the caller's own abort rather than a failure. */
function isAbort(error: unknown, signal?: AbortSignal): boolean {
  if (signal?.aborted) return true;
  return error instanceof Error && error.name === 'AbortError';
}

/**
 * Force a provider's answer into the ONE shape the library is willing to
 * publish. Nothing here is a formality:
 *
 * - `severity` is OVERWRITTEN, never read. `'audit'` is the severity that stays
 *   off the canvas; a provider returning `'blocking-overridable'` would
 *   otherwise raise a bracket on an element over a sentence a model wrote.
 * - `ruleId` is re-derived from the criterion, so a provider cannot attach its
 *   finding to a registered rule id and inherit that rule's exceptions,
 *   profile or toolbar arbitration.
 * - a finding naming a criterion that was not in the request is DROPPED. The
 *   library asked three questions; an answer to a fourth is not an answer.
 * - `at` is stamped library-side from one clock, so every finding of one run
 *   carries the same timestamp whatever the provider believes the time is.
 */
function normalizeFinding(
  raw: AuditFinding,
  criteria: ReadonlyMap<string, AuditCriterion>,
  at: number
): AuditFinding | null {
  const criterion = criteria.get(raw.criterionId);
  if (!criterion) return null;

  return {
    ...raw,
    ruleId: `audit:${criterion.id}`,
    // Whatever came back: an id list is the only part a provider authors, and
    // it must be an array of strings or nothing at all.
    elementIds: Array.isArray(raw.elementIds)
      ? raw.elementIds.filter((id): id is string => typeof id === 'string')
      : [],
    severity: 'audit',
    criterionId: criterion.id,
    criterionVersion: criterion.version,
    at,
  };
}

/**
 * The guarded call every in-library consumer uses — the one place the provider
 * contract is enforced rather than trusted.
 *
 * - **No provider registered** → `{ status: 'unavailable', findings: [] }`. A
 *   clean refusal, not a throw and not a crash: levels 1 and 2 are untouched
 *   and the caller reports nothing.
 * - **The provider throws or rejects** → `{ status: 'error' }`, with the reason
 *   kept for logs and never rendered.
 * - **The caller aborted** → `{ status: 'aborted' }`, keeping whatever findings
 *   the provider had already returned.
 * - **`onProgress` throws** → swallowed. A broken progress bar must not kill
 *   the run that feeds it.
 *
 * ## The request is ISOLATED before it crosses (the outbound half)
 *
 * `normalizeFinding` exists because a provider is not believed on the way back.
 * This is the same statement on the way out, and it was missing: the facts a
 * collector assembles are not all fresh objects. `backgroundAxisFacts` returns
 * `forward` straight from a module constant (`FORWARD` in
 * `framework-background/facts.ts`) — `as const` is compile-time only and
 * nothing is frozen — so every `frames[].axes[].forward` handed over WAS the
 * very array the engine multiplies against in `evaluateOrientationAgainstAxis`.
 * A provider writing into the facts it is given (normalising a vector in place,
 * say) flipped the axis convention for the whole process, and correct arrows
 * started reporting as violations on the canvas. That is precisely what this
 * file's header declares impossible.
 *
 * `structuredClone` at the boundary fixes the whole class rather than that one
 * field: no future fact can leak identity either, and the cost is a constraint
 * the seam already claims (ADR 0006 § 5 — the request must be serializable, and
 * a test round-trips it). Value-comparing tests were structurally blind to it;
 * an identity assertion (`.toBe`) now guards it.
 */
export async function requestAudit(
  std: BlockStdScope,
  request: AuditRequest,
  options: AuditRunOptions = {}
): Promise<AuditResult> {
  const provider = std.getOptional(AuditProvider);
  if (!provider) return { status: 'unavailable', findings: [] };

  const criteria = new Map(request.criteria.map(c => [c.id, c]));
  const { signal } = options;
  // Asked before the call as well as after: a caller that aborts between
  // building the request and issuing it must not start a run at all.
  if (signal?.aborted) return { status: 'aborted', findings: [] };

  const onProgress = options.onProgress
    ? (progress: AuditProgress) => {
        try {
          options.onProgress?.(progress);
        } catch (error) {
          console.error('AuditProvider onProgress threw', error);
        }
      }
    : undefined;

  // The outbound half of "a provider is not believed" — see the note above.
  // A throw here means the facts stopped being serializable, which is a library
  // bug and not a host one; it is reported loudly and degraded rather than
  // allowed to become a crash in front of a user.
  let isolated: AuditRequest;
  try {
    isolated = structuredClone(request);
  } catch (error) {
    console.error(
      'audit facts are not structured-cloneable — the request cannot be ' +
        'isolated, so it is not sent (ADR 0006 § 5)',
      error
    );
    return {
      status: 'error',
      findings: [],
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  let raw: AuditResult;
  try {
    raw = await provider.runAudit(isolated, {
      ...(onProgress ? { onProgress } : {}),
      ...(signal ? { signal } : {}),
    });
  } catch (error) {
    if (isAbort(error, signal)) return { status: 'aborted', findings: [] };
    console.error('AuditProvider.runAudit threw', error);
    return {
      status: 'error',
      findings: [],
      reason: error instanceof Error ? error.message : String(error),
    };
  }

  const at = Date.now();
  const findings = (raw?.findings ?? [])
    .map(finding => normalizeFinding(finding, criteria, at))
    .filter((finding): finding is AuditFinding => finding !== null);

  // A provider that resolved normally while the caller was aborting is still an
  // abort: the caller asked to stop, and honouring that is not the provider's
  // decision to make.
  //
  // `unavailable` passes through with `aborted` and `error`. A registered
  // provider CAN be unable to answer — assistant behind an app-side feature
  // flag, quota exhausted, no model configured — and folding that into
  // `complete` would both inflate the completion series and empty the one
  // number that says how often users reach for an audit this build cannot
  // deliver. `superseded` is deliberately absent: it is the library's own
  // arbitration between two of its calls, so a provider claiming it is read as
  // `complete` and the arbitration stays where it belongs.
  const status: AuditStatus = signal?.aborted
    ? 'aborted'
    : raw?.status === 'aborted' ||
        raw?.status === 'error' ||
        raw?.status === 'unavailable'
      ? raw.status
      : 'complete';

  return {
    status,
    findings,
    ...(raw?.reason !== undefined ? { reason: raw.reason } : {}),
  };
}
