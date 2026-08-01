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

export type FrameworkDiagramEvents = {
  FrameworkElementAdded: FrameworkElementEvent;
  FrameworkToolPicked: FrameworkElementEvent;
  FrameworkLegendCreated: FrameworkElementEvent;
};

/**
 * A user arbitration on a validation rule (PF8): "no rule is a wall", so every
 * rule can be waived — and every waiver is worth knowing about. A rule that
 * gets waived constantly is a rule that is wrong, and this is the only place
 * that says so.
 *
 * `ruleId` is the framework-namespaced rule id (`wardley.component-outside-map`)
 * and never carries user content — the event describes which RULE was arbitrated
 * on, never what the board contains.
 */
export interface ValidationExceptionEvent extends TelemetryEvent {
  page?: 'whiteboard editor';
  /** Namespaced rule id, e.g. `wardley.component-outside-map`. */
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

export type ValidationEvents = {
  ValidationExceptionGranted: ValidationExceptionEvent;
  ValidationExceptionRevoked: ValidationExceptionEvent;
  ValidationProfileChanged: ValidationProfileEvent;
};
