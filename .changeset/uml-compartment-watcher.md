---
'@labre/affine-gfx-uml': minor
---

feat(edgeless): a UML classifier grows to fit what is typed into its compartments. Until now a class box was laid out from its rectangle alone — a name line, three attribute lines, and the operations taking the rest (§11.4.4) — so a fourth attribute was drawn straight over the separator under it. `UmlCompartmentWatcher` measures the tiers when an edit commits (the moment the text editor lets go, never between keystrokes), grows the node to the height the stack now needs and moves the three texts to the compartments that height yields, in one undo entry. The node renderer reads its separators off the tiers, so a rule is always drawn between the compartments as they are. The height only ever goes up: a box dragged taller was dragged taller for the operations, and nothing reclaims it. Registered always-on, like `C4TypeLineWatcher` — it creates nothing and keeps words already in the document readable with the UML button off (`docs/adr/0009`).
