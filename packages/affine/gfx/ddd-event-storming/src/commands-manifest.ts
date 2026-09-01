import type { ShortcutManifestEntry } from '@labre/std';

/**
 * The Event Storming commands as SHORTCUT-MANIFEST rows — id, label, chord, scope,
 * owner — and nothing else.
 *
 * DATA ONLY, and that is the whole point (`docs/adr/0008` § Packaging). A
 * `CommandDescriptor` carries its `run`, so a host settings pane that imports
 * the package entry to list names and chords drags the entire action graph —
 * the import/export machinery, the surface and gfx deep paths — into its
 * chunk. This module has type-only imports, so the published bundle exposes it
 * as `./commands-manifest`: a few hundred bytes that reference nothing.
 *
 * GENERATED-SHAPED, hand-committed: `commands-manifest.unit.spec.ts` asserts
 * row-for-row equality with `toShortcutManifestEntry` over {@link eventStormingCommands},
 * so this file cannot drift from the commands it projects. Add a command and
 * the test says exactly what to add here.
 */
export const eventStormingCommandsManifest: ShortcutManifestEntry[] = [
  {
    id: 'ddd-event-storming.addBoard',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addBoard',
    labelFallback: 'Event Storming board',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addDomainEvent',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addDomainEvent',
    labelFallback: 'Domain event',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addCommand',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addCommand',
    labelFallback: 'Command',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addAggregate',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addAggregate',
    labelFallback: 'Aggregate',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addActor',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addActor',
    labelFallback: 'Actor',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addConstraint',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addConstraint',
    labelFallback: 'Constraint',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addPolicy',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addPolicy',
    labelFallback: 'Policy',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addReadModel',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addReadModel',
    labelFallback: 'Read model',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addSystem',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addSystem',
    labelFallback: 'External system',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addHotspot',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addHotspot',
    labelFallback: 'Hotspot',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-event-storming.addFlow',
    owner: 'ddd-event-storming',
    labelKey: 'com.labre.commands.ddd-event-storming.addFlow',
    labelFallback: 'Flow',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
];
