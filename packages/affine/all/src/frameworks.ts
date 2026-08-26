import type { FrameworkDescriptor, FrameworkId } from '@labre/std';

import type { OptionalBlock } from './flags.js';

/**
 * THE per-framework identity — the thing that was spelled five times across
 * the repo (flag key, senior-tool id, `ShortcutDescriptor.owner`, telemetry
 * union member, `scripts/build-bundles.mjs`) and had already drifted.
 *
 * This module is DATA ONLY: plain object literals and type-only imports, no
 * lit, no runtime dependency. That is what lets `scripts/build-bundles.mjs`
 * read it (through a type-strip transform) instead of hand-maintaining its own
 * `FRAMEWORKS` array. Keep it that way. See `docs/adr/0008` § Packaging.
 *
 * `telemetryKey` and `telemetrySegment` hold the HISTORICAL PostHog values.
 * They are the reason the identity unification is code-side only and existing
 * dashboards keep working untouched — never "tidy" them.
 */

/**
 * Every `FrameworkId` is a real tooling flag key — the ADR's
 * `satisfies readonly OptionalBlock[]`, expressed at the type level so this
 * module keeps NO runtime import (`FRAMEWORK_IDS` lives in `@labre/std`, where
 * `CommandDescriptor.owner` needs it and `OptionalBlock` cannot reach).
 */
type AssertFlagKey<_T extends OptionalBlock> = true;
export type FrameworkIdsAreFlags = AssertFlagKey<FrameworkId>;

export const FRAMEWORK_DESCRIPTORS: FrameworkDescriptor[] = [
  {
    id: 'wardley',
    labelKey: 'com.labre.framework.wardley',
    fallback: 'Wardley map',
    iconKey: 'wardley.toolbar',
    // The only allocated chord prefix: `w` was free against
    // RESERVED_EDGELESS_KEYS. The other six frameworks ship no chord, so they
    // allocate no letter — a prefix with no chord behind it is dead data, and
    // the uniqueness test guards the day one of them earns its first.
    chordPrefix: 'w',
    telemetryKey: 'wardley',
    telemetrySegment: 'wardley toolbox',
    bundle: 'framework-wardley',
    info: 'wardleyFramework',
    pkg: '@labre/affine-gfx-wardley',
    dir: 'affine/gfx/wardley',
    extensions: [
      // always-on: placed Wardley maps must paint even with the button off
      { viewExtension: 'WardleyRenderViewExtension' },
      { flag: 'wardley', viewExtension: 'WardleyViewExtension' },
    ],
    // The framework contributes command/shortcut-manifest entries: stripped
    // from core's shortcuts.ts; the host composes with the bundle's export.
    shortcuts: true,
  },
  {
    id: 'edgy',
    labelKey: 'com.labre.framework.edgy',
    fallback: 'EDGY',
    iconKey: 'edgy.toolbar',
    telemetryKey: 'edgy',
    telemetrySegment: 'edgy toolbox',
    bundle: 'framework-edgy',
    info: 'edgyFramework',
    pkg: '@labre/affine-gfx-edgy',
    dir: 'affine/gfx/edgy',
    extensions: [
      // always-on: placed EDGY boards must paint even with the button off
      { viewExtension: 'EdgyRenderViewExtension' },
      { flag: 'edgy', viewExtension: 'EdgyViewExtension' },
    ],
    shortcuts: true,
  },
  {
    id: 'cynefin-estuarine',
    labelKey: 'com.labre.framework.cynefin-estuarine',
    fallback: 'Cynefin / Estuarine',
    iconKey: 'cynefin.toolbar',
    // Historical PostHog value; the flag and the owner say
    // `cynefin-estuarine`, the wire says `cynefin`.
    telemetryKey: 'cynefin',
    telemetrySegment: 'cynefin toolbox',
    bundle: 'framework-cynefin',
    info: 'cynefinFramework',
    pkg: '@labre/affine-gfx-cynefin-estuarine',
    dir: 'affine/gfx/cynefin-estuarine',
    extensions: [
      // always-on: placed Cynefin / Estuarine frames must paint even with the
      // button off
      { viewExtension: 'CynefinEstuarineRenderViewExtension' },
      {
        flag: 'cynefin-estuarine',
        viewExtension: 'CynefinEstuarineViewExtension',
      },
    ],
    shortcuts: true,
  },
  {
    id: 'bpmn',
    labelKey: 'com.labre.framework.bpmn',
    fallback: 'BPMN',
    iconKey: 'bpmn.toolbar',
    telemetryKey: 'bpmn',
    telemetrySegment: 'bpmn toolbox',
    bundle: 'framework-bpmn',
    info: 'bpmnFramework',
    pkg: '@labre/affine-gfx-bpmn',
    dir: 'affine/gfx/bpmn',
    extensions: [
      // always-on: placed BPMN pools must paint even with the button off
      { viewExtension: 'BpmnRenderViewExtension' },
      { flag: 'bpmn', viewExtension: 'BpmnViewExtension' },
    ],
    shortcuts: true,
  },
  {
    id: 'ddd-event-storming',
    labelKey: 'com.labre.framework.ddd-event-storming',
    fallback: 'Event Storming',
    iconKey: 'ddd-event-storming.toolbar',
    telemetryKey: 'event-storming',
    telemetrySegment: 'ddd toolbox',
    bundle: 'framework-ddd-event-storming',
    info: 'dddEventStormingFramework',
    pkg: '@labre/affine-gfx-ddd-event-storming',
    dir: 'affine/gfx/ddd-event-storming',
    extensions: [
      // always-on: placed Event Storming boards must paint even with the button
      // off, and their role vocabulary must stay readable
      { viewExtension: 'DddEventStormingRenderViewExtension' },
      {
        flag: 'ddd-event-storming',
        viewExtension: 'DddEventStormingViewExtension',
      },
    ],
    shortcuts: true,
  },
  {
    id: 'ddd-core-domain',
    labelKey: 'com.labre.framework.ddd-core-domain',
    fallback: 'Core Domain Chart',
    iconKey: 'ddd-core-domain.toolbar',
    telemetryKey: 'core-domain',
    telemetrySegment: 'ddd toolbox',
    bundle: 'framework-ddd-core-domain',
    info: 'dddCoreDomainFramework',
    pkg: '@labre/affine-gfx-ddd-core-domain',
    dir: 'affine/gfx/ddd-core-domain',
    extensions: [
      // always-on: placed Core Domain charts must paint even with the button off
      { viewExtension: 'DddCoreDomainRenderViewExtension' },
      { flag: 'ddd-core-domain', viewExtension: 'DddCoreDomainViewExtension' },
    ],
    shortcuts: true,
  },
  {
    id: 'ddd-context-map',
    labelKey: 'com.labre.framework.ddd-context-map',
    fallback: 'Context Map',
    iconKey: 'ddd-context-map.toolbar',
    telemetryKey: 'context-map',
    telemetrySegment: 'ddd toolbox',
    bundle: 'framework-ddd-context-map',
    info: 'dddContextMapFramework',
    pkg: '@labre/affine-gfx-ddd-context-map',
    dir: 'affine/gfx/ddd-context-map',
    extensions: [
      // always-on: placed Context Map boards must paint even with the button
      // off, and their role vocabulary must stay readable
      { viewExtension: 'DddContextMapRenderViewExtension' },
      { flag: 'ddd-context-map', viewExtension: 'DddContextMapViewExtension' },
    ],
    shortcuts: true,
  },
];

/**
 * Bundles that are NOT frameworks: no senior button, no commands, no identity
 * to unify — just packaging. `ddd-aggregate` ships the four DDD Templates-panel
 * categories, which is why its flag (`ddd-templates`) is not a `FrameworkId`.
 * Kept separate on purpose: folding it into {@link FRAMEWORK_DESCRIPTORS} would
 * mean inventing a framework identity for something that has none.
 */
export const AUXILIARY_BUNDLES = [
  {
    bundle: 'framework-ddd-aggregate',
    label: 'ddd-aggregate',
    info: 'dddAggregateFramework',
    pkg: '@labre/affine-gfx-ddd-aggregate',
    dir: 'affine/gfx/ddd-aggregate',
    extensions: [
      { flag: 'ddd-templates', viewExtension: 'DddTemplatesViewExtension' },
    ],
  },
];

const BY_ID = new Map<FrameworkId, FrameworkDescriptor>(
  FRAMEWORK_DESCRIPTORS.map(d => [d.id, d])
);

export const frameworkDescriptor = (id: FrameworkId) => BY_ID.get(id);
