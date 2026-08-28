---
'@labre/affine': patch
---

test(blocks): the image adapter snapshot suites stop racing the vite cache

The `image` cases of the html and markdown adapter suites failed on every cold
vite transform cache and passed on every warm one — the first test to pull a
lazily-imported chunk paid the whole transform cost against a `testTimeout` of
1000 ms that assumed a warm, idle machine. The package's test timeout is now
10 s, the same budget the other heavy view packages (`affine-components`, the
toolbar widgets, the gfx template) already use for the same reason. Test
configuration only; no runtime behaviour changes.
