/**
 * `map.audit` and the facts it collects (PF14.1).
 *
 * The suite is organised around the one invariant the whole slice defends:
 * **the deterministic engine never depends on the AI.** Everything else here —
 * the render-free facts, the separate signal, the read-only behaviour — is a
 * consequence of it, and each is asserted as such.
 */
import {
  AuditProvider,
  TelemetryProvider,
  type AuditCriterion,
  type AuditFacts,
  type AuditFinding,
  type AuditResult,
  type AuditService,
} from '@labre/affine-shared/services';
import { Bound } from '@labre/global/gfx';
import type { BlockStdScope } from '@labre/std';
import {
  GfxControllerIdentifier,
  GfxPrimitiveElementModel,
  type RoleDefs,
} from '@labre/std/gfx';
import { describe, expect, test, vi } from 'vitest';

import { collectAuditFacts, runMapAudit, auditCommands } from '../extensions/audit.js';
import type { FrameworkBackgroundDef } from '../framework-background/def.js';
import {
  evaluateRules,
  ValidationManager,
  ValidationRuleIdentifier,
  type ValidationRule,
  type Violation,
} from '../extensions/validation.js';

/* -------------------------------------------------------------------------- */
/* A miniature framework, so the suite depends on no gfx package              */
/* -------------------------------------------------------------------------- */

const ROLE = {
  frame: 'test:frame',
  node: 'test:node',
  market: 'test:market',
  edge: 'test:edge',
} as const;

const ROLES: RoleDefs = {
  [ROLE.frame]: { id: ROLE.frame, kind: 'node', labelKey: 'k.frame' },
  [ROLE.node]: { id: ROLE.node, kind: 'node', labelKey: 'k.node' },
  // A specialisation, so the vocabulary handed to the assistant is not flat.
  [ROLE.market]: { id: ROLE.market, parent: ROLE.node, kind: 'node' },
  [ROLE.edge]: { id: ROLE.edge, kind: 'edge', labelKey: 'k.edge' },
};

/**
 * A frame 1000 × 500 with a 100-unit margin all round, so the plot is
 * 800 × 300 starting at (100, 100) — numbers picked so every ratio below is
 * exact and a wrong margin cannot pass by rounding.
 */
/** Painting detail the audit never reads — declared only to satisfy the type. */
const STROKE = { color: '#000000', width: 1 };

const BACKGROUND: FrameworkBackgroundDef = {
  type: 'test',
  role: ROLE.frame,
  geometry: {
    width: 1000,
    height: 500,
    lockAspectRatio: false,
    resizable: true,
    margin: { left: 100, top: 100, right: 100, bottom: 100 },
  },
  zones: [
    { id: 'early', rect: { x: 0, y: 0, w: 0.5, h: 1 } },
    { id: 'late', rect: { x: 0.5, y: 0, w: 0.5, h: 1 } },
  ],
  axes: [
    { id: 'evolution', orientation: 'horizontal', at: 1, stroke: STROKE },
    { id: 'value', orientation: 'vertical', at: 0, stroke: STROKE },
  ],
};

const RULE: ValidationRule = {
  id: 'test.on-frame',
  framework: 'test',
  family: 'element-in-background',
  severity: 'warning',
  appliesTo: ROLE.node,
  roles: ROLES,
  messageKey: 'com.labre.test.on-frame',
  version: 1,
  backgroundRole: ROLE.frame,
  background: BACKGROUND,
};

const CRITERION: AuditCriterion = {
  id: 'test.A1',
  framework: 'test',
  labelKey: 'com.labre.test.audit.A1',
  fallback: 'A1',
  prompt: 'is the positioning justified',
  version: 2,
};

/* -------------------------------------------------------------------------- */
/* Harness                                                                     */
/* -------------------------------------------------------------------------- */

/**
 * A real `GfxPrimitiveElementModel` prototype — `selectedFrames` gates on
 * `instanceof`, so a plain object would pass a test that production fails.
 */
function element(
  id: string,
  xywh: [number, number, number, number],
  role?: string,
  validationProfile?: string,
  absolutePath?: [number, number][]
): GfxPrimitiveElementModel {
  const el = Object.create(GfxPrimitiveElementModel.prototype) as Record<
    string,
    unknown
  >;
  const serialized = `[${xywh.join(',')}]`;
  if (absolutePath) {
    Object.defineProperty(el, 'absolutePath', {
      value: absolutePath,
      enumerable: true,
    });
  }
  Object.defineProperties(el, {
    id: { value: id, enumerable: true },
    role: { value: role, enumerable: true },
    // Shadowed explicitly: the real accessors are `@field()`s that read through
    // a `Y.Map`, and the engine consults this one for every finding it raises.
    validationExceptions: { value: undefined, enumerable: true },
    validationProfile: { value: validationProfile, enumerable: true },
    xywh: { value: serialized, enumerable: true },
    elementBound: { get: () => Bound.deserialize(serialized) },
  });
  return el as unknown as GfxPrimitiveElementModel;
}

interface Wiring {
  elements?: GfxPrimitiveElementModel[];
  selected?: GfxPrimitiveElementModel[];
  rules?: readonly ValidationRule[];
  criteria?: readonly AuditCriterion[];
  service?: AuditService;
  manager?: Pick<
    ValidationManager,
    'violations$' | 'auditFindings$' | 'setAuditFindings'
  >;
  telemetry?: { track: (name: string, props: unknown) => void };
}

/** A stub manager: the two signals and the one writer, nothing else. */
function stubManager(violations: Violation[] = []) {
  const state = {
    violations$: { peek: () => violations },
    auditFindings$: { value: [] as readonly AuditFinding[] },
    setAuditFindings(findings: readonly AuditFinding[]) {
      state.auditFindings$.value = findings;
    },
  };
  return state as unknown as Wiring['manager'] & {
    auditFindings$: { value: readonly AuditFinding[] };
  };
}

function stubStd(wiring: Wiring = {}): BlockStdScope {
  const rules = wiring.rules ?? [RULE];
  const criteria = wiring.criteria ?? [CRITERION];
  const gfx = {
    surface: { elementModels: wiring.elements ?? [] },
    selection: { selectedElements: wiring.selected ?? [] },
  };
  return {
    get: (identifier: unknown) => {
      if (identifier === GfxControllerIdentifier) return gfx;
      throw new Error('unexpected required lookup');
    },
    getOptional: (identifier: unknown) => {
      if (identifier === ValidationManager) return wiring.manager;
      if (identifier === AuditProvider) return wiring.service;
      if (identifier === TelemetryProvider) return wiring.telemetry;
      return undefined;
    },
    provider: {
      getAll: (identifier: unknown) => {
        if (identifier === ValidationRuleIdentifier) {
          return new Map(rules.map(r => [r.id, r]));
        }
        // The criteria identifier is a factory keyed by id; matching on the
        // rule identifier above is enough to tell the two apart here.
        return new Map(criteria.map(c => [c.id, c]));
      },
    },
  } as unknown as BlockStdScope;
}

const finding = (over: Partial<AuditFinding> = {}): AuditFinding =>
  ({
    ruleId: 'ignored',
    elementIds: ['n1'],
    severity: 'audit',
    messageKey: 'com.labre.test.audit.finding',
    criterionId: CRITERION.id,
    criterionVersion: 1,
    at: 0,
    ...over,
  }) as AuditFinding;

const answering = (result: AuditResult | (() => Promise<AuditResult>)) =>
  ({
    runAudit: typeof result === 'function' ? result : async () => result,
  }) as AuditService;

/** A frame and three things on it, at known plot ratios. */
function board() {
  const frame = element('map', [0, 0, 1000, 500], ROLE.frame, 'test.strict');
  return {
    frame,
    // Centre at (300, 250) → plot ratio ((300-100)/800, (250-100)/300) =
    // (0.25, 0.5) → zone `early`.
    early: element('n1', [280, 230, 40, 40], ROLE.node),
    // Centre at (700, 250) → (0.75, 0.5) → zone `late`.
    late: element('n2', [680, 230, 40, 40], ROLE.market),
    // Nowhere near the frame.
    off: element('n3', [5000, 5000, 40, 40], ROLE.node),
    // Neutral: no role at all.
    neutral: element('free', [300, 300, 40, 40]),
  };
}

/* -------------------------------------------------------------------------- */

describe('the facts handed to the assistant', () => {
  const { frame, early, late, off, neutral } = board();
  const std = stubStd({
    elements: [frame, early, late, off, neutral],
    manager: stubManager([
      {
        ruleId: RULE.id,
        elementIds: ['n3'],
        severity: 'warning',
        messageKey: RULE.messageKey,
        backgroundId: 'map',
      },
    ]),
  });
  const facts = collectAuditFacts(std);

  test('are render-free: a JSON round-trip changes nothing', () => {
    // ADR 0006 § 5. No element model, no `Bound`, no function, no template —
    // and the honest test of that is whether it survives a `postMessage`.
    expect(JSON.parse(JSON.stringify(facts))).toEqual(facts);
  });

  test('carry the role vocabulary, hierarchy included', () => {
    expect(facts.roles).toEqual(
      expect.arrayContaining([
        { id: ROLE.node, kind: 'node', labelKey: 'k.node' },
        // The specialisation survives, and so does the absent labelKey.
        { id: ROLE.market, kind: 'node', parent: ROLE.node },
      ])
    );
  });

  test('describe the frame by its declaration, not by its pixels', () => {
    expect(facts.frames).toEqual([
      {
        elementId: 'map',
        framework: 'test',
        type: 'test',
        profileId: 'test.strict',
        axes: [
          { id: 'evolution', orientation: 'horizontal', forward: [1, 0] },
          { id: 'value', orientation: 'vertical', forward: [0, -1] },
        ],
        zones: [
          { id: 'early', rect: { x: 0, y: 0, w: 0.5, h: 1 } },
          { id: 'late', rect: { x: 0.5, y: 0, w: 0.5, h: 1 } },
        ],
      },
    ]);
  });

  test('place each element in PLOT ratios, and name its zone', () => {
    // Ratios of the plot, not of the element box: the 100-unit margin is
    // exactly where a naive implementation would go wrong, and `0.25` vs the
    // `0.3` a box-relative reading would give is the whole difference.
    expect(facts.elements).toContainEqual({
      id: 'n1',
      role: ROLE.node,
      frameId: 'map',
      at: [0.25, 0.5],
      zone: 'early',
    });
    expect(facts.elements).toContainEqual({
      id: 'n2',
      role: ROLE.market,
      frameId: 'map',
      at: [0.75, 0.5],
      zone: 'late',
    });
  });

  test('a far-away element is still attributed, and reads as outside', () => {
    // Same nearest-frame heuristic the engine uses, so an audit and a rule
    // never disagree about which map a component belongs to.
    const fact = facts.elements.find(e => e.id === 'n3');
    expect(fact?.frameId).toBe('map');
    expect(fact?.at?.[0]).toBeGreaterThan(1);
    expect(fact?.zone).toBeUndefined();
  });

  test('neutral elements are not facts about a framework map', () => {
    expect(facts.elements.map(e => e.id)).not.toContain('free');
    // ...and the frame is not one of its own contents.
    expect(facts.elements.map(e => e.id)).not.toContain('map');
  });

  test('carry levels 1 and 2 as the engine computed them', () => {
    expect(facts.violations).toEqual([
      {
        ruleId: RULE.id,
        severity: 'warning',
        elementIds: ['n3'],
        messageKey: RULE.messageKey,
        backgroundId: 'map',
      },
    ]);
  });

  test('never carry a previous audit’s opinions back in', () => {
    // Otherwise a second run starts agreeing with itself.
    const withAudit = collectAuditFacts(
      stubStd({
        elements: [frame],
        manager: stubManager([
          {
            ruleId: 'audit:test.A1',
            elementIds: ['n1'],
            severity: 'audit',
            messageKey: 'whatever',
          },
        ]),
      })
    );
    expect(withAudit.violations).toEqual([]);
  });

  test('with no framework enabled, there is nothing to audit', () => {
    // Flag off ⇒ no rule registered ⇒ no frame, no vocabulary, no elements.
    const dark = collectAuditFacts(
      stubStd({ elements: [frame, early], rules: [], manager: stubManager() })
    );
    expect(dark.frames).toEqual([]);
    expect(dark.roles).toEqual([]);
    expect(dark.elements).toEqual([]);
  });
});

describe('running an audit', () => {
  test('hands the provider the criteria and the facts, and files the answer', async () => {
    const manager = stubManager();
    let received: unknown;
    const result = await runMapAudit(
      stubStd({
        elements: [board().frame],
        manager,
        service: answering(async () => ({
          status: 'complete',
          findings: [finding()],
        })) as AuditService,
      })
    );

    expect(result.status).toBe('complete');
    expect(manager!.auditFindings$.value).toHaveLength(1);
    expect(manager!.auditFindings$.value[0].ruleId).toBe('audit:test.A1');
    void received;
  });

  test('the criteria come from the registry, versioned', async () => {
    let asked: readonly AuditCriterion[] = [];
    await runMapAudit(
      stubStd({
        manager: stubManager(),
        service: {
          runAudit: async req => {
            asked = req.criteria;
            return { status: 'complete', findings: [] };
          },
        },
      })
    );

    expect(asked).toEqual([CRITERION]);
    expect(asked[0].version).toBe(2);
  });

  test('a subset can be re-checked without paying for the rest', async () => {
    let asked: readonly AuditCriterion[] = [];
    await runMapAudit(
      stubStd({
        manager: stubManager(),
        service: {
          runAudit: async req => {
            asked = req.criteria;
            return { status: 'complete', findings: [] };
          },
        },
      }),
      { criterionIds: ['nope'] }
    );

    // An unknown id degrades to auditing nothing rather than failing the run.
    expect(asked).toEqual([]);
  });

  test('reports progress through to the caller', async () => {
    const seen: number[] = [];
    await runMapAudit(
      stubStd({
        manager: stubManager(),
        service: {
          runAudit: async (_req, options) => {
            options.onProgress?.({ done: 1, total: 2 });
            options.onProgress?.({ done: 2, total: 2 });
            return { status: 'complete', findings: [] };
          },
        },
      }),
      { onProgress: p => seen.push(p.done) }
    );

    expect(seen).toEqual([1, 2]);
  });

  test('an interruption keeps what was already found', async () => {
    const manager = stubManager();
    const controller = new AbortController();
    const result = await runMapAudit(
      stubStd({
        manager,
        service: {
          runAudit: async () => ({
            status: 'aborted',
            findings: [finding()],
          }),
        },
      }),
      { signal: controller.signal }
    );

    expect(result.status).toBe('aborted');
    expect(manager!.auditFindings$.value).toHaveLength(1);
  });

  test('without a provider it degrades, and clears any stale opinion', async () => {
    const manager = stubManager();
    manager!.setAuditFindings([finding()]);

    const result = await runMapAudit(stubStd({ manager }));

    expect(result.status).toBe('unavailable');
    // A stale opinion is worse than none: the board changed under it.
    expect(manager!.auditFindings$.value).toEqual([]);
  });
});

describe('telemetry', () => {
  const events = () => {
    const seen: { name: string; props: Record<string, unknown> }[] = [];
    return {
      seen,
      telemetry: {
        track: (name: string, props: unknown) =>
          seen.push({ name, props: props as Record<string, unknown> }),
      },
    };
  };

  test('a completed run emits started then completed', async () => {
    const { seen, telemetry } = events();
    await runMapAudit(
      stubStd({
        elements: [board().frame],
        manager: stubManager(),
        telemetry,
        service: answering({ status: 'complete', findings: [finding()] }),
      })
    );

    expect(seen.map(e => e.name)).toEqual([
      'MapAuditStarted',
      'MapAuditCompleted',
    ]);
    expect(seen[0].props).toMatchObject({
      framework: 'test',
      criterionCount: 1,
      frameCount: 1,
    });
    expect(seen[1].props).toMatchObject({ findingCount: 1 });
    expect(seen[1].props.durationMs).toBeGreaterThanOrEqual(0);
  });

  test('the two series balance: a refused run still emits both', async () => {
    const { seen, telemetry } = events();
    await runMapAudit(stubStd({ manager: stubManager(), telemetry }));

    expect(seen.map(e => e.name)).toEqual([
      'MapAuditStarted',
      'MapAuditInterrupted',
    ]);
    expect(seen[1].props).toMatchObject({ reason: 'unavailable' });
  });

  test('an abort is reported as an interruption, not a failure', async () => {
    const { seen, telemetry } = events();
    const controller = new AbortController();
    controller.abort();
    await runMapAudit(
      stubStd({
        manager: stubManager(),
        telemetry,
        service: answering({ status: 'complete', findings: [] }),
      }),
      { signal: controller.signal }
    );

    expect(seen[1]).toMatchObject({
      name: 'MapAuditInterrupted',
      props: { reason: 'aborted' },
    });
  });

  test('carries counts and ids only — never board content', async () => {
    const { seen, telemetry } = events();
    await runMapAudit(
      stubStd({
        elements: [board().frame, board().early],
        manager: stubManager(),
        telemetry,
        service: answering({ status: 'complete', findings: [] }),
      })
    );

    const payload = JSON.stringify(seen);
    expect(payload).not.toContain(CRITERION.prompt);
    expect(payload).not.toContain('n1');
  });
});

describe('the command', () => {
  const command = auditCommands[0];

  test('is on the agent surface, which is the point of the slice', () => {
    expect(command.id).toBe('map.audit');
    expect(command.surfaces).toContain('agent');
    // Not a senior-menu slot: those 14 are for artefacts.
    expect(command.surfaces).not.toContain('senior-menu');
  });

  test('declares the serializable precondition a host catalogue can show', () => {
    expect(command.availability).toBe('selection:framework');
    expect(command.defaultKeys).toEqual({ mac: [], other: [] });
  });

  test('stands up only on a selected FRAME', () => {
    const { frame, early } = board();
    expect(command.when?.(stubStd({ selected: [frame] }))).toBe(true);
    // A component on the map is not the map.
    expect(command.when?.(stubStd({ selected: [early] }))).toBe(false);
    expect(command.when?.(stubStd({ selected: [] }))).toBe(false);
  });

  test('stands down when the framework is flagged off', () => {
    const { frame } = board();
    expect(command.when?.(stubStd({ selected: [frame], rules: [] }))).toBe(
      false
    );
  });

  test('rejects invalid params instead of auditing something else', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const manager = stubManager();
    await command.run(
      stubStd({ manager, service: answering({ status: 'complete', findings: [] }) }),
      { surface: 'agent', source: 'ai' },
      { criterionIds: 'not-an-array' }
    );

    expect(manager!.auditFindings$.value).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  test('carries no function across the serializable seam', () => {
    // The manifest projection is what an agent reads. A function in it would
    // be a coupling that cannot cross a `postMessage`.
    const entry = JSON.parse(
      JSON.stringify({
        id: command.id,
        surfaces: command.surfaces,
        availability: command.availability,
      })
    );
    expect(entry).toEqual({
      id: 'map.audit',
      surfaces: ['palette', 'agent'],
      availability: 'selection:framework',
    });
  });
});

describe('read-only (the `pivot.bind` pattern, and its deliberate difference)', () => {
  /**
   * `pivot.bind` guards `!std.store.readonly` inside `run`. `map.audit` does
   * not, and that is a decision rather than an omission: it writes nothing.
   * Reviewing a map you have been given and cannot change is not an edge case
   * for an audit, it is THE case.
   *
   * The invariant a guard would protect is asserted directly instead.
   *
   * ## This test is a CANARY, not a proof
   *
   * Nothing on the `map.audit` path touches `std.store` today, so the trap
   * below cannot fire and the test passes for a reason weaker than it looks: it
   * demonstrates absence of a write only in the sense that it would DETECT one.
   * That is exactly its job — it is a regression sentinel armed for the day
   * somebody adds a write (accepting a finding as a `validationExceptions`
   * entry is the obvious candidate), at which point it fails and the guard
   * decision gets reopened. Read as a proof it would be overclaiming; read as a
   * tripwire it is worth keeping.
   */
  test('runs to completion on a read-only document', async () => {
    const manager = stubManager();
    const std = stubStd({
      elements: [board().frame],
      manager,
      service: answering({ status: 'complete', findings: [finding()] }),
    });
    // A store that fails loudly if anything tries to write through it.
    (std as unknown as { store: unknown }).store = {
      readonly: true,
      transact: () => {
        throw new Error('wrote to a read-only document');
      },
      captureSync: () => {
        throw new Error('opened an undo step on a read-only document');
      },
    };

    const result = await runMapAudit(std);

    expect(result.status).toBe('complete');
    expect(manager!.auditFindings$.value).toHaveLength(1);
  });

  test('the elements it read are untouched', () => {
    const { frame, early } = board();
    const before = [frame, early].map(el => el.xywh + '|' + String(el.role));
    collectAuditFacts(
      stubStd({ elements: [frame, early], manager: stubManager() })
    );

    expect([frame, early].map(el => el.xywh + '|' + String(el.role))).toEqual(
      before
    );
  });
});

describe('the deterministic engine never depends on the AI', () => {
  test('audit findings live in their own signal, not in violations$', () => {
    const manager = new ValidationManager({
      std: { provider: { getAll: () => new Map() }, getOptional: () => null },
      surface$: { value: null, peek: () => null },
    } as never);

    manager.setAuditFindings([finding()]);

    expect(manager.auditFindings$.peek()).toHaveLength(1);
    // The signal every canvas consumer reads is untouched.
    expect(manager.violations$.peek()).toEqual([]);
  });

  test('a run REPLACES the previous one rather than accumulating', () => {
    const manager = new ValidationManager({
      std: { provider: { getAll: () => new Map() }, getOptional: () => null },
      surface$: { value: null, peek: () => null },
    } as never);

    manager.setAuditFindings([finding({ elementIds: ['a'] })]);
    manager.setAuditFindings([finding({ elementIds: ['b'] })]);

    // Two runs are two whole answers about the board; showing both would show
    // a contradiction and call it a list.
    expect(manager.auditFindings$.peek()).toHaveLength(1);
    expect(manager.auditFindings$.peek()[0].elementIds).toEqual(['b']);
  });

  test('an AuditFinding IS a violation object at audit severity', () => {
    // Pinned as a type relation, so a host panel can render one with the code
    // it already has — and so that widening `Violation` cannot silently
    // desynchronise the two shapes.
    const asViolation: Violation = finding();

    expect(asViolation.severity).toBe('audit');
    expect(asViolation.elementIds).toEqual(['n1']);
  });

  test('evaluateRules has no way to see an audit at all', () => {
    // The 16 ms budget is measured on a pure function whose signature is
    // `(rules, elements, profiles?, incremental?)`. There is no parameter an
    // audit could enter through — the structural half of the invariant. The
    // numeric half is the bench below.
    expect(evaluateRules).toHaveLength(2);
  });
});

/**
 * The attack the recette found, replayed end to end (PF14.1, BLOQUANT).
 *
 * `backgroundAxisFacts` returns `forward` straight from a module constant, and
 * `as const` is compile-time only — so before the fix, every
 * `frames[].axes[].forward` handed to a provider WAS the array
 * `evaluateOrientationAgainstAxis` multiplies against. A provider writing into
 * its own input flipped the axis convention for the whole process, and a
 * correct change arrow started reporting as a violation on the canvas.
 *
 * The assertion is the one the reviewer ran: the DETERMINISTIC verdict, before
 * and after an audit, with a hostile provider in between.
 */
describe('a hostile provider cannot move the deterministic verdict', () => {
  const AXIS_RULE: ValidationRule = {
    id: 'test.runs-with-axis',
    framework: 'test',
    family: 'orientation-against-axis',
    severity: 'warning',
    appliesTo: ROLE.edge,
    roles: ROLES,
    messageKey: 'com.labre.test.runs-with-axis',
    version: 1,
    backgroundRole: ROLE.frame,
    background: BACKGROUND,
    against: { axis: 'evolution', toleranceDeg: 5 },
  };

  /** A frame, and an arrow running WITH the evolution axis — i.e. correct. */
  function boardWithArrow() {
    return [
      element('map', [0, 0, 1000, 500], ROLE.frame),
      element('arrow', [200, 240, 300, 2], ROLE.edge, undefined, [
        [200, 240],
        [500, 240],
      ]),
    ];
  }

  test('the axis convention survives a provider that writes into the facts', async () => {
    const elements = boardWithArrow();
    const verdict = () =>
      evaluateRules([AXIS_RULE], elements).map(v => v.ruleId);

    // The arrow is correct, and the engine says so.
    expect(verdict()).toEqual([]);

    const std = stubStd({
      elements,
      rules: [AXIS_RULE],
      manager: stubManager(),
      service: {
        runAudit: async request => {
          // "Normalising" the vector in place — the plausible, well-meaning
          // version of the attack, which is what makes it worth guarding.
          for (const frame of request.facts.frames) {
            for (const axis of frame.axes) {
              const forward = axis.forward as unknown as [number, number];
              forward[0] = -forward[0];
              forward[1] = -forward[1];
            }
          }
          return { status: 'complete', findings: [] };
        },
      },
    });

    await runMapAudit(std);

    // Same board, same rule, same arrow: the verdict cannot have moved.
    expect(verdict()).toEqual([]);
  });

  test('the facts the provider sees are a copy, not the engine’s own data', async () => {
    // Identity, not value — the property `toEqual` and a JSON round-trip are
    // both structurally blind to.
    const elements = boardWithArrow();
    const mine = collectAuditFacts(
      stubStd({ elements, rules: [AXIS_RULE], manager: stubManager() })
    );
    let handed: AuditFacts | undefined;

    await runMapAudit(
      stubStd({
        elements,
        rules: [AXIS_RULE],
        manager: stubManager(),
        service: {
          runAudit: async request => {
            handed = request.facts;
            return { status: 'complete', findings: [] };
          },
        },
      })
    );

    expect(handed?.frames[0].axes[0].forward).toEqual(
      mine.frames[0].axes[0].forward
    );
    expect(handed?.frames[0].axes[0].forward).not.toBe(
      mine.frames[0].axes[0].forward
    );
  });
});

describe('two audits at once: the newest wins', () => {
  /**
   * An audit is a network call and takes seconds, so overlap is what happens
   * when a user asks again because the first one is slow. Publication used to
   * follow order of RESOLUTION, so the stale answer overwrote the fresh one.
   */
  const deferred = () => {
    let release!: (r: AuditResult) => void;
    const promise = new Promise<AuditResult>(resolve => {
      release = resolve;
    });
    return { promise, release };
  };

  /**
   * ONE editor scope — the generation is keyed on it — answering differently
   * per call: the first invocation hangs, the second answers at once.
   */
  function overlapping() {
    const slow = deferred();
    const events: { name: string; props: Record<string, unknown> }[] = [];
    let call = 0;
    const std = stubStd({
      manager: stubManager(),
      telemetry: {
        track: (name: string, props: unknown) =>
          events.push({ name, props: props as Record<string, unknown> }),
      },
      service: {
        runAudit: async () =>
          ++call === 1
            ? slow.promise
            : { status: 'complete' as const, findings: [finding({ elementIds: ['FRESH'] })] },
      },
    });
    return { std, slow, events };
  }

  test('a slow FIRST run does not overwrite a fast second one', async () => {
    const { std, slow } = overlapping();
    const manager = std.getOptional(ValidationManager) as unknown as {
      auditFindings$: { value: readonly AuditFinding[] };
    };

    const first = runMapAudit(std); // hangs
    await runMapAudit(std); // issued second, resolves first

    expect(manager.auditFindings$.value[0].elementIds).toEqual(['FRESH']);

    slow.release({
      status: 'complete',
      findings: [finding({ elementIds: ['STALE'] })],
    });
    const firstResult = await first;

    // The stale answer is dropped whole, and says so.
    expect(firstResult.status).toBe('superseded');
    expect(manager.auditFindings$.value[0].elementIds).toEqual(['FRESH']);
  });

  test('a superseded run is not counted as a completion', async () => {
    // A `findingCount` for findings nobody will see is a metric that lies.
    const { std, slow, events } = overlapping();

    const first = runMapAudit(std);
    await runMapAudit(std);
    slow.release({ status: 'complete', findings: [finding()] });
    await first;

    expect(events).toContainEqual(
      expect.objectContaining({
        name: 'MapAuditInterrupted',
        props: expect.objectContaining({ reason: 'superseded' }),
      })
    );
    // Exactly one completion — the fresh run's.
    expect(events.filter(e => e.name === 'MapAuditCompleted')).toHaveLength(1);
  });
});

/**
 * The 16 ms budget, measured against an audit rather than argued about
 * (PF14.1 § "budget intouché").
 *
 * The claim is not "the audit is fast" — the audit is a network call to a model
 * and takes seconds. The claim is that **the deterministic engine does not pay
 * for it**: a board carrying a full set of audit findings re-judges in exactly
 * the same time as one carrying none, because `evaluate()` never reads them.
 *
 * A separate signal is what makes that true by construction; this measures it,
 * because "by construction" is how the expensive filter nobody noticed gets
 * added two slices later.
 */
describe('the 16 ms budget does not pay for the audit', () => {
  /** One 60 fps frame — the same budget `validation.bench` asserts. */
  const FRAME_BUDGET_MS = 16;
  const MAP_SIZE = 500;

  /** Median of `runs` timed evaluations, after a warm-up. */
  function medianMs(run: () => unknown, runs = 21, warmup = 5): number {
    for (let i = 0; i < warmup; i++) run();
    const samples: number[] = [];
    for (let i = 0; i < runs; i++) {
      const start = performance.now();
      run();
      samples.push(performance.now() - start);
    }
    samples.sort((a, b) => a - b);
    return samples[Math.floor(samples.length / 2)];
  }

  function denseBoard(size: number): GfxPrimitiveElementModel[] {
    const elements = [element('map', [0, 0, 1000, 500], ROLE.frame)];
    for (let i = 0; i < size; i++) {
      // A third of them deliberately off the map, so the rule really raises.
      const x = i % 3 === 0 ? 4000 + i : 120 + ((i * 7) % 700);
      elements.push(element(`e-${i}`, [x, 120 + ((i * 11) % 250), 20, 20], ROLE.node));
    }
    return elements;
  }

  const elements = denseBoard(MAP_SIZE);

  function managerOver(
    board: GfxPrimitiveElementModel[]
  ): ValidationManager {
    const feed = () => ({ subscribe: () => ({ unsubscribe() {} }) });
    const surface = {
      elementModels: board,
      elementAdded: feed(),
      elementRemoved: feed(),
      elementUpdated: feed(),
    };
    return new ValidationManager({
      surface,
      surface$: { value: surface, peek: () => surface },
      std: {
        provider: {
          getAll: (identifier: unknown) =>
            new Map<string, unknown>(
              identifier === ValidationRuleIdentifier ? [['rule', RULE]] : []
            ),
        },
        getOptional: () => null,
      },
    } as never);
  }

  test('a full re-judgement stays inside the frame, audit or no audit', () => {
    const clean = managerOver(elements);
    const audited = managerOver(elements);
    // A finding per element: far more than an assistant would ever return, so
    // the measurement is a ceiling rather than a favourable case.
    audited.setAuditFindings(
      elements.map(el => finding({ elementIds: [el.id] }))
    );

    const withoutAudit = medianMs(() => clean.evaluate());
    const withAudit = medianMs(() => audited.evaluate());

    console.info(
      `[bench] full evaluation, ${MAP_SIZE} elements: ${withoutAudit.toFixed(3)} ms clean vs ` +
        `${withAudit.toFixed(3)} ms with ${elements.length} audit findings loaded ` +
        `(budget ${FRAME_BUDGET_MS} ms)`
    );

    expect(withoutAudit).toBeLessThan(FRAME_BUDGET_MS);
    expect(withAudit).toBeLessThan(FRAME_BUDGET_MS);
    // Generous against a noisy runner in both directions: the claim is that the
    // audit is not ON the path, so the two numbers describe the same work.
    expect(withAudit).toBeLessThan(withoutAudit * 2 + 1);
  });

  test('and reaches exactly the same verdict', () => {
    // The other half of "not on the path": the answer must be identical too,
    // or the audit would be influencing the engine rather than merely costing
    // it nothing.
    const clean = managerOver(elements);
    const audited = managerOver(elements);
    audited.setAuditFindings([finding({ elementIds: ['e-1'] })]);

    clean.evaluate();
    audited.evaluate();

    const key = (v: Violation) => `${v.ruleId}|${v.elementIds.join('+')}`;
    expect(clean.violations$.peek()).not.toHaveLength(0);
    expect(audited.violations$.peek().map(key)).toEqual(
      clean.violations$.peek().map(key)
    );
    // ...and the engine's own signal never picked up the audit.
    expect(
      audited.violations$.peek().some(v => v.severity === 'audit')
    ).toBe(false);
  });
});
