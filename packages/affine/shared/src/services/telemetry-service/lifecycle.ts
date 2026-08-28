import type { FrameworkId } from '@labre/std';

import type { TelemetryEvent } from './types.js';

/**
 * Per-block lifecycle taxonomy. Every block flavour reports the same five
 * moments — created / edited / deleted / abandoned / usage duration — so that
 * product analytics can compare blocks against each other with one query.
 * See ./README.md for the full taxonomy contract.
 */
export interface BlockLifecycleEvent extends TelemetryEvent {
  /** Block flavour, e.g. 'affine:paragraph', 'affine:database'. */
  flavour: string;
  page?: 'doc editor' | 'whiteboard editor';
}

export interface BlockAbandonedEvent extends BlockLifecycleEvent {
  /** Why the block is considered abandoned. */
  reason: 'emptied' | 'deleted-after-create' | 'undo';
  /** Time between creation and abandon, in milliseconds. */
  ageMs?: number;
}

export interface BlockUsageDurationEvent extends BlockLifecycleEvent {
  /** Cumulated active editing time, in milliseconds. */
  durationMs: number;
}

export type BlockLifecycleEvents = {
  // BlockCreated already exists in TelemetryEventMap (BlockCreationEvent).
  BlockEdited: BlockLifecycleEvent;
  BlockDeleted: BlockLifecycleEvent;
  BlockAbandoned: BlockAbandonedEvent;
  BlockUsageDuration: BlockUsageDurationEvent;
};

/**
 * Events of the business framework diagrams (Wardley map, EDGY facets,
 * Cynefin / estuarine, BPMN…). One event vocabulary for all frameworks: the
 * `framework` property segments, the `element` property identifies what was
 * manipulated ('background:classic', 'node:market', 'connector:link'…).
 */
export interface FrameworkElementEvent extends TelemetryEvent {
  framework:
    | 'wardley'
    | 'edgy'
    | 'cynefin'
    | 'bpmn'
    | 'c4'
    | 'event-storming'
    | 'core-domain'
    | 'context-map';
  element: string;
}

/**
 * A rung of the promotion ladder was crossed (MF1 / ADR 0007 § 7):
 * shape → role → component (a pivot record) → materialities. Promotion is
 * never a conversion — no element is created, destroyed or swapped, and no
 * geometry moves.
 *
 * **A new event name, deliberately.** An earlier draft reused
 * `FrameworkElementAdded` under a "no new event names" rule; that was a
 * taxonomy break. ADR 0003 § 2 defines the creation event as UI intent emitted
 * at INSERTION sites, and a promotion inserts nothing — so drawing a shape and
 * then binding it would emit `FrameworkElementAdded` twice and permanently
 * inflate "elements added per framework". A new event is cheaper than a
 * corrupted funnel.
 *
 * Ids only, never board content: which rung was crossed, in which direction,
 * under which role.
 */
export interface FrameworkPromotionEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /**
   * Owning framework, when the element has one — derived from the namespace of
   * its `role` (`wardley:component` → `wardley`).
   *
   * OPTIONAL, which is a deviation from ADR 0007 § 7's `framework: FrameworkId`.
   * That ADR's own § 6 states no rung requires the previous one: an element may
   * carry a `pivotDocId` with no `role` at all, and a plain rectangle bound to
   * a record belongs to no framework. Requiring the field would force the
   * library to invent an identity it does not have — the one thing the
   * `FrameworkId` unification exists to stop. Absent rather than `'unknown'`,
   * per the repo convention.
   */
  framework?: FrameworkId;
  /** Which rung was crossed. */
  rung: 'role' | 'pivot' | 'tag';
  /** Forward (`shape`→`role`) or the reverse gesture. */
  direction: 'promote' | 'demote';
  /** Role id at the time of the gesture, when there is one. */
  role?: string;
  /** How many elements the single gesture wrote to. */
  elementCount: number;
}

/**
 * The persisted direction of a TYPED EDGE was reversed (`docs/adr/0010` M3):
 * `source` and `target` swapped, in one undo step, by the only supported
 * inversion.
 *
 * Worth its own event for the same reason an exception is worth one: this is
 * the correction gesture of a decision the user could not previously see, so
 * how often it is used is the measurement of whether the DRAWING gesture (M1)
 * announces itself well enough. A framework whose links are reversed constantly
 * is a framework whose hint is wrong.
 *
 * Ids only — the role and the framework its namespace names — never board
 * content, and never the two element ids.
 */
export interface EdgeDirectionEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /** Role id of the inverted edges, when they all carry the same one. */
  role?: string;
  /** Its namespace, when that names a framework: `wardley:dependency` → `wardley`. */
  framework?: string;
  /** How many edges the single gesture reversed. */
  elementCount: number;
}

/**
 * A framework element became a NEARBY kind of itself — a task said more
 * precisely as a user task, a start event as a timer start — from its own
 * contextual toolbar, in one atomic write.
 *
 * **A new event name, for the reason {@link FrameworkPromotionEvent} gives.**
 * ADR 0003 § 2 defines the creation event as UI intent emitted at INSERTION
 * sites, and a morph inserts nothing: no element is created, destroyed or
 * swapped, no id changes, no geometry moves and no connector is re-pointed.
 * Reusing `FrameworkElementAdded` would count a drawn-then-refined artefact
 * twice and inflate "elements added per framework" permanently.
 *
 * Worth measuring on its own, too. The set of reachable kinds is DATA a
 * framework declares by hand, and the only evidence that a declared family is
 * the right family is how often it is actually crossed — a pair nobody ever
 * morphs between did not need to be offered, and a morph users reach for
 * constantly says the palette led them to the wrong artefact first.
 *
 * Ids only: the two roles, and their framework. Never a kind's board content,
 * never the element ids, never the label anybody typed.
 */
export interface FrameworkElementMorphedEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /**
   * Owning framework — the declaration's own wire key, matching what
   * `reportCommandTelemetry` sends for that framework's commands.
   *
   * OPTIONAL for the same reason it is on {@link FrameworkPromotionEvent}: the
   * capability is generic, and an element type may one day declare a morph
   * without belonging to a framework the union names. Absent rather than
   * `'unknown'`, per the repo convention.
   */
  framework?: FrameworkId;
  /** Role id the selection carried, when they all carried the same one. */
  fromRole?: string;
  /** Role id it now carries. */
  toRole?: string;
  /** How many elements the single gesture actually rewrote. */
  elementCount: number;
}

/**
 * A framework VIEW was told which level it draws — a C4 board set to Context,
 * Container or Component, or put back to a free sketch.
 *
 * **A new event name, for the reason {@link FrameworkPromotionEvent} gives.**
 * Nothing is inserted, nothing is morphed and no level of requirement changes:
 * the author is stating what the sheet IS, which is a fact none of the existing
 * events describes. Reusing one of them would corrupt the funnel it belongs to.
 *
 * Worth measuring on its own, and for the same reason a profile change is: this
 * is an OPTIONAL declaration nothing forces, so how often it is made is the only
 * evidence that asking for it was worth the toolbar entry — and a level users
 * set and then clear is a rule pack that argued with a drawing they meant.
 *
 * Ids only: the framework and the level's own closed vocabulary. Never the
 * board's title, never what is drawn on it.
 */
export interface FrameworkViewLevelEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /** Owning framework of the view, e.g. `c4`. */
  framework: FrameworkId;
  /**
   * The level now in force, from the framework's own closed vocabulary —
   * `'none'` when the view has been put back to declaring nothing, which is a
   * value the dashboard needs as much as the others.
   */
  level: string;
  /** The one it replaces, when the view declared one. */
  previousLevel?: string;
}

export type FrameworkDiagramEvents = {
  FrameworkElementAdded: FrameworkElementEvent;
  FrameworkToolPicked: FrameworkElementEvent;
  FrameworkLegendCreated: FrameworkElementEvent;
  FrameworkElementPromoted: FrameworkPromotionEvent;
  FrameworkElementMorphed: FrameworkElementMorphedEvent;
  FrameworkViewLevelSet: FrameworkViewLevelEvent;
  EdgeDirectionInverted: EdgeDirectionEvent;
};

/**
 * A user arbitration on a validation rule (PF8): "no rule is a wall", so every
 * rule can be waived — and every waiver is worth knowing about. A rule that
 * gets waived constantly is a rule that is wrong, and this is the only place
 * that says so.
 *
 * `ruleId` is the framework-namespaced rule id (`wardley.change-arrow-against-evolution`)
 * and never carries user content — the event describes which RULE was arbitrated
 * on, never what the board contains.
 */
export interface ValidationExceptionEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /** Namespaced rule id, e.g. `wardley.change-arrow-against-evolution`. */
  ruleId: string;
  /** Owning framework of the rule, when it is registered. */
  framework?: string;
  /** `element` = this one element; `map` = every element the map frames. */
  scope: 'element' | 'map';
  /** How many elements the single gesture wrote to. */
  elementCount: number;
}

/**
 * A change of the level of requirement a framework instance is checked against
 * (PF9). Worth knowing about for the same reason an exception is: a profile
 * nobody ever leaves is a default that is right, and one everybody escapes on
 * the first day is a default that is wrong.
 *
 * Ids only — the framework's own namespaced profile ids — never user content.
 */
export interface ValidationProfileEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /** Owning framework of the profile, e.g. `wardley`. */
  framework: string;
  /** Namespaced profile id now in force, e.g. `wardley.strict`. */
  profileId: string;
  /** The one it replaces, when it is known. */
  previousProfileId?: string;
}

/**
 * A map-quality NUDGE ticked or unticked (PF7.10). Worth knowing about for the
 * same reason an exception is, and for one more: a nudge everybody ticks
 * immediately is a reminder nobody needed, and one nobody ever ticks is an
 * expectation the tool has failed to make actionable. Neither is visible any
 * other way, because nothing here is ever computed.
 *
 * Ids only — the framework's own namespaced nudge ids — never board content.
 */
export interface MapQualityNudgeEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /** Owning framework of the nudge, e.g. `wardley`. */
  framework: string;
  /** Namespaced nudge id, e.g. `wardley.q1-title`. */
  nudgeId: string;
  /** `true` = ticked ("I have taken care of this"), `false` = taken back. */
  checked: boolean;
}

export type ValidationEvents = {
  ValidationExceptionGranted: ValidationExceptionEvent;
  ValidationExceptionRevoked: ValidationExceptionEvent;
  ValidationProfileChanged: ValidationProfileEvent;
  MapQualityNudgeToggled: MapQualityNudgeEvent;
};

/**
 * An AI audit run (PF14.1) — level 3, executed app-side by the Labre Assistant
 * through the `AuditProvider` seam.
 *
 * Three events rather than one, because the three questions are different: how
 * often is an audit asked for (started), does it ever finish (completed), and
 * how often does it not (interrupted). A single event with a status field would
 * answer the first and lose the other two the moment a run never resolves.
 *
 * Ids and counts only — criterion ids and how many findings came back. The
 * board's content, the criteria's prompts and the findings' wording never leave
 * the editor through this bus.
 */
export interface MapAuditEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /** Owning framework of the criteria, when the run carries only one. */
  framework?: string;
  /** How many criteria the run was given. */
  criterionCount: number;
  /** How many framework frames the facts described. */
  frameCount: number;
}

export interface MapAuditCompletedEvent extends MapAuditEvent {
  /** How many findings came back, after the library's normalisation. */
  findingCount: number;
  /** Wall-clock duration of the run, in milliseconds. */
  durationMs: number;
}

export interface MapAuditInterruptedEvent extends MapAuditEvent {
  /**
   * Why it did not complete.
   *
   * `unavailable` is a first-class member and not an error: no assistant is
   * wired in this assembly, or the one that is declared itself unable to answer
   * (feature flag, quota, no model configured). Knowing how often a user
   * reaches for an audit that cannot run is precisely the number that decides
   * whether the affordance should be there at all.
   *
   * `superseded` means a newer run for the same editor started while this one
   * was in flight, so its answer was dropped rather than published. It is
   * reported here rather than as a completion because a `findingCount` for
   * findings nobody will see is a metric that lies — and a rising `superseded`
   * count is itself the signal that audits are slow enough that users ask
   * twice.
   */
  reason: 'aborted' | 'error' | 'unavailable' | 'superseded';
  durationMs: number;
}

export type AuditEvents = {
  MapAuditStarted: MapAuditEvent;
  MapAuditCompleted: MapAuditCompletedEvent;
  MapAuditInterrupted: MapAuditInterruptedEvent;
};
