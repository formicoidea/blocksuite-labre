---
'@labre/store': patch
---

Opening a document no longer slows down quadratically with its size when the store uses the default query: a loose query that cannot hide any block now skips the ancestor walk that ran for every loaded block (#507). Measured on the store's own fixture, opening a 3000-block document drops from about 5.2 s to under 0.1 s. A store opened with a query that hides blocks keeps the previous behaviour and cost.
