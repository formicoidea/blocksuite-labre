---
'@labre/affine-block-table': patch
'@labre/affine-block-divider': patch
'@labre/affine-block-embed': patch
'@labre/affine-shared': patch
'@labre/affine-database-engine': patch
---

The table, the divider, the embed iframe and the database's `uni-lit` no longer
write a `style` text: a host page whose policy has no `style-src-attr` (the
read-only canvas viewer on Labre Sites, #668) raised a report for the table's
`display: contents` and dropped the divider's 24px child indent and the embed's
rounded corners. They now go through `styleMap`, one CSSOM property at a time.
`IframeOptions.style` (`@labre/affine-shared/services`) widens to
`string | StyleInfo`: the built-in providers give an object, a host config that
still gives a string is split into its declarations and keeps working.
