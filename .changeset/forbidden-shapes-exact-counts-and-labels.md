---
'@labre/affine-block-surface': patch
---

feat(blocks): a forbidden shape of degree, a count that does not descend, and a family that reads words

Three more capabilities in the validation engine, from a triangulation against
the reference process linters. Two are fields on families that already exist;
the third is the first brick of the PRD's _étiquetage_ family.

**`edge-degree.forbidPattern`** — a FORBIDDEN ZONE, declared as the bounds a
subject must not all satisfy at once. The inverse polarity of every other bound:
it fires when the node matches all of them rather than when it misses one. Two
shapes want exactly that and neither is a floor or a ceiling — an artefact that
merges AND splits at the same time is ambiguous although each half alone is
fine, and an artefact that does NEITHER is superfluous although a ceiling on
either side alone would forbid the legitimate case. It carries its own words,
because a forbidden zone is not a bound that failed and never reads like one, and
a pattern with no bound in it (which every node matches) is dropped with a
warning rather than indicting the board.

**`role-count.exact`** — count the elements whose role IS the subject, without
descending into its specialisations. The descending default is right when the
requirement is about the family: "one beginning" means one beginning of any kind,
and a new variant inherits the rule for free. It is wrong when the requirement is
about the PLAIN member as distinct from its qualified siblings — "at most one
unqualified beginning" is a statement about the artefact carrying no qualifier,
and under the descending reading it cannot be written at all. The guard keeps
descending, deliberately: asking "is there one of these at all" is a question
about the family whatever the bound beside it counts.

**`label-presence`** — a new family, and the first that reads an element's
WORDS. Every other one asks about geometry, roles or relations, all of which a
reader can partly infer from the drawing; a box with nothing written in it is the
one defect nothing recovers. Absent means no text, empty text, whitespace, or
invisible code points alone — an artefact named with a zero-width space looks
unnamed and would otherwise validate as named, which is the worst of both.

Naming is the one property a user changes by typing, so `text` becomes
verdict-bearing only for a framework that registers a REAL-TIME rule of that
family. A rule declared on-demand costs the drawing path nothing at all; a
real-time one wakes the debounced evaluation on every keystroke. Both are
supported, and which one a framework wants is a decision it makes in its own
declaration.
