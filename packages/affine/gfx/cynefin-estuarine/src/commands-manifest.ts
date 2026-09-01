import type { ShortcutManifestEntry } from '@labre/std';

/**
 * The Cynefin / Estuarine commands as SHORTCUT-MANIFEST rows — id, label, chord, scope,
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
 * row-for-row equality with `toShortcutManifestEntry` over {@link cynefinEstuarineCommands},
 * so this file cannot drift from the commands it projects. Add a command and
 * the test says exactly what to add here.
 */
export const cynefinEstuarineCommandsManifest: ShortcutManifestEntry[] = [
  {
    id: 'cynefin-estuarine.addCynefin',
    owner: 'cynefin-estuarine',
    labelKey: 'com.labre.commands.cynefin-estuarine.addCynefin',
    labelFallback: 'Cynefin framework',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'cynefin-estuarine.addEstuarineMap',
    owner: 'cynefin-estuarine',
    labelKey: 'com.labre.commands.cynefin-estuarine.addEstuarineMap',
    labelFallback: 'Estuarine map',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
  {
    id: 'cynefin-estuarine.addConstraintHexagon',
    owner: 'cynefin-estuarine',
    labelKey: 'com.labre.commands.cynefin-estuarine.addConstraintHexagon',
    labelFallback: 'Hexagon node',
    scope: 'edgeless',
    defaultKeys: { mac: [], other: [] },
  },
];
