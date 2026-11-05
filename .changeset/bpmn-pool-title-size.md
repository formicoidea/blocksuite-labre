---
'@labre/affine': minor
---

A BPMN pool's toolbar now offers two size dropdowns: "Pool title size" (13, 15, 18, 24, 32) and "Lane title size" (11, 13, 15, 18, 24, shown when the pool has lanes). The choice is stored in two new optional element fields, `nameFontSize` and `laneFontSize`, absent by default: a pool whose author picks nothing stays byte-identical and paints at 15 / 13 as before, and an older client ignores the keys (ADR 0049). The title bands thicken to hold a larger title, and the rename target follows. The framework-background primitive gains an optional `sizeProp` on a declared text and on an instance's zone label, read through `backgroundSizedStyle`. The `.bpmn` export does not carry the sizes. Two new chrome keys for the host catalogue: `com.labre.bpmn.toolbar.poolTitleSize` and `com.labre.bpmn.toolbar.laneTitleSize`.
