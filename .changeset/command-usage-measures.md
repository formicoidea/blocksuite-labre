---
'@labre/std': patch
'@labre/affine-shared': patch
'@labre/affine': patch
---

feat(std): runCommand feeds an injectable usage store

The editor now measures how recently and how often each command was invoked,
and exposes the seam a host needs to persist those measures itself.

`runCommand` — already the one place a command runs and the one place its
telemetry is emitted — records every invocation into `CommandUsageIdentifier`.
Every invocation, not every instrumented one: the call sits outside the
telemetry condition, so core actions, toggles and the self-emitting commands
are counted like the rest. Telemetry leaves for a dashboard; usage is local
state the editor reads back, and the sub-menu that will show a framework's
seven most relevant commands has to rank artefacts nobody thought to
instrument.

The default store keeps the pair of numbers in this browser's `localStorage`,
capped and best-effort: a browser refusing storage costs a measure, never a
command. A host that owns per-user state replaces it wholesale with
`CommandUsageExtension(store)`, so the ranking follows the user from laptop to
tablet instead of restarting at zero.

Measurement only — nothing ranks anything yet, and no menu changes.
