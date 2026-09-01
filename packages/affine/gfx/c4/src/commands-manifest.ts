import type { ShortcutManifestEntry } from '@labre/std';

/**
 * The C4 commands as SHORTCUT-MANIFEST rows — id, label, chord, scope,
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
 * row-for-row equality with `toShortcutManifestEntry` over {@link c4Commands},
 * so this file cannot drift from the commands it projects. Add a command and
 * the test says exactly what to add here.
 */
export const c4CommandsManifest: ShortcutManifestEntry[] = [
  {
    id: 'c4.addBoard',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addBoard',
    labelFallback: 'C4 board',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addPerson',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addPerson',
    labelFallback: 'Person',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addPersonExt',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addPersonExt',
    labelFallback: 'Person (external)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addSystem',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addSystem',
    labelFallback: 'Software system',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addSystemExt',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addSystemExt',
    labelFallback: 'Software system (external)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addContainer',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addContainer',
    labelFallback: 'Container',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addComponent',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addComponent',
    labelFallback: 'Component',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addDatabase',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addDatabase',
    labelFallback: 'Database',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addMobile',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addMobile',
    labelFallback: 'Mobile app',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addBrowser',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addBrowser',
    labelFallback: 'Web browser',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.relationshipTool',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.relationshipTool',
    labelFallback: 'Relationship',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addSystemBoundary',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addSystemBoundary',
    labelFallback: 'System boundary',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.addContainerBoundary',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.addContainerBoundary',
    labelFallback: 'Container boundary',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'c4.exportMermaid',
    owner: 'c4',
    labelKey: 'com.labre.commands.c4.exportMermaid',
    labelFallback: 'Export as mermaid',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
];
