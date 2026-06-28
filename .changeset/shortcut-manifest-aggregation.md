---
'@labre/affine': minor
'@labre/affine-block-root': patch
---

Add `getShortcutManifest(flags)` (#30, phase 2): the enumerable, framework-aware
shortcut manifest for a host "Shortcuts" settings panel. It returns the core
shortcuts plus the shortcuts contributed by the currently-enabled frameworks
(flag-gated like `getInternalViewExtensions`), as metadata-only entries (no
runtime handler). Enumerable without an editor instance. Exposed at
`@labre/affine/shortcuts`. The per-framework contribution seam is ready
(`coreShortcuts` is now exported from the root block); no framework ships
shortcuts yet, so the manifest currently returns core only.
