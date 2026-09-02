---
'@labre/affine-gfx-wardley': minor
---

feat(edgeless): W A creates an anchor, W E the evolution arrow

Two Wardley default chords moved (staging recette of 2026-09-02, retour n°12):
press `w`, then `a` to place an **anchor** — the letter every tester reached
for — and `w`, then `e` for the **evolution arrow**, which had held `w a` since
the chords first shipped in 0.30.0. Every other Wardley chord is unchanged:
`w c` component, `w m` method, `w p` pipeline, `w l` link, `w i` inertia,
`w b` background.

Command ids and label keys are untouched, so a host's persisted override table
and its translations keep resolving; a host that lists the defaults (Settings ›
Shortcuts) reads the new pair from `./commands-manifest` as before. The anchor
was keyless until now, so Wardley ships eight default-bound chords instead of
seven.
