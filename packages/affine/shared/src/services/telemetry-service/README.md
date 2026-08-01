# Telemetry service — event taxonomy

The editor never talks to an analytics backend directly. It emits typed events
on an internal bus (`TelemetryService`) and the **host application injects the
adapter**:

```ts
// Standalone (playground, tests, self-hosted without analytics):
import { NoopTelemetryExtension } from '@labre/affine-shared/services';

// SaaS host (PostHog, GA4…):
import { TelemetryExtension } from '@labre/affine-shared/services';
const PostHogTelemetry = TelemetryExtension({
  track: (event, props) => posthog.capture(event, props),
});
```

Emission sites always use the optional accessor, so a missing adapter is safe:

```ts
std.getOptional(TelemetryProvider)?.track('FrameworkElementAdded', { ... });
```

## Block lifecycle taxonomy (the contract)

Every block flavour reports the same five moments, so product analytics can
compare blocks with one query. **A new block is not done until it emits these
events** (this is part of the block template):

| Event                | When                                                          | Required props |
| -------------------- | ------------------------------------------------------------- | -------------- |
| `BlockCreated`       | the block is inserted by a user action                        | `blockType` |
| `BlockEdited`        | first edit of an editing session on the block                 | `flavour` |
| `BlockDeleted`       | the block is removed by a user action                         | `flavour` |
| `BlockAbandoned`     | created then emptied/undone/deleted shortly after creation    | `flavour`, `reason` (`emptied` \| `deleted-after-create` \| `undo`), `ageMs` |
| `BlockUsageDuration` | end of an editing session on the block                        | `flavour`, `durationMs` |

`BlockEdited`, `BlockDeleted`, `BlockAbandoned` and `BlockUsageDuration` are
emitted automatically for every flavour by `BlockLifecycleTelemetryWatcher`
(registered in the foundation view extension, fed by store mutations, local
changes only). `BlockCreated` stays a UI-intent event emitted at insertion
sites — do not emit it from store plumbing.

Conventions:

- `flavour` is the store flavour (`affine:paragraph`, `affine:database`…).
- `page` distinguishes `doc editor` vs `whiteboard editor` when relevant.
- Events describe **user intent**, not store mechanics: a programmatic
  migration that rewrites blocks must not emit lifecycle events.

## Framework diagram taxonomy (wardley / edgy / cynefin…)

Business framework diagrams share one vocabulary; `framework` segments,
`element` identifies what was manipulated:

| Event                    | When                                  | `element` examples |
| ------------------------ | ------------------------------------- | ------------------ |
| `FrameworkElementAdded`  | an element is created from a toolbox  | `background:classic`, `background:opportunity`, `node:component`, `node:market`, `node:pipeline` |
| `FrameworkToolPicked`    | a framework drawing tool is activated | `connector:link`, `connector:arrow` |
| `FrameworkLegendCreated` | an auto-legend is generated           | `legend` |

Adding a framework = reuse these three events with a new `framework` value
(add it to the `FrameworkElementEvent['framework']` union in `lifecycle.ts`).

## The promotion ladder (MF1)

`FrameworkElementPromoted` is the fourth framework event, and the only one that
is **not** a creation: shape → role → component → materialities, every rung
reversible, no element created, destroyed or swapped.

| Event                      | When                                       | Required props |
| -------------------------- | ------------------------------------------ | -------------- |
| `FrameworkElementPromoted` | a rung of the promotion ladder is crossed  | `rung` (`role` \| `pivot` \| `tag`), `direction` (`promote` \| `demote`), `elementCount` |

It is a separate event on purpose. `FrameworkElementAdded` is a UI-intent event
emitted at insertion sites; a promotion inserts nothing, so reusing it would
count a drawn-then-bound shape twice and inflate "elements added per framework"
forever. `framework` and `role` are optional here — no rung requires the
previous one, so an element may be bound to a pivot record while carrying no
role, and therefore belonging to no framework. Ids only: the event says which
rung was crossed, never what the board contains, and never the `pivotDocId`
itself.

## Validation arbitrations (PF8)

No rule is a wall: every violation can be waived, and every waiver is reported.
A rule waived on every board is a rule that is wrong — these two events are the
only place that says so.

| Event                         | When                                   | Required props |
| ----------------------------- | -------------------------------------- | -------------- |
| `ValidationExceptionGranted`  | the user waives a rule from the bubble  | `ruleId`, `scope` (`element` \| `map`), `elementCount` |
| `ValidationExceptionRevoked`  | the user restores a waived rule         | `ruleId`, `scope`, `elementCount` |

`ruleId` is the framework-namespaced rule id (`wardley.change-arrow-against-evolution`);
`framework` segments as elsewhere. Neither event carries board content — a
waiver says which rule was arbitrated on, never what was drawn. A gesture that
changes nothing (the exception was already there) emits nothing.

## Validation profiles (PF9)

A framework exposes several levels of requirement and the user picks one per
instance. Which one they pick, and how often they leave the default, is the
only signal that says whether the default is right.

| Event                      | When                                        | Required props |
| -------------------------- | ------------------------------------------- | -------------- |
| `ValidationProfileChanged` | the user puts an instance on another profile | `framework`, `profileId` |

`profileId` is the framework-namespaced profile id (`wardley.strict`), and
`previousProfileId` carries the one it replaces. Ids only, never board content.
A gesture that changes nothing (already on that profile) emits nothing.

## AI audit runs (PF14.1)

Level 3 — the criteria a framework declares as data, evaluated app-side by the
Labre Assistant through the `AuditProvider` seam. The library owns the seam, not
the model, so what it can report is when a run was asked for and how it ended.

| Event                  | When                                     | Required props                                    |
| ---------------------- | ---------------------------------------- | ------------------------------------------------- |
| `MapAuditStarted`      | `map.audit` reaches the provider          | `criterionCount`, `frameCount`                     |
| `MapAuditCompleted`    | the provider settled every criterion      | + `findingCount`, `durationMs`                     |
| `MapAuditInterrupted`  | aborted, failed, or no assistant is wired | + `reason` (`aborted` / `error` / `unavailable`), `durationMs` |

Three events rather than one with a status: "how often is an audit asked for"
and "how often does it finish" are different questions, and a single event would
lose the second one for every run that never resolves. `unavailable` is a
first-class reason, not an error — it counts the users reaching for an audit
this build cannot run, which is what decides whether the affordance belongs
there at all.

Counts and ids only. Criterion prompts, finding wording and board content never
cross this bus. A run that is refused before it starts (`unavailable`) emits
`MapAuditStarted` **and** `MapAuditInterrupted`, so the two series always
balance.

## Legacy events

The historical AFFiNE events (`CanvasElementAdded`, `DocCreated`, slash menu,
database, attachment…) remain in `TelemetryEventMap` untouched; new code
should prefer the taxonomies above.
