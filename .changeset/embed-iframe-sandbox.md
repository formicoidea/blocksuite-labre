---
'@labre/affine-block-embed': patch
'@labre/affine-shared': patch
---

An embedded iframe is sandboxed: a known provider gets `allow-same-origin allow-scripts allow-forms allow-presentation` and may widen it through its `sandbox` option, while an arbitrary url only gets `allow-scripts`. A stored url that is not http(s) shows the error card instead of reaching the iframe `src`, and opening the original link no longer hands the opener to the target page.
