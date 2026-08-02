/**
 * `AuditProvider` — the injectable AI-audit seam (PF14.1, ADR 0008 § surface
 * `'agent'`).
 *
 * The spec is written around the four properties that are load-bearing, in the
 * sense that losing any of them re-couples the deterministic engine to a model:
 *
 * 1. **The degraded path is the DEFAULT path.** No noop is registered, so the
 *    standalone playground and every unit suite run without a provider — and
 *    they must run, not merely not crash.
 * 2. **A provider's answer is normalised, not trusted.** Severity is forced to
 *    `'audit'`, the rule id is re-derived, and an answer to a question that was
 *    not asked is dropped. This is what keeps a model's opinion off the canvas.
 * 3. **Interruption is honoured whatever shape it arrives in** — a signal
 *    aborted before the call, an `AbortError` rejection, or a provider that
 *    resolves anyway after the caller gave up.
 * 4. **A broken host is not a crash.** A throwing `runAudit`, a throwing
 *    `onProgress`, a malformed findings array: all of them degrade.
 */
import type { BlockStdScope } from '@labre/std';
import { describe, expect, test, vi } from 'vitest';

import {
  AuditCriterionIdentifier,
  AuditProvider,
  getAuditCriteria,
  requestAudit,
  type AuditCriterion,
  type AuditFacts,
  type AuditFinding,
  type AuditProgress,
  type AuditRequest,
  type AuditResult,
  type AuditService,
} from '../../services/audit-service.js';

const criterion = (id: string, version = 1): AuditCriterion => ({
  id,
  framework: 'wardley',
  labelKey: `com.labre.wardley.audit.${id}`,
  fallback: id,
  prompt: `check ${id}`,
  version,
});

const A1 = criterion('wardley.A1');
const A2 = criterion('wardley.A2', 3);

const FACTS: AuditFacts = {
  roles: [{ id: 'wardley:component', kind: 'node' }],
  frames: [],
  elements: [],
  violations: [],
};

const request = (criteria: readonly AuditCriterion[]): AuditRequest => ({
  criteria,
  facts: FACTS,
});

/** A finding as a PROVIDER would hand it back — i.e. possibly wrong. */
const raw = (over: Partial<AuditFinding> = {}): AuditFinding =>
  ({
    ruleId: 'whatever',
    elementIds: ['el-1'],
    severity: 'audit',
    messageKey: 'com.labre.audit.finding',
    criterionId: A1.id,
    criterionVersion: 999,
    at: 0,
    ...over,
  }) as AuditFinding;

/**
 * The smallest `std` the seam reads: one optional lookup, plus `provider.getAll`
 * for the criteria registry. Anything beyond this would be a coupling the seam
 * exists to prevent.
 */
function stubStd(
  service?: AuditService,
  criteria: readonly AuditCriterion[] = []
): BlockStdScope {
  return {
    getOptional: (identifier: unknown) =>
      identifier === AuditProvider ? service : undefined,
    provider: {
      getAll: (identifier: unknown) =>
        new Map<string, unknown>(
          identifier === AuditCriterionIdentifier
            ? criteria.map(c => [c.id, c])
            : []
        ),
    },
  } as unknown as BlockStdScope;
}

/** A provider that answers with exactly what it is given. */
const provider = (
  run: AuditService['runAudit']
): AuditService => ({ runAudit: run });

const complete = (findings: AuditFinding[]): AuditResult => ({
  status: 'complete',
  findings,
});

describe('degradation without a provider', () => {
  test('refuses cleanly rather than throwing', async () => {
    const result = await requestAudit(stubStd(), request([A1]));

    expect(result).toEqual({ status: 'unavailable', findings: [] });
  });

  test('is a status, not an error — nothing is logged as a failure', async () => {
    // `unavailable` means "this build has no assistant", which is the shipped
    // configuration of the playground and of every unit suite. Treating it as
    // an error would put a console error in front of every standalone user.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    await requestAudit(stubStd(), request([A1]));

    expect(error).not.toHaveBeenCalled();
    error.mockRestore();
  });

  test('never touches the request it was given', async () => {
    const req = request([A1]);
    const snapshot = JSON.stringify(req);
    await requestAudit(stubStd(), req);

    expect(JSON.stringify(req)).toBe(snapshot);
  });
});

describe('the provider contract is enforced, not trusted', () => {
  test('severity is FORCED to audit, whatever came back', async () => {
    // The one that matters: `audit` is the severity `userFacingViolations`
    // filters out, so a provider returning `'warning'` would otherwise raise a
    // canvas bracket on an element over a sentence a model wrote.
    const std = stubStd(
      provider(async () =>
        complete([
          raw({ severity: 'blocking-overridable' as AuditFinding['severity'] }),
          raw({ severity: 'warning' as AuditFinding['severity'] }),
        ])
      )
    );

    const result = await requestAudit(std, request([A1]));

    expect(result.findings).toHaveLength(2);
    expect(result.findings.every(f => f.severity === 'audit')).toBe(true);
  });

  test('the rule id is re-derived from the criterion', async () => {
    // A provider naming a REGISTERED rule id would inherit that rule's
    // exceptions, its profile and its toolbar arbitration. `audit:` namespacing
    // makes the collision impossible rather than unlikely.
    const std = stubStd(
      provider(async () =>
        complete([raw({ ruleId: 'wardley.overlapping-artefacts' })])
      )
    );

    const result = await requestAudit(std, request([A1]));

    expect(result.findings[0].ruleId).toBe('audit:wardley.A1');
  });

  test('an answer to a question that was not asked is dropped', async () => {
    const std = stubStd(
      provider(async () =>
        complete([raw({ criterionId: A1.id }), raw({ criterionId: 'invented' })])
      )
    );

    const result = await requestAudit(std, request([A1]));

    expect(result.findings.map(f => f.criterionId)).toEqual([A1.id]);
  });

  test('the criterion VERSION is the library’s, not the provider’s', async () => {
    const std = stubStd(
      provider(async () => complete([raw({ criterionId: A2.id })]))
    );

    const result = await requestAudit(std, request([A2]));

    expect(result.findings[0].criterionVersion).toBe(A2.version);
  });

  test('every finding of one run carries the same timestamp', async () => {
    const std = stubStd(
      provider(async () =>
        complete([raw({ at: 1 }), raw({ at: 2 }), raw({ at: 3 })])
      )
    );
    const before = Date.now();

    const result = await requestAudit(std, request([A1]));

    const stamps = new Set(result.findings.map(f => f.at));
    expect(stamps.size).toBe(1);
    expect([...stamps][0]).toBeGreaterThanOrEqual(before);
  });

  test('a malformed elementIds degrades to an empty list', async () => {
    const std = stubStd(
      provider(async () =>
        complete([
          raw({ elementIds: undefined as unknown as string[] }),
          raw({ elementIds: ['ok', 42 as unknown as string] }),
        ])
      )
    );

    const result = await requestAudit(std, request([A1]));

    expect(result.findings[0].elementIds).toEqual([]);
    expect(result.findings[1].elementIds).toEqual(['ok']);
  });

  test('a provider that throws becomes an error status, not a crash', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const std = stubStd(
      provider(async () => {
        throw new Error('the assistant is down');
      })
    );

    const result = await requestAudit(std, request([A1]));

    expect(result.status).toBe('error');
    expect(result.reason).toBe('the assistant is down');
    expect(result.findings).toEqual([]);
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('progress', () => {
  test('is reported as the provider settles criteria', async () => {
    const seen: AuditProgress[] = [];
    const std = stubStd(
      provider(async (req, options) => {
        req.criteria.forEach((c, i) => {
          options.onProgress?.({
            done: i + 1,
            total: req.criteria.length,
            criterionId: c.id,
          });
        });
        return complete([]);
      })
    );

    await requestAudit(std, request([A1, A2]), {
      onProgress: p => seen.push(p),
    });

    expect(seen).toEqual([
      { done: 1, total: 2, criterionId: A1.id },
      { done: 2, total: 2, criterionId: A2.id },
    ]);
  });

  test('a throwing listener does not kill the run that feeds it', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const std = stubStd(
      provider(async (_req, options) => {
        options.onProgress?.({ done: 1, total: 1 });
        return complete([raw()]);
      })
    );

    const result = await requestAudit(std, request([A1]), {
      onProgress: () => {
        throw new Error('the progress bar exploded');
      },
    });

    expect(result.status).toBe('complete');
    expect(result.findings).toHaveLength(1);
    error.mockRestore();
  });

  test('no listener means the provider is handed none', async () => {
    // Not "handed one that does nothing": a provider deciding whether to
    // compute per-criterion progress at all should be able to tell.
    let handed: unknown = 'unset';
    const std = stubStd(
      provider(async (_req, options) => {
        handed = options.onProgress;
        return complete([]);
      })
    );

    await requestAudit(std, request([A1]));

    expect(handed).toBeUndefined();
  });
});

describe('interruption', () => {
  test('an already-aborted signal never starts a run', async () => {
    const runAudit = vi.fn(async () => complete([]));
    const controller = new AbortController();
    controller.abort();

    const result = await requestAudit(
      stubStd(provider(runAudit)),
      request([A1]),
      { signal: controller.signal }
    );

    expect(result).toEqual({ status: 'aborted', findings: [] });
    expect(runAudit).not.toHaveBeenCalled();
  });

  test('an AbortError rejection reads as aborted, not as an error', async () => {
    const controller = new AbortController();
    const std = stubStd(
      provider(async () => {
        const error = new Error('aborted');
        error.name = 'AbortError';
        throw error;
      })
    );

    const result = await requestAudit(std, request([A1]), {
      signal: controller.signal,
    });

    expect(result.status).toBe('aborted');
  });

  test('a provider resolving after the caller gave up is still an abort', async () => {
    // Honouring the caller's abort is not the provider's decision to make.
    const controller = new AbortController();
    const std = stubStd(
      provider(async () => {
        controller.abort();
        return complete([raw()]);
      })
    );

    const result = await requestAudit(std, request([A1]), {
      signal: controller.signal,
    });

    expect(result.status).toBe('aborted');
  });

  test('the signal reaches the provider, so it can stop working', async () => {
    let handed: AbortSignal | undefined;
    const controller = new AbortController();
    const std = stubStd(
      provider(async (_req, options) => {
        handed = options.signal;
        return complete([]);
      })
    );

    await requestAudit(std, request([A1]), { signal: controller.signal });

    expect(handed).toBe(controller.signal);
  });

  test('a provider that stops early KEEPS what it already found', async () => {
    // An audit interrupted halfway has still said something true. Throwing it
    // away would punish the user for pressing Cancel.
    const std = stubStd(
      provider(async () => ({
        status: 'aborted' as const,
        findings: [raw()],
      }))
    );

    const result = await requestAudit(std, request([A1]));

    expect(result.status).toBe('aborted');
    expect(result.findings).toHaveLength(1);
  });
});

describe('criteria are registered data, enumerated from DI', () => {
  test('none registered means none asked about', () => {
    expect(getAuditCriteria(stubStd())).toEqual([]);
  });

  test('registered criteria come back whole', () => {
    expect(getAuditCriteria(stubStd(undefined, [A1, A2]))).toEqual([A1, A2]);
  });
});

describe('the request that crosses the seam is render-free', () => {
  test('survives a structural round-trip untouched', async () => {
    // ADR 0006 § 5: no `TemplateResult`, no element model, no function. The
    // honest test of that is whether the thing survives `postMessage`.
    let received: AuditRequest | undefined;
    const std = stubStd(
      provider(async req => {
        received = req;
        return complete([]);
      })
    );

    await requestAudit(std, request([A1, A2]));

    expect(received).toBeDefined();
    expect(JSON.parse(JSON.stringify(received))).toEqual(received);
  });
});

describe('the request is ISOLATED, not merely serializable', () => {
  /**
   * The outbound half of "a provider is not believed" — and the half that was
   * missing (recette PF14.1, BLOQUANT).
   *
   * Value-comparing assertions are structurally blind to this: `toEqual` on
   * `{ forward: [1, 0] }` passes whether the array is a copy or the very one
   * the engine multiplies against. So these assert IDENTITY.
   */
  test('the provider never receives the object the caller holds', async () => {
    const req = request([A1]);
    let received: AuditRequest | undefined;
    const std = stubStd(
      provider(async r => {
        received = r;
        return complete([]);
      })
    );

    await requestAudit(std, req);

    expect(received).not.toBe(req);
    expect(received?.facts).not.toBe(req.facts);
    expect(received?.facts.roles).not.toBe(req.facts.roles);
    expect(received?.criteria).not.toBe(req.criteria);
    // ...and it is still the same DATA.
    expect(received).toEqual(req);
  });

  test('a provider that writes into its input cannot reach the caller', async () => {
    // The reviewer's scenario, at this layer: a provider that "normalises" a
    // vector in place. Before the fix, that array WAS the module constant the
    // engine reads, so a correct arrow started reporting as a violation.
    const shared: [number, number] = [1, 0];
    const req: AuditRequest = {
      criteria: [A1],
      facts: {
        ...FACTS,
        frames: [
          {
            elementId: 'map',
            framework: 'wardley',
            type: 'wardley',
            axes: [{ id: 'evolution', orientation: 'horizontal', forward: shared }],
            zones: [],
          },
        ],
      },
    };

    const std = stubStd(
      provider(async r => {
        const forward = r.facts.frames[0].axes[0]
          .forward as unknown as [number, number];
        forward[0] = -1;
        forward[1] = 99;
        (r.facts.frames[0] as { framework: string }).framework = 'hijacked';
        return complete([]);
      })
    );

    await requestAudit(std, req);

    // The vector the engine reads is untouched, whatever the provider did.
    expect(shared).toEqual([1, 0]);
    expect(req.facts.frames[0].axes[0].forward).toEqual([1, 0]);
    expect(req.facts.frames[0].framework).toBe('wardley');
  });

  test('facts that cannot be isolated are not sent at all', async () => {
    // A function in the facts is a library bug (ADR 0006 § 5 forbids it), and
    // this is where it stops: reported, degraded, never handed over.
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    const runAudit = vi.fn(async () => complete([]));
    const poisoned = {
      criteria: [A1],
      facts: { ...FACTS, roles: [{ id: 'x', kind: 'node', leak: () => 1 }] },
    } as unknown as AuditRequest;

    const result = await requestAudit(stubStd(provider(runAudit)), poisoned);

    expect(result.status).toBe('error');
    expect(runAudit).not.toHaveBeenCalled();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});

describe('a provider may declare itself unable to answer', () => {
  test('unavailable is passed through, not read as complete', async () => {
    // A registered provider CAN be unable: assistant behind an app-side feature
    // flag, quota exhausted, no model configured. Folding it into `complete`
    // both inflated the completion series and emptied the one number that
    // counts users reaching for an audit this build cannot deliver.
    const std = stubStd(
      provider(async () => ({ status: 'unavailable' as const, findings: [] }))
    );

    const result = await requestAudit(std, request([A1]));

    expect(result.status).toBe('unavailable');
  });

  test('but it cannot declare itself SUPERSEDED — that is the library’s call', async () => {
    const std = stubStd(
      provider(async () => ({
        status: 'superseded' as const,
        findings: [raw()],
      }))
    );

    const result = await requestAudit(std, request([A1]));

    expect(result.status).toBe('complete');
  });
});
