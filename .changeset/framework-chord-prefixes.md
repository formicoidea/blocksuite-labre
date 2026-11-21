---
'@labre/affine': minor
'@labre/affine-shared': minor
'@labre/std': minor
'@labre/affine-gfx-bpmn': minor
'@labre/affine-gfx-uml': minor
'@labre/affine-gfx-edgy': minor
'@labre/affine-gfx-cynefin-estuarine': minor
'@labre/affine-gfx-ddd-core-domain': minor
'@labre/affine-gfx-ddd-context-map': minor
'@labre/affine-gfx-ddd-event-storming': minor
'@labre/affine-gfx-c4': minor
'@labre/affine-gfx-template': minor
'@labre/affine-block-frame': minor
'@labre/affine-gfx-wardley': minor
---

Framework chord prefixes beside Wardley's `w` (ADR 0055). Forty-seven
framework commands that shipped keyless gain a default chord on the canvas:
BPMN `b` (`b p` pool, `b s` start event, `b e` end event, `b t` task, `b u`
user task, `b v` service task, `b o` sub-process, `b c` call activity, `b x`
exclusive gateway, `b a` parallel gateway, `b d` data object, `b n` text
annotation); UML `u` (`u d` diagram, `u c` class, `u i` interface, `u e`
enumeration, `u p` package, `u a` actor, `u o` use case, `u s` subject);
Cynefin / Estuarine `y` (`y c` Cynefin framework, `y e` Estuarine map, `y h`
hexagon); EDGY `g` (`g b` board, `g p` People, `g o` Outcome, `g j` Object,
`g a` Activity); DDD `d`, shared by two boards (Core Domain Chart: `d c`
chart, `d g` big-bet, `d p` platform, `d o` outsourced, `d n` bounded context,
`d f` future position; Context Map: `d m` board, `d b` bounded context, `d s`
cloud / system); Event Storming `o` (`o b` board, `o e` domain event, `o c`
command, `o a` aggregate, `o u` actor, `o i` constraint, `o p` policy, `o r`
read model, `o s` external system, `o h` hotspot). C4 has none. Every Wardley
chord is unchanged.

`l` on the canvas opens the Templates panel, as a click on its toolbar button
does, with the caret in its search field (new command `canvas.templates.toggle`,
edgeless scope, overridable, listed by `getShortcutManifest()`; label: the
existing `com.labre.template.senior-tool.name` key, no new wording). `l` again,
the focus outside the field, closes it; Escape in the panel closes it and gives
the focus back to the canvas. It does nothing while a canvas element is edited,
on a read-only board and in a presentation. `EdgelessTemplateButton` gains
`togglePanel({ focusSearch })` and `EdgelessTemplatePanel` `focusSearch()`.
The template cards are still not reachable from the keyboard.

What your users will notice on the canvas. The letters `b`, `u`, `g`, `y`, `d`
and `o`, which did nothing alone, now arm a chord for 1.2 s, as `w` always
has: the next letter places an artefact when it is a second key of that
prefix, and is swallowed otherwise. So a prefix then a tool letter no longer
switches the tool: `b` then `t` places a BPMN task instead of picking the Text
tool, `b` then `h` does nothing instead of picking the hand, `w` then `l` arms
the Wardley link tool rather than opening the Templates panel (ADR 0055 § 5
has the table for every prefix). Every printable character after a prefix
stays in its namespace, so the canvas's own printable shortcuts are swallowed
there too: `Shift+P` (highlighter), `Shift+S` (shape cycle), `-` (note
slicer), `@` (link), digits and punctuation. Named keys, Space and modified
keys are handed on, now for `w` too: after a prefix, Delete, Backspace,
Escape, Enter, Tab, the arrows, Space and any Ctrl / Meta / Alt combination
(Ctrl+Z, Ctrl+D) do exactly what they do without it, where they used to be
swallowed for 1.2 s after `w`. The shared `d` follows the two DDD flags: with
one board off, its letters after `d` are swallowed and the other board's
still place; with both off, `d` arms nothing. A key held after completing a
chord no longer auto-repeats into its own tool (`b` then `p` held used to
place the pool and then pick the Pen tool), for `w` too. With Caps Lock on, no
prefix arms (as for `w` before).

In a read-only document, during a presentation, and while a canvas element is
in edit mode (a text, a polygon's vertices), no prefix arms and no chord runs:
a chord used to throw "Cannot add element in readonly mode" (`w c` included),
and during a presentation `w c` and the new chords wrote into the document
and left the presentation; now each letter does what it does alone there.
`availability: 'editable'` now also means "not presenting": a tool declaring
the new `BaseTool.presents` (`PresentTool` does) makes every `'editable'`
command unavailable, imports included. Every framework
artefact and tool command now declares `availability: 'editable'` instead of
`'always'`, in `getCommandManifest()` too: a host surface that honours
`availability` withdraws them from a read-only document.

Nothing persisted changes: no command id and no `labelKey` moved, only
`defaultKeys` went from empty to a chord, in `getShortcutManifest()`, in
`getCommandManifest()` and in each framework bundle's `./commands-manifest`. A
user's override on any of these ids keeps winning. An override that already
put another command on one of the new chords conflicts with the default:
`resolveKeymap` binds the first registered and reports the conflict to
`ShortcutConflictReporter`, or only to the console when the host registers
none. `FrameworkDescriptor.chordPrefix` is now set for every framework but
`c4`. `@labre/affine-shared/utils` exports `frameworkChord`, the helper the
frameworks build their chords with; `@labre/std` exports `ChordBinding`, a
keymap handler that may say whether it can run (`canRun`), which
`toShortcutDescriptor` now provides. No new displayed string: the French
catalogue needs nothing.
