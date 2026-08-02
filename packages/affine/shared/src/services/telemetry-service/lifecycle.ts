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

export type FrameworkDiagramEvents = {
  FrameworkElementAdded: FrameworkElementEvent;
  FrameworkToolPicked: FrameworkElementEvent;
  FrameworkLegendCreated: FrameworkElementEvent;
  FrameworkElementPromoted: FrameworkPromotionEvent;
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

/**
 * A quality CHECK-UP asked for (PF5.14). The on-demand moment exists so these
 * controls never touch the drawing budget, which also means nothing else
 * records that they run: how often a user asks, and how much a run finds, are
 * only knowable here.
 *
 * Counts only, never a rule id and never board content: which remarks a
 * particular map produced is the map's business.
 */
export interface MapQualityCheckupEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /** Owning framework of the rules walked, when the run had any. */
  framework?: string;
  /** How many on-demand rules the run walked. */
  ruleCount: number;
  /**
   * How many remarks came back — for the ONE instance the run was about. A
   * check-up walks the whole surface and reports on one map, so this is never a
   * count over the board.
   */
  remarkCount: number;
  /**
   * Set when a rule threw and the run stopped early. Absent rather than `false`,
   * per the repo convention — and worth knowing about on its own: a check-up
   * that fails is invisible everywhere else, because it produces no remark to
   * notice the absence of.
   */
  error?: true;
}

export type ValidationEvents = {
  ValidationExceptionGranted: ValidationExceptionEvent;
  ValidationExceptionRevoked: ValidationExceptionEvent;
  ValidationProfileChanged: ValidationProfileEvent;
  MapQualityNudgeToggled: MapQualityNudgeEvent;
  MapQualityCheckupRun: MapQualityCheckupEvent;
};
