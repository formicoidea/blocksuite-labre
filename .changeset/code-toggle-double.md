---
'@labre/affine-components': patch
'@labre/affine-block-code': patch
---

The Wrap and Line number switches of the code block's "more" menu flip their setting once, whether the user clicks the switch or the row, and the switch always shows the stored value (#660, upstream toeverything/AFFiNE#15782). `<toggle-switch>` now keeps its click to itself (a row holding one no longer receives it), reads the new value from its checkbox and binds it as a property; a host that relied on a switch's click reaching an enclosing element must listen to `onChange` instead.
