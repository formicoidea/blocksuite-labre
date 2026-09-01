import type { ShortcutManifestEntry } from '@labre/std';

/**
 * The Core Domain Chart commands as SHORTCUT-MANIFEST rows — id, label, chord, scope,
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
 * row-for-row equality with `toShortcutManifestEntry` over {@link coreDomainCommands},
 * so this file cannot drift from the commands it projects. Add a command and
 * the test says exactly what to add here.
 */
export const coreDomainCommandsManifest: ShortcutManifestEntry[] = [
  {
    id: 'ddd-core-domain.addChart',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addChart',
    labelFallback: 'Core Domain Chart',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-core-domain.addBigBet',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addBigBet',
    labelFallback: 'Big-bet sub-domain',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-core-domain.addPlatform',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addPlatform',
    labelFallback: 'Platform sub-domain',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-core-domain.addOutsourced',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addOutsourced',
    labelFallback: 'Outsourced / purchased',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-core-domain.addBcCurrent',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addBcCurrent',
    labelFallback: 'Bounded context',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-core-domain.addBcFuture',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addBcFuture',
    labelFallback: 'Future position',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-core-domain.addCollaboration',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addCollaboration',
    labelFallback: 'Collaboration',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-core-domain.addXaas',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addXaas',
    labelFallback: 'X-as-a-Service',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-core-domain.addFacilitating',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addFacilitating',
    labelFallback: 'Facilitating',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-core-domain.addMovement',
    owner: 'ddd-core-domain',
    labelKey: 'com.labre.commands.ddd-core-domain.addMovement',
    labelFallback: 'Movement over time',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
];
