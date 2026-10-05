---
'@labre/affine-shared': patch
---

Building the library from source in a CRLF checkout no longer fails with
thousands of TS1005 errors in the generated `editor-setting-service.d.ts`: the
comment on the `edgelessShowGrid` editor setting is now a line comment, which
TypeScript's declaration emit cannot splice into an unrelated type. The
setting and its behaviour are unchanged.
