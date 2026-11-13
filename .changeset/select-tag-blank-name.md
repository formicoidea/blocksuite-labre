---
'@labre/affine-database-engine': patch
---

A select or multi-select option whose name is empty or blank is now drawn as "Untitled" (new key `com.labre.data-view.tag.untitled`) in cells, in the tag menu (where typing it finds the option) and as a kanban group title, which keeps its height and opens its rename menu again. Display only: the stored option name is not changed. Hosts with their own catalogue add the new key (#657).
