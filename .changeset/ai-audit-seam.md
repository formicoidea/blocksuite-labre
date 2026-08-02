---
'@labre/affine': minor
---

The AI audit seam, for a host-side assistant (PF14.1)

A framework can now declare **audit criteria** as versioned data, and a host can
plug an assistant in to evaluate them. The library ships the seam and nothing
else: no model, no prompt runner, and no dependency on one. Wardley ships the
first three criteria — A1 positioning is justified (contextual ubiquity, not
technical maturity), A2 the value chain is legible, A3 the model applies here
(competitive landscapes only). See `docs/adr/0008` § surface `'agent'`.

**The invariant.** The deterministic engine never depends on the AI. Levels 1
and 2 — the rules evaluated inside the 16 ms frame budget — are computed,
rendered and arbitrated with no knowledge that the seam exists. Audit results
land in a **separate signal** (`ValidationManager.auditFindings$`), never in
`violations$`, and their severity is forced to `audit` library-side rather than
trusted, so a provider cannot put a model's opinion behind a canvas bracket. A
bench asserts the numeric half: a board carrying a finding per element re-judges
in the same time as a clean one.

**What hosts get.**

1. `AuditExtension(service)` injects an `AuditService`:

   ```ts
   runAudit(
     request: { criteria: AuditCriterion[]; facts: AuditFacts },
     options: { onProgress?: (p: AuditProgress) => void; signal?: AbortSignal }
   ): Promise<AuditResult>
   ```

   `facts` is render-free and serializable end to end (ADR 0006 § 5): the role
   vocabulary, each framework frame with its axes and named zones as plot
   ratios, every role-carrying element placed inside its frame, and the level
   1/2 findings the engine already computed. No element model, no `Bound`, no
   template, no function — it survives a `postMessage`.

2. The `map.audit` command, on the `'agent'` and `'palette'` surfaces,
   `availability: 'selection:framework'`, keyless but bindable.

3. Three telemetry events — `MapAuditStarted`, `MapAuditCompleted`,
   `MapAuditInterrupted` — carrying counts and ids only.

**A new switch axis: `OPTIONAL_CAPABILITIES`.** `ai-audit` gates the command,
with the same contract as a block flag (missing key = enabled, disabling removes
tooling only) but on its **own list**, because `OPTIONAL_BLOCKS` answers "does
this block or framework exist for this user" and every entry there names
something a document can contain. A capability names none. Hosts still pass one
object: `LabreFlags = BlockFlags & CapabilityFlags`, and the two key spaces are
disjoint, so a host that only ever spoke `BlockFlags` keeps compiling and
behaving identically.

Nothing here is persisted — criteria are code, findings are session state — so
switching `ai-audit` off cannot lose data even in principle.

**The request is isolated on the way out.** `requestAudit` hands the provider a
`structuredClone` of the request, not the caller's objects. This is the outbound
half of "a provider is not believed", symmetric with the finding normalisation:
some facts are not fresh objects — an axis `forward` vector came straight from a
module constant the engine multiplies against — so a provider writing into its
own input could flip an axis convention and turn correct arrows into violations
on the canvas. The clone closes the whole class, at a cost the seam already
claims (the request must be serializable).

**Two audits at once: the newest wins.** An audit is a network call and takes
seconds, so a user asking again while the first is in flight is ordinary. Runs
carry a generation; a run superseded by a newer one publishes nothing and
reports `MapAuditInterrupted` with `reason: 'superseded'` rather than a
completion whose `findingCount` describes findings nobody will see.

**Degradation is the default path.** No noop provider is registered. With none
injected (the standalone playground, every unit suite), `map.audit` is still
enumerable but refuses cleanly with `status: 'unavailable'` — not a throw, not a
console error — and levels 1 and 2 are untouched. A registered provider may also
_declare_ itself unavailable (assistant behind an app-side feature flag, quota
exhausted, no model configured); that is passed through rather than folded into
`complete`. A provider that throws becomes `status: 'error'`; an abort, whatever
shape it arrives in, becomes `status: 'aborted'` and **keeps the findings already
produced**.

**Host panels must tolerate stale element ids.** `AuditFinding.elementIds` is
checked for type and not validated against the surface: the board moves on while
an audit is in flight, so an id naming a departed element is stale rather than
wrong, and a lookup per id would be paid on every finding to say so.

**`map.audit` carries no read-only guard, deliberately.** Unlike `pivot.bind`,
it writes nothing: reviewing a map you have been given and cannot change is not
an edge case for an audit, it is the case. A test asserts it runs to completion
against a read-only store that throws on any write.
