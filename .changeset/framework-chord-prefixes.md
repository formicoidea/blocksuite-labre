---
'@labre/affine': minor
'@labre/affine-shared': minor
'@labre/affine-gfx-bpmn': minor
'@labre/affine-gfx-uml': minor
'@labre/affine-gfx-edgy': minor
'@labre/affine-gfx-cynefin-estuarine': minor
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-ddd-context-map': minor
'@labre/affine-gfx-wardley': patch
---

Framework chord prefixes beside Wardley's `w` (ADR 0055). Thirty-seven
framework commands that shipped keyless gain a default chord on the canvas:
BPMN `b` (`b p` pool, `b s` start event, `b e` end event, `b t` task, `b u`
user task, `b v` service task, `b o` sub-process, `b c` call activity, `b x`
exclusive gateway, `b a` parallel gateway, `b d` data object, `b n` text
annotation); UML `u` (`u d` diagram, `u c` class, `u i` interface, `u e`
enumeration, `u p` package, `u a` actor, `u o` use case, `u s` subject);
Cynefin / Estuarine `y` (`y c` Cynefin framework, `y e` Estuarine map, `y h`
hexagon); EDGY `g` (`g b` board, `g p` People, `g o` Outcome, `g j` Object,
`g a` Activity); DDD `d`, shared by the two boards (Core Domain Chart: `d c`
chart, `d g` big-bet, `d p` platform, `d o` outsourced, `d n` bounded context,
`d f` future position; Context Map: `d m` board, `d b` bounded context, `d s`
cloud / system). Event Storming has no chord: the requested `t` is the Text
tool, and a letter is awaiting a product decision. C4 has none. Every Wardley
chord is unchanged.

Nothing persisted changes: no command id and no `labelKey` moved, only
`defaultKeys` went from empty to a chord, in `getShortcutManifest()`, in
`getCommandManifest()` and in each framework bundle's `./commands-manifest`.
A user's override on any of these ids keeps winning; an override that already
put another command on one of the new chords is reported as a conflict by
`ShortcutConflictReporter`. `FrameworkDescriptor.chordPrefix` is now set for
`bpmn`, `uml`, `cynefin-estuarine`, `edgy`, `ddd-core-domain` and
`ddd-context-map`. `@labre/affine-shared/utils` exports `frameworkChord`, the
helper the frameworks build their chords with. No new displayed string: the
French catalogue needs nothing.
