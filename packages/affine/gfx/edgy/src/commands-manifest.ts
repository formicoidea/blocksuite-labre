import type { ShortcutManifestEntry } from '@labre/std';

/**
 * The EDGY commands as SHORTCUT-MANIFEST rows — id, label, chord, scope,
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
 * row-for-row equality with `toShortcutManifestEntry` over {@link edgyCommands},
 * so this file cannot drift from the commands it projects. Add a command and
 * the test says exactly what to add here.
 */
export const edgyCommandsManifest: ShortcutManifestEntry[] = [
  {
    id: 'edgy.addFacets',
    owner: 'edgy',
    labelKey: 'com.labre.commands.edgy.addFacets',
    labelFallback: 'Enterprise Design facets',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'edgy.insertDynamic',
    owner: 'edgy',
    labelKey: 'com.labre.commands.edgy.insertDynamic',
    labelFallback: 'EDGY dynamic (elements & relations)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'edgy.addBoard',
    owner: 'edgy',
    labelKey: 'com.labre.commands.edgy.addBoard',
    labelFallback: 'EDGY board (hover spotlight)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'edgy.addPeople',
    owner: 'edgy',
    labelKey: 'com.labre.commands.edgy.addPeople',
    labelFallback: 'People',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'edgy.addOutcome',
    owner: 'edgy',
    labelKey: 'com.labre.commands.edgy.addOutcome',
    labelFallback: 'Outcome',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'edgy.addObject',
    owner: 'edgy',
    labelKey: 'com.labre.commands.edgy.addObject',
    labelFallback: 'Object',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'edgy.addActivity',
    owner: 'edgy',
    labelKey: 'com.labre.commands.edgy.addActivity',
    labelFallback: 'Activity',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'edgy.addRelation',
    owner: 'edgy',
    labelKey: 'com.labre.commands.edgy.addRelation',
    labelFallback: 'Relation',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
];
