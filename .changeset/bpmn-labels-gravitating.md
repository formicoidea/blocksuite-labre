---
'@labre/affine-gfx-bpmn': minor
'@labre/affine-shared': minor
---

BPMN symbols now carry their name where it can be read. Events, gateways, data
objects and data stores are drawn with their name as a separate text centred
under the symbol, grouped with it — as BPMN draws them — instead of squeezed
inside a 56-unit ring or a 72-unit diamond; a new one is seeded with the name of
its type ("Start event", "Exclusive gateway"…), under the new keys
`com.labre.bpmn.seed.<kind>` for hosts to translate. Double-click the text to
rename it; morphing the group changes the symbol and keeps a name you typed.
Activities (task, user task, service task, sub-process, call activity) are
drawn 1.5× larger, 180×108, so their inscribed name fits at 18 units. BPMN
nodes also get the shape toolbar. `.bpmn` import and export read and write the
grouped name; documents drawn before this change are not migrated and keep
painting, editing and exporting their inner text.

New framework rule R38 (ADR 0029): a label is inscribed only when "Hello World"
at 18 units fits the symbol at its creation size, otherwise it gravitates.
`fitsInscribedLabel` in `@labre/affine-shared/utils` is the fit test.
