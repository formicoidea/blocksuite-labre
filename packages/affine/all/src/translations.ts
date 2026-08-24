import {
  WARDLEY_AUDIT_CRITERIA,
  WARDLEY_BACKGROUND,
  WARDLEY_CHECKUP_RULES,
  WARDLEY_NUDGES,
  WARDLEY_PROFILES,
  WARDLEY_READING,
  WARDLEY_ROLES,
  WARDLEY_RULES,
} from '@labre/affine-gfx-wardley';
import { toCommandManifestEntry } from '@labre/std';

import { getCommands } from './commands.js';
import { FRAMEWORK_DESCRIPTORS } from './frameworks.js';

/**
 * The translation-key manifest (the i18n sibling of `getShortcutManifest` /
 * `getCommandManifest`): every i18n key the library can hand to
 * `TranslationProvider.t`, with its English fallback, enumerable WITHOUT an
 * editor instance. A host builds its catalogue from this list instead of
 * chasing `translateKey` call sites — see
 * `packages/affine/shared/src/services/translation-service/README.md`.
 *
 * Two kinds of entry, and the split is what keeps the list honest:
 *
 * - **Declared data** (commands, roles, rules, profiles, nudges, audit
 *   criteria, reading conventions, background labels): walked from the same
 *   runtime declarations the editor registers, so a key added to a rule or a
 *   command appears here BY CONSTRUCTION.
 * - **Chrome** ({@link CHROME_KEYS}): the widget literals — panel titles,
 *   field names, action buttons — which live in lit templates and cannot be
 *   walked. They are restated here, and `manifest.unit.spec.ts` scans the
 *   source for every `com.labre.*` literal and fails the build when a key is
 *   used but missing from this manifest, or when a restated fallback drifts
 *   from the one the widget actually renders.
 */

export type TranslationKeySource =
  | 'command'
  | 'framework'
  | 'role'
  | 'background'
  | 'rule'
  | 'nudge'
  | 'profile'
  | 'audit-criterion'
  | 'reading'
  | 'chrome';

export interface TranslationKeyManifestEntry {
  key: string;
  /**
   * The English default the library renders when the host's catalogue has no
   * entry. Absent for the keys that deliberately ship none (framework prose
   * whose wording the library must not invent — see the `translateKey`
   * docstring).
   */
  fallback?: string;
  /** Which kind of declaration the key comes from. */
  source: TranslationKeySource;
}

const KEY_PREFIX = 'com.labre.';

/**
 * Chrome wordings: the `translateKey(std, key, fallback)` literals of the
 * library's own panels and toolbars, plus the closed enumerations behind the
 * few template-literal keys (severity chips, exemption states, relation
 * sides). Restated data, guarded against drift by the manifest unit test.
 */
const CHROME_KEYS: readonly [key: string, fallback: string][] = [
  // Validation bubble, badge and toolbar
  ['com.labre.validation.toolbar.label', 'Validation'],
  ['com.labre.validation.bubble.label', 'Validation details'],
  ['com.labre.validation.badge.label', 'Show validation details'],
  ['com.labre.validation.profile.section', 'Profile'],
  ['com.labre.validation.action.ignore', 'Ignore this validation rule'],
  ['com.labre.validation.action.ignore-map', 'Ignore this rule on the whole map'],
  ['com.labre.validation.action.revoke', 'Revoke'],
  ['com.labre.validation.action.revoke-exception', 'Revoke exception'],
  // `com.labre.validation.severity.${ViolationSeverity}`
  ['com.labre.validation.severity.blocking-overridable', 'Blocking'],
  ['com.labre.validation.severity.warning', 'Warning'],
  ['com.labre.validation.severity.audit', 'Audit'],
  // `com.labre.validation.state.exempted.${ExemptionScope}`
  ['com.labre.validation.state.exempted.element', 'Exception'],
  ['com.labre.validation.state.exempted.map', 'Exception (whole map)'],
  // Map quality panel
  ['com.labre.validation.map-quality.open', 'Map quality…'],
  ['com.labre.validation.map-quality.section', 'Map quality'],
  ['com.labre.validation.map-quality.checklist', 'Checklist'],
  ['com.labre.validation.map-quality.checkup', 'Check-up'],
  ['com.labre.validation.map-quality.run', 'Run check-up'],
  ['com.labre.validation.map-quality.running', 'Checking… {done}/{total}'],
  ['com.labre.validation.map-quality.stamp', 'Last check-up'],
  ['com.labre.validation.map-quality.error', 'The check-up could not finish. Try again.'],
  ['com.labre.validation.map-quality.clean', 'Nothing to report.'],
  ['com.labre.validation.map-quality.close', 'Close'],
  // Qualify (tags) toolbar
  ['com.labre.tags.toolbar.label', 'Qualify'],
  // Reading panel
  ['com.labre.reading.toolbar.label', 'Read this component'],
  ['com.labre.reading.panel.label', 'Proposed record'],
  ['com.labre.reading.panel.title', 'What this map says about this component'],
  ['com.labre.reading.field.type', 'Type of node'],
  ['com.labre.reading.field.specialises', 'A kind of'],
  ['com.labre.reading.field.nature', 'Nature'],
  ['com.labre.reading.field.relations', 'Parent-child relations'],
  ['com.labre.reading.field.phase', 'Evolution phase'],
  ['com.labre.reading.field.naming', 'Naming convention'],
  ['com.labre.reading.field.record', 'Record'],
  ['com.labre.reading.field.drift', 'Drift'],
  [
    'com.labre.reading.nature.none',
    'Not qualified — the reading proposes nothing of its own.',
  ],
  ['com.labre.reading.nature.unknown-record-value', 'The record says'],
  [
    'com.labre.reading.nature.unknown-record-value.suffix',
    'a value this framework does not describe.',
  ],
  ['com.labre.reading.action.confirm-nature', 'Confirm'],
  ['com.labre.reading.action.link', 'Link to a record'],
  ['com.labre.reading.action.update-record', 'Update the record'],
  // `com.labre.reading.relations.${side}`
  ['com.labre.reading.relations.consumers', 'Consumers (above)'],
  ['com.labre.reading.relations.suppliers', 'Suppliers (below)'],
  ['com.labre.reading.relations.none', 'No typed link touches this component.'],
  [
    'com.labre.reading.relations.contradiction',
    'A link states the opposite of what the positions show',
  ],
  ['com.labre.reading.phase.band', 'In the zone of punctuated equilibrium'],
  [
    'com.labre.reading.phase.none',
    'Not on a framework background — no phase to read.',
  ],
  ['com.labre.reading.naming.conforms', 'The name follows the convention of its nature.'],
  ['com.labre.reading.record.linked', 'Linked'],
  ['com.labre.reading.record.none', 'Not linked to a record.'],
  ['com.labre.reading.drift.message', 'The board and the record disagree'],
];

/**
 * Deep-walk a declaration and collect every `…Key` string property holding a
 * `com.labre.*` key, paired with its fallback by the repo's own conventions:
 * `<stem>Key` ↔ `<stem>Fallback` (roles, rules, commands, conventions), and
 * `labelKey` ↔ `fallback` (profiles, nudges, criteria, background labels).
 *
 * First occurrence wins, so the walk order in {@link getTranslationKeyManifest}
 * decides which `source` a key shared by two declarations reports.
 */
function collect(
  source: TranslationKeySource,
  value: unknown,
  out: Map<string, TranslationKeyManifestEntry>,
  seen: WeakSet<object>
): void {
  if (typeof value !== 'object' || value === null) return;
  if (seen.has(value)) return;
  seen.add(value);

  if (Array.isArray(value)) {
    for (const item of value) collect(source, item, out, seen);
    return;
  }

  const record = value as Record<string, unknown>;
  for (const [prop, propValue] of Object.entries(record)) {
    if (
      typeof propValue === 'string' &&
      prop.endsWith('Key') &&
      propValue.startsWith(KEY_PREFIX)
    ) {
      if (out.has(propValue)) continue;
      const stem = prop.slice(0, -'Key'.length);
      const fallback =
        record[`${stem}Fallback`] ??
        (prop === 'labelKey' ? record.fallback : undefined);
      out.set(propValue, {
        key: propValue,
        ...(typeof fallback === 'string' ? { fallback } : {}),
        source,
      });
    } else {
      collect(source, propValue, out, seen);
    }
  }
}

/**
 * Every i18n key the library can ask the host for, with its English fallback
 * where one ships. Flag-independent on purpose: a catalogue is built once for
 * the whole library, and a framework toggled on later must not find holes in
 * it — `getCommands()` with no flags enumerates every command, including the
 * capability-gated ones.
 */
export function getTranslationKeyManifest(): TranslationKeyManifestEntry[] {
  const out = new Map<string, TranslationKeyManifestEntry>();
  const seen = new WeakSet<object>();

  const sources: [TranslationKeySource, unknown][] = [
    ['command', getCommands().map(toCommandManifestEntry)],
    ['framework', FRAMEWORK_DESCRIPTORS],
    ['role', WARDLEY_ROLES],
    ['background', WARDLEY_BACKGROUND],
    ['rule', [WARDLEY_RULES, WARDLEY_CHECKUP_RULES]],
    ['nudge', WARDLEY_NUDGES],
    ['profile', WARDLEY_PROFILES],
    ['audit-criterion', WARDLEY_AUDIT_CRITERIA],
    ['reading', WARDLEY_READING],
  ];
  for (const [source, value] of sources) collect(source, value, out, seen);

  for (const [key, fallback] of CHROME_KEYS) {
    if (!out.has(key)) out.set(key, { key, fallback, source: 'chrome' });
  }

  return [...out.values()].sort((a, b) => a.key.localeCompare(b.key));
}
