---
'@labre/affine-block-surface': minor
'@labre/affine-gfx-wardley': minor
'@labre/affine-shared': minor
'@labre/affine': minor
'@labre/std': minor
---

feat(edgeless): map quality — a checklist you tick and a check-up you ask for (PF5.14, PF7.10, PF7.11, PF13.8, PF13.9)

A rule only belongs in the real-time engine if an algorithm can decide it, on
persisted data, inside the 16 ms budget. Everything else was homeless. This
slice gives it a home: a **Map quality** panel on the framework's own instance,
with the things the tool cannot judge on one side and the things it can — but
that are not urgent — on the other.

- **A check-up is about ONE map.** It walks the whole surface — that is where
  the elements are — but the answer is narrowed to the instance the user asked
  about, on the `backgroundId` every family measuring against a frame already
  records. A board carrying two Wardley maps holds two independent answers, and
  a panel showing the neighbour's would be the whole-surface tally the majority
  family goes out of its way not to compute. Narrowed in the engine, not at the
  rendering, so a run reaching a host or the agent is already about one map; the
  run names its instance, and the panel refuses one that is not its own.
- **A second evaluation moment.** A rule now carries `moment: 'realtime'`
  (the default, and what every rule written so far means) or `'on-demand'`. An
  on-demand rule is not filtered out of the drawing path, it never enters it:
  the moment is tested before the rule reaches a profile lookup, let alone an
  element. Its results land on `ValidationManager.checkup$`, a signal of its
  own — so they never reach the timeline, the bracket or the badge, and "outside
  the canvas affordance" is a property of the wiring rather than a filter
  somebody has to remember. A run carries one timestamp, taken when the user
  asked, and yields the thread between rules once it has held it for a frame,
  reporting `done / total` as it goes. A run started while another is still
  yielding supersedes it. A rule that throws ends the run _visibly_ — reported
  finished, carrying `error` — because the one thing a failure must not do is
  leave the panel believing a check-up is in flight, which reads as "Checking…"
  for ever and disables the only button that could try again.
- **Nudges: expectations the tool cannot check, and does not pretend to.** A
  framework declares them as data — `{ id, framework, labelKey, fallback }` —
  and nothing ever evaluates them. They are offered as a checklist, and ticking
  one is the same gesture as granting an exception: the user says "I have taken
  care of this", and the tool records that rather than claiming to have looked.
- **One entry, in the dropdown that was built for it.** PF9's Validation
  dropdown was written to render SECTIONS and shipped with one; Map quality is
  the second. It opens a panel — four boxes to tick, a **Run check-up** button
  and the remarks that come back — because a menu that closes on the first click
  is the wrong shape for a surface you work in. The same panel is reachable from
  the command registry (`validation.mapQuality`, palette and agent), so it is
  one command with several surfaces rather than two implementations.
- **Generic, not Wardley.** Nothing in the panel, the entry or the command names
  a framework, a role or a rule. Whether an instance has a checklist or a
  check-up is derived from what the frameworks registered, exactly as the
  profile picker already derives which profiles it may offer. A second framework
  declaring either gets all of it with no code written anywhere.
- **Wardley Q1–Q4** ship as data: the title that frames the study, the context,
  the legend, the evolution axis being used and legended. Four things a map needs
  in order to be discussed, and not one of them decidable by a machine.
- **Wardley Q5 — the tone convention.** A new `tone-convention` rule family: the
  landscape is drawn in greys, red is reserved for what is moving and green for
  benefits. The sanctioned tones are named against the frame's OWN declared
  palette (three new entries: `landscape`, `change`, `benefit`), so a rule
  restates no colour the background owns and a host restyling the frame restyles
  the convention with it. The comparison is by tone family, never byte for byte,
  or every legitimate shade of grey the shape toolbar can produce would be a
  finding. A colour the engine cannot honestly read — a theme variable with no
  tone in its name, a gradient, `transparent`, the stored fill of an unfilled
  shape — yields silence rather than a guess.
- **Wardley Q6 — shipped inert, on purpose.** "Most of what you have mapped is
  an activity; the phase names for activities would read better" needs the
  type-3 **nature**, and nothing writes it yet. The new `majority-fact` family
  is built for exactly that: a surface where not one subject carries the fact
  raises nothing, silently, per map. So the rule ships today, costs a walk on a
  check-up somebody asked for, and starts working by itself the day the field
  lands — no flag, no `TODO`, and a test that documents both halves of the
  condition.

Two new telemetry events, `MapQualityNudgeToggled` and `MapQualityCheckupRun`,
carry the framework, the nudge id and the counts — never board content. A nudge
everybody ticks immediately is a reminder nobody needed; a nudge nobody ever
ticks is an expectation the tool failed to make actionable. Nothing else can say
either, because nothing here is ever computed.

**Persistence.** One new optional `@field()` on the base element model,
`qualityChecklist: string[]` — the ids ticked on the instance. Declared on the
BASE class for the same reason `role`, `validationExceptions` and
`validationProfile` are: an element re-created from props only reaches the Y.Map
through declared accessors, so a per-subclass declaration would be silently
dropped on copy. Its default is `undefined` and is never written, so an instance
with nothing ticked stays byte-identical to one created before the field
existed: no block schema change, no version bump, no migration, and documents
written before and after remain mutually loadable. Unticking the last one removes
the KEY through `clearField` rather than leaving an empty array behind, so an
emptied checklist is byte-identical again too — in the document, and not merely
through the getter. Ids of nudges no framework declares any more are kept rather
than pruned: the tooling comes and goes with a flag, the decisions recorded on it
do not. `setNudgeChecked` enforces read-only itself, at the seam, like
`setProfile` and `setException` do: a disabled checkbox covers exactly one
caller, and `clearField` goes through `Store.transact`, which — unlike
`addBlock` / `updateBlock` / `deleteBlock` — carries no read-only guard of its
own, so unticking would genuinely delete the key from a document nobody may edit.

**Cost.** Measured, not asserted: registering the two Wardley check-up rules
beside the three real-time ones leaves both the verdict and the timing of the
drawing path unchanged on the 500-element reference map. The two timings are
measured on INTERLEAVED samples, because taken one after the other they compare
two moments in the runner's life as much as two rule sets — the same evaluation
drifts by half again between back-to-back medians, which is several times the
effect being looked for. That is the whole point of the second moment.
