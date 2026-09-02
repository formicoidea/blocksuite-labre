/**
 * FROZEN on `blocksuite-labre-main` (commit fad4c0817), BEFORE the PF3
 * switchover, from the then-current declarations: `coreShortcuts` +
 * `shapeShortcuts` + `wardleyShortcuts`.
 *
 * `declarations` is what each id declared; `bindings` is the combo -> id map
 * `resolveKeymap` actually installed, PER PLATFORM and per scope. Both
 * platforms are frozen because they genuinely differ: `redo-windows` ships
 * `mac: []`, so the mac global scope binds two combos where Windows/Linux bind
 * three. A golden that only froze the host's own platform would pass on CI and
 * fail on a maintainer's Mac.
 *
 * Regenerating this file defeats its purpose: it exists so a user's persisted
 * v0.29 override table keeps resolving to the same action after the switchover
 * (docs/adr/0008).
 *
 * AMENDED 2026-09-02 (labre#538, staging recette retour n°12) — one deliberate
 * default-keymap change, not a regeneration: `w a` now creates an ANCHOR
 * (`wardley.addAnchor`, keyless until then) and the evolution arrow moved to
 * `w e`. Ids are unchanged, so a persisted override table still resolves; only
 * these two defaults moved. Anything else in this file drifting is still a
 * regression.
 */
export const KEYMAP_GOLDEN = {
  declarations: [
    {
      id: 'applyLastStyle',
      owner: 'core',
      scope: 'edgeless',
      mac: ['Mod-y'],
      other: ['Mod-y'],
    },
    {
      id: 'duplicate',
      owner: 'core',
      scope: 'edgeless',
      mac: ['Mod-d'],
      other: ['Mod-d'],
    },
    {
      id: 'redo',
      owner: 'core',
      scope: 'global',
      mac: ['Shift-Mod-z'],
      other: ['Shift-Mod-z'],
    },
    {
      id: 'redo-windows',
      owner: 'core',
      scope: 'global',
      mac: [],
      other: ['Control-y'],
    },
    {
      id: 'shape.cycleTextFit',
      owner: 'core',
      scope: 'edgeless',
      mac: ['Mod-Shift-f'],
      other: ['Mod-Shift-f'],
    },
    {
      id: 'undo',
      owner: 'core',
      scope: 'global',
      mac: ['Mod-z'],
      other: ['Mod-z'],
    },
    {
      id: 'wardley.addAnchor',
      owner: 'wardley',
      scope: 'edgeless',
      mac: ['w', 'a'],
      other: ['w', 'a'],
    },
    {
      id: 'wardley.addBackground',
      owner: 'wardley',
      scope: 'edgeless',
      mac: ['w', 'b'],
      other: ['w', 'b'],
    },
    {
      id: 'wardley.addComponent',
      owner: 'wardley',
      scope: 'edgeless',
      mac: ['w', 'c'],
      other: ['w', 'c'],
    },
    {
      id: 'wardley.addInertia',
      owner: 'wardley',
      scope: 'edgeless',
      mac: ['w', 'i'],
      other: ['w', 'i'],
    },
    {
      id: 'wardley.addMethod',
      owner: 'wardley',
      scope: 'edgeless',
      mac: ['w', 'm'],
      other: ['w', 'm'],
    },
    {
      id: 'wardley.addPipeline',
      owner: 'wardley',
      scope: 'edgeless',
      mac: ['w', 'p'],
      other: ['w', 'p'],
    },
    {
      id: 'wardley.evolutionArrow',
      owner: 'wardley',
      scope: 'edgeless',
      mac: ['w', 'e'],
      other: ['w', 'e'],
    },
    {
      id: 'wardley.linkTool',
      owner: 'wardley',
      scope: 'edgeless',
      mac: ['w', 'l'],
      other: ['w', 'l'],
    },
  ],
  bindings: {
    mac: {
      global: {
        'Mod-z': 'undo',
        'Shift-Mod-z': 'redo',
      },
      page: {},
      edgeless: {
        'Mod-d': 'duplicate',
        'Mod-y': 'applyLastStyle',
        'Mod-Shift-f': 'shape.cycleTextFit',
        'w c': 'wardley.addComponent',
        'w l': 'wardley.linkTool',
        'w a': 'wardley.addAnchor',
        'w e': 'wardley.evolutionArrow',
        'w i': 'wardley.addInertia',
        'w p': 'wardley.addPipeline',
        'w m': 'wardley.addMethod',
        'w b': 'wardley.addBackground',
      },
    },
    other: {
      global: {
        'Mod-z': 'undo',
        'Shift-Mod-z': 'redo',
        'Control-y': 'redo-windows',
      },
      page: {},
      edgeless: {
        'Mod-d': 'duplicate',
        'Mod-y': 'applyLastStyle',
        'Mod-Shift-f': 'shape.cycleTextFit',
        'w c': 'wardley.addComponent',
        'w l': 'wardley.linkTool',
        'w a': 'wardley.addAnchor',
        'w e': 'wardley.evolutionArrow',
        'w i': 'wardley.addInertia',
        'w p': 'wardley.addPipeline',
        'w m': 'wardley.addMethod',
        'w b': 'wardley.addBackground',
      },
    },
  },
} as const;
