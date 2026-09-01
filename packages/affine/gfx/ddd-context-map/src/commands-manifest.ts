import type { ShortcutManifestEntry } from '@labre/std';

/**
 * The Context Map commands as SHORTCUT-MANIFEST rows — id, label, chord, scope,
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
 * row-for-row equality with `toShortcutManifestEntry` over {@link contextMapCommands},
 * so this file cannot drift from the commands it projects. Add a command and
 * the test says exactly what to add here.
 */
export const contextMapCommandsManifest: ShortcutManifestEntry[] = [
  {
    id: 'ddd-context-map.addBoard',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addBoard',
    labelFallback: 'Context Map board',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addBoundedContext',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addBoundedContext',
    labelFallback: 'Bounded Context',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addCloud',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addCloud',
    labelFallback: 'Cloud / System (Big Ball of Mud)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addPartnership',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addPartnership',
    labelFallback: 'Partnership',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addSharedKernel',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addSharedKernel',
    labelFallback: 'Shared Kernel',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addCustomerSupplier',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addCustomerSupplier',
    labelFallback: 'Customer / Supplier',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addConformist',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addConformist',
    labelFallback: 'Conformist',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addAcl',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addAcl',
    labelFallback: 'Anticorruption Layer',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addOhs',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addOhs',
    labelFallback: 'Open Host Service',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addPublishedLanguage',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addPublishedLanguage',
    labelFallback: 'Published Language',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addSeparateWays',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addSeparateWays',
    labelFallback: 'Separate Ways',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'ddd-context-map.addBbom',
    owner: 'ddd-context-map',
    labelKey: 'com.labre.commands.ddd-context-map.addBbom',
    labelFallback: 'Big Ball of Mud',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
];
