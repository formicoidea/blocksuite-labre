import type { ShortcutManifestEntry } from '@labre/std';

/**
 * The Wardley commands as SHORTCUT-MANIFEST rows — id, label, chord, scope,
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
 * row-for-row equality with `toShortcutManifestEntry` over {@link wardleyCommands},
 * so this file cannot drift from the commands it projects. Add a command and
 * the test says exactly what to add here.
 */
export const wardleyCommandsManifest: ShortcutManifestEntry[] = [
  {
    id: 'wardley.addBackground',
    owner: 'wardley',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addBackground',
    labelFallback: 'Wardley map background',
    scope: 'edgeless',
    defaultKeys: { mac: ['w', 'b'], other: ['w', 'b'] },
  },
  {
    id: 'wardley.addOpportunityBackground',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addOpportunityBackground',
    labelFallback: 'Opportunity background (gradient)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.addBenefitBackground',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addBenefitBackground',
    labelFallback: 'Benefit / Investment background (gradient)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.addEvolutionBackground',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addEvolutionBackground',
    labelFallback: 'Evolution background (Wardley presentation)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.addComponent',
    owner: 'wardley',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addComponent',
    labelFallback: 'Component',
    scope: 'edgeless',
    defaultKeys: { mac: ['w', 'c'], other: ['w', 'c'] },
  },
  {
    id: 'wardley.addMethod',
    owner: 'wardley',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addMethod',
    labelFallback: 'Component + method',
    scope: 'edgeless',
    defaultKeys: { mac: ['w', 'm'], other: ['w', 'm'] },
  },
  {
    id: 'wardley.addMarket',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addMarket',
    labelFallback: 'Market',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.addEcosystem',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addEcosystem',
    labelFallback: 'Ecosystem',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.addAnchor',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addAnchor',
    labelFallback: 'Anchor',
    scope: 'edgeless',
    defaultKeys: { mac: ['w', 'a'], other: ['w', 'a'] },
  },
  {
    id: 'wardley.addPipeline',
    owner: 'wardley',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addPipeline',
    labelFallback: 'Pipeline',
    scope: 'edgeless',
    defaultKeys: { mac: ['w', 'p'], other: ['w', 'p'] },
  },
  {
    id: 'wardley.linkTool',
    owner: 'wardley',
    labelKey: 'com.labre.keyboardShortcuts.wardley.linkTool',
    labelFallback: 'Link',
    scope: 'edgeless',
    defaultKeys: { mac: ['w', 'l'], other: ['w', 'l'] },
  },
  {
    id: 'wardley.evolutionArrow',
    owner: 'wardley',
    labelKey: 'com.labre.keyboardShortcuts.wardley.evolutionArrow',
    labelFallback: 'Arrow (evolution)',
    scope: 'edgeless',
    defaultKeys: { mac: ['w', 'e'], other: ['w', 'e'] },
  },
  {
    id: 'wardley.addInertia',
    owner: 'wardley',
    labelKey: 'com.labre.keyboardShortcuts.wardley.addInertia',
    labelFallback: 'Inertia',
    scope: 'edgeless',
    defaultKeys: { mac: ['w', 'i'], other: ['w', 'i'] },
  },
  {
    id: 'wardley.addPorter',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addPorter',
    labelFallback: "Porter's forces",
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.addAccelerator',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addAccelerator',
    labelFallback: 'Accelerator',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.addDecelerator',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addDecelerator',
    labelFallback: 'Decelerator',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.addAreaRect',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addAreaRect',
    labelFallback: 'Area (rectangle)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.addAreaPolygon',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.addAreaPolygon',
    labelFallback: 'Area (polygon)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.importOwm',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.importOwm',
    labelFallback: 'Import Wardley map (OWM)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.exportOwm',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.exportOwm',
    labelFallback: 'Export Wardley map (OWM)',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'wardley.importSvg',
    owner: 'wardley',
    labelKey: 'com.labre.commands.wardley.importSvg',
    labelFallback: 'Import SVG sketch',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
];
