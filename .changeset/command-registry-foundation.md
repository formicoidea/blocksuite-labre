---
'@labre/affine': minor
---

One command registry behind every surface (PF3)

Every framework artefact is now declared exactly once, as a `CommandDescriptor`
in `@labre/std`. The senior button sub-menu, the keyboard bindings and
Settings › Shortcuts all read that one list instead of each keeping their own
— which is how Wardley's menu had drifted to 13 artefacts against 7 in the
shortcut manifest, and how EDGY, BPMN, Cynefin/Estuarine and the three DDD
palettes were completely absent from Settings › Shortcuts. See
`docs/adr/0008`.

60 framework commands were converted in one release (wardley 13, edgy 7, bpmn
6, cynefin-estuarine 3, ddd-event-storming 9, ddd-core-domain 10,
ddd-context-map 12), plus the 6 core ones.

**What users see.** Settings › Shortcuts grows from ~10 rows to 66: every
command is listed and bindable, including the ~53 that ship with no default
chord. The effective keymap is unchanged — the same combos trigger the same
actions, and existing override tables keep working (a golden test compares the
resolved keymap per scope against the pre-switchover one). Cynefin/Estuarine
starts reporting telemetry, which it never did.

**What hosts must change.**

1. `ShortcutManifestEntry` changes shape. It still describes shortcuts and
   nothing else — no `iconKey`, no `category` — but `when?: string` is gone (no
   descriptor in the library ever set it), `defaultKeys` is always present, and
   `owner` narrows from `string` to `CommandOwner`. Recompile; nothing changes
   at runtime.

2. Framework bundles' `descriptor.ts` renames `telemetry` to `telemetryKey`,
   which now carries the historical analytics value in every case (it used to
   echo the flag key, so the three DDD bundles advertised a value the library
   never sent):

   ```diff
   - import { dddEventStormingFramework } from '@formicoidea/labre-framework-ddd-event-storming/descriptor';
   - registerFramework(dddEventStormingFramework.telemetry);   // 'ddd-event-storming'
   + registerFramework(dddEventStormingFramework.telemetryKey); // 'event-storming'
   ```

3. Menu tooltips are i18n keys now (`com.labre.commands.<id>`). Each command
   also ships the English wording it replaced as a fallback, so a host with no
   catalogue entry reads exactly as before — but a host that wants them
   localised must extend its catalogue with the new keys. **No existing key was
   renamed**: `com.affine.keyboardShortcuts.*` and the seven
   `com.labre.keyboardShortcuts.wardley.*` are carried over verbatim.

4. New entry points: `@labre/affine/commands` (`getCommands`,
   `getCommandManifest`, `getCommandManifestForSurface`) and
   `@labre/affine/frameworks` (`FRAMEWORK_DESCRIPTORS` — per-framework label,
   icon, chord prefix, analytics keys and packaging, the identity that was
   previously spelled five times and had drifted).

**Analytics are unaffected.** The per-menu `track()` helpers are gone; emission
happens once, in the registry's `run()`. `framework` and `segment` keep their
historical PostHog values through `FrameworkDescriptor.telemetryKey` /
`telemetrySegment`, and events gain one field — `control`, naming which surface
invoked the command. Existing dashboards keep working untouched.

Two small behaviour changes worth naming: `undo` / `redo` now consume their
keystroke (they are the only handler bound to it, so nothing else was reading
it), and disabling a framework's flag now removes its commands from the
registry, the keymap and the sub-menu at once, while its already-drawn elements
keep painting as before.
