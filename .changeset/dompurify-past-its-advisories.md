---
'@labre/affine-block-root': patch
'@labre/affine-block-surface': patch
'@labre/affine-shared': patch
'@labre/std': patch
---

Raise the floor of the shipped `dompurify` to `^3.4.13`, the smallest version
clear of its five open advisories (up to GHSA-55q2-fjhq-7xh7, an XSS through a
detached subtree). No behaviour change in a browser.
